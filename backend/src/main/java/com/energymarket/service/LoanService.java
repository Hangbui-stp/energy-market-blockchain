package com.energymarket.service;

import com.energymarket.contracts.EnergyLending; 
import com.energymarket.model.LoanApplication;
import com.energymarket.repository.LoanApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanApplicationRepository loanRepo;
    private final EnergyLending lendingContract; 
    private final CreditScoringService creditService;

    private static final double ETH_TO_KW_RATE = 10000.0;

    @Transactional
    public String applyAndApproveLoan(String userAddress, double requestedEth, int durationMonths) {
        // Lấy thông tin để tính toán (chỉ để hiển thị và tính lãi)
        var creditScore = creditService.calculateCreditScore(userAddress);
        
        // --- BỎ QUA BƯỚC CHECK HẠN MỨC Ở JAVA ---
        // Blockchain sẽ tự revert nếu user không đủ điều kiện (Revenue/Loyalty)
        // Backend chỉ đóng vai trò người nhập liệu.
        
        double rateYearly = creditScore.getInterestRate();
        double interestAmount = requestedEth * rateYearly * ((double) durationMonths / 12.0);
        double totalRepaymentEth = requestedEth + interestAmount;
        long energyToProduce = (long) (requestedEth * ETH_TO_KW_RATE);

        BigInteger principalWei = Convert.toWei(BigDecimal.valueOf(requestedEth), Convert.Unit.ETHER).toBigInteger();
        BigInteger repaymentWei = Convert.toWei(BigDecimal.valueOf(totalRepaymentEth), Convert.Unit.ETHER).toBigInteger();
        BigInteger durationSeconds = BigInteger.valueOf((long) durationMonths * 30 * 24 * 60 * 60);
        BigInteger energyAmountUint = BigInteger.valueOf(energyToProduce);

        String txHash = "";
        BigInteger onChainLoanId = BigInteger.ZERO;

        try {
            log.info("Submitting Loan to Blockchain... (Trustless Verification)");
            
            // GỌI SMART CONTRACT
            // Nếu user không đủ điều kiện (Doanh thu/Loyalty), transaction sẽ FAIL ở đây và nhảy vào catch
            TransactionReceipt receipt = lendingContract.createLoan(
                new Address(userAddress),
                new Uint256(principalWei),
                new Uint256(repaymentWei),
                new Uint256(durationSeconds),
                new Uint256(energyAmountUint)
            ).send();
            
            txHash = receipt.getTransactionHash();
            
            // Lấy ID (Sửa lại .getValue() cho đúng kiểu BigInteger)
            onChainLoanId = lendingContract.loanCounter().send().getValue();
            
            log.info("Loan Created Successfully On-Chain! ID: {}", onChainLoanId);

        } catch (Exception e) {
            log.error("Blockchain transaction REVERTED by Smart Contract Rules!", e);
            // Ném lỗi ra để Frontend biết là bị từ chối
            throw new RuntimeException("Loan Rejected by Smart Contract! (Reason: Not enough Revenue/Loyalty on-chain)");
        }

        // Lưu DB để hiển thị
        LoanApplication loan = new LoanApplication();
        loan.setUserAddress(userAddress);
        loan.setPrincipalAmount(requestedEth);
        loan.setDurationMonths(durationMonths);
        loan.setInterestRate(rateYearly);
        loan.setTotalRepayment(totalRepaymentEth);
        loan.setDueDate(java.time.LocalDate.now().plusMonths(durationMonths));
        loan.setApprovedLimit(creditScore.getMaxLoanLimit());
        loan.setLoyaltyPointsSnapshot(creditScore.getLoyaltyPoints().intValue());
        loan.setTotalRevenueSnapshot(creditScore.getTotalRevenueEth());
        
        loan.setStatus(LoanApplication.LoanStatus.APPROVED);
        loan.setDescription(String.format("Loan ID: %d. Tx: %s. Invested %.2f ETH -> Generated %d kW.", 
                onChainLoanId, txHash, requestedEth, energyToProduce));

        loanRepo.save(loan);

        return "Loan Approved on Blockchain! Loan ID: " + onChainLoanId;
    }
}