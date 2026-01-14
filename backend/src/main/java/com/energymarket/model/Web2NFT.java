package com.energymarket.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigInteger;

@Data
@Entity
@Table(name = "web2_nfts")
public class Web2NFT {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    private BigInteger price;
    private String owner;
    
    @Column(name = "is_active")
    private boolean isActive;
}