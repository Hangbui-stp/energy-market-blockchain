import React, { useState, useContext, useEffect } from "react";
import Image from "next/image";
import { Zap, Tag, ShoppingCart, ImageOff } from "lucide-react";
import { Web3 } from "./Web3";
import { ethers } from "ethers";
import * as APP_CONSTANT from "../../constants/AppConstant";

interface NFTCardProps {
  id: number;
  title: string;
  price: string;
  energyAmount: number;
  seller: string;
  image?: string;
  description?: string;
  totalTrades?: number;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    unit?: string;
    fullValue?: string;
  }>;
  loadNFTs?: () => Promise<void>;
  activeSection: string;
}

const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Danh sách các Gateway để thử lần lượt
const GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/", // Ưu tiên 1: Nhanh nhất
  "https://ipfs.io/ipfs/",             // Ưu tiên 2: Ổn định
  "https://gateway.pinata.cloud/ipfs/",// Ưu tiên 3: Nguồn gốc (hay bị rate limit)
  "https://dweb.link/ipfs/"            // Ưu tiên 4: Dự phòng
];

export default function NFTCard({
  id,
  title,
  price,
  energyAmount,
  seller,
  image,
  description = "",
  totalTrades = 0,
  attributes = [],
  loadNFTs,
  activeSection,
}: NFTCardProps) {
  const { account, marketplace, web3Handler } = useContext(Web3);
  
  // --- LOGIC XỬ LÝ ẢNH THÔNG MINH ---
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isImgError, setIsImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Hàm trích xuất CID từ bất kỳ đường dẫn IPFS nào
  const extractCID = (url: string) => {
    if (!url) return null;
    // Tìm chuỗi bắt đầu bằng Qm... (CID v0) hoặc bafy... (CID v1)
    const match = url.match(/(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]+)/);
    return match ? match[0] : null;
  };

  useEffect(() => {
    if (image) {
      const cid = extractCID(image);
      if (cid) {
        // Bắt đầu thử với gateway đầu tiên
        setImgSrc(`${GATEWAYS[0]}${cid}`);
        setCurrentGatewayIndex(0);
        setIsImgError(false);
      } else {
        // Nếu không phải link IPFS, dùng link gốc (ví dụ link http thường)
        setImgSrc(image);
      }
    }
  }, [image]);

  const handleImageError = () => {
    // Nếu thử hết gateway mà vẫn lỗi thì thôi
    if (currentGatewayIndex < GATEWAYS.length - 1) {
      const nextIndex = currentGatewayIndex + 1;
      const cid = extractCID(image || "");
      if (cid) {
        console.log(`Image load failed. Switching to gateway: ${GATEWAYS[nextIndex]}`);
        setImgSrc(`${GATEWAYS[nextIndex]}${cid}`);
        setCurrentGatewayIndex(nextIndex);
      }
    } else {
      setIsImgError(true); // Đánh dấu là ảnh chết hẳn
    }
  };
  // ------------------------------------

  const isOwner =
    account && seller && account.toLowerCase() === seller.toLowerCase();

  const allAttributes = [
    {
      trait_type: "Seller",
      value: formatAddress(seller),
      fullValue: seller,
    },
    ...attributes,
  ];

  const handleBuy = async () => {
    try {
      setIsLoading(true);

      if (!account) {
        await web3Handler();
        return;
      }

      if (!marketplace) {
        alert("Marketplace contract not available");
        return;
      }

      if (isOwner) {
        alert("You cannot buy your own NFT");
        return;
      }

      const cleanPrice = price.replace(" ETH", "").toLowerCase();
      let priceInWei;
      try {
        if (cleanPrice.includes("e-")) {
          const [base, exponent] = cleanPrice.split("e-");
          const baseNum = parseFloat(base);
          const exp = parseInt(exponent);
          const weiExponent = 18 - exp;
          priceInWei = ethers.getBigInt(
            Math.floor(baseNum * Math.pow(10, weiExponent))
          );
        } else {
          priceInWei = ethers.parseEther(cleanPrice);
        }
      } catch (error) {
        throw new Error(`Invalid price format: ${cleanPrice}`);
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplaceWithSigner = marketplace.connect(signer);

      const transaction = await marketplaceWithSigner.buyNFT(id, {
        value: priceInWei,
      });

      await transaction.wait();

      alert(`Successfully purchased NFT #${id}. The dashboard will update shortly.`);
      
      if (loadNFTs) {
         await loadNFTs();
      }

    } catch (error: any) {
      console.error("Error buying NFT:", error);
      if (error.message.includes("UNSUPPORTED_OPERATION")) {
        alert(`Failed to purchase NFT: Please check your wallet connection`);
      } else {
        alert(`Failed to purchase NFT: ${error.reason || error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="relative bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
        {/* Image Section */}
        <div className="relative w-full h-48 shrink-0 bg-gray-100 group">
          {imgSrc && !isImgError ? (
            <Image
              src={imgSrc}
              alt={title}
              fill
              className="object-cover transition-opacity duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onError={handleImageError}
              priority={false}
              unoptimized={true} // Tắt tối ưu hóa server để browser tự retry
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center flex-col gap-2">
              <ImageOff className="w-10 h-10 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Image Unavailable</span>
            </div>
          )}
          
          {/* Badge: Energy Amount */}
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10 shadow-sm border border-white/10">
            <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="font-bold">{energyAmount} kW</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-1 truncate" title={title}>{title}</h3>
          
          {description && (
            <p className="text-xs text-gray-500 mb-4 line-clamp-2 h-8 leading-4">{description}</p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4 mt-auto">
            {allAttributes.slice(0, 3).map((attr, index) => (
              <div
                key={index}
                className={`bg-gray-50 p-2 rounded-lg border border-gray-100 ${
                  attr.trait_type === "Seller" ? "col-span-2" : ""
                }`}
              >
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{attr.trait_type}</p>
                <p
                  className="text-xs font-semibold text-gray-700 truncate"
                  title={attr.trait_type === "Seller" ? attr.fullValue : undefined}
                >
                  {attr.value} {attr.unit || ""}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-end pt-3 border-t border-gray-100 mt-2">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Current Price</p>
              <p className="text-lg font-black text-blue-600 leading-none">{price}</p>
            </div>

            <div className="flex items-center gap-2">
                {totalTrades > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200" title="Total trades">
                        <Tag className="w-3 h-3" />
                        <span>{totalTrades} Sold</span>
                    </div>
                )}

                {activeSection === APP_CONSTANT.HOME_MENU_ID && (
                <button
                    className={`px-4 py-2 rounded-lg transition-all text-sm font-bold flex items-center gap-1.5 shadow-sm active:scale-95 ${
                    isLoading
                        ? "bg-gray-300 text-white cursor-not-allowed"
                        : !account
                        ? "bg-slate-800 text-white hover:bg-slate-900"
                        : isOwner
                        ? "bg-emerald-50 text-emerald-600 cursor-not-allowed border border-emerald-200"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                    }`}
                    disabled={
                    isLoading ||
                    !account ||
                    (account && seller && account.toLowerCase() === seller.toLowerCase())
                    }
                    onClick={handleBuy}
                >
                    {isLoading ? (
                        "Processing..."
                    ) : isOwner ? (
                        "Owned"
                    ) : (
                        <>
                            Buy <ShoppingCart className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
                )}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="text-center bg-white p-8 rounded-2xl shadow-2xl max-w-sm mx-4">
            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4 mx-auto"></div>
            <h2 className="text-gray-900 text-xl font-bold mb-2">Confirm Transaction</h2>
            <p className="text-gray-500 text-sm">Please approve the transaction in your wallet to complete the purchase.</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .loader {
          border-top-color: #2563eb;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}