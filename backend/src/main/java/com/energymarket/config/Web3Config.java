package com.energymarket.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.gas.ContractGasProvider;
import org.web3j.tx.gas.StaticGasProvider;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.OkHttpClient;
import lombok.extern.slf4j.Slf4j;
import java.math.BigInteger;
import java.util.concurrent.TimeUnit;

// Import Contracts
import com.energymarket.contracts.EnergyMarketplace;
import com.energymarket.contracts.EnergyNFT;
import com.energymarket.contracts.LoyaltyProgram;
import com.energymarket.contracts.EnergyLending; // IMPORT MỚI

@Configuration
@Slf4j
public class Web3Config {
    @Value("${blockchain.node.url}")
    private String blockchainNodeUrl;
    
    @Value("${contract.marketplace.address}")
    private String marketplaceAddress;

    @Value("${contract.nft.address}")
    private String nftAddress;

    // --- THÊM VÀO APPLICATION.YML ---
    @Value("${contract.lending.address}") 
    private String lendingAddress; 

    private String loyaltyProgramAddress = "0x12738655b22fF3e1Dd8B41E0A3f0Bb31CF06CE91";

    @Bean
    @Primary
    public OkHttpClient httpClient() {
        return new OkHttpClient.Builder()
            .connectTimeout(90, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(90, TimeUnit.SECONDS)
            .build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        return mapper;
    }
    
    @Bean
    public Web3j web3j(OkHttpClient httpClient) {
        return Web3j.build(new HttpService(blockchainNodeUrl, httpClient));
    }
    
    @Bean
    public Credentials credentials() {
        try {
            // Private Key Admin (Ví Deploy)
            String privateKey = "e429b4a47ff6fc7068e3cfd3ab97c7bf39be1c2d14ab98444298199f8b59efce";
            return Credentials.create(privateKey);
        } catch (Exception e) {
            log.error("Error loading credentials", e);
            return null;
        }
    }
    
    @Bean
    public ContractGasProvider gasProvider() {
        BigInteger gasPrice = BigInteger.valueOf(30_000_000_000L); // 30 Gwei
        BigInteger gasLimit = BigInteger.valueOf(8_000_000L);
        return new StaticGasProvider(gasPrice, gasLimit);
    }
    
    @Bean
    public EnergyMarketplace energyMarketplace(Web3j web3j, Credentials credentials, ContractGasProvider gasProvider) {
        return EnergyMarketplace.load(marketplaceAddress, web3j, credentials, gasProvider);
    }

    @Bean
    public EnergyNFT energyNFT(Web3j web3j, Credentials credentials, ContractGasProvider gasProvider) {
        return EnergyNFT.load(nftAddress, web3j, credentials, gasProvider);
    }

    @Bean
    public LoyaltyProgram loyaltyProgram(Web3j web3j, Credentials credentials, ContractGasProvider gasProvider) {
        return LoyaltyProgram.load(loyaltyProgramAddress, web3j, credentials, gasProvider);
    }

    // --- BEAN MỚI ---
    @Bean
    public EnergyLending energyLending(Web3j web3j, Credentials credentials, ContractGasProvider gasProvider) {
        return EnergyLending.load(lendingAddress, web3j, credentials, gasProvider);
    }
}