import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Activity, Package, FileText, CheckCircle2, AlertCircle, Sparkles, RefreshCw, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput, SpecialCharToolbar, DSCard, PageHeader } from '../../components';
import { normalizeName, createAliasRecord } from '../../services/criteriaAliasService';
import { logAuditAction } from '../../services/auditService';

interface CriterionUsageInfo {
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string; productId?: string }[];
  types: Set<string>;
  relatedBatchesCount: number;
}

const CriteriaFormPage: React.FC = () => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();

  // App Store States
  const { tccsList, products, batches, testResults, criteriaAliases, updateTCCS, updateTestResult, addCriteriaAlias, notify, isAdmin, user } = useAppStore();

  const [selectedName, setSelectedName] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [renameScope, setRenameScope] = useState<'global' | 'product'>('global');
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoCreateAlias, setAutoCreateAlias] = useState(true);

  // 1. Tổng hợp toàn bộ danh mục chỉ tiêu từ TCCS và TestResults
  const criteriaMap = useMemo(() => {
    const map = new Map<string, CriterionUsageInfo>();
    const productMap = new Map(products.map(p => [p.id, p]));

    tccsList.forEach((tccs) => {
      const product = productMap.get(tccs.productId);
      const productName = product ? product.name : (tccs.productId ? `Sản phẩm đã xóa (${tccs.productId.slice(-6)})` : 'Chưa gán sản phẩm');

      const processList = (list: any[], type: string) => {
        (list || []).forEach((c) => {
          if (!c || !c.name) return;
          const trimmed = c.name.trim();
          if (!map.has(trimmed)) {
            map.set(trimmed, {
              name: trimmed,
              count: 0,
              relatedTCCS: [],
              types: new Set(),
              relatedBatchesCount: 0
            });
          }
          const entry = map.get(trimmed)!;
          entry.count++;
          entry.types.add(type);
          if (!entry.relatedTCCS.some(r => r.id === tccs.id)) {
            entry.relatedTCCS.push({
              id: tccs.id,
              code: tccs.code,
              product: productName,
              productId: tccs.productId
            });
          }
        });
      };

      processList(tccs.mainQualityCriteria, 'Chất lượng chính');
      processList(tccs.safetyCriteria, 'An toàn');
    });

    // Đếm số lô kiểm nghiệm
    testResults.forEach((result) => {
      (result.results || []).forEach(r => {
        if (!r || !r.criteriaName) return;
        const trimmed = r.criteriaName.trim();
        const entry = map.get(trimmed);
        if (entry) {
          entry.relatedBatchesCount++;
        }
      });
    });

    return map;
  }, [tccsList, products, testResults]);

  const allCriteriaNames = useMemo(() => {
    return Array.from(criteriaMap.keys()).sort((a, b) => a.localeCompare(b));
  }, [criteriaMap]);

  // Nạp dữ liệu theo paramId khi mount hoặc thay đổi URL
  useEffect(() => {
    if (paramId) {
      const decoded = decodeURIComponent(paramId).trim();
      setSelectedName(decoded);
      setNewName(decoded);
    } else if (allCriteriaNames.length > 0 && !selectedName) {
      setSelectedName(allCriteriaNames[0]);
      setNewName(allCriteriaNames[0]);
    }
  }, [paramId, allCriteriaNames]);

  const currentInfo = useMemo(() => {
    if (!selectedName) return null;
    return criteriaMap.get(selectedName) || {
      name: selectedName,
      count: 0,
      relatedTCCS: [],
      types: new Set<string>(['Chỉ tiêu mới']),
      relatedBatchesCount: 0
    };
  }, [selectedName, criteriaMap]);

  const productsUsingCurrentCriteria = useMemo(() => {
    if (!currentInfo) return [];
    const prodMap = new Map<string, string>();
    currentInfo.relatedTCCS.forEach(r => {
      if (r.productId) {
        prodMap.set(r.productId, r.product);
      }
    });
    return Array.from(prodMap.entries()).map(([id, name]) => ({ id, name }));
  }, [currentInfo]);

  // Lấy các alias hiện có của chỉ tiêu này
  const activeAliases = useMemo(() => {
    if (!selectedName) return [];
    const norm = normalizeName(selectedName);
    return criteriaAliases.filter(a => normalizeName(a.canonicalName) === norm);
  }, [selectedName, criteriaAliases]);

  // Xử lý đổi tên / chuẩn hóa chỉ tiêu
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedName || !newName.trim()) {
      notify({ type: 'WARNING', message: 'Vui lòng nhập tên chỉ tiêu mới!' });
      return;
    }

    if (newName.trim() === selectedName) {
      notify({ type: 'INFO', message: 'Tên chỉ tiêu không thay đổi.' });
      return;
    }

    if (renameScope === 'product' && !targetProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn sản phẩm cần áp dụng đổi tên!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const oldName = selectedName;
      const targetName = newName.trim();
      const tccsUpdates: Promise<void>[] = [];
      const testResultUpdates: Promise<void>[] = [];

      // 1. Cập nhật các TCCS liên quan
      tccsList.forEach(tccs => {
        if (renameScope === 'product' && tccs.productId !== targetProductId) return;

        let hasChange = false;
        const updateList = (list: any[]) => (list || []).map(c => {
          if (c && c.name && c.name.trim() === oldName) {
            hasChange = true;
            return { ...c, name: targetName };
          }
          return c;
        });

        const newMain = updateList(tccs.mainQualityCriteria);
        const newSafety = updateList(tccs.safetyCriteria);

        const newRules = (tccs.alternateRules || []).map(r => {
          let ruleChanged = false;
          let main = r.main;
          let alt = r.alt;
          if (main === oldName) { main = targetName; ruleChanged = true; }
          if (alt === oldName) { alt = targetName; ruleChanged = true; }
          if (ruleChanged) hasChange = true;
          return { ...r, main, alt };
        });

        if (hasChange) {
          tccsUpdates.push(updateTCCS({
            ...tccs,
            mainQualityCriteria: newMain,
            safetyCriteria: newSafety,
            alternateRules: newRules
          }));

          // Tự động tạo bản ghi alias để bảo toàn tương thích ngược
          if (autoCreateAlias) {
            const aliasRec = {
              id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...createAliasRecord(tccs.id, targetName, [oldName], false, true),
            };
            addCriteriaAlias(aliasRec).catch(err => console.warn('Lỗi tạo alias tự động:', err));
          }
        }
      });

      // 2. Cập nhật các phiếu kiểm nghiệm liên quan
      const batchMap = new Map(batches.map(b => [b.id, b]));
      testResults.forEach(result => {
        if (renameScope === 'product') {
          const batch = (result.batchId ? batchMap.get(result.batchId) : null) || result.batch;
          if (!batch || batch.productId !== targetProductId) return;
        }

        let hasChange = false;
        const newEntries = (result.results || []).map(entry => {
          if (entry && entry.criteriaName && entry.criteriaName.trim() === oldName) {
            hasChange = true;
            return { ...entry, criteriaName: targetName };
          }
          return entry;
        });

        if (hasChange) {
          testResultUpdates.push(updateTestResult({
            ...result,
            results: newEntries
          }));
        }
      });

      await Promise.all([...tccsUpdates, ...testResultUpdates]);

      logAuditAction({
        action: 'UPDATE',
        collection: 'CRITERIA_ALIASES',
        documentId: targetName,
        details: `Đổi tên chỉ tiêu "${oldName}" thành "${targetName}" (Phạm vi: ${renameScope === 'global' ? 'Toàn hệ thống' : `Sản phẩm ${targetProductId}`})`,
        performedBy: user?.email || 'unknown'
      });

      notify({
        type: 'SUCCESS',
        title: 'Thành công',
        message: `Đã cập nhật chỉ tiêu thành "${targetName}" trên ${tccsUpdates.length} hồ sơ TCCS.`
      });

      setSelectedName(targetName);
      setNewName(targetName);
      navigate('/criteria');
    } catch (error) {
      console.error('Lỗi khi đổi tên chỉ tiêu:', error);
      notify({ type: 'ERROR', message: 'Có lỗi xảy ra khi cập nhật chỉ tiêu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/criteria')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Activity className="text-violet-600" size={24} />
              Quản lý & Chuẩn hóa Chỉ tiêu
            </h1>
            <p className="text-xs text-slate-400 font-bold">Tra cứu hồ sơ áp dụng, chuẩn hóa tên gọi và đồng bộ bảng ánh xạ toàn hệ thống.</p>
          </div>
        </div>
        <Link to="/system/criteria-aliases" className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors">
          <Sparkles size={14} /> Quản lý Alias
        </Link>
      </div>

      {/* Selector chọn chỉ tiêu nếu không đi từ đường dẫn trực tiếp */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Chọn chỉ tiêu cần quản lý / chuẩn hóa:</label>
        <div className="flex gap-3">
          <select 
            value={selectedName} 
            onChange={(e) => {
              setSelectedName(e.target.value);
              setNewName(e.target.value);
            }} 
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-500"
          >
            {allCriteriaNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button 
            type="button" 
            onClick={() => {
              const customName = prompt('Nhập tên chỉ tiêu mới cần tra cứu:');
              if (customName && customName.trim()) {
                setSelectedName(customName.trim());
                setNewName(customName.trim());
              }
            }}
            className="px-4 py-3 bg-violet-50 text-violet-700 font-bold rounded-xl text-xs hover:bg-violet-100 transition-colors whitespace-nowrap"
          >
            + Nhập tên khác
          </button>
        </div>
      </div>

      {currentInfo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Thông tin sử dụng */}
          <div className="md:col-span-1 space-y-4">
            <DSCard className="p-5 bg-gradient-to-br from-violet-50 via-white to-purple-50 border border-violet-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-violet-600 text-white rounded-xl shadow-md shadow-violet-200">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base leading-tight truncate">{currentInfo.name}</h3>
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
                    {Array.from(currentInfo.types).join(', ') || 'Chỉ tiêu phân tích'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Hồ sơ TCCS sử dụng:</span>
                  <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-100">{currentInfo.relatedTCCS.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Lô kiểm nghiệm áp dụng:</span>
                  <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-100">{currentInfo.relatedBatchesCount}</span>
                </div>
              </div>
            </DSCard>

            {/* Danh sách TCCS & Sản phẩm */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Package size={14} className="text-indigo-500" /> Sản phẩm áp dụng ({currentInfo.relatedTCCS.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {currentInfo.relatedTCCS.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa gắn vào TCCS nào.</p>
                ) : (
                  currentInfo.relatedTCCS.map((t, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-xs font-bold text-slate-700 line-clamp-1">{t.product}</p>
                      <p className="text-[10px] font-mono font-bold text-indigo-600 uppercase">TCCS: {t.code}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Danh sách Alias đã lưu */}
            {activeAliases.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-2">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <RefreshCw size={14} className="text-amber-500" /> Alias đã ánh xạ ({activeAliases.length})
                </h4>
                <div className="space-y-1.5 text-xs">
                  {activeAliases.map(a => (
                    <div key={a.id} className="p-2 bg-amber-50/60 rounded-lg border border-amber-100">
                      <p className="font-bold text-amber-900">{a.canonicalName}</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">Biến thể: {a.aliases?.join(', ') || '---'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Đổi tên & Chuẩn hóa */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Sparkles size={18} className="text-violet-600" />
                  Chuẩn hóa / Đổi tên Chỉ tiêu
                </h3>
                <p className="text-xs text-slate-500 mt-1">Thay đổi tên chỉ tiêu đồng loạt trên các hồ sơ TCCS và phiếu kiểm nghiệm mà không làm mất dữ liệu lịch sử.</p>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <SpecialCharToolbar />

                <div>
                  <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-2">Tên chỉ tiêu mới *</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="Nhập tên chuẩn hóa (VD: Độ ẩm, Định lượng Paracetamol...)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500 shadow-inner"
                    required
                  />
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest block">Phạm vi áp dụng</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="scope" 
                        value="global" 
                        checked={renameScope === 'global'} 
                        onChange={() => setRenameScope('global')}
                        className="text-violet-600 focus:ring-violet-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Toàn hệ thống (Khuyến nghị)</span>
                        <p className="text-[10px] text-slate-500">Cập nhật tất cả hồ sơ TCCS ({currentInfo.relatedTCCS.length}) và toàn bộ phiếu kiểm nghiệm có chỉ tiêu này.</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-200/50">
                      <input 
                        type="radio" 
                        name="scope" 
                        value="product" 
                        checked={renameScope === 'product'} 
                        onChange={() => setRenameScope('product')}
                        className="text-violet-600 focus:ring-violet-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Chỉ áp dụng cho 1 Sản phẩm cụ thể</span>
                        <p className="text-[10px] text-slate-500">Chỉ đổi tên trên hồ sơ TCCS và phiếu kiểm nghiệm thuộc sản phẩm được chọn.</p>
                      </div>
                    </label>
                  </div>

                  {renameScope === 'product' && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">Chọn sản phẩm:</label>
                      <select 
                        value={targetProductId} 
                        onChange={(e) => setTargetProductId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500"
                        required
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {productsUsingCurrentCriteria.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="auto-alias-check" 
                    checked={autoCreateAlias} 
                    onChange={(e) => setAutoCreateAlias(e.target.checked)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 rounded h-4 w-4"
                  />
                  <label htmlFor="auto-alias-check" className="text-xs text-emerald-900 cursor-pointer">
                    <span className="font-bold">Tự động tạo Alias ánh xạ</span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Lưu tên cũ ("{selectedName}") làm alias của tên mới ("{newName}") để các báo cáo và biểu đồ xu hướng cũ vẫn hiển thị đồng bộ.</p>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => navigate('/criteria')} 
                    className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !isAdmin}
                    className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-violet-200 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Xác nhận & Cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CriteriaFormPage;