package com.energymarket.repository;

import com.energymarket.model.TransactionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param; // Nhớ import cái này
import org.springframework.stereotype.Repository;

import java.math.BigInteger;
import java.util.List;

@Repository
public interface TransactionHistoryRepository extends JpaRepository<TransactionHistory, Long> {
    
    // 1. GLOBAL: Doanh thu toàn sàn (Giữ nguyên)
    @Query(value = "SELECT to_char(transaction_date, 'DD/MM') as date, SUM(price) as revenue " +
                   "FROM transaction_history " +
                   "GROUP BY to_char(transaction_date, 'DD/MM') " +
                   "ORDER BY date ASC LIMIT 7", nativeQuery = true)
    List<Object[]> getRevenueLast7Days();

    // 2. PERSONAL: Doanh thu của riêng User (THÊM MỚI)
    @Query(value = "SELECT to_char(transaction_date, 'DD/MM') as date, SUM(price) as revenue " +
                   "FROM transaction_history " +
                   "WHERE seller = :account " + // Lọc theo người bán
                   "GROUP BY to_char(transaction_date, 'DD/MM') " +
                   "ORDER BY date ASC LIMIT 7", nativeQuery = true)
    List<Object[]> getRevenueLast7DaysBySeller(@Param("account") String account);

    // 3. Đếm số lần NFT được bán (Giữ nguyên)
    long countByTokenId(BigInteger tokenId);

    // 4. Đếm tổng giao dịch của User (THÊM MỚI)
    long countBySeller(String seller);
    
    // 5. Tính tổng doanh thu của User (THÊM MỚI)
    @Query("SELECT SUM(t.price) FROM TransactionHistory t WHERE t.seller = :seller")
    BigInteger sumPriceBySeller(@Param("seller") String seller);
    
    // 6. Tính tổng doanh thu toàn sàn (THÊM MỚI)
    @Query("SELECT SUM(t.price) FROM TransactionHistory t")
    BigInteger sumPriceAll();
}