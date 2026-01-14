package com.energymarket.service;

import com.energymarket.contracts.EnergyMarketplace;
import com.energymarket.contracts.EnergyMarketplace.NFTSoldEventResponse;
import com.energymarket.contracts.EnergyMarketplace.NFTMintedAndListedEventResponse;
import com.energymarket.dto.NFTAttributeDto;
import com.energymarket.dto.NFTMetadataDto;
import com.energymarket.model.NFT;
import com.energymarket.model.TransactionHistory;
import com.energymarket.repository.NFTRepository;
import com.energymarket.repository.TransactionHistoryRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.web3j.abi.EventEncoder;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.EthBlockNumber;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class BlockchainEventListenerService {

    private final Web3j web3j;
    private final EnergyMarketplace marketplace;
    private final MarketplaceService marketplaceService;
    private final TransactionHistoryRepository transactionHistoryRepository;
    private final NFTRepository nftRepository;
    private final NFTMetadataService nftMetadataService;

    @Value("${ipfs.gateway.url:https://gateway.pinata.cloud/ipfs/}")
    private String ipfsGatewayUrl;

    private BigInteger lastProcessedBlock;
    // Alchemy Free Tier giới hạn, để 5 block cho an toàn tuyệt đối
    private static final BigInteger MAX_BLOCK_RANGE = BigInteger.valueOf(5);

    public BlockchainEventListenerService(
        Web3j web3j,
        EnergyMarketplace marketplace,
        MarketplaceService marketplaceService,
        TransactionHistoryRepository transactionHistoryRepository,
        NFTRepository nftRepository,
        NFTMetadataService nftMetadataService
    ) {
        this.web3j = web3j;
        this.marketplace = marketplace;
        this.marketplaceService = marketplaceService;
        this.transactionHistoryRepository = transactionHistoryRepository;
        this.nftRepository = nftRepository;
        this.nftMetadataService = nftMetadataService;
    }

    @PostConstruct
    public void init() {
        try {
            EthBlockNumber blockNumber = web3j.ethBlockNumber().send();
            this.lastProcessedBlock = blockNumber.getBlockNumber();
            log.info("System initialized. Starting STATELESS polling from block: {}", lastProcessedBlock);
        } catch (Exception e) {
            log.error("Failed to get initial block number", e);
            this.lastProcessedBlock = BigInteger.ZERO;
        }
    }

    @Scheduled(fixedDelay = 5000)
    public void pollBlockchainEvents() {
        try {
            BigInteger currentBlockChainHead = web3j.ethBlockNumber().send().getBlockNumber();

            if (currentBlockChainHead.compareTo(lastProcessedBlock) <= 0) {
                return;
            }

            BigInteger endBlock = currentBlockChainHead;
            BigInteger diff = currentBlockChainHead.subtract(lastProcessedBlock);

            // Chia nhỏ range để không bị lỗi quá tải
            if (diff.compareTo(MAX_BLOCK_RANGE) > 0) {
                endBlock = lastProcessedBlock.add(MAX_BLOCK_RANGE);
            }

            log.info("Scanning Blockchain (Stateless): Block {} -> {}", lastProcessedBlock, endBlock);

            // --- CÁCH GỌI MỚI: DÙNG ETH_GETLOGS TRỰC TIẾP (KHÔNG DÙNG FILTER) ---
            processEventsInRange(lastProcessedBlock, endBlock);

            // Cập nhật block
            lastProcessedBlock = endBlock.add(BigInteger.ONE);

        } catch (Exception e) {
            log.error("Critical error during polling: {}", e.getMessage());
        }
    }

    private void processEventsInRange(BigInteger start, BigInteger end) {
        try {
            DefaultBlockParameter startParam = DefaultBlockParameter.valueOf(start);
            DefaultBlockParameter endParam = DefaultBlockParameter.valueOf(end);

            // Tạo bộ lọc thủ công
            EthFilter filter = new EthFilter(startParam, endParam, marketplace.getContractAddress());
            
            // Gọi trực tiếp eth_getLogs (Stateless call)
            EthLog ethLog = web3j.ethGetLogs(filter).send();
            List<EthLog.LogResult> logs = ethLog.getLogs();

            for (EthLog.LogResult logResult : logs) {
                Log logData = (Log) logResult.get();
                List<String> topics = logData.getTopics();

                if (topics == null || topics.isEmpty()) continue;

                String eventSignature = topics.get(0);

                // Kiểm tra xem log này thuộc sự kiện nào dựa trên mã băm (Signature)
                if (eventSignature.equals(EventEncoder.encode(EnergyMarketplace.NFTSOLD_EVENT))) {
                    // Convert log thô sang Object NFTSold
                    NFTSoldEventResponse typedEvent = EnergyMarketplace.getNFTSoldEventFromLog(logData);
                    handleNFTSoldEvent(typedEvent);
                } 
                else if (eventSignature.equals(EventEncoder.encode(EnergyMarketplace.NFTMINTEDANDLISTED_EVENT))) {
                    // Convert log thô sang Object Mint
                    NFTMintedAndListedEventResponse typedEvent = EnergyMarketplace.getNFTMintedAndListedEventFromLog(logData);
                    handleMintEvent(typedEvent);
                }
            }

        } catch (Exception e) {
            log.error("Error fetching logs in range [{} - {}]: {}", start, end, e.getMessage());
        }
    }

    // --- LOGIC XỬ LÝ DATABASE GIỮ NGUYÊN ---

    private void handleNFTSoldEvent(NFTSoldEventResponse event) {
        try {
            BigInteger tokenId = event.tokenId.getValue();
            
            // Check trùng lặp giao dịch (đề phòng quét lại block cũ)
            // (Đơn giản hóa: Cứ lưu, ID tự tăng sẽ lo phần unique)
            TransactionHistory history = TransactionHistory.builder()
                .tokenId(tokenId)
                .seller(event.seller.getValue())
                .buyer(event.buyer.getValue())
                .price(event.price.getValue())
                .fee(event.fee.getValue())
                .transactionDate(LocalDateTime.now())
                .build();
            
            transactionHistoryRepository.save(history);
            log.info(">>> SUCCESS: SAVED TRANSACTION for Token #{}", tokenId);
            
            marketplaceService.evictItem(tokenId);
            
            NFT nft = nftRepository.findById(tokenId).orElse(null);
            if (nft != null) {
                nft.setListed(false);
                nft.setOwner(event.buyer.getValue());
                nftRepository.save(nft);
            }
        } catch (Exception e) {
            log.error("Error saving Sold event", e);
        }
    }

    private void handleMintEvent(NFTMintedAndListedEventResponse event) {
        try {
            BigInteger tokenId = event.tokenId.getValue();
            if (nftRepository.existsById(tokenId)) return;

            String rawTokenURI = event.ipfsHash.getValue();
            log.info(">>> SUCCESS: DETECTED NEW MINT Token #{}", tokenId);

            String httpUrl = rawTokenURI;
            if (rawTokenURI.startsWith("ipfs://")) {
                httpUrl = rawTokenURI.replace("ipfs://", ipfsGatewayUrl);
            } else if (!rawTokenURI.startsWith("http")) {
                httpUrl = ipfsGatewayUrl + rawTokenURI;
            }

            String energyType = "Unknown";
            for (int i = 0; i < 3; i++) {
                try {
                    NFTMetadataDto metadata = nftMetadataService.fetchMetadata(httpUrl);
                    if (metadata != null && metadata.getAttributes() != null) {
                        for (NFTAttributeDto attr : metadata.getAttributes()) {
                            if ("Energy Source".equalsIgnoreCase(attr.getTrait_type())) {
                                energyType = attr.getValue();
                                break;
                            }
                        }
                        if (!"Unknown".equals(energyType)) break;
                    }
                } catch (Exception ex) {
                    Thread.sleep(1000);
                }
            }

            NFT newNFT = new NFT();
            newNFT.setTokenId(tokenId);
            newNFT.setOwner(event.seller.getValue());
            newNFT.setTokenURI(rawTokenURI);
            newNFT.setEnergyAmount(event.energyValue.getValue());
            newNFT.setPrice(event.price.getValue());
            newNFT.setListed(true);
            newNFT.setEnergyType(energyType);

            nftRepository.save(newNFT);
            marketplaceService.evictItem(tokenId);
        } catch (Exception e) {
            log.error("Error saving Mint event", e);
        }
    }
}