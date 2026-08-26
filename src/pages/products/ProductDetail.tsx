
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { 
  ChevronLeft, Info, FileText, History, BarChart3, ArrowRight,
  Plus, Beaker, Calendar, Tag, Hash, Activity, CheckCircle2,
  AlertCircle, Building2, ShieldCheck, X, Eye, Box, Thermometer, BookOpen, Clock, FlaskConical,
  ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Percent, SlidersHorizontal, Table, Sparkles, Layers, Package
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
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

  // Chỉ lấy chỉ tiêu chất lượng chính (không bao gồm chỉ tiêu an toàn)
  const allQualityCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    productTCCSList.forEach(t => {
      (t.mainQualityCriteria || []).forEach(c => c && c.name && names.add(c.name));
    });
    return Array.from(names).sort();
  }, [productTCCSList]);

  // Nhiều chỉ tiêu được chọn (Set)
  const [selectedCriteria, setSelectedCriteria] = useState<Set<string>>(new Set());

  const toggleCriterion = useCallback((name: string) => {
    setSelectedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const selectAllCriteria = useCallback(() => {
    setSelectedCriteria(new Set(allQualityCriteriaNames));
  }, [allQualityCriteriaNames]);

  const clearAllCriteria = useCallback(() => setSelectedCriteria(new Set()), []);

  const activeTCCS = productTCCSList.find(t => t.isActive) || productTCCSList[0];
  const resolver = useCriteriaResolver(activeTCCS);

  // Helper tính toán thống kê
  const calcMean = (vals: number[]) =>
    vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

  const calcStdDev = (vals: number[], mean: number) => {
    if (vals.length < 2) return 0;
    return Math.sqrt(vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1));
  };

  // Chế độ xem % hoặc giá trị thực tế theo từng chỉ tiêu (mặc định: 'PERCENT')
  const [criteriaViewModes, setCriteriaViewModes] = useState<Record<string, 'PERCENT' | 'VALUE'>>({});
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const toggleCriterionViewMode = (name: string) => {
    setCriteriaViewModes(prev => ({
      ...prev,
      [name]: (prev[name] || 'PERCENT') === 'PERCENT' ? 'VALUE' : 'PERCENT'
    }));
  };

  const toggleCriterionTable = (name: string) => {
    setExpandedTables(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Tính dữ liệu biểu đồ và thống kê biến động (%) cho từng chỉ tiêu
  const analyticsDataMap = useMemo(() => {
    const result: Record<string, any> = {};

    allQualityCriteriaNames.forEach(criterionName => {
      // 1. Tìm thông tin tiêu chuẩn từ TCCS
      const criterionObj = productTCCSList
        .flatMap(t => [...(t.mainQualityCriteria || []), ...(t.safetyCriteria || [])])
        .find(c => c && resolver.isMatch(c.name, criterionName));

      let unit = criterionObj?.unit || '';
      const min = criterionObj?.min;
      const max = criterionObj?.max;
      const expectedText = criterionObj?.expectedText;

      // 2. Tìm hàm lượng công bố từ TCCS hoặc Công thức
      let declaredContent: number | undefined = undefined;
      if (criterionObj?.declaredContent != null && criterionObj.declaredContent !== '') {
        const parsed = typeof criterionObj.declaredContent === 'string'
          ? parseNumberFromText(criterionObj.declaredContent)
          : Number(criterionObj.declaredContent);
        if (!isNaN(parsed) && parsed > 0) declaredContent = parsed;
      }

      if (declaredContent === undefined && productFormula) {
        let formulaItem = productFormula.ingredients?.find(i => resolver.isMatch(i.name, criterionName)) ||
          productFormula.excipients?.find(e => resolver.isMatch(e.name, criterionName));

        if (criterionObj?.formulaIngredientId) {
          const linkedId = criterionObj.formulaIngredientId.trim().toLowerCase();
          const linked = productFormula.ingredients?.find(i => i.id === linkedId || i.name.trim().toLowerCase() === linkedId) ||
            productFormula.excipients?.find(e => e.id === linkedId || e.name.trim().toLowerCase() === linkedId);
          if (linked) formulaItem = linked;
        }

        if (formulaItem) {
          const dc = typeof formulaItem.declaredContent === 'string' ? parseNumberFromText(formulaItem.declaredContent) : Number(formulaItem.declaredContent);
          const ec = formulaItem.elementalContent != null
            ? (typeof formulaItem.elementalContent === 'string' ? parseNumberFromText(formulaItem.elementalContent) : Number(formulaItem.elementalContent))
            : undefined;

          if (criterionObj?.calculationBasis === 'ELEMENTAL' && ec != null && !isNaN(ec) && ec > 0) {
            declaredContent = ec;
          } else if (!isNaN(dc) && dc > 0) {
            declaredContent = dc;
          }
          if (!unit && formulaItem.unit) unit = formulaItem.unit;
        }
      }

      // Mức chuẩn cơ sở để tính % (Công bố > Điểm giữa Min/Max > Max > Min)
      let targetBasis: number | undefined = declaredContent;
      let basisSource: 'FORMULA' | 'TCCS' | 'MIDPOINT' | 'NONE' = declaredContent ? (productFormula ? 'FORMULA' : 'TCCS') : 'NONE';
      if (targetBasis === undefined) {
        if (min !== undefined && max !== undefined && min > 0 && max > 0) {
          targetBasis = (min + max) / 2;
          basisSource = 'MIDPOINT';
        } else if (max !== undefined && max > 0) {
          targetBasis = max;
          basisSource = 'TCCS';
        } else if (min !== undefined && min > 0) {
          targetBasis = min;
          basisSource = 'TCCS';
        }
      }

      // 3. Gom dữ liệu theo lô
      const batchMap = new Map<string, any>();
      const batchDataList: any[] = [];
      const values: number[] = [];
      const percents: number[] = [];
      const labsFound = new Set<string>();

      // Sắp xếp phiếu kiểm nghiệm từ cũ đến mới để vẽ biểu đồ
      const sortedResults = [...allProductResults].sort((a, b) => {
        const batchA = batches.find(batch => batch.id === a.batchId);
        const batchB = batches.find(batch => batch.id === b.batchId);
        const dateA = batchA?.mfgDate || a.testDate || a.createdAt || '';
        const dateB = batchB?.mfgDate || b.testDate || b.createdAt || '';
        return dateA.localeCompare(dateB);
      });

      sortedResults.forEach(res => {
        const batch = batches.find(b => b.id === res.batchId);
        const match = (res.results || []).find(r => resolver.isMatch(r.criteriaName, criterionName));
        if (match && batch) {
          const numVal = typeof match.value === 'number' ? match.value : parseNumberFromText(match.value);
          if (!isNaN(numVal)) {
            const percent = (targetBasis && targetBasis > 0) ? (numVal / targetBasis) * 100 : null;
            let isPass: boolean | null = null;
            if (min !== undefined && max !== undefined) isPass = numVal >= min && numVal <= max;
            else if (min !== undefined) isPass = numVal >= min;
            else if (max !== undefined) isPass = numVal <= max;
            else isPass = match.isPass !== false;

            labsFound.add(res.labName);
            values.push(numVal);
            if (percent !== null) percents.push(percent);

            const itemDetail = {
              batchId: batch.id,
              batchNo: batch.batchNo,
              mfgDate: batch.mfgDate,
              testDate: res.testDate,
              labName: res.labName,
              value: numVal,
              percent,
              isPass,
              testResultId: res.id,
            };
            batchDataList.push(itemDetail);

            // Recharts data point
            const existing = batchMap.get(batch.batchNo) || {
              name: batch.batchNo,
              batchId: batch.id,
              mfgDate: batch.mfgDate,
              testDate: res.testDate,
            };
            existing[res.labName] = numVal;
            existing[`${res.labName}_pct`] = percent ? Math.round(percent * 10) / 10 : null;
            existing[`${res.labName}_val`] = numVal;
            existing[`${res.labName}_isPass`] = isPass;
            batchMap.set(batch.batchNo, existing);
          }
        }
      });

      // 4. Thống kê SPC & Biến động (%)
      let stats = null;
      if (values.length > 0) {
        const mean = calcMean(values);
        const stdDev = calcStdDev(values, mean);
        const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
        const meanPercent = targetBasis && targetBasis > 0 ? (mean / targetBasis) * 100 : (percents.length > 0 ? calcMean(percents) : null);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const minPercent = percents.length > 0 ? Math.min(...percents) : null;
        const maxPercent = percents.length > 0 ? Math.max(...percents) : null;
        const spreadPercent = (minPercent !== null && maxPercent !== null) ? maxPercent - minPercent : null;
        const passCount = batchDataList.filter(d => d.isPass === true).length;
        const failCount = batchDataList.filter(d => d.isPass === false).length;
        const passRate = batchDataList.length > 0 ? (passCount / batchDataList.length) * 100 : 100;

        let stabilityLabel = 'Rất ổn định (CV < 3%)';
        let stabilityCls = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';

        if (cv >= 10) {
          stabilityLabel = `Biến động cao (CV = ${cv.toFixed(1)}%)`;
          stabilityCls = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
        } else if (cv >= 5) {
          stabilityLabel = `Biến động TB (CV = ${cv.toFixed(1)}%)`;
          stabilityCls = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
        } else if (cv >= 3) {
          stabilityLabel = `Quy trình ổn định (CV = ${cv.toFixed(1)}%)`;
          stabilityCls = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
        }

        stats = {
          totalBatches: batchDataList.length,
          mean,
          stdDev,
          cv,
          meanPercent,
          minVal,
          maxVal,
          minPercent,
          maxPercent,
          spreadPercent,
          passCount,
          failCount,
          passRate,
          stabilityLabel,
          stabilityCls,
        };
      }

      // Min/Max percent limit for reference lines
      let minPercentLimit: number | undefined = undefined;
      let maxPercentLimit: number | undefined = undefined;
      if (targetBasis && targetBasis > 0) {
        if (min !== undefined) minPercentLimit = (min / targetBasis) * 100;
        if (max !== undefined) maxPercentLimit = (max / targetBasis) * 100;
      }

      result[criterionName] = {
        criterionName,
        unit,
        min,
        max,
        expectedText,
        declaredContent,
        targetBasis,
        basisSource,
        minPercentLimit,
        maxPercentLimit,
        chartData: Array.from(batchMap.values()),
        batchDataList,
        labs: Array.from(labsFound),
        stats,
      };
    });

    return result;
  }, [allQualityCriteriaNames, productTCCSList, productFormula, allProductResults, batches, resolver]);

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
                   
                   {/* Ecosystem Linkages Card */}
                   <div className="col-span-1 md:col-span-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                     <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                       <Layers size={16} className="text-indigo-500" />
                       Hệ sinh thái Liên kết Dữ liệu (Data Ecosystem)
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                       {/* Formula Link */}
                       <div 
                         onClick={() => setActiveTab('formula')}
                         className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all group"
                       >
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Công thức</span>
                           <FlaskConical size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                         </div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                           {productFormula ? `${productFormula.ingredients.length} hoạt chất` : 'Chưa có'}
                         </p>
                         <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline">
                           Xem công thức <ArrowRight size={12} />
                         </span>
                       </div>

                       {/* TCCS Link */}
                       <div 
                         onClick={() => setActiveTab('tccs')}
                         className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-all group"
                       >
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu chuẩn TCCS</span>
                           <FileText size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                         </div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={activeTCCS?.code || 'Chưa có'}>
                           {activeTCCS?.code || 'Chưa có TCCS'}
                         </p>
                         <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline">
                           {productTCCSList.length} phiên bản <ArrowRight size={12} />
                         </span>
                       </div>

                       {/* Batches Link */}
                       <div 
                         onClick={() => navigate(`/batches?productId=${product.id}`)}
                         className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer transition-all group"
                       >
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lô sản xuất</span>
                           <Package size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
                         </div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                           {batches.filter(b => b.productId === product.id).length} lô đã tạo
                         </p>
                         <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline">
                           Quản lý lô hàng <ArrowRight size={12} />
                         </span>
                       </div>

                       {/* Quality / Lab Results Link */}
                       <div 
                         onClick={() => setActiveTab('history')}
                         className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer transition-all group"
                       >
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kiểm nghiệm Lab</span>
                           <Activity size={16} className="text-violet-500 group-hover:scale-110 transition-transform" />
                         </div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                           {allProductResults.length} phiếu đã nhập
                         </p>
                         <span className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline">
                           Lịch sử chi tiết <ArrowRight size={12} />
                         </span>
                       </div>
                     </div>
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
            {/* Panel chọn chỉ tiêu */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-indigo-500" />
                    Chọn chỉ tiêu chất lượng để phân tích biến động:
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hệ thống tự động quy đổi tỉ lệ % theo hàm lượng công bố / chuẩn TCCS và đánh giá hệ số biến động (CV%).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllCriteria}
                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    onClick={clearAllCriteria}
                    className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-all uppercase tracking-wider"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              {allQualityCriteriaNames.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có TCCS nào được khai báo chỉ tiêu chất lượng.</p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {allQualityCriteriaNames.map(name => {
                    const meta = analyticsDataMap[name];
                    const count = meta?.batchDataList?.length || 0;
                    const isSelected = selectedCriteria.has(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleCriterion(name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {isSelected && <span className="text-[10px]">✓</span>}
                        <span>{name}</span>
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Biểu đồ & Thống kê cho từng chỉ tiêu đã chọn */}
            {selectedCriteria.size === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-slate-400 italic text-sm gap-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <BarChart3 size={40} className="text-slate-300 dark:text-slate-600" />
                <div className="text-center">
                  <p className="font-bold text-slate-600 dark:text-slate-300">Chưa chọn chỉ tiêu nào</p>
                  <p className="text-xs text-slate-400 mt-0.5">Chọn một hoặc nhiều chỉ tiêu ở trên để xem biểu đồ và tỉ lệ % biến động.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Array.from(selectedCriteria).map(criterionName => {
                  const meta = analyticsDataMap[criterionName];
                  if (!meta) return null;

                  const {
                    unit, min, max, expectedText, declaredContent, targetBasis,
                    minPercentLimit, maxPercentLimit, chartData, batchDataList,
                    labs: criterionLabs, stats
                  } = meta;

                  const currentMode = criteriaViewModes[criterionName] || (targetBasis ? 'PERCENT' : 'VALUE');
                  const isPercentMode = currentMode === 'PERCENT';
                  const isTableExpanded = expandedTables[criterionName] || false;

                  // Map Recharts data depending on current view mode (% vs actual value)
                  const displayChartData = chartData.map((d: any) => {
                    const row: any = { ...d };
                    criterionLabs.forEach((lab: string) => {
                      row[lab] = isPercentMode ? d[`${lab}_pct`] : d[`${lab}_val`];
                    });
                    return row;
                  });

                  return (
                    <div key={criterionName} className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4">
                      {/* Card Header & Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                {criterionName}
                              </h4>
                              {unit && <span className="text-xs font-bold text-slate-400">({unit})</span>}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {declaredContent ? (
                                <>Mức công bố: <span className="font-bold text-slate-600 dark:text-slate-300 font-mono">{declaredContent.toLocaleString(getActiveLocale())} {unit}</span> (Chuẩn 100%)</>
                              ) : targetBasis ? (
                                <>Mức chuẩn tham chiếu: <span className="font-bold text-slate-600 dark:text-slate-300 font-mono">{targetBasis.toLocaleString(getActiveLocale())} {unit}</span></>
                              ) : (
                                <>Chưa thiết lập hàm lượng công bố</>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* View mode toggle: Tỉ lệ % vs Giá trị thực tế */}
                        <div className="flex items-center gap-2">
                          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600">
                            <button
                              type="button"
                              onClick={() => setCriteriaViewModes(prev => ({ ...prev, [criterionName]: 'PERCENT' }))}
                              disabled={!targetBasis}
                              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                isPercentMode
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40'
                              }`}
                              title={!targetBasis ? 'Chưa có mức công bố để tính %' : 'Xem theo tỉ lệ % so với công bố'}
                            >
                              <Percent size={12} /> Tỉ lệ %
                            </button>
                            <button
                              type="button"
                              onClick={() => setCriteriaViewModes(prev => ({ ...prev, [criterionName]: 'VALUE' }))}
                              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                !isPercentMode
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                              }`}
                            >
                              <SlidersHorizontal size={12} /> Giá trị thực ({unit || 'Số'})
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 5 Thẻ KPI Thống kê & Biến động */}
                      {stats && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {/* 1. Mức công bố / Tiêu chuẩn */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mức chuẩn / Công bố</span>
                            <div className="mt-1">
                              <span className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
                                {declaredContent ? `${declaredContent.toLocaleString(getActiveLocale())} ${unit}` : (min !== undefined && max !== undefined ? `${min} ~ ${max} ${unit}` : '---')}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                {min !== undefined && max !== undefined ? `TCCS: ${min} ~ ${max} ${unit}` : expectedText || 'Mức danh định 100%'}
                              </p>
                            </div>
                          </div>

                          {/* 2. Trung bình thực tế & % TB */}
                          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Trung bình thực tế (X̄)</span>
                            <div className="mt-1">
                              <div className="flex items-baseline gap-1.5 font-mono">
                                <span className="text-base font-black text-indigo-700 dark:text-indigo-400">
                                  {stats.mean.toLocaleString(getActiveLocale(), { maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] text-indigo-400 font-bold">{unit}</span>
                              </div>
                              {stats.meanPercent !== null ? (
                                <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-300 mt-0.5 font-mono">
                                  = {stats.meanPercent.toFixed(1)}% <span className="font-normal text-[10px] opacity-75">công bố</span>
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-400 mt-0.5">σ = {stats.stdDev.toFixed(2)}</p>
                              )}
                            </div>
                          </div>

                          {/* 3. Mức độ biến động (CV%) */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hệ số biến động (CV)</span>
                            <div className="mt-1">
                              <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                                {stats.cv.toFixed(1)}%
                              </div>
                              <div className="mt-1">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${stats.stabilityCls}`}>
                                  {stats.stabilityLabel}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 4. Biên độ dao động (%) */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Biên độ dao động</span>
                            <div className="mt-1">
                              <div className="text-xs font-black text-slate-700 dark:text-slate-200 font-mono">
                                {stats.minPercent !== null && stats.maxPercent !== null ? (
                                  <>{stats.minPercent.toFixed(1)}% ~ {stats.maxPercent.toFixed(1)}%</>
                                ) : (
                                  <>{stats.minVal.toLocaleString(getActiveLocale())} ~ {stats.maxVal.toLocaleString(getActiveLocale())} {unit}</>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {stats.spreadPercent !== null ? `Độ lệch: Δ = ${stats.spreadPercent.toFixed(1)}%` : `σ = ${stats.stdDev.toFixed(2)}`}
                              </p>
                            </div>
                          </div>

                          {/* 5. Tỷ lệ Đạt TCCS */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tỷ lệ Đạt TCCS</span>
                            <div className="mt-1">
                              <div className={`text-base font-black font-mono ${stats.passRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {stats.passRate.toFixed(1)}%
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                {stats.passCount}/{stats.totalBatches} lô đạt chuẩn
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Biểu đồ Recharts */}
                      {displayChartData.length > 0 ? (
                        <div className="h-[280px] w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={displayChartData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                width={50}
                                domain={isPercentMode ? (['auto', 'auto'] as any) : undefined}
                                unit={isPercentMode ? '%' : ''}
                              />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null;
                                  return (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 text-xs space-y-2 min-w-[200px] z-50">
                                      <div className="border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                                        <span className="font-black text-slate-800 dark:text-slate-100">Lô: {label}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {payload[0]?.payload?.mfgDate ? formatDateStandard(payload[0]?.payload?.mfgDate) : ''}
                                        </span>
                                      </div>
                                      {payload.map((p: any) => {
                                        const rawVal = p.payload[`${p.dataKey}_val`];
                                        const pct = p.payload[`${p.dataKey}_pct`];
                                        const isPass = p.payload[`${p.dataKey}_isPass`];
                                        const diffPct = pct !== null && pct !== undefined ? pct - 100 : null;

                                        return (
                                          <div key={p.dataKey} className="space-y-1 pt-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                {p.dataKey}
                                              </span>
                                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isPass ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                                                {isPass ? 'ĐẠT' : 'KĐ'}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] pl-3.5">
                                              <span className="text-slate-400">Giá trị đo:</span>
                                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {rawVal != null ? `${rawVal.toLocaleString(getActiveLocale())} ${unit}` : '---'}
                                              </span>
                                            </div>
                                            {pct !== null && pct !== undefined && (
                                              <div className="flex items-center justify-between text-[11px] pl-3.5">
                                                <span className="text-slate-400">Tỉ lệ % công bố:</span>
                                                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                  {pct.toFixed(1)}%
                                                  {diffPct !== null && (
                                                    <span className={`text-[9px] font-normal ${diffPct >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                      ({diffPct >= 0 ? `+${diffPct.toFixed(1)}` : diffPct.toFixed(1)}%)
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }}
                              />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />

                              {/* Đường tham chiếu cho chế độ % */}
                              {isPercentMode && (
                                <>
                                  <ReferenceLine
                                    y={100}
                                    stroke="#10b981"
                                    strokeDasharray="4 3"
                                    strokeWidth={1.5}
                                    label={{ value: 'Chuẩn 100%', position: 'insideTopRight', fill: '#10b981', fontSize: 10, fontWeight: 700 }}
                                  />
                                  {minPercentLimit !== undefined && (
                                    <ReferenceLine
                                      y={minPercentLimit}
                                      stroke="#f59e0b"
                                      strokeDasharray="4 2"
                                      strokeWidth={1}
                                      label={{ value: `LSL ${minPercentLimit.toFixed(1)}%`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 9 }}
                                    />
                                  )}
                                  {maxPercentLimit !== undefined && (
                                    <ReferenceLine
                                      y={maxPercentLimit}
                                      stroke="#f59e0b"
                                      strokeDasharray="4 2"
                                      strokeWidth={1}
                                      label={{ value: `USL ${maxPercentLimit.toFixed(1)}%`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }}
                                    />
                                  )}
                                </>
                              )}

                              {/* Đường tham chiếu cho chế độ Giá trị thực tế */}
                              {!isPercentMode && (
                                <>
                                  {declaredContent !== undefined && (
                                    <ReferenceLine
                                      y={declaredContent}
                                      stroke="#10b981"
                                      strokeDasharray="4 3"
                                      strokeWidth={1.5}
                                      label={{ value: `Công bố: ${declaredContent} ${unit}`, position: 'insideTopRight', fill: '#10b981', fontSize: 10, fontWeight: 700 }}
                                    />
                                  )}
                                  {min !== undefined && (
                                    <ReferenceLine
                                      y={min}
                                      stroke="#f59e0b"
                                      strokeDasharray="4 2"
                                      strokeWidth={1}
                                      label={{ value: `Min: ${min} ${unit}`, position: 'insideBottomRight', fill: '#f59e0b', fontSize: 9 }}
                                    />
                                  )}
                                  {max !== undefined && (
                                    <ReferenceLine
                                      y={max}
                                      stroke="#f59e0b"
                                      strokeDasharray="4 2"
                                      strokeWidth={1}
                                      label={{ value: `Max: ${max} ${unit}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }}
                                    />
                                  )}
                                </>
                              )}

                              {criterionLabs.map((lab: string, index: number) => (
                                <Line
                                  key={lab}
                                  type="monotone"
                                  dataKey={lab}
                                  name={isPercentMode ? `${lab} (%)` : `${lab} (${unit})`}
                                  stroke={labColors[index % labColors.length]}
                                  strokeWidth={2.5}
                                  dot={{ r: 4, fill: labColors[index % labColors.length] }}
                                  activeDot={{ r: 6 }}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[80px] flex items-center justify-center text-slate-300 italic text-xs">
                          Không có dữ liệu số cho chỉ tiêu này.
                        </div>
                      )}

                      {/* Bảng chi tiết từng lô (Collapsible) */}
                      {batchDataList.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50">
                          <button
                            type="button"
                            onClick={() => toggleCriterionTable(criterionName)}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Table size={13} />
                            {isTableExpanded ? 'Thu gọn bảng dữ liệu lô' : `Xem bảng dữ liệu chi tiết (${batchDataList.length} lô kiểm nghiệm)`}
                            {isTableExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isTableExpanded && (
                            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-100/70 dark:bg-slate-800/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="px-3 py-2.5">STT</th>
                                    <th className="px-3 py-2.5">Số lô</th>
                                    <th className="px-3 py-2.5">Ngày kiểm / SX</th>
                                    <th className="px-3 py-2.5">Phòng Lab</th>
                                    <th className="px-3 py-2.5 text-right">Giá trị đo ({unit})</th>
                                    <th className="px-3 py-2.5 text-center">Tỉ lệ % công bố</th>
                                    <th className="px-3 py-2.5 text-center">Độ lệch (Δ)</th>
                                    <th className="px-3 py-2.5 text-center">Trạng thái</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {batchDataList.map((item: any, idx: number) => {
                                    const diff = item.percent !== null ? item.percent - 100 : null;
                                    return (
                                      <tr key={idx} className="hover:bg-white dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">
                                          <Link to={`/batches/${item.batchId}`} className="hover:text-indigo-600 hover:underline">
                                            {item.batchNo}
                                          </Link>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">
                                          {formatDateStandard(item.testDate || item.mfgDate)}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{item.labName}</td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                                          {item.value.toLocaleString(getActiveLocale())}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono font-black text-indigo-600 dark:text-indigo-400">
                                          {item.percent !== null ? `${item.percent.toFixed(1)}%` : '---'}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono text-[11px]">
                                          {diff !== null ? (
                                            <span className={`font-bold ${Math.abs(diff) < 5 ? 'text-emerald-600' : Math.abs(diff) < 10 ? 'text-amber-600' : 'text-red-600'}`}>
                                              {diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                                            </span>
                                          ) : '---'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item.isPass ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                                            {item.isPass ? 'ĐẠT' : 'KĐ'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
