import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { ArrowLeft, FileText, Printer } from 'lucide-react';
import { ensureArray, formatDateStandard } from '../../utils';

const TccsDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const tccsList = useAppStore(s => s.tccsList);
  const products = useAppStore(s => s.products);

  const tccs = tccsList.find(t => t.id === id);
  const product = products.find(p => p.id === tccs?.productId);

  if (!tccs) {
    return (
      <div className="p-8 text-center text-slate-500">
        Không tìm thấy thông tin TCCS.
        <button onClick={() => navigate('/tccs')} className="block mx-auto mt-4 text-indigo-600 font-bold hover:underline">Quay lại</button>
      </div>
    );
  }

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

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-10 print:shadow-none print:border-0 print:p-0">
        <div className="tccs-print-title hidden text-center mb-8 border-b-2 border-slate-800 pb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Tiêu chuẩn Cơ sở</h1>
          <p className="text-sm font-bold text-slate-600 uppercase">Specification Document</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 mb-8 print:bg-transparent print:border-slate-800 print:rounded-none">
          <p><span className="font-bold text-slate-500 dark:text-slate-400">Mã TCCS:</span> <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg ml-2 print:text-slate-900">{tccs.code}</span></p>
          <p><span className="font-bold text-slate-500 dark:text-slate-400">Sản phẩm:</span> <span className="font-bold text-slate-800 dark:text-slate-200 ml-2 print:text-slate-900">{product?.name}</span></p>
          <p><span className="font-bold text-slate-500 dark:text-slate-400">Ngày ban hành:</span> <span className="font-medium text-slate-800 dark:text-slate-200 ml-2 print:text-slate-900">{formatDateStandard(tccs.issueDate)}</span></p>
          <p className="print:hidden"><span className="font-bold text-slate-500 dark:text-slate-400">Trạng thái:</span> <span className={`font-black uppercase ml-2 text-[10px] px-2 py-0.5 rounded ${tccs.isActive ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tccs.isActive ? 'Hiệu lực' : 'Hết hiệu lực'}</span></p>
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