package com.energymarket.service;

import com.energymarket.model.Web2NFT;
import com.energymarket.model.Web2User;
import com.energymarket.repository.Web2NFTRepository;
import com.energymarket.repository.Web2UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class Web2Service {

    private final Web2UserRepository userRepository;
    private final Web2NFTRepository nftRepository;

    @PersistenceContext
    private EntityManager entityManager; // Dùng để chạy câu lệnh SQL gốc

    // Hàm mua hàng (Giữ nguyên logic cũ)
    @Transactional
    public void buyItemWeb2(String buyerName, Long nftId) {
        long startTime = System.nanoTime(); 

        // 1. Tìm NFT
        Web2NFT item = nftRepository.findById(nftId)
                .orElseThrow(() -> new RuntimeException("Item not found with ID: " + nftId));

        if (!item.isActive()) {
            throw new RuntimeException("Item is not for sale");
        }

        // 2. Tìm người mua/bán
        Web2User buyer = userRepository.findById(buyerName)
                .orElseThrow(() -> new RuntimeException("Buyer not found: " + buyerName));
        
        Web2User seller = userRepository.findById(item.getOwner())
                .orElseThrow(() -> new RuntimeException("Seller not found"));

        // 3. Validate tiền
        if (buyer.getBalance().compareTo(item.getPrice()) < 0) {
            throw new RuntimeException("Insufficient balance");
        }

        // 4. Chuyển tiền
        buyer.setBalance(buyer.getBalance().subtract(item.getPrice()));
        seller.setBalance(seller.getBalance().add(item.getPrice()));

        // 5. Chuyển hàng
        item.setOwner(buyerName);
        item.setActive(false);

        // 6. Lưu DB
        userRepository.save(buyer);
        userRepository.save(seller);
        nftRepository.save(item);

        long endTime = System.nanoTime();
        log.info("WEB2 TRANSACTION SUCCESS: Time taken = {} ms", (endTime - startTime) / 1_000_000.0);
    }
    
    // Hàm reset dữ liệu (ĐÃ SỬA: Dùng TRUNCATE để reset ID về 1)
    @Transactional
    public void resetData() {
        // Xóa sạch bảng và reset bộ đếm ID
        entityManager.createNativeQuery("TRUNCATE TABLE web2_nfts RESTART IDENTITY CASCADE").executeUpdate();
        entityManager.createNativeQuery("TRUNCATE TABLE web2_users RESTART IDENTITY CASCADE").executeUpdate();
        
        // Tạo lại dữ liệu mẫu
        Web2User buyer = new Web2User();
        buyer.setUsername("buyer_vip");
        buyer.setBalance(new BigInteger("10000000000000000000")); // 10 ETH
        userRepository.save(buyer);

        Web2User seller = new Web2User();
        seller.setUsername("seller_pro");
        seller.setBalance(BigInteger.ZERO);
        userRepository.save(seller);

        Web2NFT nft = new Web2NFT();
        nft.setName("Web2 Energy Item #1");
        nft.setPrice(new BigInteger("1000000000000000000")); // 1 ETH
        nft.setOwner("seller_pro");
        nft.setActive(true);
        nftRepository.save(nft); // Lúc này chắc chắn ID sẽ là 1

        log.info("DATABASE RESET COMPLETED: ID counter reset to 1.");
    }
}