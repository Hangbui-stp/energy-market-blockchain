// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {EnergyMarketplace} from "../src/EnergyMarketplace.sol";
import {EnergyNFT} from "../src/EnergyNFT.sol";
import {LoyaltyProgram} from "../src/LoyaltyProgram.sol";
import {EnergyLending} from "../src/EnergyLending.sol";

contract Deployment is Script {
    EnergyMarketplace public energyMarketplace;
    EnergyNFT public energyNFT;
    LoyaltyProgram public loyaltyProgram;
    EnergyLending public energyLending;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // 1. Deploy NFT & Loyalty trước
        energyNFT = new EnergyNFT();
        console.log("EnergyNFT deployed at:", address(energyNFT));

        loyaltyProgram = new LoyaltyProgram();
        console.log("LoyaltyProgram deployed at:", address(loyaltyProgram));

        // 2. Deploy Marketplace (Cần NFT + Loyalty)
        energyMarketplace = new EnergyMarketplace(
            address(energyNFT),
            address(loyaltyProgram)
        );
        console.log("EnergyMarketplace deployed at:", address(energyMarketplace));

        // 3. Deploy Lending (Cần NFT + Marketplace + Loyalty)
        // Đây là bước thay đổi để Lending có thể check doanh thu từ Market
        energyLending = new EnergyLending(
            address(energyNFT),
            address(energyMarketplace),
            address(loyaltyProgram)
        );
        console.log("EnergyLending deployed at:", address(energyLending));

        // ---------------------- SETUP PERMISSIONS ----------------------

        // 1. Set Marketplace Address cho NFT
        energyNFT.setMarketplaceAddress(address(energyMarketplace));
        console.log("Marketplace address set in NFT contract");

        // 2. CẤP QUYỀN MINT CHO LENDING CONTRACT
        energyNFT.setMinter(address(energyLending), true);
        console.log("Authorized EnergyLending contract to mint Energy");

        // 3. Set quyền cho Marketplace cộng điểm Loyalty
        loyaltyProgram.addAuthorizeCaller(address(energyMarketplace));
        console.log("Marketplace authorized in LoyaltyProgram");

        vm.stopBroadcast();
    }
}