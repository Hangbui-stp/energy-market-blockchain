"use client";

import { useState, useContext, useEffect } from "react";
import { Web3 } from "./Web3"; 
import ConnectButton from "./ConnectButton";
import { 
  Landmark, History, Wallet, ArrowRight, TrendingUp, ShieldCheck, 
  FileText, Zap, CheckCircle2, AlertCircle, RefreshCw, Lock, Coins, 
  LogOut, PiggyBank
} from "lucide-react";
import { ethers } from "ethers";

// --- START: CONFIG SECTION ---
const LENDING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LENDING_ADDRESS || "";

const LENDING_ABI_SHORT = [
  "function repayLoan(uint256 _loanId) external payable",
  "function loanCounter() external view returns (uint256)",
  "function owner() view returns (address)", 
  "function withdraw(uint256 _amount) external"
];
// --- END: CONFIG SECTION ---

function BankDashboard() {
  const { account } = useContext(Web3);
  const [creditData, setCreditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'borrow' | 'history'>('borrow');
  
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [loanTerm, setLoanTerm] = useState<number>(6); 
  const [myLoans, setMyLoans] = useState<any[]>([]);

  // --- STATE ADMIN ---
  const [isOwner, setIsOwner] = useState(false);
  const [contractBalance, setContractBalance] = useState<string>("0");
  const [withdrawAmount, setWithdrawAmount] = useState<string>(""); // State mới cho ô nhập tiền

  // --- API CALLS ---
  const checkCredit = async () => {
    if (!account) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bank/credit-score?account=${account}`);
      const data = await res.json();
      setCreditData(data);
      if(data.maxLoanLimit > 0) {
          const defaultAmount = parseFloat((data.maxLoanLimit / 2).toFixed(2));
          setLoanAmount(defaultAmount < 0.01 ? 0.01 : defaultAmount);
      } else {
          setLoanAmount(0);
      }
    } catch (e) { console.error("Error fetching credit score:", e); } finally { setLoading(false); }
  };

  const fetchLoans = async () => {
    if (!account) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bank/loans?account=${account}`);
      if (res.ok) {
        const data = await res.json();
        setMyLoans(data.reverse());
      }
    } catch (e) { console.error("Error fetching loans:", e); }
  };

  // --- HOOKS (ĐẶT TẤT CẢ LÊN TRÊN CÙNG ĐỂ TRÁNH LỖI REACT) ---

  // 1. Check Admin Hook
  useEffect(() => {
    const checkOwnerAndBalance = async () => {
        if (!account || !window.ethereum) return;
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const lendingContract = new ethers.Contract(LENDING_CONTRACT_ADDRESS, LENDING_ABI_SHORT, provider);
            
            let ownerAddr: string | null = null;

try {
    ownerAddr = await lendingContract.owner();
} catch (e) {
    console.warn("owner() not available or wrong network", e);
    setIsOwner(false);
    return;
}

if (
    ownerAddr &&
    ownerAddr.toLowerCase() === account.toLowerCase()
) {
    setIsOwner(true);
    const balance = await provider.getBalance(LENDING_CONTRACT_ADDRESS);
    setContractBalance(ethers.formatEther(balance));
} else {
    setIsOwner(false);
}

        } catch (error) {
            console.error("Error checking owner:", error);
        }
    };
    checkOwnerAndBalance();
  }, [account]);

  // 2. Fetch User Data Hook (Chạy kể cả là Admin để tránh lỗi Hook order, nhưng logic hiển thị sẽ chặn sau)
  useEffect(() => {
    if (account) {
        checkCredit();
        fetchLoans();
    }
  }, [account]);

  // --- ACTIONS ---

  const handleLoanApply = async () => {
    if(!creditData || loanAmount <= 0) return;
    const interestRate = creditData.interestRate || 0;
    const totalRepay = loanAmount + (loanAmount * interestRate * (loanTerm / 12));
    const energyKw = (loanAmount * 10000).toLocaleString();
    if (!confirm(`CONFIRM LOAN REQUEST\n----------------\nReceive: ${energyKw} kW Energy (Minted On-Chain)\nRepayment Obligation: ${totalRepay.toFixed(4)} ETH`)) return;
    setLoading(true);
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bank/apply`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account, amount: loanAmount, duration: loanTerm })
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Loan Approved on Blockchain!\nMessage: ${result.message}`);
            checkCredit(); fetchLoans(); setActiveTab('history'); 
        } else {
            alert("Loan Failed: " + (result.error || "Unknown Error"));
        }
    } catch (error) { console.error(error); alert("Network Error"); } finally { setLoading(false); }
  };

  const handleRepay = async (loan: any) => {
    if (!window.ethereum) { alert("Please install MetaMask!"); return; }
    const match = loan.description ? loan.description.match(/ID:\s*(\d+)/) : null;
    if(!match) { alert("Error: Cannot find Blockchain Loan ID."); return; }
    const onChainId = match[1];
    if(!confirm(`CONFIRM REPAYMENT\nPay ${loan.totalRepayment.toFixed(4)} ETH for Loan #${onChainId}?`)) return;
    setLoading(true);
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const lendingContract = new ethers.Contract(LENDING_CONTRACT_ADDRESS, LENDING_ABI_SHORT, signer);
        console.log(`Repaying Loan #${onChainId}...`);
        const tx = await lendingContract.repayLoan(onChainId, { value: ethers.parseEther(loan.totalRepayment.toString()) });
        console.log("Transaction sent:", tx.hash);
        alert("Transaction Sent! Waiting for confirmation...");
        await tx.wait(); 
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/bank/repay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loanId: loan.id }) });
        alert("Repayment Successful on Blockchain!");
        fetchLoans(); checkCredit();
    } catch (error: any) { console.error("Repay Error:", error); alert("Transaction Failed: " + (error.reason || error.message)); } finally { setLoading(false); }
  };

  // 3. ADMIN RÚT TIỀN (SỬA DÙNG INPUT STATE THAY VÌ PROMPT)
  const handleWithdraw = async () => {
      if (!window.ethereum) return;
      if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
          alert("Please enter a valid amount!");
          return;
      }
      
      if (parseFloat(withdrawAmount) > parseFloat(contractBalance)) {
          alert("Insufficient funds in Vault!");
          return;
      }

      setLoading(true);
      try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const lendingContract = new ethers.Contract(LENDING_CONTRACT_ADDRESS, LENDING_ABI_SHORT, signer);

          const tx = await lendingContract.withdraw(ethers.parseEther(withdrawAmount));
          alert("Withdrawing funds to Admin Wallet...");
          await tx.wait();
          
          alert("Withdrawal Successful!");
          setWithdrawAmount(""); // Reset ô nhập
          window.location.reload(); 
      } catch (error: any) {
          console.error(error);
          alert("Withdrawal Failed: " + (error.reason || error.message));
      } finally {
          setLoading(false);
      }
  }

  // --- UI RENDER: LOGIN SCREEN ---
  if (!account) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center mb-6 text-white shadow-lg"><Landmark size={32} /></div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">DeFi Bank Portal</h1>
            <p className="text-slate-500 mb-8 text-sm">Financing for renewable energy assets.</p>
            <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
  );

  // --- GIAO DIỆN 1: DÀNH RIÊNG CHO ADMIN ---
  if (isOwner) {
      return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
            <nav className="border-b border-white/10 bg-slate-950 px-8 h-20 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500"><Lock size={24}/></div>
                    <span className="text-xl font-bold tracking-widest text-amber-500">ADMIN<span className="text-white">VAULT</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">OWNER MODE</span>
                    <ConnectButton />
                </div>
            </nav>

            <main className="flex-grow flex items-center justify-center p-6">
                <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <h1 className="text-5xl font-black leading-tight">Liquidity <br/><span className="text-amber-500">Management</span></h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Welcome back, Owner. <br/>
                            Manage the bank's liquidity pool securely. Funds collected from borrower repayments are stored here.
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Status</div>
                                <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 size={18}/> Operational</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-slate-500 text-xs font-bold uppercase mb-1">Smart Contract</div>
                                <div className="text-white font-mono text-sm truncate" title={LENDING_CONTRACT_ADDRESS}>
                                    {LENDING_CONTRACT_ADDRESS.substring(0, 10)}...
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VAULT CARD: Đã sửa lại chỗ nhập tiền */}
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-orange-600 rounded-[24px] blur opacity-40 group-hover:opacity-75 transition duration-1000"></div>
                        <div className="relative bg-slate-950 rounded-[22px] p-8 border border-white/10 h-full flex flex-col justify-between overflow-hidden">
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                            <div>
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h3 className="text-amber-500 font-bold text-sm uppercase tracking-widest mb-1">Vault Balance</h3>
                                        <p className="text-xs text-slate-500">Available ETH for withdrawal</p>
                                    </div>
                                    <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
                                        <Coins size={32} />
                                    </div>
                                </div>
                                <div className="text-6xl font-black text-white mb-2 tracking-tighter">
                                    {parseFloat(contractBalance).toFixed(4)} 
                                    <span className="text-2xl text-slate-600 font-bold ml-2">ETH</span>
                                </div>
                            </div>

                            {/* KHU VỰC NHẬP TIỀN RÚT (MỚI) */}
                            <div className="mt-12 pt-8 border-t border-white/10">
                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block tracking-wider">Amount to Withdraw</label>
                                <div className="flex gap-3">
                                    <input 
                                        type="number" 
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.0" 
                                        className="flex-1 bg-slate-900 border border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-700"
                                    />
                                    <button 
                                        onClick={handleWithdraw}
                                        disabled={parseFloat(contractBalance) <= 0 || loading || !withdrawAmount}
                                        className="px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" /> : <LogOut size={18} className="rotate-0"/>}
                                        Withdraw
                                    </button>
                                </div>
                                {parseFloat(contractBalance) <= 0 && (
                                    <p className="text-center text-xs text-slate-600 mt-3 italic">Vault is currently empty.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
      )
  }

  // --- GIAO DIỆN USER (Giữ nguyên) ---
  const interestRate = creditData?.interestRate || 0;
  const estimatedInterest = loanAmount * interestRate * (loanTerm / 12);
  const totalRepayUI = loanAmount + estimatedInterest;
  const energyGenerated = (loanAmount * 10000).toLocaleString();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      <nav className="bg-slate-900 text-white sticky top-0 z-50 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <div className="bg-white/10 p-2 rounded-lg"><Landmark className="text-emerald-400 w-6 h-6" /></div>
                 <span className="text-xl font-bold tracking-tight">DeFi<span className="text-emerald-400">Bank</span></span>
            </div>
            <div><ConnectButton /></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600"><ShieldCheck size={20}/></div>
                        <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">Credit Rating</span>
                    </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900">{creditData ? creditData.creditRating.split(" ")[0] : "-"} <span className="text-sm font-bold text-emerald-600 ml-2 bg-emerald-50 px-2 py-1 rounded">{creditData ? `${creditData.loyaltyPoints} PTS` : "-"}</span></h2>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600"><TrendingUp size={20}/></div>
                        <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">Borrow Limit</span>
                    </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900">{creditData ? creditData.maxLoanLimit.toFixed(2) : "0.00"} <span className="text-lg font-bold text-slate-400 ml-1">ETH</span></h2>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400 font-medium"><CheckCircle2 size={12} className="text-emerald-500" /><span>Verified on-chain</span></div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-2.5 rounded-lg text-purple-600"><FileText size={20}/></div>
                        <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">Active Loans</span>
                    </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900">{myLoans.filter(l => l.status === 'APPROVED').length} <span className="text-lg font-bold text-slate-400 ml-1">LOANS</span></h2>
            </div>
        </div>

        <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm inline-flex">
                <button onClick={() => setActiveTab('borrow')} className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'borrow' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}><Wallet size={16} /> Borrow Capital</button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}><History size={16} /> Loan History</button>
            </div>
        </div>

        {activeTab === 'borrow' ? (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-300">
                <div className="lg:col-span-7">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">Configure Loan</h3>
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        {creditData ? (
                            <div className="space-y-8">
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                    <div className="flex justify-between mb-2"><label className="text-slate-500 font-bold text-xs uppercase tracking-wider">Loan Amount</label><div className="text-right"><span className="text-3xl font-black text-slate-900">{loanAmount}</span><span className="text-lg font-bold text-slate-400 ml-1">ETH</span></div></div>
                                    <input type="range" min="0.01" max={creditData.maxLoanLimit > 0.01 ? creditData.maxLoanLimit : 0.01} step="0.01" value={loanAmount} onChange={(e) => { const val = parseFloat(e.target.value); if(val <= creditData.maxLoanLimit) setLoanAmount(val); }} disabled={creditData.maxLoanLimit <= 0.01} className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${creditData.maxLoanLimit <= 0.01 ? 'bg-slate-200' : 'bg-slate-300 accent-emerald-600 hover:accent-emerald-500'}`} />
                                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide"><span>Min: 0.01 ETH</span><span>Limit: {creditData.maxLoanLimit.toFixed(2)} ETH</span></div>
                                </div>
                                <div>
                                    <label className="text-slate-500 font-bold text-xs uppercase mb-3 block tracking-wider">Repayment Term</label>
                                    <div className="grid grid-cols-4 gap-3">{[3, 6, 12, 24].map(m => (<button key={m} onClick={() => setLoanTerm(m)} className={`py-3 rounded-lg text-sm font-bold border transition-all ${loanTerm === m ? 'border-slate-900 bg-slate-900 text-white shadow-md transform -translate-y-0.5' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}>{m} Months</button>))}</div>
                                </div>
                                {creditData.maxLoanLimit > 0.01 ? (
                                    <button onClick={handleLoanApply} disabled={loading || loanAmount <= 0} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold text-md shadow-lg shadow-emerald-200/50 transition-all flex items-center justify-center gap-2 hover:-translate-y-1 active:translate-y-0">{loading ? <><RefreshCw className="animate-spin mr-2"/> Processing Blockchain Tx...</> : <>Confirm & Mint Energy <ArrowRight size={18}/></>}</button>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 w-full bg-slate-100 text-slate-400 py-4 rounded-xl font-bold border border-slate-200 cursor-not-allowed"><AlertCircle size={18}/> Credit Limit too low to borrow</div>
                                )}
                            </div>
                        ) : <div className="text-center py-12 text-slate-400">Loading credit data...</div>}
                    </div>
                </div>
                <div className="lg:col-span-5 h-full flex flex-col">
                    <div className="h-7 mb-4 lg:block hidden"></div> 
                    <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden border border-slate-800 flex-grow">
                        <div className="absolute top-0 right-0 opacity-[0.03] pointer-events-none"><Zap size={300} /></div>
                        <div className="relative z-10">
                            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Payment Breakdown</h3>
                            <div className="space-y-5 text-sm">
                                <div className="flex justify-between items-center text-slate-400"><span>Principal</span><span className="text-white font-bold text-lg">{loanAmount} ETH</span></div>
                                <div className="flex justify-between items-center text-slate-400"><span>Interest ({(creditData?.interestRate * 100 || 0).toFixed(1)}%)</span><span className="text-emerald-400 font-bold">+ {(loanAmount * (creditData?.interestRate || 0) * (loanTerm / 12)).toFixed(4)} ETH</span></div>
                                <div className="flex justify-between items-center text-slate-400"><span>Term Length</span><span className="text-white font-bold">{loanTerm} Months</span></div>
                                <div className="pt-6 mt-2 border-t border-slate-800 flex justify-between items-end"><span className="text-slate-300 font-bold">Total Repayment</span><span className="text-3xl font-black text-white">{(loanAmount + (loanAmount * (creditData?.interestRate || 0) * (loanTerm / 12))).toFixed(4)} <span className="text-base text-slate-500 font-medium">ETH</span></span></div>
                            </div>
                        </div>
                        <div className="mt-8 relative z-10 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1"><Zap className="text-emerald-400 fill-emerald-400" size={16}/><p className="text-emerald-200 text-xs font-bold uppercase tracking-wider">Energy Asset Minted</p></div>
                            <h2 className="text-2xl font-bold text-white">{(loanAmount * 10000).toLocaleString()} <span className="text-sm text-emerald-400/70 font-medium ml-1">kW</span></h2>
                            <p className="text-xs text-slate-400 mt-2">Energy tokens will be minted to your wallet immediately upon approval.</p>
                        </div>
                    </div>
                </div>
             </div>
        ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                     <h3 className="font-bold text-slate-900">Your Transactions</h3>
                     <button onClick={fetchLoans} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><tr><th className="px-6 py-3 font-bold">Loan ID</th><th className="px-6 py-3 font-bold">Date</th><th className="px-6 py-3 font-bold">Amount</th><th className="px-6 py-3 font-bold">Total Repay</th><th className="px-6 py-3 font-bold">Status</th><th className="px-6 py-3 font-bold text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {myLoans.map(loan => {
                                const onChainId = loan.description ? loan.description.match(/ID:\s*(\d+)/)?.[1] : "N/A";
                                return (
                                <tr key={loan.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs"><span className="bg-slate-100 px-2 py-1 rounded">#{onChainId}</span></td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : "-"}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900">{loan.principalAmount} ETH</td>
                                    <td className="px-6 py-4 text-slate-600">{loan.totalRepayment.toFixed(4)}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex w-fit items-center gap-1 ${loan.status === 'APPROVED' ? 'bg-amber-50 text-amber-700 border-amber-200' : loan.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{loan.status === 'PAID' && <CheckCircle2 size={10}/>}{loan.status}</span></td>
                                    <td className="px-6 py-4 text-right">{loan.status === 'APPROVED' && (<button onClick={() => handleRepay(loan)} disabled={loading} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "..." : "Repay"}</button>)}</td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {myLoans.length === 0 && <div className="p-16 text-center text-slate-400"><FileText size={32} className="mx-auto mb-2 opacity-20"/><p className="text-sm">No transaction history found.</p></div>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default BankDashboard;

