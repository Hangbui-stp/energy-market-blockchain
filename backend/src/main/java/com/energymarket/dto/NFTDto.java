package com.energymarket.dto;

import lombok.Data;
import lombok.Builder;
import java.util.List;

@Data
@Builder
public class NFTDto {
    private Long id;
    private String title;
    private String price;
    private Integer energyAmount;
    private String seller;
    private String image;
    private String description;
    private boolean isActive;
    
    // --- QUAN TRỌNG: Trường chứa số lượng đã bán ---
    private Long totalTrades; 
    
    private List<NFTAttributeDto> attributes;
}