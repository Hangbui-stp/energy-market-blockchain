import React, { useEffect, useState, useContext } from "react";
import { Web3 } from "./Web3";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { DollarSign, Zap, Activity, Box } from "lucide-react";

interface ChartItem {
  name: string;
  value: number;
}

interface AnalyticsData {
  totalRevenue: number;
  totalEnergy: number;
  totalNFTs: number;
  totalTransactions: number;
  revenueChart: ChartItem[];
  energyTypeChart: ChartItem[];
  energyOutputChart: ChartItem[];
}

const PIE_COLORS = ['#FDB931', '#60A5FA', '#E5E7EB', '#F59E0B'];

export default function AnalyticsDashboard() {
  const { account } = useContext(Web3);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // State để lưu số liệu đã được làm sạch
  const [cleanTotalNFTs, setCleanTotalNFTs] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/analytics?account=${account || ''}`;
        
        const res = await fetch(url);
        if (res.ok) {
          const result: AnalyticsData = await res.json();
          setData(result);
          
          // --- LOGIC MỚI: Tính lại tổng số NFT hợp lệ ---
          // Lấy tổng số lượng từ biểu đồ Pie (đã loại bỏ Unknown/Other)
          // để hiển thị con số chính xác trên Card
          const validEnergyTypes = (result.energyTypeChart || []).filter(
             item => item.name !== 'Unknown' && item.name !== 'Other'
          );
          
          // Tổng số NFT hợp lệ = Tổng giá trị của các loại năng lượng hợp lệ
          const totalValid = validEnergyTypes.reduce((sum, item) => sum + item.value, 0);
          
          // Nếu con số này quá nhỏ so với thực tế (do backend trả về group), 
          // ta có thể dùng cách trừ đi số lượng Unknown
          const unknownCount = (result.energyTypeChart || [])
            .filter(item => item.name === 'Unknown' || item.name === 'Other')
            .reduce((sum, item) => sum + item.value, 0);
            
          setCleanTotalNFTs(result.totalNFTs - unknownCount);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [account]);

  if (loading) return <div className="text-white text-center p-10 animate-pulse">Loading Analytics...</div>;
  if (!data) return <div className="text-white text-center p-10">No Data Available</div>;

  const safeNumber = (num: any) => {
    return num ? Number(num) : 0;
  };

  // Lọc dữ liệu cho biểu đồ Pie
  const cleanPieData = (data.energyTypeChart || []).filter(
    item => item.name !== 'Unknown' && item.name !== 'Other'
  );

  const KPICard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white bg-opacity-10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-lg flex items-center gap-4 transition-transform hover:-translate-y-1">
      <div className={`p-3 rounded-full ${color} bg-opacity-20 border border-white/10`}>
        <Icon className={`w-8 h-8 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-gray-200 text-sm font-medium opacity-80">{title}</p>
        <h4 className="text-2xl font-bold text-white tracking-wide">{value}</h4>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end mb-2">
         <h2 className="text-3xl font-bold text-white drop-shadow-md">Analytics Overview</h2>
         {account && <span className="text-sm text-gray-300 bg-black/20 px-3 py-1 rounded-full">Viewing Personal Stats</span>}
      </div>
      
      {/* --- KPI CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
            title={account ? "Your Revenue" : "Market Revenue"} 
            value={`${safeNumber(data.totalRevenue).toFixed(4)} ETH`} 
            icon={DollarSign} 
            color="bg-emerald-400" 
        />
        <KPICard 
            title="Total Energy (Market)" 
            value={`${safeNumber(data.totalEnergy).toLocaleString()} kW`} 
            icon={Zap} 
            color="bg-yellow-400" 
        />
        <KPICard 
            title="Active NFTs (Valid)" 
            // SỬA: Hiển thị số lượng đã được làm sạch (trừ đi Unknown)
            value={safeNumber(cleanTotalNFTs)} 
            icon={Box} 
            color="bg-blue-400" 
        />
        <KPICard 
            title={account ? "Your Sales" : "Total Tx"} 
            value={safeNumber(data.totalTransactions)} 
            icon={Activity} 
            color="bg-purple-400" 
        />
      </div>

      {/* --- CHARTS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Revenue */}
        <div className="lg:col-span-2 bg-black bg-opacity-20 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-2">
            {account ? "Your Revenue Trend" : "Market Revenue Trend"}
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#E5E7EB" tick={{fontSize: 12}} />
                <YAxis stroke="#E5E7EB" tick={{fontSize: 12}} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff' }}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                />
                <Bar dataKey="value" fill="#34D399" radius={[4, 4, 0, 0]} name="ETH" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Pie Chart */}
        <div className="lg:col-span-1 bg-black bg-opacity-20 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-2 border-b border-white/10 pb-2">Energy Source Mix</h3>
          <div className="flex-1 min-h-[300px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cleanPieData} 
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {cleanPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#000000',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                    }}
                    itemStyle={{ color: '#FFFFFF' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#fff' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Energy Output Trend (ĐÃ SỬA TIÊU ĐỀ) */}
        <div className="lg:col-span-3 bg-black bg-opacity-20 border border-white/10 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
          {/* Cập nhật tiêu đề để phản ánh đúng nội dung mới */}
          <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-2">
            Energy Output Trend
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.energyOutputChart || []}>
                <defs>
                  <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FBBF24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                
                {/* Thêm label cho trục X và Y để rõ ràng hơn */}
                <XAxis 
                    dataKey="name" 
                    stroke="#E5E7EB" 
                    tick={{fontSize: 12}} 
                    // label={{ value: 'NFT ID (Chronological)', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF', fontSize: 10 }}
                />
                <YAxis 
                    stroke="#E5E7EB" 
                    tick={{fontSize: 12}} 
                    // label={{ value: 'Energy (kW)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 10 }}
                />
                
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff' }} />
                
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#F59E0B" 
                    fillOpacity={1} 
                    fill="url(#colorEnergy)" 
                    name="Energy Capacity (kW)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}