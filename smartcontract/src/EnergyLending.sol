// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface để gọi sang các contract khác
interface IEnergyNFT {
    function produceEnergy(address user, uint256 amount) external;
}

// Interface check doanh thu từ Marketplace
interface IEnergyMarketplace {
    function userRevenue(address user) external view returns (uint256);
}

// Interface check điểm từ Loyalty
interface ILoyaltyProgram {
    function getLoyaltyPoints(address user) external view returns (uint256);
}

contract EnergyLending is Ownable, ReentrancyGuard {
    IEnergyNFT public nftContract;
    IEnergyMarketplace public marketContract; 
    ILoyaltyProgram public loyaltyContract;   

    // --- CẤU HÌNH ĐIỀU KIỆN VAY ---
    // Ví dụ: Phải có ít nhất 10 điểm Loyalty và 0.01 ETH doanh thu thì mới được vay
    uint256 public constant MIN_LOYALTY_REQ = 10; 
    uint256 public constant MIN_REVENUE_REQ = 0.01 ether;

    struct Loan {
        uint256 id;
        address borrower;
        uint256 principalAmount; 
        uint256 totalRepayment;  
        uint256 energyCollateral; 
        uint256 dueDate;
        bool isPaid;
        bool isActive;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public loanCounter;

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 repayment, uint256 energyAmount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amountPaid);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    constructor(
        address _nftAddress, 
        address _marketAddress, 
        address _loyaltyAddress
    ) Ownable(msg.sender) {
        nftContract = IEnergyNFT(_nftAddress);
        marketContract = IEnergyMarketplace(_marketAddress);
        loyaltyContract = ILoyaltyProgram(_loyaltyAddress);
    }

    function createLoan(
        address _borrower,
        uint256 _principalWei,
        uint256 _repaymentWei,
        uint256 _durationSeconds,
        uint256 _energyAmount
    ) external onlyOwner nonReentrant returns (uint256) {
        
        // --- SMART CONTRACT TỰ KIỂM TRA TÍN DỤNG ---
        
        // 1. Kiểm tra điểm Loyalty trên Blockchain
        uint256 points = loyaltyContract.getLoyaltyPoints(_borrower);
        require(points >= MIN_LOYALTY_REQ, "REJECTED: Not enough Loyalty Points");

        // 2. Kiểm tra Doanh thu bán hàng trên Blockchain
        uint256 revenue = marketContract.userRevenue(_borrower);
        require(revenue >= MIN_REVENUE_REQ, "REJECTED: Not enough on-chain Revenue");

        // ----------------------------------------------------

        loanCounter++;
        
        loans[loanCounter] = Loan({
            id: loanCounter,
            borrower: _borrower,
            principalAmount: _principalWei,
            totalRepayment: _repaymentWei,
            energyCollateral: _energyAmount,
            dueDate: block.timestamp + _durationSeconds,
            isPaid: false,
            isActive: true
        });

        nftContract.produceEnergy(_borrower, _energyAmount);
        emit LoanCreated(loanCounter, _borrower, _repaymentWei, _energyAmount);
        return loanCounter;
    }

    function repayLoan(uint256 _loanId) external payable nonReentrant {
        Loan storage loan = loans[_loanId];
        
        require(loan.isActive, "Loan not active");
        require(!loan.isPaid, "Loan already paid");
        require(msg.value >= loan.totalRepayment, "Insufficient ETH sent");

        loan.isPaid = true;
        loan.isActive = false;

        if (msg.value > loan.totalRepayment) {
            payable(msg.sender).transfer(msg.value - loan.totalRepayment);
        }

        emit LoanRepaid(_loanId, msg.sender, loan.totalRepayment);
    }

    function withdraw(uint256 _amount) external onlyOwner {
        require(address(this).balance >= _amount, "Insufficient contract balance");
        payable(owner()).transfer(_amount);
        emit FundsWithdrawn(owner(), _amount);
    }

    function getLoanStatus(uint256 _loanId) external view returns (bool, bool) {
        return (loans[_loanId].isPaid, loans[_loanId].isActive);
    }
}