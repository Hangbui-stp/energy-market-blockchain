package com.energymarket.repository;

import com.energymarket.model.Web2User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Web2UserRepository extends JpaRepository<Web2User, String> {
}