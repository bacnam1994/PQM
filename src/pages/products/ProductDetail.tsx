
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  ChevronLeft, Info, FileText, History, BarChart3, ArrowRight,
  Plus, Beaker, Calendar, Tag, Hash, Activity, CheckCircle2,
  AlertCircle, Building2, ShieldCheck, X, Eye, Box, Thermometer, BookOpen, Clock, FlaskConical
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProductStatus } from '../../types';
import { parseNumberFromText, formatDateStandard, getActiveLocale } from '../../utils';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName } from '../../services/criteriaAliasService';
import { fetchTestResultsByProductId } from '../../services/testResultService';
import { Loader2 } from 'lucide-react';

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
  return num.toLocaleString(getActiveLocale());
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const products = useAppStore(state => state.products);
  const tccsList = useAppStore(state => state.tccsList);
  const productFormulas = useAppStore(state => state.productFormulas);
  const isAdmin = useAppStore(state => state.isAdmin);
  const batches = useAppStore(state => state.batches);
  const testResults = useAppStore(state => state.testResults);
  const [activeTab, setActiveTab] = useState<'info' | 'formula' | 'tccs' | 'history' | 'analytics'>('info');
  
  const product = products.find(p => p.id === id);
  const productTCCSList = tccsList.filter(t => t.productId === id).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  const productFormula = productFormulas.find(f => f.productId === id);
  
  // Kết quả từ Store (bị giới hạn 50 phiếu gần nhất)
  const productResults = useMemo(() => 
    testResults.filter(r => {
      const b = batches.find(batch => batch.id === r.batchId);
      return b?.productId === id;
    }).sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
  , [testResults, batches, id]);

  // Toàn bộ lịch sử đầy đủ (tải từ Firebase khi vào tab lịch sử)
  const [allProductResults, setAllProductResults] = useState(productResults);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [hasFetchedAll, setHasFetchedAll] = useState(false);

  const fetchAllResults = useCallback(async () => {
    if (!id || hasFetchedAll || isFetchingAll) return;
    setIsFetchingAll(true);
    try {
      const results = await fetchTestResultsByProductId(id);
      setAllProductResults(results);
      setHasFetchedAll(true);
    } catch (e) {
      console.error('Lỗi tải toàn bộ lịch sử kiểm nghiệm:', e);
    } finally {
      setIsFetchingAll(false);
    }
  }, [id, hasFetchedAll, isFetchingAll]);

  // Khi chuyển sang tab Lịch sử hoặc Biến động → tải đầy đủ từ Firebase
  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'analytics') {
      fetchAllResults();
    }
  }, [activeTab, fetchAllResults]);

  // Khi store cập nhật thêm dữ liệu (do loadMore), đồng bộ lại nếu chưa fetch riêng
  useEffect(() => {
    if (!hasFetchedAll) {
      setAllProductResults(productResults);
    }
  }, [productResults, hasFetchedAll]);

  const [selectedCriterion, setSelectedCriterion] = useState<string>('');
  
  const allCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    productTCCSList.forEach(t => {
      (t.mainQualityCriteria || []).forEach(c => c && c.name && names.add(c.name));
      (t.safetyCriteria || []).forEach(c => c && c.name && names.add(c.name));
    });
    return Array.from(names);
  }, [productTCCSList]);

  const activeTCCS = productTCCSList.find(t => t.isActive) || productTCCSList[0];
  const resolver = useCriteriaResolver(activeTCCS);

  const analyticsData = useMemo(() => {
    if (!selectedCriterion) return [];
    const batchMap = new Map<string, any>();
    [...allProductResults].reverse().forEach(res => {
      const batch = batches.find(b => b.id === res.batchId);
      // [ALIAS FIX] Dùng resolver.isMatch thay vì exact equality
      const match = (res.results || []).find(r => resolver.isMatch(r.criteriaName, selectedCriterion));
      if (match && batch) {
        const numVal = typeof match.value === 'number' ? match.value : parseNumberFromText(match.value);
        if (!isNaN(numVal)) {
          const existing = batchMap.get(batch.batchNo) || { name: batch.batchNo };
          existing[res.labName] = numVal;
          batchMap.set(batch.batchNo, existing);
        }
      }
    });
    return Array.from(batchMap.values());
  }, [allProductResults, selectedCriterion, batches, resolver]);

  const labs: string[] = Array.from(new Set(allProductResults.map(r => r.labName)));
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
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm shrink-0"
          >
            <ChevronLeft size={20} />
          </button>

          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
          ) : (
            <div className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl shrink-0 border border-slate-100 dark:border-slate-700">
              <Box size={32} />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider">{product.code}</span>
              {getStatusBadge(product.status)}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{product.name}</h1>
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
                <InfoItem label="Ngày cấp ĐKCB" value={formatDateStandard(product.registrationDate)} />
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
              <div className="flex items-center gap-4">
                {productFormula && <span className="text-xs text-zinc-400 italic">Cập nhật: {formatDateStandard(productFormula.updatedAt)}</span>}
                {isAdmin && (
                  <button 
                    onClick={() => navigate(productFormula ? `/product-formulas/edit/${productFormula.id}` : '/product-formulas/new')}
                    className="text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                  >
                    {productFormula ? 'CHỈNH SỬA' : 'TẠO MỚI'}
                  </button>
                )}
              </div>
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
                   <button onClick={() => navigate(`/tccs/detail/${tccs.id}`)} className="text-indigo-600 text-xs font-black hover:underline">CHI TIẾT</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {isFetchingAll && (
              <div className="flex items-center gap-2 text-xs text-indigo-500 font-bold bg-indigo-50 px-4 py-2 rounded-lg">
                <Loader2 size={14} className="animate-spin" /> Đang tải đầy đủ lịch sử kiểm nghiệm từ cơ sở dữ liệu...
              </div>
            )}
            {hasFetchedAll && !isFetchingAll && (
              <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-lg">
                ✓ Đã tải đầy đủ {allProductResults.length} phiếu kiểm nghiệm
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  <th className="py-4">Lô hàng</th>
                  <th className="py-4">Ngày kiểm</th>
                  <th className="py-4">Phòng Lab</th>
                  <th className="py-4 text-center">Kết quả</th>
                  <th className="py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allProductResults.map(res => {
                  const batch = batches.find(b => b.id === res.batchId);
                  return (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-700 uppercase">
                        {batch ? <Link to={`/batches/${batch.id}`} className="hover:text-indigo-600 hover:underline">{batch.batchNo}</Link> : <span className="text-slate-400 italic text-xs">{res.batchId?.slice(-6)}</span>}
                      </td>
                      <td className="py-4 text-zinc-500">{formatDateStandard(res.testDate)}</td>
                      <td className="py-4 text-zinc-500 text-xs">{res.labName}</td>
                      <td className="py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.overallStatus === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {res.overallStatus}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {isAdmin && (
                          <button onClick={() => navigate(`/test-results/edit/${res.id}`)} title="Sửa kết quả" className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-all"><ArrowRight size={18} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!isFetchingAll && allProductResults.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400 italic text-sm">Chưa có phiếu kiểm nghiệm nào cho sản phẩm này.</td></tr>
                )}
              </tbody>
            </table>
          </div>
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
