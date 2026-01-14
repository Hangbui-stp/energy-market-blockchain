import React, { useContext, useEffect, useState } from "react";
import { SidebarProps } from "../../types";
import { Web3 } from "../components/Web3";
import { useLoyaltyPoints } from "../../hooks/useLoyaltyPoints";
import { ethers } from "ethers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon, Wallet } from "lucide-react";
import Image from "next/image";
import * as APP_CONSTANT from "../../constants/AppConstant";

interface Discount {
  points: number;
  discountPercentage: number;
}

const useDiscountTiers = (loyaltyProgram: ethers.Contract | null) => {
  const [tiers, setTiers] = useState<Discount[]>([]);

  useEffect(() => {
    const fetchTiers = async () => {
      if (!loyaltyProgram) return;

      let tiersList = [];
      try {
        let index = 0;

        while (true) {
          try {
            const tier = await loyaltyProgram.discountTiers(index);
            tiersList.push({
              points: Number(tier.points),
              discountPercentage: Number(tier.discountPercentage),
            });
            index++;
          } catch (error) {
            break;
          }
        }

        setTiers(tiersList);
      } catch (error) {
        console.error("Error fetching discount tiers:", error);
        tiersList = [
          { points: 1000, discountPercentage: 5 },
          { points: 5000, discountPercentage: 8 },
          { points: 10000, discountPercentage: 10 },
        ];
        setTiers(tiersList);
      }
    };

    fetchTiers();
  }, [loyaltyProgram]);

  return tiers;
};

const useBaseCommissionRate = (marketplace: ethers.Contract | null) => {
  const [baseCommissionRate, setBaseCommissionRate] = useState<number>(2);

  useEffect(() => {
    const fetchCommissionRate = async () => {
      if (!marketplace) return;

      try {
        const rate = await marketplace.baseCommissionRate();
        setBaseCommissionRate(Number(rate));
      } catch (error) {
        console.error("Error fetching base commission rate:", error);
      }
    };

    fetchCommissionRate();
  }, [marketplace]);

  return baseCommissionRate;
};

const menuItems = [
  { id: APP_CONSTANT.HOME_MENU_ID, label: APP_CONSTANT.HOME_MENU_LABEL },
  { id: APP_CONSTANT.CREATE_MENU_ID, label: APP_CONSTANT.CREATE_MENU_LABEL },
  { id: APP_CONSTANT.LISTING_MENU_ID, label: APP_CONSTANT.LISTING_MENU_LABEL },
  {
    id: APP_CONSTANT.PURCHASED_MENU_ID,
    label: APP_CONSTANT.PURCHASED_MENU_LABEL,
  },
  { id: APP_CONSTANT.ANALYTICS_MENU_ID, 
    label: APP_CONSTANT.ANALYTICS_MENU_LABEL, 
    icon: InfoIcon },
];

export default function Sidebar({
  activeSection,
  setActiveSection,
}: SidebarProps) {
  const { account, marketplace, loyaltyProgram } = useContext(Web3);
  const loyaltyPoints = useLoyaltyPoints(account, loyaltyProgram);
  const tiers = useDiscountTiers(loyaltyProgram);
  const baseCommissionRate = useBaseCommissionRate(marketplace);

  return (
    <div className="w-64 bg-white bg-opacity-10 p-6">
      {/* --- PHẦN LOGO & TÊN ỨNG DỤNG --- */}
      <div className="mb-8 flex items-center gap-3">
        {/* Logo kích thước 40px (h-10 w-10) */}
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/20 shadow-sm">
          <Image
            src="/favicon.ico"
            alt="App Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        
        {/* THAY ĐỔI:
            - text-base: Cỡ chữ khoảng 16px (nhỏ hơn text-lg/text-xl trước đó).
            - font-bold: Vẫn giữ độ đậm để nổi bật.
            - whitespace-nowrap: Ép chữ luôn nằm trên 1 dòng.
        */}
        <h1 className="text-base font-bold text-white whitespace-nowrap">
          Green Energy NFT
        </h1>
      </div>
      {/* -------------------------------- */}

      <nav>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => account && setActiveSection(item.id)}
            className={`w-full flex items-center p-3 mb-4 rounded-lg text-white ${
              activeSection === item.id
                ? "bg-white bg-opacity-20"
                : "hover:bg-white hover:bg-opacity-10"
            } ${
              !account &&
              [
                APP_CONSTANT.CREATE_MENU_ID,
                APP_CONSTANT.LISTING_MENU_ID,
                APP_CONSTANT.PURCHASED_MENU_ID,
                APP_CONSTANT.BRIDGE_MENU_ID,
              ].includes(item.id)
                ? "cursor-not-allowed opacity-50"
                : ""
            }`}
            disabled={
              !account &&
              [
                APP_CONSTANT.CREATE_MENU_ID,
                APP_CONSTANT.LISTING_MENU_ID,
                APP_CONSTANT.PURCHASED_MENU_ID,
                APP_CONSTANT.BRIDGE_MENU_ID,
              ].includes(item.id)
            }
          >
            {item.label}
          </button>
        ))}
      </nav>
      {account && (
        <div className="w-full flex items-center p-3 mb-4 text-white">
          <span className="mr-2">Loyalty Points: {loyaltyPoints}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="bg-gray-800 text-white p-3 rounded-lg shadow-lg">
                <div className="space-y-2">
                  <h3 className="font-semibold">Loyalty Tiers</h3>
                  <p>Base Commission Rate: {baseCommissionRate}%</p>
                  {tiers.map((tier, index) => (
                    <div key={index}>
                      Tier {index + 1}: {tier.points.toLocaleString()} points -{" "}
                      {tier.discountPercentage}% discount
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}