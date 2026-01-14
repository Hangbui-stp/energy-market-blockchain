package com.energymarket.controller;

import com.energymarket.dto.AnalyticsDto;
import com.energymarket.model.NFT;
import com.energymarket.repository.NFTRepository;
import com.energymarket.repository.TransactionHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AnalyticsController {

    private final TransactionHistoryRepository transactionRepo;
    private final NFTRepository nftRepo;

    @GetMapping
    public AnalyticsDto getAnalytics(@RequestParam(required = false) String account) {
        List<NFT> allNfts = nftRepo.findAll();
        
        // --- 1. XỬ LÝ DOANH THU & GIAO DỊCH (PERSONAL vs GLOBAL) ---
        List<Object[]> revenueRaw;
        double totalRevenueEth = 0.0;
        long totalTrans = 0;

        if (account != null && !account.isEmpty()) {
            // Nếu có đăng nhập -> Lấy dữ liệu CÁ NHÂN
            // Chuẩn hóa address về lowercase để so sánh chính xác
            String userAddress = account.toLowerCase(); 
            
            revenueRaw = transactionRepo.getRevenueLast7DaysBySeller(userAddress);
            totalTrans = transactionRepo.countBySeller(userAddress);
            
            BigInteger totalRevWei = transactionRepo.sumPriceBySeller(userAddress);
            if (totalRevWei != null) {
                totalRevenueEth = Convert.fromWei(new BigDecimal(totalRevWei), Convert.Unit.ETHER).doubleValue();
            }
        } else {
            // Nếu không đăng nhập -> Lấy dữ liệu TOÀN SÀN
            revenueRaw = transactionRepo.getRevenueLast7Days();
            totalTrans = transactionRepo.count();
            
            BigInteger totalRevWei = transactionRepo.sumPriceAll();
            if (totalRevWei != null) {
                totalRevenueEth = Convert.fromWei(new BigDecimal(totalRevWei), Convert.Unit.ETHER).doubleValue();
            }
        }

        // Tạo Chart Doanh Thu
        List<AnalyticsDto.ChartData> revenueChart = new ArrayList<>();
        for (Object[] row : revenueRaw) {
            String date = (String) row[0];
            BigDecimal wei = new BigDecimal(row[1].toString());
            double eth = Convert.fromWei(wei, Convert.Unit.ETHER).doubleValue();
            revenueChart.add(new AnalyticsDto.ChartData(date, eth));
        }

        // --- 2. CÁC CHỈ SỐ THỊ TRƯỜNG (LUÔN LÀ GLOBAL) ---
        
        // Tổng năng lượng toàn thị trường (Global)
        double totalEnergyKw = allNfts.stream()
            .mapToDouble(n -> n.getEnergyAmount() != null ? n.getEnergyAmount().doubleValue() : 0)
            .sum();

        // Biểu đồ tròn (Global Energy Mix)
        Map<String, Long> energyTypeCount = allNfts.stream()
            .collect(Collectors.groupingBy(
                n -> n.getEnergyType() != null ? n.getEnergyType() : "Other", 
                Collectors.counting()
            ));

        List<AnalyticsDto.ChartData> pieChart = new ArrayList<>();
        energyTypeCount.forEach((type, count) -> 
            pieChart.add(new AnalyticsDto.ChartData(type, count.doubleValue()))
        );

        // --- SỬA ĐỔI: Biểu đồ Area (Toàn bộ NFT theo thứ tự thời gian để hiện Trend) ---
        // Thay vì lấy Top 7, ta lấy toàn bộ và sắp xếp theo ID (cũ -> mới)
        List<AnalyticsDto.ChartData> areaChart = allNfts.stream()
            .sorted((n1, n2) -> n1.getTokenId().compareTo(n2.getTokenId())) // Sắp xếp theo ID tăng dần
            .map(n -> new AnalyticsDto.ChartData(
                "#" + n.getTokenId(), // Tên hiển thị là ID của NFT
                n.getEnergyAmount().doubleValue() // Giá trị là sản lượng điện
            ))
            .collect(Collectors.toList());

        // Biểu đồ Giá niêm yết (Global Market Prices)
        List<AnalyticsDto.ChartData> lineChart = allNfts.stream()
            .filter(NFT::isListed) // Chỉ lấy những cái đang bán
            .limit(10)
            .map(n -> {
                double priceEth = Convert.fromWei(new BigDecimal(n.getPrice()), Convert.Unit.ETHER).doubleValue();
                return new AnalyticsDto.ChartData("NFT #" + n.getTokenId(), priceEth);
            })
            .collect(Collectors.toList());

        return AnalyticsDto.builder()
            .totalRevenue(totalRevenueEth)
            .totalEnergy(totalEnergyKw)
            .totalNFTs((long) allNfts.size())
            .totalTransactions(totalTrans)
            .revenueChart(revenueChart)
            .energyTypeChart(pieChart)
            .energyOutputChart(areaChart) // Dữ liệu trend mới
            .priceHistoryChart(lineChart)
            .build();
    }
}