"use client";

import { useState, useContext, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import NFTGrid from "./components/NFTGrid";
import ConnectButton from "./components/ConnectButton";
import MarketplaceAdmin from "./components/MarketplaceAdmin";
import { Web3Provider, Web3 } from "./components/Web3";
import * as APP_CONSTANT from "../constants/AppConstant";

// Tạo một component con để dùng context Web3 (vì Web3Provider bọc ở ngoài cùng)
function MainContent() {
  const { account, marketplace } = useContext(Web3);
  const [activeSection, setActiveSection] = useState<string>(
    APP_CONSTANT.HOME_MENU_ID
  );
  const [isOwner, setIsOwner] = useState(false);
  // Biến này để tránh màn hình nhấp nháy khi đang check quyền
  const [checkingOwner, setCheckingOwner] = useState(true);

  useEffect(() => {
    const checkOwner = async () => {
      if (account && marketplace) {
        try {
          // Lấy địa chỉ owner từ contract Marketplace
          const owner = await marketplace.owner();
          // So sánh địa chỉ (chuyển về chữ thường để so sánh chính xác)
          if (owner.toLowerCase() === account.toLowerCase()) {
            setIsOwner(true);
          } else {
            setIsOwner(false);
          }
        } catch (e) {
          console.error("Error checking owner:", e);
          setIsOwner(false);
        }
      } else {
        setIsOwner(false);
      }
      setCheckingOwner(false);
    };

    checkOwner();
  }, [account, marketplace]);

  // Nếu đang check hoặc chưa kết nối ví, hiển thị giao diện mặc định (User)
  // Nếu là Owner -> Hiển thị Admin Dashboard
  if (isOwner) {
    return <MarketplaceAdmin />;
  }

  // Nếu là User thường -> Hiển thị giao diện Marketplace cũ
  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />
      <main className="flex-1 p-8">
        <div className="flex justify-end mb-6">
          <ConnectButton />
        </div>
        <NFTGrid section={activeSection} />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Web3Provider>
      <MainContent />
    </Web3Provider>
  );
}