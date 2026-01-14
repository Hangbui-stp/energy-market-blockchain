package com.energymarket.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@AllArgsConstructor // <--- Thêm cái này
@NoArgsConstructor  // <--- Thêm cái này
public class AnalyticsDto {
    // Số liệu tổng quan (KPI)
    private Double totalRevenue;
    private Double totalEnergy;
    private Long totalNFTs;
    private Long totalTransactions;

    // Dữ liệu biểu đồ
    private List<ChartData> revenueChart;
    private List<ChartData> energyTypeChart;
    private List<ChartData> energyOutputChart;
    private List<ChartData> priceHistoryChart;

    @Data
    @Builder
    @AllArgsConstructor // <--- QUAN TRỌNG: Cái này giúp sửa lỗi "is not public"
    @NoArgsConstructor  // <--- Cái này giúp tránh lỗi khi JSON parse
    public static class ChartData {
        private String name;
        private Double value;
    }
}