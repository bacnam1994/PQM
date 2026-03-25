
import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { 
  ChevronLeft, Info, FileText, History, BarChart3, ArrowRight,
  Plus, Beaker, Calendar, Tag, Hash, Activity, CheckCircle2,
  AlertCircle, Building2, ShieldCheck, X, Eye, Box, Thermometer, BookOpen, Clock, FlaskConical
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProductStatus } from '../types';
import { parseNumberFromText } from '../utils/criteriaEvaluation';

// Helper: Format số sang dạng mũ (VD: 1000 -> 10³)
const formatScientific = (value: string | number) => {
  let num = Number(value);
  if (isNaN(num)) {
    num = parseNumberFromText(String(value));
    if (num === 0 && String(value).trim() !== '0') return value;
  }
  if (num === 0) return value;

  if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    const roundedMantissa = Math.round(mantissa * 1000) / 1000;

    return (
      <span className="whitespace-nowrap">
        {roundedMantissa !== 1 && <>{roundedMantissa} × </>}
        10<sup>{exponent}</sup>
      </span>
    );
  }
  return num.toLocaleString('vi-VN');
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { testResults } = useTestResultContext();
  const [activeTab, setActiveTab] = useState<'info' | 'formula' | 'tccs' | 'history' | 'analytics'>('info');
  
  const product = state.products.find(p => p.id === id);
  const productTCCSList = state.tccsList.filter(t => t.productId === id).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  const productFormula = state.productFormulas.find(f => f.productId === id);
  
  const productResults = useMemo(() => 
    testResults.filter(r => {
      const b = state.batches.find(batch => batch.id === r.batchId);
      return b?.productId === id;
    }).sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
  , [testResults, state.batches, id]);

  const [selectedCriterion, setSelectedCriterion] = useState<string>('');
  
  const allCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    productTCCSList.forEach(t => {
      (t.mainQualityCriteria || []).forEach(c => c && c.name && names.add(c.name));
      (t.safetyCriteria || []).forEach(c => c && c.name && names.add(c.name));
    });
    return Array.from(names);
  }, [productTCCSList]);

  const analyticsData = useMemo(() => {
    if (!selectedCriterion) return [];
    const batchMap = new Map<string, any>();
    [...productResults].reverse().forEach(res => {
      const batch = state.batches.find(b => b.id === res.batchId);
      const match = res.results.find(r => r.criteriaName === selectedCriterion);
      if (match && typeof match.value === 'number' && batch) {
        const existing = batchMap.get(batch.batchNo) || { name: batch.batchNo };
        existing[res.labName] = match.value;
        batchMap.set(batch.batchNo, existing);
      }
    });
    return Array.from(batchMap.values());
  }, [productResults, selectedCriterion, state.batches]);

  const labs = Array.from(new Set(productResults.map(r => r.labName)));
  const labColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck size={14}/> Đang công bố</span>;
      case 'DISCONTINUED':
        return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={14}/> Ngừng sản xuất</span>;
      case 'RECALLED':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><X size={14}/> Đã thu hồi</span>;
      default:
        return null;
    }
  };

  if (!product) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => navigate('/products')}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-wider">{product.code}</span>
              {getStatusBadge(product.status)}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">{product.name}</h1>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 scrollbar-hide overflow-x-auto">
        {[
          { id: 'info', label: 'Thông tin kỹ thuật', icon: Info },
          { id: 'formula', label: 'Công thức & Thành phần', icon: FlaskConical },
          { id: 'tccs', label: 'Hồ sơ TCCS', icon: FileText },
          { id: 'history', label: 'Lịch sử Kiểm nghiệm', icon: Activity },
          { id: 'analytics', label: 'Biến động Chất lượng', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
            `}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 min-h-[400px]">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <Tag size={18} className="text-indigo-500" />
                Hồ sơ Pháp lý
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <InfoItem label="Số Công bố / ĐKCB" value={product.registrationNo} />
                <InfoItem label="Ngày cấp ĐKCB" value={new Date(product.registrationDate).toLocaleDateString('en-GB')} />
                <InfoItem label="Đơn vị sở hữu" value={product.registrant} />
                <InfoItem label="Nhóm sản phẩm" value={product.group} />
              </div>
              <div className="pt-4 space-y-2">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mô tả tóm lược</p>
                 <p className="text-slate-700 leading-relaxed text-sm">{product.description || 'Không có mô tả.'}</p>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <Eye size={18} className="text-indigo-500" />
                Đặc tính & Nhận diện
              </h3>
              {productFormula ? (
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dạng bào chế</p>
                      <p className="text-xs font-bold text-slate-700">{productFormula.sensory?.dosageForm || '---'}</p>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quy cách</p>
                      <p className="text-xs font-bold text-slate-700">{productFormula.packaging || '---'}</p>
                   </div>
                   <div className="col-span-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Đặc điểm cảm quan</p>
                      <p className="text-xs font-medium text-slate-700 italic">"{productFormula.sensory?.appearance || '---'}"</p>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Hạn dùng</p>
                      <p className="text-xs font-bold text-slate-700">{productFormula.shelfLife || '---'}</p>
                   </div>
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bảo quản</p>
                      <p className="text-xs font-bold text-slate-700">{productFormula.storage || '---'}</p>
                   </div>
                 </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-dashed text-center text-slate-400 text-sm italic">
                  Chưa cập nhật thông tin đặc tính sản phẩm (Công thức).
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'formula' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FlaskConical size={18} className="text-indigo-500" />
                Thành phần công thức
              </h3>
              {productFormula && <span className="text-xs text-slate-400 italic">Cập nhật: {new Date(productFormula.updatedAt).toLocaleDateString('en-GB')}</span>}
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              {productFormula && productFormula.ingredients.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                    <tr><th className="px-6 py-3">Tên hoạt chất</th><th className="px-6 py-3 text-right">Hàm lượng</th><th className="px-6 py-3 text-center">Đơn vị</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productFormula.ingredients.map((ing, idx) => (
                      <tr key={idx} className="hover:bg-white transition-colors">
                        <td className="px-6 py-3 font-bold text-slate-700">{ing.name}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600">
                          {formatScientific(ing.declaredContent)}
                        </td>
                        <td className="px-6 py-3 text-center text-slate-500">{ing.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm italic">Chưa có dữ liệu công thức.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tccs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {productTCCSList.map(tccs => (
              <div key={tccs.id} className={`p-6 rounded-2xl border transition-all ${tccs.isActive ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-100 bg-white'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={20} className={tccs.isActive ? 'text-indigo-600' : 'text-slate-400'} />
                  <h4 className="font-bold text-slate-800">{tccs.code}</h4>
                </div>
                <div className="space-y-3 mb-4">
                   <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 italic">
                     Các chỉ tiêu chất lượng được quy định trong phiên bản này.
                   </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tccs.mainQualityCriteria.length + tccs.safetyCriteria.length} Chỉ tiêu</span>
                   {tccs.standardRefs && (
                      <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded uppercase tracking-tighter max-w-[100px] truncate" title={tccs.standardRefs}>
                        {tccs.standardRefs}
                      </span>
                   )}
                   <button className="text-indigo-600 text-xs font-black hover:underline">CHI TIẾT</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
           <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                <th className="py-4">Lô hàng</th>
                <th className="py-4">Ngày kiểm</th>
                <th className="py-4 text-center">Kết quả</th>
                <th className="py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productResults.map(res => {
                const batch = state.batches.find(b => b.id === res.batchId);
                return (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-700 uppercase">{batch?.batchNo || '---'}</td>
                    <td className="py-4 text-slate-500">{new Date(res.testDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.overallStatus === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {res.overallStatus}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-all"><ArrowRight size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
           </table>
        )}

        {activeTab === 'analytics' && (
           <div className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chỉ tiêu đối soát:</label>
                <select 
                  value={selectedCriterion}
                  onChange={(e) => setSelectedCriterion(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chọn chỉ tiêu --</option>
                  {allCriteriaNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {selectedCriterion && analyticsData.length > 0 ? (
                <div className="h-[400px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" />
                      {labs.map((lab, index) => (
                        <Line key={lab} type="monotone" dataKey={lab} stroke={labColors[index % labColors.length]} strokeWidth={3} dot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-300 italic">
                  Vui lòng chọn chỉ tiêu định lượng để bắt đầu phân tích.
                </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="font-bold text-slate-800">{value || '--'}</p>
  </div>
);

export default ProductDetail;
