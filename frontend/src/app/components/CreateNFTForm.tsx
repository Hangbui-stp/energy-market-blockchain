import React, { useState, useEffect, useContext } from "react";
import { Web3 } from "./Web3";
import { ethers } from "ethers";
import { RefreshCw } from "lucide-react";

import MarketplaceABI from "../../contracts/MarketplaceABI.json";
import NFTABI from "../../contracts/NFTABI.json";

// 1. ĐỊNH NGHĨA DANH SÁCH ĐỊA ĐIỂM
const SOLAR_LOCATIONS = [
  "Tây Ninh - Dầu Tiếng - Solar Station",
  "Ninh Thuận - Trung Nam Thuận Bắc - Solar Station",
  "Thừa Thiên Huế - TTC Phong Điền - Solar Station"
];

const WIND_LOCATIONS = [
  "Đắk Lắk - Nhà máy điện gió Ea Nam - Wind Farm",
  "Bình Thuận - Phong điện 1 - Wind Farm",
  "Bình Thuận - đảo Phú Quý - Wind Farm",
  "Trà Vinh - Duyên Hải - Wind Farm",
  "Trà Vinh - Vĩnh Châu - Wind Farm"
];

export default function CreateNFTForm() {
  const { account, marketplace, nft, web3Handler } = useContext(Web3);

  // --- STATE ---
  const [marketRate, setMarketRate] = useState<string>("0");
  const [estimatedPrice, setEstimatedPrice] = useState<string>("0");

  const [energyAmount, setEnergyAmount] = useState<number>(0);
  
  // State cho Source và Location
  const [energySource, setEnergySource] = useState<string>("Solar");
  // Mặc định chọn địa điểm đầu tiên của danh sách Solar
  const [location, setLocation] = useState<string>(SOLAR_LOCATIONS[0]);
  
  // Biến xác định danh sách hiện tại để render (Solar hay Wind)
  const currentLocations = energySource === "Solar" ? SOLAR_LOCATIONS : WIND_LOCATIONS;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mintingSuccess, setMintingSuccess] = useState<boolean>(false);
  const [energyBalance, setEnergyBalance] = useState<string>("0");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const PINATA_HOST = process.env.NEXT_PUBLIC_PINATA_GATEWAY + "/ipfs/";
  const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "";
  const NFT_ADDRESS = process.env.NEXT_PUBLIC_NFT_ADDRESS || "";

  const fetchMarketData = async () => {
    if (marketplace) {
      try {
        const rateWei = await marketplace.pricePerKw();
        const rateEth = ethers.formatEther(rateWei);
        setMarketRate(rateEth);
      } catch (error) {
        console.error("Failed to fetch market rate.", error);
      }
    }
  };

  const fetchEnergyBalance = async () => {
    if (account && nft) {
      try {
        setIsRefreshing(true);
        const balance = await nft.getCurrentEnergy(account);
        setEnergyBalance(balance.toString());
      } catch (error) {
        console.error("Error fetching energy balance:", error);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (account) {
      fetchEnergyBalance();
      fetchMarketData();
    }
  }, [account, nft, marketplace]);

  useEffect(() => {
    if (energyAmount > 0 && marketRate !== "0") {
      const rate = parseFloat(marketRate);
      const total = energyAmount * rate;
      setEstimatedPrice(parseFloat(total.toFixed(18)).toString());
    } else {
      setEstimatedPrice("0");
    }
  }, [energyAmount, marketRate]);

  // --- HÀM XỬ LÝ KHI ĐỔI NGUỒN NĂNG LƯỢNG ---
  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSource = e.target.value;
    setEnergySource(selectedSource);
    
    // Tự động reset location về cái đầu tiên của danh sách mới để tránh lỗi dữ liệu cũ
    if (selectedSource === "Solar") {
      setLocation(SOLAR_LOCATIONS[0]);
    } else {
      setLocation(WIND_LOCATIONS[0]);
    }
  };

  const uploadToIPFS = async (): Promise<string | null> => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const response = await fetch("/api/ipfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ energyAmount, energySource, location }),
      });

      const data = await response.json();
      return response.ok ? data.ipfsHash : null;
    } catch (error: any) {
      setErrorMessage("Failed to upload metadata to IPFS");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const mintNFT = async (hash: string) => {
    try {
      if (!window.ethereum) {
        setErrorMessage("Please install MetaMask.");
        return;
      }

      setIsLoading(true);
      const NFT_URI = "https://cloudflare-ipfs.com/ipfs/" + hash; 

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const writeMarketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI, signer);
      const writeNft = new ethers.Contract(NFT_ADDRESS, NFTABI, signer);

      console.log("Approving Marketplace...");
      const approvalTx = await writeNft.setApprovalForAll(MARKETPLACE_ADDRESS, true);
      await approvalTx.wait(); 

      console.log("Minting & Listing...");
      const mintTx = await writeMarketplace.mintAndList(NFT_URI, energyAmount);
      await mintTx.wait();

      console.log("NFT minted successfully");
      setMintingSuccess(true);
      
      await fetchEnergyBalance();
      setEnergyAmount(0);

    } catch (error: any) {
      console.error("Error minting:", error);
      const reason = error.reason || error.message || "Unknown error";
      setErrorMessage("Failed to mint: " + reason);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMintingSuccess(false);

    try {
      if (!account) {
        await web3Handler();
      }

      if (energyAmount <= 0) {
        setErrorMessage("Energy amount must be greater than 0");
        return;
      }
      if (Number(energyAmount) > Number(energyBalance)) {
        setErrorMessage("Insufficient energy balance");
        return;
      }

      const hash = await uploadToIPFS();
      if (hash) await mintNFT(hash);
    } catch (error) {
      setErrorMessage("An error occurred. Please try again.");
    }
  };

  return (
    <div className="relative">
      <div className="bg-white bg-opacity-10 rounded-lg p-6 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Energy NFT</h2>
        
        <div className="mb-6 flex items-center space-x-2">
          <p className="text-lg text-white">Current Energy Balance: {energyBalance} kW</p>
          <button
            onClick={fetchEnergyBalance}
            disabled={isRefreshing}
            className="p-2 rounded-full hover:bg-white hover:bg-opacity-10 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-white ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          
          {/* 1. Energy Amount */}
          <div>
            <label className="block text-white mb-2">Energy Amount (kW)</label>
            <input
              type="number"
              value={energyAmount}
              onChange={(e) => setEnergyAmount(Number(e.target.value))}
              max={Number(energyBalance)}
              min={0}
              className="w-full p-2 rounded-lg bg-white bg-opacity-20 text-white border border-white border-opacity-20 placeholder-gray-300"
              required
            />
          </div>

          {/* 2. Price (Read-only) */}
          <div>
            <label className="block text-white mb-2">
                Price (ETH) 
                <span className="text-xs text-gray-400 ml-2 font-normal">
                    (Market Rate: {marketRate} ETH/kW)
                </span>
            </label>
            <input
              type="text"
              value={estimatedPrice}
              readOnly
              className="w-full p-2 rounded-lg bg-gray-600 bg-opacity-50 text-gray-200 border border-white border-opacity-20 cursor-not-allowed font-bold"
            />
          </div>

          {/* 3. Energy Source (Đã cập nhật onChange) */}
          <div>
            <label className="block text-white mb-2">Energy Source</label>
            <select
              value={energySource}
              onChange={handleSourceChange}
              className="w-full p-2 rounded-lg bg-white bg-opacity-20 text-white border border-white border-opacity-20 cursor-pointer"
              required
            >
              <option value="Solar" className="text-black bg-white">Solar</option>
              <option value="Wind" className="text-black bg-white">Wind</option>
            </select>
          </div>

          {/* 4. Location (Đã cập nhật để render theo danh sách tương ứng) */}
          <div>
            <label className="block text-white mb-2">Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-2 rounded-lg bg-white bg-opacity-20 text-white border border-white border-opacity-20 cursor-pointer"
              required
            >
              {currentLocations.map((loc) => (
                <option key={loc} value={loc} className="text-black bg-white">
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 w-full mt-4 font-semibold transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Mint NFT"}
          </button>
        </form>

        {mintingSuccess && (
          <div className="mt-4 p-3 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg">
            <p className="text-green-400 text-center">NFT minted successfully!</p>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg">
              <p className="text-red-500 text-center">{errorMessage}</p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="text-center">
            <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24 mb-4"></div>
            <h2 className="text-white text-2xl font-semibold">Processing...</h2>
            <p className="text-gray-300 mt-2 text-sm">Please check your wallet to confirm.</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .loader {
          border-top-color: #3498db;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}