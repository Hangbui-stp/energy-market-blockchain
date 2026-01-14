package com.energymarket.controller;

import com.energymarket.model.LoanApplication;
import com.energymarket.repository.LoanApplicationRepository;
import com.energymarket.service.LoanService;
import com.energymarket.service.CreditScoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/bank")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BankController {

    private final LoanService loanService;
    private final CreditScoringService creditService;
    private final LoanApplicationRepository loanRepo;

    // 1. Lấy thông tin tín dụng (Đã có logic của bạn)
    @GetMapping("/credit-score")
    public ResponseEntity<?> getCreditScore(@RequestParam String account) {
        return ResponseEntity.ok(creditService.calculateCreditScore(account));
    }

    // 2. Xin vay (Đã có logic của bạn)
    @PostMapping("/apply")
    public ResponseEntity<?> applyLoan(@RequestBody Map<String, Object> payload) {
        try {
            String account = (String) payload.get("account");
            Double amount = Double.valueOf(payload.get("amount").toString());
            Integer duration = (Integer) payload.get("duration");
            
            String result = loanService.applyAndApproveLoan(account, amount, duration);
            return ResponseEntity.ok(Map.of("message", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // --- THÊM MỚI TỪ ĐÂY ---

    // 3. Lấy lịch sử khoản vay của User
    @GetMapping("/loans")
    public ResponseEntity<List<LoanApplication>> getMyLoans(@RequestParam String account) {
        return ResponseEntity.ok(loanRepo.findByUserAddress(account));
    }

    // 4. Thanh toán khoản vay (Repay)
    @PostMapping("/repay")
    public ResponseEntity<?> repayLoan(@RequestBody Map<String, Object> payload) {
        try {
            Long loanId = Long.valueOf(payload.get("loanId").toString());
            // Trong thực tế, bạn cần nhận thêm TransactionHash để verify trên Blockchain xem họ đã chuyển tiền chưa
            // Ở đây mình làm đơn giản là update DB
            
            LoanApplication loan = loanRepo.findById(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
            
            if (loan.getStatus() == LoanApplication.LoanStatus.PAID) {
                return ResponseEntity.badRequest().body(Map.of("error", "Loan already paid"));
            }

            loan.setStatus(LoanApplication.LoanStatus.PAID);
            loanRepo.save(loan);
            
            return ResponseEntity.ok(Map.of("message", "Loan Repaid Successfully!"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
