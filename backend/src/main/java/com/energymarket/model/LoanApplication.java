package com.energymarket.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "loan_applications")
public class LoanApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userAddress;

    private Integer loyaltyPointsSnapshot;
    private Double totalRevenueSnapshot;

    private Double principalAmount;   
    private Integer durationMonths;   
    private Double interestRate;      
    private Double totalRepayment;    
    private LocalDate dueDate;        

    private Double approvedLimit;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    private LoanStatus status;

    private LocalDateTime createdAt;

    public enum LoanStatus {
        PENDING, APPROVED, REJECTED, PAID
    }
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

