// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";
import {BaseTemplate} from "./base/BaseTemplate.sol";
import {TemplateRegistry} from "./TemplateRegistry.sol";

/// @title InvoiceTemplate
/// @notice Receivable asset contract for invoices
/// @dev Supports financing via future marketplace integration
contract InvoiceTemplate is ITemplate, BaseTemplate {
    /// @notice Invoice data
    struct Invoice {
        uint256 invoiceId;
        address issuer;
        address payer;
        uint256 amount;
        uint256 dueDate;
        InvoiceState state;
        uint256 agreementId; // Optional link to AgreementTemplate
        uint256 financedAt;
        address financier;
        bytes32 termsHash;
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Mapping from invoice ID to invoice data
    mapping(uint256 => Invoice) private _invoices;

    /// @notice Reentrancy guard for settleInvoice
    mapping(uint256 => bool) private _settling;

    /// @notice Total invoice count
    uint256 private _invoiceCount;

    /// @notice Allowed token
    address public immutable TOKEN;

    /// @notice Emitted when invoice is created
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed issuer,
        address indexed payer,
        uint256 amount,
        uint256 dueDate
    );

    /// @notice Emitted when invoice is accepted by payer
    event InvoiceAccepted(uint256 indexed invoiceId);

    /// @notice Emitted when invoice is financed
    event InvoiceFinanced(
        uint256 indexed invoiceId,
        address indexed financier
    );

    /// @notice Emitted when invoice is settled
    event InvoiceSettled(uint256 indexed invoiceId);

    /// @notice Emitted when invoice is defaulted
    event InvoiceDefaulted(uint256 indexed invoiceId);

    /// @notice Emitted when invoice is cancelled
    event InvoiceCancelled(uint256 indexed invoiceId);

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    /// @param registry Address of the TemplateRegistry contract
    /// @param verification Address of the VerificationRegistry contract
    /// @param token Address of the payment token (USDC)
    constructor(
        address reputation,
        address registry,
        address verification,
        address token
    ) BaseTemplate(reputation, registry, verification) {
        require(token != address(0), "InvoiceTemplate: token is zero address");
        TOKEN = token;
    }

    /// @notice Create a new invoice
    /// @param payer Address that will pay the invoice
    /// @param amount Invoice amount in token units
    /// @param dueDate Unix timestamp for payment deadline
    /// @param agreementId Optional link to AgreementTemplate
    /// @param termsHash IPFS hash of invoice terms
    /// @return invoiceId The new invoice ID
    function createInvoice(
        address payer,
        uint256 amount,
        uint256 dueDate,
        uint256 agreementId,
        bytes32 termsHash
    ) external returns (uint256 invoiceId) {
        require(payer != address(0), "InvoiceTemplate: payer is zero address");
        require(amount > 0, "InvoiceTemplate: amount must be positive");
        require(dueDate > block.timestamp, "InvoiceTemplate: dueDate must be in future");

        // Register deal in registry
        uint256 dealId = TemplateRegistry(REGISTRY).registerDeal(address(this), msg.sender);

        _invoiceCount++;
        invoiceId = _invoiceCount;

        _invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            issuer: msg.sender,
            payer: payer,
            amount: amount,
            dueDate: dueDate,
            state: InvoiceState.Created,
            agreementId: agreementId,
            financedAt: 0,
            financier: address(0),
            termsHash: termsHash,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit InvoiceCreated(invoiceId, msg.sender, payer, amount, dueDate);
    }

    /// @notice Accept an invoice (payer acknowledges obligation)
    /// @param invoiceId The invoice ID
    function acceptInvoice(uint256 invoiceId) external {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        require(msg.sender == _invoices[invoiceId].payer, 
            "InvoiceTemplate: caller is not payer");
        require(_invoices[invoiceId].state == InvoiceState.Created, 
            "InvoiceTemplate: invoice not in created state");

        _invoices[invoiceId].state = InvoiceState.Accepted;
        _invoices[invoiceId].updatedAt = block.timestamp;

        emit InvoiceAccepted(invoiceId);
    }

    /// @notice Mark invoice as financed by a third party
    /// @dev Used for marketplace/factoring integration
    /// @param invoiceId The invoice ID
    function financeInvoice(uint256 invoiceId) external {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        require(_invoices[invoiceId].state == InvoiceState.Accepted, 
            "InvoiceTemplate: invoice not accepted");
        require(msg.sender != _invoices[invoiceId].issuer && 
                msg.sender != _invoices[invoiceId].payer, 
            "InvoiceTemplate: financier must be third party");

        _invoices[invoiceId].state = InvoiceState.Financed;
        _invoices[invoiceId].financedAt = block.timestamp;
        _invoices[invoiceId].financier = msg.sender;
        _invoices[invoiceId].updatedAt = block.timestamp;

        // Update reputation for financier
        IReputation(REPUTATION).recordFinancedDeal(
            msg.sender, 
            _invoices[invoiceId].amount
        );

        emit InvoiceFinanced(invoiceId, msg.sender);
    }

    /// @notice Settle an invoice (pay the amount)
    /// @param invoiceId The invoice ID
    /// @param to Address to receive payment (issuer or financier)
    function settleInvoice(uint256 invoiceId, address to) external {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        require(msg.sender == _invoices[invoiceId].payer, 
            "InvoiceTemplate: caller is not payer");
        require(_invoices[invoiceId].state == InvoiceState.Accepted ||
                _invoices[invoiceId].state == InvoiceState.Financed, 
            "InvoiceTemplate: invoice not settleable");
        require(to != address(0), 
            "InvoiceTemplate: settlement address is zero");
        
        // Reentrancy guard
        require(!_settling[invoiceId], "InvoiceTemplate: reentrancy detected");
        _settling[invoiceId] = true;

        uint256 amount = _invoices[invoiceId].amount;
        address recipient;

        if (_invoices[invoiceId].state == InvoiceState.Financed) {
            // Pay the financier who advanced the funds
            recipient = _invoices[invoiceId].financier;
        } else {
            // Pay the issuer directly
            recipient = _invoices[invoiceId].issuer;
        }

        require(to == recipient, 
            "InvoiceTemplate: settlement must go to recipient");

        // Transfer tokens from payer to recipient
        IERC20(TOKEN).transferFrom(msg.sender, recipient, amount);

        _invoices[invoiceId].state = InvoiceState.Settled;
        _invoices[invoiceId].updatedAt = block.timestamp;

        // Update reputation for payer on successful settlement
        IReputation(REPUTATION).recordSuccessfulSettlement(
            _invoices[invoiceId].payer,
            amount
        );

        emit InvoiceSettled(invoiceId);
        
        _settling[invoiceId] = false;
    }

    /// @notice Mark invoice as defaulted (after due date)
    /// @param invoiceId The invoice ID
    function markDefault(uint256 invoiceId) external {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        require(_invoices[invoiceId].state == InvoiceState.Accepted ||
                _invoices[invoiceId].state == InvoiceState.Financed, 
            "InvoiceTemplate: invoice not outstanding");
        require(block.timestamp > _invoices[invoiceId].dueDate, 
            "InvoiceTemplate: not past due date");
        
        // Access control: only issuer or financier can mark as defaulted
        require(msg.sender == _invoices[invoiceId].issuer || 
                msg.sender == _invoices[invoiceId].financier,
            "InvoiceTemplate: not authorized to mark default");

        _invoices[invoiceId].state = InvoiceState.Defaulted;
        _invoices[invoiceId].updatedAt = block.timestamp;

        // Update reputation for payer
        IReputation(REPUTATION).recordDefault(_invoices[invoiceId].payer);

        emit InvoiceDefaulted(invoiceId);
    }

    /// @notice Cancel an invoice (issuer withdraws)
    /// @param invoiceId The invoice ID
    function cancelInvoice(uint256 invoiceId) external {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        require(msg.sender == _invoices[invoiceId].issuer, 
            "InvoiceTemplate: caller is not issuer");
        require(_invoices[invoiceId].state == InvoiceState.Created, 
            "InvoiceTemplate: invoice cannot be cancelled");

        _invoices[invoiceId].state = InvoiceState.Cancelled;
        _invoices[invoiceId].updatedAt = block.timestamp;

        emit InvoiceCancelled(invoiceId);
    }

    /// @notice Get invoice data
    /// @param invoiceId The invoice ID
    /// @return invoice The invoice data struct
    function getInvoice(uint256 invoiceId) external view returns (Invoice memory invoice) {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        return _invoices[invoiceId];
    }

    /// @notice Get invoices by issuer
    /// @param issuer The issuer address
    /// @return invoiceIds Array of invoice IDs
    function getInvoicesByIssuer(address issuer) external view returns (uint256[] memory invoiceIds) {
        uint256 count;
        for (uint256 i = 1; i <= _invoiceCount; i++) {
            if (_invoices[i].issuer == issuer) {
                count++;
            }
        }

        invoiceIds = new uint256[](count);
        uint256 index;
        for (uint256 i = 1; i <= _invoiceCount; i++) {
            if (_invoices[i].issuer == issuer) {
                invoiceIds[index++] = i;
            }
        }
    }

    /// @notice Get invoices by payer
    /// @param payer The payer address
    /// @return invoiceIds Array of invoice IDs
    function getInvoicesByPayer(address payer) external view returns (uint256[] memory invoiceIds) {
        uint256 count;
        for (uint256 i = 1; i <= _invoiceCount; i++) {
            if (_invoices[i].payer == payer) {
                count++;
            }
        }

        invoiceIds = new uint256[](count);
        uint256 index;
        for (uint256 i = 1; i <= _invoiceCount; i++) {
            if (_invoices[i].payer == payer) {
                invoiceIds[index++] = i;
            }
        }
    }

    /// @notice Get total invoice count
    /// @return count Total number of invoices
    function getInvoiceCount() external view returns (uint256 count) {
        return _invoiceCount;
    }

    /// @notice Check if invoice is overdue
    /// @param invoiceId The invoice ID
    /// @return overdue True if past due date and not settled
    function isOverdue(uint256 invoiceId) external view returns (bool overdue) {
        require(invoiceId != 0 && invoiceId <= _invoiceCount, 
            "InvoiceTemplate: invalid invoice ID");
        Invoice memory invoice = _invoices[invoiceId];
        return block.timestamp > invoice.dueDate && 
               invoice.state != InvoiceState.Settled && 
               invoice.state != InvoiceState.Cancelled;
    }
}

/// @notice Minimal ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
