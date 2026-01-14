"use client";

import { useState, useEffect, useContext } from "react";
import { Web3 } from "./Web3";
import { ethers } from "ethers";
import { Lock, Coins, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import ConnectButton from "./ConnectButton";

export default function MarketplaceAdmin() {
  const { account, marketplace } = useContext(Web3);
  const [contractBalance, setContractBalance] = useState<string>("0");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Lấy số dư của Smart Contract Marketplace
  const fetchBalance = async () => {
    if (window.ethereum && marketplace) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(await marketplace.getAddress());
        setContractBalance(ethers.formatEther(balance));
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [marketplace, account]);

  const handleWithdraw = async () => {
    if (!marketplace) return;
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("Please enter a valid amount!");
      return;
    }
    if (parseFloat(withdrawAmount) > parseFloat(contractBalance)) {
      alert("Insufficient funds in Marketplace!");
      return;
    }

    setLoading(true);
    try {
      // Gọi hàm withdrawFees từ Smart Contract Marketplace
      const amountWei = ethers.parseEther(withdrawAmount);
      const tx = await marketplace.withdrawFees(amountWei);
      
      alert("Withdrawing fees to Admin Wallet...");
      await tx.wait();

      alert("Withdrawal Successful!");
      setWithdrawAmount("");
      fetchBalance(); // Cập nhật lại số dư
    } catch (error: any) {
      console.error(error);
      alert("Withdrawal Failed: " + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <nav className="border-b border-white/10 bg-slate-950 px-8 h-20 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500"><Lock size={24}/></div>
          <span className="text-xl font-bold tracking-widest text-emerald-500">MARKET<span className="text-white">ADMIN</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">OWNER MODE</span>
          <ConnectButton />
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center p-6">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl font-black leading-tight">Marketplace <br/><span className="text-emerald-500">Revenue</span></h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Welcome, Marketplace Owner. <br/>
              Manage the platform fees collected from NFT trades. 
              Ensure liquidity is withdrawn securely to your cold wallet.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="text-slate-500 text-xs font-bold uppercase mb-1">System Status</div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 size={18}/> Active</div>
              </div>
            </div>
          </div>

          {/* VAULT CARD */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[24px] blur opacity-40 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative bg-slate-950 rounded-[22px] p-8 border border-white/10 h-full flex flex-col justify-between overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div>
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h3 className="text-emerald-500 font-bold text-sm uppercase tracking-widest mb-1">Platform Fees</h3>
                    <p className="text-xs text-slate-500">Available ETH to withdraw</p>
                  </div>
                  <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                    <Coins size={32} />
                  </div>
                </div>
                <div className="text-6xl font-black text-white mb-2 tracking-tighter">
                  {parseFloat(contractBalance).toFixed(4)}
                  <span className="text-2xl text-slate-600 font-bold ml-2">ETH</span>
                </div>
              </div>

              {/* INPUT RÚT TIỀN */}
              <div className="mt-12 pt-8 border-t border-white/10">
                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block tracking-wider">Amount to Withdraw</label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 bg-slate-900 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-700"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={parseFloat(contractBalance) <= 0 || loading || !withdrawAmount}
                    className="px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? <RefreshCw className="animate-spin" /> : <LogOut size={18} className="rotate-0"/>}
                    Withdraw
                  </button>
                </div>
                {parseFloat(contractBalance) <= 0 && (
                   <p className="text-center text-xs text-slate-600 mt-3 italic">No fees collected yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}