package com.energymarket.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CreditScoreDto {
    private String userAddress;
    private Long loyaltyPoints;
    private Double totalRevenueEth;
    private Long totalTransactions;
    private String creditRating; 
    private Double maxLoanLimit; 
    private Double interestRate; 
}
