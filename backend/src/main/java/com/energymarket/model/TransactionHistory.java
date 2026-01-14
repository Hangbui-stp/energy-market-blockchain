package com.energymarket.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import java.math.BigInteger;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "transaction_history")
public class TransactionHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private BigInteger tokenId;
    private String seller;
    private String buyer;
    private BigInteger price; // Giá bán (Wei)
    private BigInteger fee;   // Phí sàn
    
    private LocalDateTime transactionDate;
}