import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { 
  Package, Layers, ClipboardCheck, FileText, 
  Activity, ArrowRight, Clock 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DSCard } from '../components/DesignSystem';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../utils/constants';

const Dashboard: React.FC = () => {
  const { state } = useAppContext();
  const { testResults } = useTestResultContext();

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const totalProducts = state.products.length;
    const activeProducts = state.products.filter(p => p.status === PRODUCT_STATUS.ACTIVE).length;
    
    const totalBatches = state.batches.length;
    const pendingBatches = state.batches.filter(b => b.status === BATCH_STATUS.PENDING).length;
    const testingBatches = state.batches.filter(b => b.status === BATCH_STATUS.TESTING).length;
    const releasedBatches = state.batches.filter(b => b.status === BATCH_STATUS.RELEASED).length;
    const rejectedBatches = state.batches.filter(b => b.status === BATCH_STATUS.REJECTED).length;
    
    const totalResults = testResults.length;
    const passResults = testResults.filter(r => r.overallStatus === TEST_RESULT_STATUS.PASS).length;
    
    const totalTCCS = state.tccsList.length;

    return {
      totalProducts, activeProducts,
      totalBatches, pendingBatches, testingBatches, releasedBatches, rejectedBatches,
      totalResults, passResults,
      totalTCCS
    };
  }, [state, testResults]);

  // Dữ liệu biểu đồ tròn (Trạng thái Lô)
  const batchStatusData = useMemo(() => [
    { name: 'Kế hoạch', value: stats.pendingBatches, color: '#94a3b8' },
    { name: 'Đang kiểm', value: stats.testingBatches, color: '#6366f1' },
    { name: 'Đã duyệt', value: stats.releasedBatches, color: '#10b981' },
    { name: 'Loại bỏ', value: stats.rejectedBatches, color: '#ef4444' },
  ], [stats]);

  // Dữ liệu biểu đồ cột (Kết quả kiểm nghiệm gần đây)
  const recentResultsData = useMemo(() => {
    return [
      { name: 'Đạt', value: stats.passResults, color: '#10b981' },
      { name: 'Không đạt', value: stats.totalResults - stats.passResults, color: '#ef4444' },
    ];
  }, [stats]);

  // Hoạt động gần đây (Lô mới + Kết quả mới)
  const recentActivities = useMemo(() => {
    const batches = state.batches.map(b => ({
      type: 'BATCH',
      id: b.id,
      title: `Lô mới: ${b.batchNo}`,
      subtitle: b.product?.name,
      date: b.createdAt,
      icon: Layers,
      color: 'text-indigo-600 bg-indigo-50'
    }));

    const results = testResults.map(r => ({
      type: 'RESULT',
      id: r.id,
      title: `Kết quả: ${r.batch?.batchNo}`,
      subtitle: r.overallStatus === TEST_RESULT_STATUS.PASS ? 'ĐẠT' : 'KHÔNG ĐẠT',
      date: r.createdAt,
      icon: ClipboardCheck,
      color: r.overallStatus === TEST_RESULT_STATUS.PASS ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
    }));

    return [...batches, ...results]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [state.batches, testResults]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Tổng quan Hệ thống</h1>
        <p className="text-slate-500 mt-1">Theo dõi chỉ số chất lượng và tiến độ sản xuất.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Sản phẩm" 
          value={stats.totalProducts} 
          subValue={`${stats.activeProducts} đang lưu hành`}
          icon={Package} 
          color="bg-blue-500" 
          link="/products"
        />
        <StatCard 
          title="Lô sản xuất" 
          value={stats.totalBatches} 
          subValue={`${stats.testingBatches} đang kiểm, ${stats.releasedBatches} đã duyệt`}
          icon={Layers} 
          color="bg-indigo-500" 
          link="/batches"
        />
        <StatCard 
          title="Hồ sơ TCCS" 
          value={stats.totalTCCS} 
          subValue="Tiêu chuẩn cơ sở"
          icon={FileText} 
          color="bg-amber-500" 
          link="/tccs"
        />
        <StatCard 
          title="Phiếu Kiểm nghiệm" 
          value={stats.totalResults} 
          subValue={`${stats.passResults} phiếu ĐẠT`}
          icon={ClipboardCheck} 
          color="bg-emerald-500" 
          link="/test-results"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DSCard className="p-6 flex flex-col items-center justify-center min-h-[300px]">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Trạng thái Lô hàng</h3>
                 <div className="w-full h-48">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie 
                            data={batchStatusData} 
                            innerRadius={60} 
                            outerRadius={80} 
                            paddingAngle={5} 
                            dataKey="value"
                          >
                            {batchStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex gap-4 mt-4">
                    {batchStatusData.map((entry, index) => (
                       <div key={index} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name} ({entry.value})
                       </div>
                    ))}
                 </div>
              </DSCard>

              <DSCard className="p-6 flex flex-col items-center justify-center min-h-[300px]">
                 <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Tỷ lệ Đạt / Không Đạt</h3>
                 <div className="w-full h-48">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={recentResultsData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {recentResultsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </DSCard>
           </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-6">
           <DSCard className="p-6 h-full">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Activity size={16} /> Hoạt động gần đây
              </h3>
              <div className="space-y-6">
                 {recentActivities.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-start group">
                       <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${item.color}`}>
                          <item.icon size={18} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{item.title}</p>
                          <p className="text-xs font-medium text-slate-500 truncate">{item.subtitle}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                             <Clock size={10} /> {new Date(item.date).toLocaleDateString('vi-VN')}
                          </p>
                       </div>
                    </div>
                 ))}
                 {recentActivities.length === 0 && (
                    <p className="text-center text-slate-400 text-xs italic">Chưa có hoạt động nào.</p>
                 )}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-50">
                 <Link to="/batches" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase transition-all">
                    Xem tất cả <ArrowRight size={14} />
                 </Link>
              </div>
           </DSCard>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; subValue: string; icon: any; color: string; link: string }> = ({ title, value, subValue, icon: Icon, color, link }) => (
  <Link to={link} className="block group">
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
       <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-150 ${color}`} />
       
       <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl text-white shadow-lg shadow-indigo-100 ${color}`}>
             <Icon size={24} />
          </div>
       </div>
       
       <div className="space-y-1 relative z-10">
          <h3 className="text-3xl font-black text-slate-800">{value}</h3>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pt-2 border-t border-slate-50 mt-2">{subValue}</p>
       </div>
    </div>
  </Link>
);

export default Dashboard;