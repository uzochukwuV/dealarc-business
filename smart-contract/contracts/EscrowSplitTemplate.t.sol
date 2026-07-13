// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/EscrowSplitTemplate.sol";
import "../contracts/Reputation.sol";
import "../contracts/TemplateRegistry.sol";
import "../contracts/VerificationRegistry.sol";
import "../contracts/FeeController.sol";
import "../contracts/ArbitrationTemplate.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= amount;
        }
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        unchecked {
            allowance[from][msg.sender] -= amount;
            balanceOf[from] -= amount;
        }
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

contract EscrowSplitTemplateTest is Test {
    EscrowSplitTemplate public escrow;
    Reputation public reputation;
    TemplateRegistry public registry;
    VerificationRegistry public verification;
    FeeController public feeController;
    ArbitrationTemplate public arbitration;
    MockERC20 public usdc;
    
    address public payer = address(0x1);
    address public recipient1 = address(0x2);
    address public recipient2 = address(0x3);
    address public other = address(0x4);
    
    uint256 public constant ESCROW_AMOUNT = 10000e6;
    
    function setUp() public {
        usdc = new MockERC20();
        // Deploy registry first
        registry = new TemplateRegistry(address(0));
        // Deploy verification
        verification = new VerificationRegistry();
        // Deploy fee controller
        feeController = new FeeController(address(this));
        // Deploy arbitration
        arbitration = new ArbitrationTemplate();
        // Deploy reputation
        reputation = new Reputation(address(registry));
        // Deploy escrow template
        escrow = new EscrowSplitTemplate(
            address(reputation), 
            address(registry), 
            address(verification),
            address(feeController),
            address(arbitration),
            address(usdc)
        );
        
        // Register and authorize escrow template
        registry.registerTemplate(address(escrow), "Escrow Split Template");
        registry.authorizeTemplate(address(escrow));
        
        // Authorize template in reputation
        vm.prank(address(registry));
        reputation.authorizeTemplate(address(escrow));
        
        // Mint USDC to payer
        usdc.mint(payer, 100000e6);
    }
    
    function test_CreateEscrow() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory bps = new uint256[](2);
        bps[0] = 7000; // 70%
        bps[1] = 3000; // 30%
        
        vm.prank(payer);
        uint256 escrowId = escrow.createEscrow(ESCROW_AMOUNT, recipients, bps, 0);
        
        assertEq(escrowId, 1);
        
        EscrowSplitTemplate.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.payer, payer);
        assertEq(e.totalAmount, ESCROW_AMOUNT);
        assertEq(e.fundedAmount, 0);
        assertEq(uint8(e.state), uint8(ITemplate.DealState.Created));
    }
    
    function test_RevertOnInvalidBpsSum() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory bps = new uint256[](2);
        bps[0] = 5000; // 50% - should be 10000 total
        bps[1] = 3000; // 30%
        
        vm.prank(payer);
        vm.expectRevert("EscrowSplitTemplate: bps must sum to 10000");
        escrow.createEscrow(ESCROW_AMOUNT, recipients, bps, 0);
    }
    
    function test_RevertOnTooManyRecipients() public {
        address[] memory recipients = new address[](11);
        uint256[] memory bps = new uint256[](11);
        
        for (uint256 i = 0; i < 11; i++) {
            recipients[i] = address(uint160(i + 100));
            bps[i] = 909; // Roughly 10% each
        }
        
        vm.prank(payer);
        vm.expectRevert("EscrowSplitTemplate: invalid recipient count");
        escrow.createEscrow(ESCROW_AMOUNT, recipients, bps, 0);
    }
    
    function test_RevertOnDuplicateRecipients() public {
        address[] memory recipients = new address[](2);
        recipients[0] = address(0x5);
        recipients[1] = address(0x5); // Duplicate!

        uint256[] memory bps = new uint256[](2);
        bps[0] = 5000;
        bps[1] = 5000;

        vm.prank(payer);
        vm.expectRevert("EscrowSplitTemplate: duplicate recipients not allowed");
        escrow.createEscrow(ESCROW_AMOUNT, recipients, bps, 0);
    }

    function test_RevertOnResolveAfterCompletion() public {
        uint256 escrowId = _createEscrowWithMilestones();
        
        // Fund escrow with enough tokens
        vm.prank(payer);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(payer);
        escrow.fundEscrow(escrowId, ESCROW_AMOUNT);
        
        // Raise dispute while active
        vm.prank(recipient1);
        escrow.raiseDispute(escrowId, "Quality issues");
        
        // Resolve the dispute by cancelling (action=0)
        vm.prank(payer);
        escrow.resolveDispute(escrowId, 0);
        
        // Now the escrow is Cancelled, try to resolve again - should fail
        // (First need to raise a new dispute, but escrow is Cancelled not Active)
        // Instead, test that resolveDispute rejects Cancelled state
        vm.prank(payer);
        vm.expectRevert("EscrowSplitTemplate: escrow already finalized");
        escrow.resolveDispute(escrowId, 0);
    }
    
    function test_FundEscrow() public {
        uint256 escrowId = _createEscrow();
        
        vm.prank(payer);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(payer);
        escrow.fundEscrow(escrowId, ESCROW_AMOUNT);
        
        EscrowSplitTemplate.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.fundedAmount, ESCROW_AMOUNT);
        assertEq(uint8(e.state), uint8(ITemplate.DealState.Active));
    }
    
    function test_PartialFundEscrow() public {
        uint256 escrowId = _createEscrow();
        
        vm.prank(payer);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(payer);
        escrow.fundEscrow(escrowId, ESCROW_AMOUNT / 2);
        
        EscrowSplitTemplate.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.fundedAmount, ESCROW_AMOUNT / 2);
        assertEq(uint8(e.state), uint8(ITemplate.DealState.Created)); // Still Created until fully funded
    }
    
    function test_GetRecipients() public {
        uint256 escrowId = _createEscrow();
        
        EscrowSplitTemplate.Recipient[] memory recipients = escrow.getRecipients(escrowId);
        assertEq(recipients.length, 2);
        assertEq(recipients[0].recipientAddress, recipient1);
        assertEq(recipients[0].bps, 7000);
        assertEq(recipients[1].recipientAddress, recipient2);
        assertEq(recipients[1].bps, 3000);
    }
    
    function test_AddMilestones() public {
        uint256 escrowId = _createEscrow();
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 6000e6;
        amounts[1] = 4000e6;
        
        string[] memory descriptions = new string[](2);
        descriptions[0] = "Milestone 1: Delivery";
        descriptions[1] = "Milestone 2: Installation";
        
        vm.prank(payer);
        escrow.addMilestones(escrowId, amounts, descriptions);
        
        EscrowSplitTemplate.Milestone[] memory milestones = escrow.getMilestones(escrowId);
        assertEq(milestones.length, 2);
        assertEq(milestones[0].amount, 6000e6);
        assertEq(milestones[1].amount, 4000e6);
    }
    
    function test_ApproveMilestone() public {
        uint256 escrowId = _createEscrowWithMilestones();
        _fundEscrow(escrowId);
        
        // Only recipients can approve milestones
        vm.prank(recipient1);
        escrow.approveMilestone(escrowId, 0);
        
        EscrowSplitTemplate.Milestone[] memory milestones = escrow.getMilestones(escrowId);
        assertTrue(milestones[0].approved);
    }
    
    function test_RevertOnApproveMilestoneNotRecipient() public {
        uint256 escrowId = _createEscrowWithMilestones();
        _fundEscrow(escrowId);
        
        // Non-recipient cannot approve milestones
        vm.prank(other);
        vm.expectRevert("EscrowSplitTemplate: caller is not a recipient");
        escrow.approveMilestone(escrowId, 0);
    }
    
    function test_RaiseDispute() public {
        uint256 escrowId = _createEscrowWithMilestones();
        _fundEscrow(escrowId);
        
        vm.prank(recipient1);
        escrow.raiseDispute(escrowId, "Quality issues");
        
        // Dispute is raised (no state change until resolved)
    }
    
    function test_RevertOnRaiseDisputeNotAuthorized() public {
        uint256 escrowId = _createEscrowWithMilestones();
        _fundEscrow(escrowId);
        
        vm.prank(other);
        vm.expectRevert("EscrowSplitTemplate: not authorized to dispute");
        escrow.raiseDispute(escrowId, "Reason");
    }
    
    function test_GetEscrowCount() public {
        assertEq(escrow.getEscrowCount(), 0);
        _createEscrow();
        assertEq(escrow.getEscrowCount(), 1);
    }
    
    function _createEscrow() internal returns (uint256) {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory bps = new uint256[](2);
        bps[0] = 7000;
        bps[1] = 3000;
        
        vm.prank(payer);
        return escrow.createEscrow(ESCROW_AMOUNT, recipients, bps, 0);
    }
    
    function _createEscrowWithMilestones() internal returns (uint256) {
        uint256 escrowId = _createEscrow();
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 6000e6;
        amounts[1] = 4000e6;
        
        string[] memory descriptions = new string[](2);
        descriptions[0] = "Delivery";
        descriptions[1] = "Installation";
        
        vm.prank(payer);
        escrow.addMilestones(escrowId, amounts, descriptions);
        
        return escrowId;
    }
    
    function _fundEscrow(uint256 escrowId) internal {
        vm.prank(payer);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(payer);
        escrow.fundEscrow(escrowId, ESCROW_AMOUNT);
    }
}

// Import ITemplate for types
import "../contracts/interfaces/ITemplate.sol";
