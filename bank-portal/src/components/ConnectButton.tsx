"use client";
import { useContext } from "react";
import { Web3 } from "./Web3";
import { Wallet, LogOut, Zap } from "lucide-react";

export default function ConnectButton() {
  const { account, web3Handler, disconnectWallet } = useContext(Web3);

  // Nếu đã kết nối
  if (account) {
    return (
      <button
        onClick={disconnectWallet}
        className="group flex items-center gap-2 bg-slate-800 hover:bg-red-900/80 text-white px-4 py-2 rounded-full transition-all duration-300 border border-slate-700 hover:border-red-500/50"
      >
        {/* Icon Ví */}
        <div className="bg-emerald-500/20 p-1.5 rounded-full group-hover:bg-red-500/20 transition-colors">
            <Wallet size={14} className="text-emerald-400 group-hover:text-red-400" />
        </div>
        
        <div className="flex flex-col items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5 group-hover:text-red-300">Connected</span>
            <span className="font-mono text-sm font-bold leading-none">
                {account.slice(0, 6)}...{account.slice(-4)}
            </span>
        </div>
        
        <LogOut size={14} className="ml-2 text-slate-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
      </button>
    );
  }

  // Nếu chưa kết nối
  return (
    <button
      onClick={web3Handler}
      className="flex items-center gap-2 bg-[#0f172a] hover:bg-black text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 border border-slate-800"
    >
      <Zap size={18} className="text-emerald-400 fill-emerald-400" />
      <span>Connect Wallet</span>
    </button>
  );
}