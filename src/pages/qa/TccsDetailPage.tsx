import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, Package, Layers, FlaskConical, ClipboardCheck, CheckCircle2, AlertCircle, TrendingUp, ArrowRight, Hash } from 'lucide-react';
import { ensureArray, formatDateStandard } from '../../utils';
import { useDataGraph } from '../../hooks/useDataGraph';

const TccsDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tccsList, batches, testResults } = useDataGraph();

  const tccs = tccsList.find(t => t.id === id);
  const product = tccs?.product;

  if (!tccs) {
    return (
      <div className="p-8 text-center text-slate-500">
        Không tìm thấy thông tin TCCS.
        <button onClick={() => navigate('/tccs')} className="block mx-auto mt-4 text-indigo-600 font-bold hover:underline">Quay lại</button>
      </div>
    );
  }

  // Lô sản xuất đang áp dụng TCCS này
  const batchesUsingTccs = batches.filter(b => b.tccsId === tccs.id).slice(0, 5);
  // Phiếu kiểm nghiệm liên quan (tất cả lô dùng TCCS này)
  const allBatchIds = new Set(batches.filter(b => b.tccsId === tccs.id).map(b => b.id));
  const relatedTestResults = testResults.filter(r => {
    const batchId = r.batch?.id || r.batchId;
    return allBatchIds.has(batchId);
  });

  const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi', 'pb', 'cd', 'hg', 'as'];
  const MYCOTOXIN_KEYWORDS = ['aflatoxin', 'ochratoxin', 'patulin', 'zearalenone', 'độc tố vi nấm', 'mycotoxin', 'dư lượng'];
  const safety = ensureArray(tccs.safetyCriteria);
  const micro = safety.filter(c => {
      if (!c) return false;
      const nameLower = (c.name || '').toLowerCase();
      if ((c as any).category === 'micro') return true;
      if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw)) && !MYCOTOXIN_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
      return false;
  });
  const metal = safety.filter(c => {
      if (!c) return false;
      const nameLower = (c.name || '').toLowerCase();
      if ((c as any).category === 'metal') return true;
      if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
      return false;
  });
  const mycotoxin = safety.filter(c => {
      if (!c) return false;
      const nameLower = (c.name || '').toLowerCase();
      if ((c as any).category === 'mycotoxin' || (c as any).category === 'other') return true;
      if (!(c as any).category && MYCOTOXIN_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
      return false;
  });

  const groups = [
    { title: 'Chỉ tiêu Chất lượng', criteria: tccs.mainQualityCriteria, color: 'text-indigo-600' },
    { title: 'Giới hạn Vi sinh vật', criteria: micro, color: 'text-emerald-600' },
    { title: 'Giới hạn Kim loại nặng', criteria: metal, color: 'text-red-600' },
    { title: 'Độc tố vi nấm / Chỉ tiêu An toàn khác', criteria: mycotoxin, color: 'text-amber-600' }
  ];

  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED': return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400';
      case 'REJECTED': return 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400';
      case 'TESTING': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };
  const getBatchStatusLabel = (status: string) => {
    switch (status) { case 'RELEASED': return 'Xuất xưởng'; case 'REJECTED': return 'Từ chối'; case 'TESTING': return 'Đang kiểm'; default: return 'Chờ'; }
  };

  return (
    <div className="p-6 max-w-[21cm] mx-auto animate-in fade-in duration-500 space-y-6 print:p-0 print:m-0 print:max-w-none print:space-y-4">
      {/* Khối CSS in ấn */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          .tccs-print-title { display: block !important; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/tccs')} className="p-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl shadow-sm transition-all border border-slate-100 dark:border-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
            Chi tiết TCCS
          </h1>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg text-sm font-bold transition-colors shadow-md">
          <Printer size={16} /> In TCCS
        </button>
      </div>

      {/* --- PANEL LIÊN KẾT DỮ LIỆU (chỉ hiển thị trên màn hình, không in) --- */}
      {(tccs.batchesCount > 0 || tccs.testResultsCount > 0 || product) && (
        <div className="print-hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Sản phẩm */}
          {product && (
            <Link to={`/products/${product.id}`}
              className="flex flex-col gap-1.5 p-3.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/50 rounded-xl shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Package size={12} className="text-emerald-500" /> Sản phẩm
              </div>
              <p className="font-black text-slate-700 dark:text-slate-200 text-sm leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{product.name}</p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{product.code}</p>
            </Link>
          )}
          {/* Lô đang dùng */}
          <Link to={`/batches?productId=${tccs.productId}`}
            className="flex flex-col gap-1.5 p-3.5 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800/50 rounded-xl shadow-sm hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <Layers size={12} className="text-blue-500" /> Lô áp dụng
            </div>
            <p className="font-black text-blue-600 dark:text-blue-400 text-2xl">{tccs.batchesCount}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">Xem lô <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" /></p>
          </Link>
          {/* Phiếu kiểm nghiệm */}
          <Link to={`/test-results?productId=${tccs.productId}`}
            className="flex flex-col gap-1.5 p-3.5 bg-white dark:bg-slate-800 border border-cyan-200 dark:border-cyan-800/50 rounded-xl shadow-sm hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <ClipboardCheck size={12} className="text-cyan-500" /> Phiếu KN
            </div>
            <p className="font-black text-cyan-600 dark:text-cyan-400 text-2xl">{tccs.testResultsCount}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">Xem phiếu <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" /></p>
          </Link>
          {/* Tỷ lệ đạt */}
          <div className={`flex flex-col gap-1.5 p-3.5 bg-white dark:bg-slate-800 border rounded-xl shadow-sm ${tccs.passRate >= 80 ? 'border-emerald-200 dark:border-emerald-800/50' : tccs.passRate >= 50 ? 'border-amber-200 dark:border-amber-800/50' : 'border-red-200 dark:border-red-800/50'}`}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <TrendingUp size={12} className={tccs.passRate >= 80 ? 'text-emerald-500' : tccs.passRate >= 50 ? 'text-amber-500' : 'text-red-500'} /> Tỷ lệ đạt
            </div>
            <p className={`font-black text-2xl ${tccs.passRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : tccs.passRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {tccs.testResultsCount > 0 ? `${tccs.passRate}%` : '—'}
            </p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{tccs.testResultsCount > 0 ? 'Tổng hợp' : 'Chưa có KN'}</p>
          </div>
        </div>
      )}

      {/* --- DANH SÁCH LÔ GẦN NHẤT DÙNG TCCS NÀY --- */}
      {batchesUsingTccs.length > 0 && (
        <div className="print-hidden bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Layers size={14} className="text-blue-500" /> Lô sản xuất đang áp dụng TCCS này
            </h3>
            <Link to={`/batches?productId=${tccs.productId}`} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              Xem tất cả <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {batchesUsingTccs.map(batch => (
              <Link key={batch.id} to={`/batches/${batch.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <Hash size={12} className="text-slate-400 dark:text-slate-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{batch.batchNo}</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{formatDateStandard(batch.mfgDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {batch.testResultsCount > 0 && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 px-2 py-0.5 rounded">
                      {batch.testResultsCount} phiếu KN
                    </span>
                  )}
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getBatchStatusColor(batch.status)}`}>
                    {getBatchStatusLabel(batch.status)}
                  </span>
                  <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-10 print:shadow-none print:border-0 print:p-0">
        <div className="tccs-print-title hidden text-center mb-8 border-b-2 border-slate-800 pb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Tiêu chuẩn Cơ sở</h1>
          <p className="text-sm font-bold text-slate-600 uppercase">Specification Document</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 mb-8 print:bg-transparent print:border-slate-800 print:rounded-none">
          <p><span className="font-bold text-slate-500 dark:text-slate-400">Mã TCCS:</span> <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg ml-2 print:text-slate-900">{tccs.code}</span></p>
          <p>
            <span className="font-bold text-slate-500 dark:text-slate-400">Sản phẩm:</span>{' '}
            {product ? (
              <Link to={`/products/${product.id}`} className="font-bold text-slate-800 dark:text-slate-200 ml-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors print:text-slate-900">
                {product.name}
              </Link>
            ) : (
              <span className="font-bold text-slate-800 dark:text-slate-200 ml-2 print:text-slate-900">—</span>
            )}
          </p>
          <p><span className="font-bold text-slate-500 dark:text-slate-400">Ngày ban hành:</span> <span className="font-medium text-slate-800 dark:text-slate-200 ml-2 print:text-slate-900">{formatDateStandard(tccs.issueDate)}</span></p>
          <p className="print:hidden"><span className="font-bold text-slate-500 dark:text-slate-400">Trạng thái:</span> <span className={`font-black uppercase ml-2 text-[10px] px-2 py-0.5 rounded ${tccs.isActive ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tccs.isActive ? 'Hiệu lực' : 'Hết hiệu lực'}</span></p>
          {tccs.formula && (
            <p className="print:hidden">
              <span className="font-bold text-slate-500 dark:text-slate-400">Công thức:</span>{' '}
              <Link to={`/product-formulas`} className="font-bold text-purple-600 dark:text-purple-400 ml-2 hover:underline text-sm flex items-center gap-1 inline-flex">
                <FlaskConical size={12} /> Xem công thức sản phẩm
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-8">
          {groups.map((group) => {
            const list = ensureArray(group.criteria);
            if (list.length === 0) return null;
            return (
              <div key={group.title} className="break-inside-avoid">
                <h4 className={`text-sm font-black uppercase tracking-widest mb-3 ${group.color} print:text-slate-900 border-b-2 border-slate-200 dark:border-slate-700 print:border-slate-800 pb-2`}>{group.title}</h4>
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800 print:bg-transparent text-slate-600 dark:text-slate-300 print:text-slate-900">
                    <tr>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 font-bold">Tên chỉ tiêu</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 font-bold">Mức yêu cầu</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 font-bold text-center">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors break-inside-avoid">
                        <td className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 font-bold text-slate-700 dark:text-slate-300 print:text-slate-900">{c.name}</td>
                        <td className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 font-mono text-slate-600 dark:text-slate-400 print:text-slate-900">
                          {c.expectedText || (
                            c.min !== undefined && c.max !== undefined ? `${c.min} ~ ${c.max}` : c.min !== undefined ? `≥ ${c.min}` : c.max !== undefined ? `≤ ${c.max}` : ''
                          )}
                        </td>
                        <td className="p-3 border border-slate-200 dark:border-slate-700 print:border-slate-800 text-center text-slate-500 dark:text-slate-400 print:text-slate-900">{c.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TccsDetailPage;