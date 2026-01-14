// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {EnergyNFT} from "./EnergyNFT.sol";
import {ILoyaltyProgram} from "./ILoyaltyProgram.sol";

contract EnergyMarketplace is ReentrancyGuard, Ownable {
    uint8 public constant DEFAULT_BASE_COMMISSION_RATE = 1;
    uint256 private constant PRECISION = 100;

    // Giá thị trường (0.0001 ETH per kW)
    uint256 public pricePerKw = 0.0001 ether;

    EnergyNFT public nftContract;
    ILoyaltyProgram public loyaltyProgram;

    uint256 public itemCount;
    uint8 public baseCommissionRate;

    // --- QUAN TRỌNG: Lưu tổng doanh thu của user trên Blockchain ---
    mapping(address => uint256) public userRevenue;

    struct Item {
        uint256 tokenId;
        uint256 price;
        uint256 energyAmount;
        address seller;
        bool isActive;
    }

    mapping(uint256 => Item) public items;

    event NFTMintedAndListed(uint256 tokenId, address seller, string ipfsHash, uint256 energyValue, uint256 price);
    event NFTSold(uint256 tokenId, address seller, address buyer, uint256 price, uint256 fee);
    event ListingUpdated(uint256 tokenId, uint256 newPrice);
    event ListingCancelled(uint256 tokenId);
    event CommissionRateUpdated(uint256 newFeePercentage);
    event Withdrawal(address recipient, uint256 amount);
    event LoyaltyProgramUpdated(address newLoyaltyProgram);
    event MarketPriceUpdated(uint256 newPricePerKw);

    constructor(address _nftContract, address _loyaltyProgram) Ownable(msg.sender) {
        nftContract = EnergyNFT(_nftContract);
        loyaltyProgram = ILoyaltyProgram(_loyaltyProgram);
        baseCommissionRate = DEFAULT_BASE_COMMISSION_RATE;
    }

    function setMarketPricePerKw(uint256 _newPrice) external onlyOwner {
        pricePerKw = _newPrice;
        emit MarketPriceUpdated(_newPrice);
    }

    function setLoyaltyProgram(address _loyaltyProgram) external onlyOwner {
        require(_loyaltyProgram != address(0), "Invalid address");
        loyaltyProgram = ILoyaltyProgram(_loyaltyProgram);
        emit LoyaltyProgramUpdated(_loyaltyProgram);
    }

    function calculateFee(uint256 price, address seller) public view returns (uint256) {
        uint256 sellerPoints = loyaltyProgram.getLoyaltyPoints(seller);
        uint256 commissionRate = loyaltyProgram.getCommissionRate(sellerPoints, baseCommissionRate);
        return (price * commissionRate) / (100 * PRECISION);
    }

    function buyNFT(uint256 _tokenId) external payable nonReentrant {
        Item storage item = items[_tokenId];
        require(item.isActive, "NFT not for sale");
        require(msg.value >= item.price, "Insufficient payment");

        address seller = item.seller;
        uint256 price = item.price;
        uint256 fee = calculateFee(price, seller);
        uint256 sellerProceeds = price - fee;

        item.isActive = false;

        nftContract.transferFrom(seller, msg.sender, _tokenId);
        nftContract.transferEnergy(seller, msg.sender, _tokenId);

        // --- CỘNG DOANH THU ON-CHAIN ---
        userRevenue[seller] += price; 
        // -------------------------------

        loyaltyProgram.addLoyaltyPoints(seller, uint32(item.energyAmount / 10));

        payable(seller).transfer(sellerProceeds);

        emit NFTSold(_tokenId, seller, msg.sender, price, fee);
    }

    function updateCommissionRate(uint8 _newCommissionRate) external onlyOwner {
        require(_newCommissionRate > 0, "Commission rate cannot be less than 0");
        baseCommissionRate = _newCommissionRate;
        emit CommissionRateUpdated(_newCommissionRate);
    }

    function mintAndList(string memory _tokenURI, uint256 _energyAmount) external returns (uint256) {
        uint256 calculatedPrice = _energyAmount * pricePerKw;

        uint256 newTokenId = nftContract.mint(msg.sender, _tokenURI, _energyAmount);
        
        items[newTokenId] = Item(
            newTokenId,
            calculatedPrice,
            _energyAmount,
            msg.sender,
            true
        );
        
        emit NFTMintedAndListed(newTokenId, msg.sender, _tokenURI, _energyAmount, calculatedPrice);
        itemCount++;
        return newTokenId;
    }

    function withdrawFees(uint256 _amount) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance >= _amount, "Insufficient balance");
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Failed to withdraw fees");
        emit Withdrawal(owner(), _amount);
    }
}