import React, { useState } from 'react';
import { 
  OOSInvestigationReport, 
  generateAIOOSInvestigation, 
  generateRuleBasedOOSReport 
} from '../../services/ai/oosInvestigationService';
import { 
  ShieldAlert, 
  FileText, 
  Activity, 
  GitPullRequest, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  X, 
  Sparkles, 
  Users, 
  Cpu, 
  Layers, 
  Sliders, 
  Scale, 
  Wind,
  Loader2
} from 'lucide-react';
import { DSCard } from '../ui/DesignSystem';

interface OOSInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    productName: string;
    batchNo: string;
    mfgDate?: string;
    expDate?: string;
    failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[];
    passedCriteria?: { criteriaName: string; actualValue: string | number }[];
    formulaIngredients?: { name: string; declaredContent?: any }[];
    recentBatchesHistory?: { batchNo: string; overallStatus: string; results?: any[] }[];
  };
}

export const OOSInvestigationModal: React.FC<OOSInvestigationModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const [report, setReport] = useState<OOSInvestigationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'investigation' | 'ishikawa' | 'capa'>('overview');

  const handleGenerate = async (forceAI = true) => {
    setLoading(true);
    try {
      if (forceAI) {
        const res = await generateAIOOSInvestigation(initialData);
        setReport(res);
      } else {
        const res = generateRuleBasedOOSReport(initialData);
        setReport(res);
      }
    } catch (err) {
      console.error('Error generating OOS report:', err);
      const fallback = generateRuleBasedOOSReport(initialData);
      setReport(fallback);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !report) {
      handleGenerate(true);
    }
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Man': return <Users size={16} className="text-blue-500" />;
      case 'Machine': return <Cpu size={16} className="text-indigo-500" />;
      case 'Material': return <Layers size={16} className="text-emerald-500" />;
      case 'Method': return <Sliders size={16} className="text-amber-500" />;
      case 'Measurement': return <Scale size={16} className="text-purple-500" />;
      case 'Milieu': return <Wind size={16} className="text-cyan-500" />;
      default: return <Activity size={16} className="text-slate-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl my-auto overflow-hidden border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col max-h-[85vh]">
          {/* Modal Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400">
                  HỒ SƠ OOS GMP
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                  {report?.reportId || 'Đang khởi tạo...'}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                Điều Tra Sai Lệch OOS & Hoạch Định CAPA (AI)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Sản phẩm: <span className="font-bold text-slate-900 dark:text-slate-200">{initialData.productName}</span> — Lô: <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">{initialData.batchNo}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerate(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-xs font-bold transition-all border border-cyan-200 dark:border-cyan-800/50"
              title="Phân tích lại bằng AI"
            >
              <Sparkles size={14} className={loading ? 'animate-spin' : ''} />
              Tạo lại AI
            </button>
            <button
              onClick={handlePrint}
              disabled={!report}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all border border-slate-300 dark:border-slate-700"
            >
              <Printer size={14} />
              In hồ sơ
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
              <Sparkles className="absolute inset-0 m-auto text-cyan-500 animate-pulse" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                AI đang rà soát hồ sơ & xây dựng biên bản điều tra OOS...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Phân tích dữ liệu phân tích phòng Lab, thông số sản xuất, cây nguyên nhân 6M Ishikawa và đề xuất kế hoạch hành động CAPA.
              </p>
            </div>
          </div>
        )}

        {/* Content Body */}
        {!loading && report && (
          <div className="flex flex-col flex-1 overflow-hidden mt-3">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 shrink-0">
              {[
                { key: 'overview', label: '1. Tổng quan & Sự cố', icon: FileText },
                { key: 'investigation', label: '2. Điều tra 2 giai đoạn (Lab & Sx)', icon: Activity },
                { key: 'ishikawa', label: '3. Ishikawa 6M & 5-Why', icon: GitPullRequest },
                { key: 'capa', label: '4. Kế hoạch CAPA', icon: CheckCircle2 },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? 'bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-md shadow-slate-900/10'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Tab Content */}
            <div className="overflow-y-auto flex-1 pr-1 py-4 space-y-4">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Executive Summary Card */}
                  <DSCard className="p-4 bg-gradient-to-br from-red-50/60 via-white to-rose-50/40 dark:from-red-950/20 dark:via-slate-900 dark:to-slate-900 border-red-200/60 dark:border-red-900/40">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-wider">
                          Tóm tắt điều hành (Executive Summary)
                        </span>
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1.5 leading-relaxed">
                          {report.executiveSummary}
                        </p>
                      </div>
                      <div className="shrink-0 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-900/60 text-center">
                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest block">Mức rủi ro</span>
                        <span className="text-sm font-black text-red-700 dark:text-red-300 uppercase">
                          {report.riskAssessment.patientSafetyRisk}
                        </span>
                      </div>
                    </div>
                  </DSCard>

                  {/* Failed Criteria Table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-500" />
                        Danh sách chỉ tiêu lệch chuẩn (Out-of-Specification)
                      </h4>
                      <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                        {report.failedCriteria.length} chỉ tiêu vi phạm
                      </span>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-4 py-2.5">Chỉ tiêu kiểm nghiệm</th>
                          <th className="px-4 py-2.5 text-center">Giới hạn tiêu chuẩn</th>
                          <th className="px-4 py-2.5 text-center">Kết quả thực tế</th>
                          <th className="px-4 py-2.5 text-center">Đánh giá sai lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.failedCriteria.map((f, idx) => (
                          <tr key={idx} className="hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {f.criteriaName}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                              {f.specification} {f.unit || ''}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-black text-red-600 dark:text-red-400">
                              {f.actualValue} {f.unit || ''}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                                KHÔNG ĐẠT (OOS)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Scope & Regulatory Impact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DSCard className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        Phạm vi ảnh hưởng (Scope Impact)
                      </span>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                        {report.riskAssessment.scopeImpact}
                      </p>
                    </DSCard>
                    <DSCard className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        Yêu cầu báo cáo cơ quan quản lý
                      </span>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                        {report.riskAssessment.regulatoryNotificationRequired ? '⚠️ Cần thông báo cơ quan quản lý (Cục Quản lý Dược / ATTP)' : '✅ Lưu hồ sơ nội bộ, chưa cần thông báo ngoại viện'}
                      </p>
                    </DSCard>
                  </div>
                </div>
              )}

              {/* TAB 2: 2-PHASE INVESTIGATION */}
              {activeTab === 'investigation' && (
                <div className="space-y-4">
                  {/* Phase 1: Laboratory */}
                  <DSCard className="p-4 border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                          Giai đoạn 1 (Phase 1)
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100">
                          Điều tra Phòng kiểm nghiệm (Laboratory Investigation)
                        </h4>
                      </div>
                      <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded ${report.phase1LabInvestigation.isLabError ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {report.phase1LabInvestigation.isLabError ? 'Lỗi từ Lab' : 'Loại trừ lỗi Lab'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 font-medium">
                      {report.phase1LabInvestigation.summary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Thiết bị & Hiệu chuẩn</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase1LabInvestigation.equipmentCheck}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Chất chuẩn & Thuốc thử</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase1LabInvestigation.standardAndReagentCheck}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Thao tác chuẩn bị mẫu</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase1LabInvestigation.samplePrepCheck}</p>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/30 text-xs text-indigo-900 dark:text-indigo-200">
                      <span className="font-bold">Kết luận Lab:</span> {report.phase1LabInvestigation.labVerdict}
                    </div>
                  </DSCard>

                  {/* Phase 2: Manufacturing */}
                  <DSCard className="p-4 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                          Giai đoạn 2 (Phase 2)
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100">
                          Điều tra Quy trình Sản xuất (Manufacturing Investigation)
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 font-medium">
                      {report.phase2ManufacturingInvestigation.summary}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Nguyên liệu đầu vào</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase2ManufacturingInvestigation.rawMaterialReview}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Thông số công đoạn</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase2ManufacturingInvestigation.processParametersReview}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Môi trường phòng sạch</span>
                        <p className="text-[11px] text-slate-800 dark:text-slate-200 mt-1">{report.phase2ManufacturingInvestigation.environmentReview}</p>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200">
                      <span className="font-bold">Kết luận Sản xuất:</span> {report.phase2ManufacturingInvestigation.manufacturingVerdict}
                    </div>
                  </DSCard>
                </div>
              )}

              {/* TAB 3: ISHIKAWA & 5-WHY */}
              {activeTab === 'ishikawa' && (
                <div className="space-y-4">
                  {/* Root cause summary banner */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-200 block">
                      Tuyên bố nguyên nhân cốt lõi (Root Cause Statement)
                    </span>
                    <p className="text-xs font-bold mt-1 leading-relaxed">
                      {report.rootCauseStatement}
                    </p>
                  </div>

                  {/* 6M Ishikawa Fishbone Grid */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <GitPullRequest size={14} className="text-cyan-500" />
                      Sơ đồ xương cá phân tích nguyên nhân 6M (Ishikawa Fishbone)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {report.ishikawaDiagram.map((cat, i) => (
                        <div key={i} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                            {getCategoryIcon(cat.category)}
                            <h5 className="text-xs font-black text-slate-800 dark:text-slate-200">
                              {cat.vietnameseLabel}
                            </h5>
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            {cat.causes.map((c, cIdx) => (
                              <li key={cIdx} className="flex items-start gap-1.5 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0 mt-1.5" />
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5-Why Analysis Progression */}
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Activity size={14} className="text-indigo-500" />
                      Phương pháp suy luận 5-Why (5 Câu hỏi tại sao)
                    </h4>
                    <div className="space-y-2">
                      {report.fiveWhyAnalysis.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center shrink-0 text-[11px]">
                            {item.level}
                          </span>
                          <div className="flex-1">
                            <span className="font-bold text-indigo-900 dark:text-indigo-300">
                              Hỏi: {item.question}
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                              ➔ Đáp: {item.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CAPA PLAN */}
              {activeTab === 'capa' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        Kế hoạch hành động khắc phục & phòng ngừa (CAPA Plan)
                      </h4>
                      <span className="text-[11px] font-bold text-slate-500">
                        {report.capaPlan.length} hành động được thiết lập
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                          <th className="px-4 py-2.5">Phân loại</th>
                          <th className="px-4 py-2.5">Nội dung hành động</th>
                          <th className="px-4 py-2.5">Người phụ trách</th>
                          <th className="px-4 py-2.5">Thời hạn</th>
                          <th className="px-4 py-2.5">Bằng chứng nghiệm thu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.capaPlan.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                item.type === 'CORRECTION'
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                                  : item.type === 'CORRECTIVE'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              }`}>
                                {item.type === 'CORRECTION' ? 'Khắc phục ngay' : item.type === 'CORRECTIVE' ? 'Hành động KP' : 'Phòng ngừa'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                              {item.action}
                            </td>
                            <td className="px-4 py-3 font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                              {item.responsible}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                              {item.deadline}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                              {item.verificationMethod}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                        Quy trình phê duyệt & Đóng hồ sơ CAPA (GMP Standard):
                      </span>
                      Hồ sơ OOS và Kế hoạch CAPA cần được ký duyệt bởi Trưởng phòng QA và Giám đốc Nhà máy. Sau khi hoàn thành các bằng chứng nghiệm thu, hồ sơ sẽ được lưu trữ tối thiểu 05 năm phục vụ thanh tra Dược.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Hệ thống Quản lý Chất lượng PQM • Tiêu chuẩn PIC/S & GMP WHO
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity"
          >
            Đóng hồ sơ
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};
