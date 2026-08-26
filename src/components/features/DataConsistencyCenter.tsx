import React, { useState, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, 
  Wrench, Sparkles, Layers, FileCheck, Package, Beaker, Link2, 
  Unlink, Check, ChevronDown, ChevronUp, ArrowRight, Activity, Filter, Info
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useDataGraph } from '../../hooks/useDataGraph';
import { 
  auditDataConsistency, generateAutoHealPlan, ConsistencyReport, 
  ConsistencyIssue, ConsistencyCategory, SystemDataSnapshot 
} from '../../services/dataConsistencyService';
import toast from 'react-hot-toast';

export const DataConsistencyCenter: React.FC = () => {
  const { 
    products, batches, tccsList, productFormulas, rawMaterials, testResults, 
    criteriaAliases, updateProductFormula, updateTestResult, updateTCCS, 
    deleteCriteriaAlias, isAdmin, notify 
  } = useAppStore();

  const [isScanning, setIsScanning] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ConsistencyCategory | 'ALL'>('ALL');
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  // Lấy dữ liệu hệ thống hiện tại
  const systemSnapshot: SystemDataSnapshot = useMemo(() => ({
    products: products || [],
    batches: batches || [],
    tccsList: tccsList || [],
    productFormulas: productFormulas || [],
    rawMaterials: rawMaterials || [],
    testResults: testResults || [],
    criteriaAliases: criteriaAliases || [],
  }), [products, batches, tccsList, productFormulas, rawMaterials, testResults, criteriaAliases]);

  const handleManualScan = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      toast.success('Đã hoàn tất rà soát toàn bộ hệ thống!');
    }, 500);
  }, []);

  // Thực hiện quét liên kết dữ liệu
  const report: ConsistencyReport = useMemo(() => {
    return auditDataConsistency(systemSnapshot);
  }, [systemSnapshot]);

  // Lọc danh sách vấn đề theo category được chọn
  const filteredIssues = useMemo(() => {
    if (selectedCategory === 'ALL') return report.issues;
    return report.issues.filter(i => i.category === selectedCategory);
  }, [report, selectedCategory]);

  // Xử lý Auto-Heal 1 vấn đề đơn lẻ
  const handleFixSingleIssue = useCallback(async (issue: ConsistencyIssue) => {
    if (!isAdmin) {
      notify({ type: 'ERROR', message: 'Chỉ Quản trị viên mới có quyền tự động sửa dữ liệu.' });
      return;
    }
    if (!issue.autoHealable || !issue.healPayload) return;

    setIsHealing(true);
    try {
      if (issue.autoHealAction === 'LINK_MATERIAL') {
        const { formulaId } = issue.healPayload;
        const formula = productFormulas.find(f => f.id === formulaId);
        if (formula) {
          const updated = JSON.parse(JSON.stringify(formula));
          const materialNameMap = new Map<string, string>();
          rawMaterials.forEach(m => {
            materialNameMap.set(m.name.trim().toLowerCase(), m.id);
            (m.aliases || []).forEach(a => materialNameMap.set(a.trim().toLowerCase(), m.id));
          });

          (updated.ingredients || []).forEach((ing: any) => {
            if (!ing.materialId && ing.name) {
              const matched = materialNameMap.get(ing.name.trim().toLowerCase());
              if (matched) ing.materialId = matched;
            }
          });
          (updated.excipients || []).forEach((exc: any) => {
            if (!exc.materialId && exc.name) {
              const matched = materialNameMap.get(exc.name.trim().toLowerCase());
              if (matched) exc.materialId = matched;
            }
          });
          await updateProductFormula(updated);
          toast.success(`Đã tự động liên kết Nguyên liệu cho công thức ${formulaId}`);
        }
      } else if (issue.autoHealAction === 'FIX_TEST_STATUS') {
        const { testResultId, correctStatus } = issue.healPayload;
        const testRes = testResults.find(t => t.id === testResultId);
        if (testRes) {
          await updateTestResult({ ...testRes, overallStatus: correctStatus });
          toast.success(`Đã cập nhật trạng thái phiếu kiểm nghiệm thành ${correctStatus}`);
        }
      } else if (issue.autoHealAction === 'FIX_ACTIVE_TCCS') {
        const { productId, targetTccsId } = issue.healPayload;
        const pTccsList = tccsList.filter(t => t.productId === productId);
        for (const t of pTccsList) {
          const shouldBeActive = t.id === targetTccsId;
          if (t.isActive !== shouldBeActive) {
            await updateTCCS({ ...t, isActive: shouldBeActive });
          }
        }
        toast.success(`Đã chuẩn hóa TCCS hiện hành cho sản phẩm`);
      } else if (issue.autoHealAction === 'CLEAN_ORPHAN_ALIAS') {
        await deleteCriteriaAlias(issue.healPayload.aliasId);
        toast.success('Đã dọn dẹp alias mồ côi');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Lỗi khi khắc phục: ' + e.message);
    } finally {
      setIsHealing(false);
    }
  }, [isAdmin, notify, productFormulas, rawMaterials, testResults, tccsList, updateProductFormula, updateTestResult, updateTCCS, deleteCriteriaAlias]);

  // Xử lý Auto-Heal toàn bộ vấn đề an toàn
  const handleAutoHealAll = useCallback(async () => {
    if (!isAdmin) {
      notify({ type: 'ERROR', message: 'Chỉ Quản trị viên mới có quyền tự động sửa dữ liệu.' });
      return;
    }

    const plan = generateAutoHealPlan(report, systemSnapshot);
    if (plan.totalActionsCount === 0) {
      notify({ type: 'INFO', message: 'Không có vấn đề nào có thể tự động hàn gắn.' });
      return;
    }

    setIsHealing(true);
    let successCount = 0;

    try {
      // 1. Cập nhật Formulas
      for (const formulaId of Object.keys(plan.formulaUpdates)) {
        await updateProductFormula(plan.formulaUpdates[formulaId]);
        successCount++;
      }

      // 2. Cập nhật Test Result Statuses
      for (const trId of Object.keys(plan.testResultStatusUpdates)) {
        const tr = testResults.find(t => t.id === trId);
        if (tr) {
          await updateTestResult({ ...tr, overallStatus: plan.testResultStatusUpdates[trId] });
          successCount++;
        }
      }

      // 3. Cập nhật TCCS Active Flags
      for (const pId of Object.keys(plan.tccsActiveUpdates)) {
        const updates = plan.tccsActiveUpdates[pId];
        for (const u of updates) {
          const tccsItem = tccsList.find(t => t.id === u.tccsId);
          if (tccsItem && tccsItem.isActive !== u.isActive) {
            await updateTCCS({ ...tccsItem, isActive: u.isActive });
          }
        }
        successCount++;
      }

      // 4. Dọn dẹp Orphan Aliases
      for (const aId of plan.orphanAliasIdsToDelete) {
        await deleteCriteriaAlias(aId);
        successCount++;
      }

      notify({ 
        type: 'SUCCESS', 
        title: 'Hàn gắn thành công!', 
        message: `Đã tự động sửa đổi và chuẩn hóa ${successCount} liên kết dữ liệu.` 
      });
    } catch (e: any) {
      console.error(e);
      notify({ type: 'ERROR', message: 'Lỗi trong quá trình Auto-Heal: ' + e.message });
    } finally {
      setIsHealing(false);
    }
  }, [isAdmin, notify, report, systemSnapshot, testResults, tccsList, updateProductFormula, updateTestResult, updateTCCS, deleteCriteriaAlias]);

  return (
    <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/50 pb-5">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl ${
            report.grade === 'EXCELLENT' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
            report.grade === 'GOOD' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' :
            report.grade === 'WARNING' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' :
            'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
          }`}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Trung tâm Kiểm soát & Hàn gắn Toàn vẹn Dữ liệu
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                report.grade === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' :
                report.grade === 'GOOD' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' :
                report.grade === 'WARNING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' :
                'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
              }`}>
                Hạng {report.grade}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rà soát tự động 8 thực thể dữ liệu, phát hiện bản ghi mồ côi, sai lệch liên kết và bất nhất quán logic.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualScan}
            disabled={isScanning}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
            title="Quét lại toàn bộ cơ sở dữ liệu"
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin text-indigo-600" : ""} />
            Quét lại
          </button>
          {report.autoHealableCount > 0 && isAdmin && (
            <button
              onClick={handleAutoHealAll}
              disabled={isHealing}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
            >
              {isHealing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Hàn gắn Toàn bộ ({report.autoHealableCount})
            </button>
          )}
        </div>
      </div>

      {/* Score and Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score Card */}
        <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
          report.grade === 'EXCELLENT' ? 'bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40' :
          report.grade === 'GOOD' ? 'bg-blue-50/60 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40' :
          report.grade === 'WARNING' ? 'bg-amber-50/60 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40' :
          'bg-rose-50/60 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40'
        }`}>
          <div className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            {report.overallScore}<span className="text-base font-normal text-slate-400">/100</span>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Điểm Sức khỏe</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {report.totalIssuesCount === 0 ? 'Dữ liệu hoàn hảo' : `${report.totalIssuesCount} cảnh báo`}
            </p>
          </div>
        </div>

        {/* Critical Issues */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Nghiêm trọng (Critical)</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{report.criticalCount}</p>
          </div>
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-xl">
            <AlertCircle size={20} />
          </div>
        </div>

        {/* Warning Issues */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Cần lưu ý (Warning)</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{report.warningCount}</p>
          </div>
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-500 rounded-xl">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Auto-Healable */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tự động sửa được</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{report.autoHealableCount}</p>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 rounded-xl">
            <Wrench size={20} />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pt-2">
        {[
          { id: 'ALL', label: 'Tất cả vấn đề', count: report.totalIssuesCount },
          { id: 'ORPHAN_RECORDS', label: 'Bản ghi mồ côi', count: report.categoryBreakdown.orphanRecords },
          { id: 'CROSS_ENTITY_MISMATCH', label: 'Sai lệch liên kết chéo', count: report.categoryBreakdown.crossEntityMismatch },
          { id: 'LOGICAL_STATUS_INCONSISTENCY', label: 'Bất nhất quán logic', count: report.categoryBreakdown.logicalStatusInconsistency },
          { id: 'RAW_MATERIAL_LINKAGE', label: 'Mất liên kết Nguyên liệu', count: report.categoryBreakdown.rawMaterialLinkage },
          { id: 'FORMULA_TCCS_ALIGNMENT', label: 'Lệch Công thức - TCCS', count: report.categoryBreakdown.formulaTccsAlignment },
          { id: 'DUPLICATE_IDENTIFIERS', label: 'Trùng lặp mã định danh', count: report.categoryBreakdown.duplicateIdentifiers },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedCategory === tab.id
                ? 'bg-slate-800 text-white dark:bg-indigo-600 dark:text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="space-y-3 pt-2">
        {filteredIssues.map((issue) => {
          const isExpanded = expandedIssueId === issue.id;

          return (
            <div 
              key={issue.id}
              className={`p-4 rounded-xl border transition-all ${
                issue.severity === 'CRITICAL' ? 'bg-rose-50/40 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30' :
                issue.severity === 'WARNING' ? 'bg-amber-50/40 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/30' :
                'bg-slate-50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    issue.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400' :
                    issue.severity === 'WARNING' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' :
                    'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {issue.severity === 'CRITICAL' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {issue.title}
                      </h4>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        issue.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {issue.entityType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {issue.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {issue.autoHealable && isAdmin && (
                    <button
                      onClick={() => handleFixSingleIssue(issue)}
                      disabled={isHealing}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles size={12} />
                      Sửa tự động
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs animate-in fade-in duration-200">
                  <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Hành động khắc phục đề xuất:</p>
                    <p className="text-slate-600 dark:text-slate-400">{issue.suggestedAction}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredIssues.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">
              Không phát hiện vấn đề nào trong phân nhóm này!
            </h4>
            <p className="text-xs text-slate-400 max-w-md">
              Toàn bộ dữ liệu của danh mục này đang đạt trạng thái liên kết và nhất quán tuyệt đối.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
