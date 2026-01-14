package com.energymarket.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigInteger;

@Data
@Entity
@Table(name = "web2_users") // Trỏ đúng vào bảng web2 mới tạo
public class Web2User {
    @Id
    private String username;
    private BigInteger balance;
}