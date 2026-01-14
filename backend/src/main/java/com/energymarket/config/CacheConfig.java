package com.energymarket.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {
    public static final String MARKETPLACE_ITEMS_CACHE = "marketplaceItems";
    public static final String NFT_METADATA_CACHE = "nftMetadataCache";
    
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        
        cacheManager.setCaffeine(Caffeine.newBuilder()
            // QUAN TRỌNG: Cache chỉ lưu trong 5 giây
            .expireAfterWrite(5, TimeUnit.SECONDS) 
            .maximumSize(1000)                      
            .recordStats());                        
            
        cacheManager.setCacheNames(List.of(MARKETPLACE_ITEMS_CACHE, NFT_METADATA_CACHE));
        
        return cacheManager;
    }
}