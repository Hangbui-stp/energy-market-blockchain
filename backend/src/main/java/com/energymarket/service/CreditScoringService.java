package com.energymarket.service;

import com.energymarket.dto.CreditScoreDto;
import com.energymarket.repository.TransactionHistoryRepository;
import com.energymarket.contracts.LoyaltyProgram;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.generated.Uint256;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.web3j.utils.Convert;
import java.math.BigDecimal;
import java.math.BigInteger;

@Service
@RequiredArgsConstructor
public class CreditScoringService {

    private final TransactionHistoryRepository transactionRepo;
    private final LoyaltyProgram loyaltyProgram;

    public CreditScoreDto calculateCreditScore(String userAddress) {
        try {
            // 1. Lấy điểm Loyalty từ Blockchain
            Uint256 loyaltyPointsUint = loyaltyProgram.getLoyaltyPoints(new Address(userAddress)).send();
            long loyalty = loyaltyPointsUint.getValue().longValue();

            // 2. Lấy tổng doanh thu từ DB (tính bằng Wei rồi đổi ra Ether)
            BigInteger totalRevenueWei = transactionRepo.sumPriceBySeller(userAddress.toLowerCase());
            double totalRevenueEth = (totalRevenueWei != null) 
                ? Convert.fromWei(new BigDecimal(totalRevenueWei), Convert.Unit.ETHER).doubleValue() 
                : 0.0;

            // 3. Đếm số lượng giao dịch thành công
            long totalTransactions = transactionRepo.countBySeller(userAddress.toLowerCase());

            String rating;
            double trustFactor;
            double interestRate;
            double baseLimit; // Hạn mức tín chấp cơ bản dựa trên hạng thành viên

            // LOGIC MỚI: Phân hạng và cấp hạn mức cơ bản
            if (loyalty > 1000) {
                rating = "AAA (Prime)";
                trustFactor = 2.0;
                interestRate = 0.05; // Lãi suất 5%/năm
                baseLimit = 10.0;    // Luôn được vay tối thiểu 10 ETH
            } else if (loyalty > 500) {
                rating = "A (Good)";
                trustFactor = 1.5;
                interestRate = 0.08; 
                baseLimit = 5.0;     // Luôn được vay tối thiểu 5 ETH
            } else if (loyalty > 100) {
                rating = "B (Average)";
                trustFactor = 1.0;   
                interestRate = 0.12; 
                baseLimit = 2.0;     // Luôn được vay tối thiểu 2 ETH
            } else {
                rating = "C (Risky)";
                trustFactor = 0.0;
                interestRate = 0.20; 
                baseLimit = 0.0;     // Hạng thấp không có hạn mức cơ bản
            }

            // Công thức mới: (Doanh thu * Hệ số tin cậy) + Hạn mức cơ bản
            // Ví dụ: Hạng B, Doanh thu 0 => MaxLoan = (0 * 1.0) + 2.0 = 2.0 ETH
            double maxLoanLimit = (totalRevenueEth * trustFactor) + baseLimit;

            return CreditScoreDto.builder()
                .userAddress(userAddress)
                .loyaltyPoints(loyalty)
                .totalRevenueEth(totalRevenueEth)
                .totalTransactions(totalTransactions)
                .creditRating(rating)
                .maxLoanLimit(maxLoanLimit)
                .interestRate(interestRate)
                .build();

        } catch (Exception e) {
            throw new RuntimeException("Error calculating credit score: " + e.getMessage());
        }
    }
}