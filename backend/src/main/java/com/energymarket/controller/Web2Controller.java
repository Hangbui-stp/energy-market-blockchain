package com.energymarket.controller;

import com.energymarket.service.Web2Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map; 
@RestController
@RequestMapping("/api/v1/web2")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class Web2Controller {

    private final Web2Service web2Service;

    @PostMapping("/buy/{nftId}")
    public ResponseEntity<?> buyWeb2(@PathVariable Long nftId, @RequestParam String buyer) {
        try {
            web2Service.buyItemWeb2(buyer, nftId);
            
            // Trả về JSON chi tiết giao dịch (Hóa đơn)
            return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Transaction completed via Web2 Database",
                "buyer", buyer,
                "nft_id", nftId,
                "timestamp", java.time.LocalDateTime.now()
            ));
            
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/reset")
    public ResponseEntity<?> resetWeb2() {
        web2Service.resetData();
        return ResponseEntity.ok(Map.of("message", "Web2 Database & ID Counter Reset Successfully"));
    }
}