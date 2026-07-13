// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/InvoiceTemplate.sol";
import "../contracts/Reputation.sol";
import "../contracts/TemplateRegistry.sol";
import "../contracts/VerificationRegistry.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract InvoiceTemplateTest is Test {
    InvoiceTemplate public invoice;
    Reputation public reputation;
    TemplateRegistry public registry;
    VerificationRegistry public verification;
    MockToken public token;
    
    address public issuer = address(0x1);
    address public payer = address(0x2);
    address public financier = address(0x3);
    address public other = address(0x4);
    
    uint256 public constant INVOICE_AMOUNT = 5000e6;
    uint256 public constant FUTURE_DUE_DATE = 1893456000; // Jan 1, 2030
    
    bytes32 public constant TERMS_HASH = bytes32(uint256(1));
    
    function setUp() public {
        token = new MockToken();
        // Deploy registry first
        registry = new TemplateRegistry(address(0));
        // Deploy verification
        verification = new VerificationRegistry();
        // Deploy reputation
        reputation = new Reputation(address(registry));
        // Deploy invoice template
        invoice = new InvoiceTemplate(address(reputation), address(registry), address(verification), address(token));
        
        // Register and authorize invoice template
        registry.registerTemplate(address(invoice), "Invoice Template");
        registry.authorizeTemplate(address(invoice));
        
        // Authorize template in reputation
        vm.prank(address(registry));
        reputation.authorizeTemplate(address(invoice));
        
        // Mint tokens to payer
        token.mint(payer, 100000e6);
    }
    
    function test_CreateInvoice() public {
        vm.prank(issuer);
        uint256 invoiceId = invoice.createInvoice(
            payer,
            INVOICE_AMOUNT,
            FUTURE_DUE_DATE,
            0,
            TERMS_HASH
        );
        
        assertEq(invoiceId, 1);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(inv.issuer, issuer);
        assertEq(inv.payer, payer);
        assertEq(inv.amount, INVOICE_AMOUNT);
        assertEq(inv.dueDate, FUTURE_DUE_DATE);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Created));
    }
    
    function test_RevertOnZeroPayer() public {
        vm.prank(issuer);
        vm.expectRevert("InvoiceTemplate: payer is zero address");
        invoice.createInvoice(address(0), INVOICE_AMOUNT, FUTURE_DUE_DATE, 0, TERMS_HASH);
    }
    
    function test_RevertOnZeroAmount() public {
        vm.prank(issuer);
        vm.expectRevert("InvoiceTemplate: amount must be positive");
        invoice.createInvoice(payer, 0, FUTURE_DUE_DATE, 0, TERMS_HASH);
    }
    
    function test_RevertOnPastDueDate() public {
        vm.prank(issuer);
        vm.expectRevert("InvoiceTemplate: dueDate must be in future");
        invoice.createInvoice(payer, INVOICE_AMOUNT, block.timestamp - 1, 0, TERMS_HASH);
    }
    
    function test_AcceptInvoice() public {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(payer);
        invoice.acceptInvoice(invoiceId);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Accepted));
    }
    
    function test_RevertOnAcceptByNonPayer() public {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(other);
        vm.expectRevert("InvoiceTemplate: caller is not payer");
        invoice.acceptInvoice(invoiceId);
    }
    
    function test_RevertOnAcceptAlreadyAccepted() public {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(payer);
        invoice.acceptInvoice(invoiceId);
        
        vm.prank(payer);
        vm.expectRevert("InvoiceTemplate: invoice not in created state");
        invoice.acceptInvoice(invoiceId);
    }
    
    function test_FinanceInvoice() public {
        uint256 invoiceId = _createAndAcceptInvoice();
        
        vm.prank(financier);
        invoice.financeInvoice(invoiceId);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Financed));
        assertEq(inv.financier, financier);
        assertTrue(inv.financedAt > 0);
    }
    
    function test_RevertOnFinanceByParty() public {
        uint256 invoiceId = _createAndAcceptInvoice();
        
        vm.prank(issuer);
        vm.expectRevert("InvoiceTemplate: financier must be third party");
        invoice.financeInvoice(invoiceId);
    }
    
    function test_SettleInvoice() public {
        uint256 invoiceId = _createAndAcceptInvoice();
        
        vm.prank(payer);
        token.approve(address(invoice), INVOICE_AMOUNT);
        
        vm.prank(payer);
        invoice.settleInvoice(invoiceId, issuer);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Settled));
    }
    
    function test_SettleFinancedInvoice() public {
        uint256 invoiceId = _createAndAcceptInvoice();
        
        // Third party finances
        vm.prank(financier);
        invoice.financeInvoice(invoiceId);
        
        // Payer settles to financier
        vm.prank(payer);
        token.approve(address(invoice), INVOICE_AMOUNT);
        
        vm.prank(payer);
        invoice.settleInvoice(invoiceId, financier);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Settled));
    }
    
    function test_CancelInvoice() public {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(issuer);
        invoice.cancelInvoice(invoiceId);
        
        InvoiceTemplate.Invoice memory inv = invoice.getInvoice(invoiceId);
        assertEq(uint8(inv.state), uint8(ITemplate.InvoiceState.Cancelled));
    }
    
    function test_RevertOnCancelByNonIssuer() public {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(payer);
        vm.expectRevert("InvoiceTemplate: caller is not issuer");
        invoice.cancelInvoice(invoiceId);
    }
    
    function test_RevertOnCancelAcceptedInvoice() public {
        uint256 invoiceId = _createAndAcceptInvoice();
        
        vm.prank(issuer);
        vm.expectRevert("InvoiceTemplate: invoice cannot be cancelled");
        invoice.cancelInvoice(invoiceId);
    }
    
    function test_GetInvoicesByIssuer() public {
        _createInvoice();
        _createInvoice();
        
        uint256[] memory invoices = invoice.getInvoicesByIssuer(issuer);
        assertEq(invoices.length, 2);
    }
    
    function test_GetInvoicesByPayer() public {
        _createInvoice();
        
        vm.prank(issuer);
        invoice.createInvoice(payer, INVOICE_AMOUNT, FUTURE_DUE_DATE, 0, TERMS_HASH);
        
        uint256[] memory invoices = invoice.getInvoicesByPayer(payer);
        assertEq(invoices.length, 2);
    }
    
    function test_IsOverdue() public {
        uint256 invoiceId = _createInvoice();
        
        // Not overdue yet
        assertFalse(invoice.isOverdue(invoiceId));
    }
    
    function test_GetInvoiceCount() public {
        assertEq(invoice.getInvoiceCount(), 0);
        _createInvoice();
        assertEq(invoice.getInvoiceCount(), 1);
    }
    
    function _createInvoice() internal returns (uint256) {
        vm.prank(issuer);
        return invoice.createInvoice(
            payer,
            INVOICE_AMOUNT,
            FUTURE_DUE_DATE,
            0,
            TERMS_HASH
        );
    }
    
    function _createAndAcceptInvoice() internal returns (uint256) {
        uint256 invoiceId = _createInvoice();
        
        vm.prank(payer);
        invoice.acceptInvoice(invoiceId);
        
        return invoiceId;
    }
}

// Import ITemplate for types
import "../contracts/interfaces/ITemplate.sol";
