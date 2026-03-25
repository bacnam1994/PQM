import React, { memo, useMemo } from 'react';
import { TestResult, Batch, Product, TCCS, TestResultEntry, ProductFormula } from '../types';
import { TEST_RESULT_STATUS } from '../utils/constants';
import { parseNumberFromText } from '../utils/criteriaEvaluation';

interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

interface CoAReportProps {
  res: TestResult;
  batch: Batch | undefined;
  product: Product | undefined;
  tccs: TCCS | undefined;
  formula?: ProductFormula; // Thêm prop cho công thức sản phẩm
}

// Helper: Format số sang dạng mũ (VD: 1000 -> 10³)
const formatScientific = (value: string | number) => {
  let num = Number(value);
  // Nếu không phải số JS chuẩn (VD: "10^3"), thử parse bằng utility
  if (isNaN(num)) {
    num = parseNumberFromText(String(value));
    // Nếu parse ra 0 nhưng chuỗi gốc không phải "0" (VD: "Âm tính"), giữ nguyên text gốc
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

const CoAReport = memo(({ res, batch, product, tccs, formula }: CoAReportProps) => {
  const groupedResults = useMemo(() => {
    if (!res.results) return [];
    
    const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
    const mainCriteria = tccs?.mainQualityCriteria || [];
    const safetyCriteria = tccs?.safetyCriteria || [];

    const groups = {
      physical: [] as TestResultEntry[],
      micro: [] as TestResultEntry[],
      metal: [] as TestResultEntry[]
    };

    res.results.forEach(r => {
        const safetyItem = safetyCriteria.find(c => c.name === r.criteriaName);
        if (safetyItem) {
           const cat = (safetyItem as any).category;
           const nameLower = r.criteriaName.toLowerCase();
           if (cat === 'metal' || (!cat && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw)))) {
             groups.metal.push(r);
           } else {
             groups.micro.push(r);
           }
        } else {
           groups.physical.push(r);
        }
    });

    // Sort physical: Main criteria first (in order), then Extra
    groups.physical.sort((a, b) => {
        const idxA = mainCriteria.findIndex(c => c.name === a.criteriaName);
        const idxB = mainCriteria.findIndex(c => c.name === b.criteriaName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    return [
        { title: 'I. Chỉ tiêu Lý hóa & Cảm quan', items: groups.physical },
        { title: 'II. Giới hạn Vi sinh vật', items: groups.micro },
        { title: 'III. Giới hạn Kim loại nặng', items: groups.metal }
    ].filter(g => g.items.length > 0);
  }, [res.results, tccs]);

  const getLimitText = (r: TestResultEntry) => {
    if (r.isExtra) return (r as ExtraTestResultEntry).limit || '';
    
    if (!tccs) return 'Theo TCCS';
    
    const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])];
    const c = allCriteria.find(item => item.name === r.criteriaName);
    
    if (!c) return 'Theo TCCS';
    
    if (c.type === 'NUMBER') {
      if (c.min != null && c.max != null) return `${c.min} ~ ${c.max}`;
      if (c.min != null) return `≥ ${c.min}`;
      if (c.max != null) return `≤ ${c.max}`;
    }
    return c.expectedText || '';
  };

  const getUnitText = (r: TestResultEntry) => {
    // Ưu tiên đơn vị từ TCCS gốc của phiếu kết quả
    if (tccs) {
      const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])];
      const c = allCriteria.find(item => item.name === r.criteriaName);
      if (c && c.unit) return c.unit;
    }
    
    // Nếu không tìm thấy, dùng đơn vị đã lưu trong kết quả (fallback)
    return r.unit || '';
  };

  return (
    <div className="bg-white p-10 text-slate-900 max-w-[21cm] mx-auto print:shadow-none print:border-0 print:p-0 print:max-w-full font-serif">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tight font-sans">Phiếu Kiểm Nghiệm</h2>
          <p className="text-sm font-bold text-slate-500 font-sans">Certificate of Analysis (CoA)</p>
          <p className="text-[10px] font-medium font-sans text-slate-400 uppercase tracking-tighter">ID: {res.id.split('-')[0]}</p>
        </div>
        <div className="text-right space-y-1 font-sans">
          <h3 className="font-black text-lg">QC DEPARTMENT</h3>
          <p className="text-sm font-bold uppercase text-indigo-700">{res.labName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-4 gap-x-12 mb-8 text-sm font-sans">
        <div className="space-y-2">
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Sản phẩm:</span> <span className="font-bold">{product?.name}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Số lô (Batch No):</span> <span className="font-bold text-indigo-800">{batch?.batchNo}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Tiêu chuẩn:</span> <span className="font-bold">{tccs?.code || '---'}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Sản lượng:</span> <span className="font-bold">{batch?.actualYield?.toLocaleString()} {batch?.yieldUnit}</span></div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Ngày SX (MFG):</span> <span className="font-bold">{batch && batch.mfgDate ? new Date(batch.mfgDate).toLocaleDateString('en-GB') : '---'}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Hạn dùng (EXP):</span> <span className="font-bold text-red-700">{batch && batch.expDate ? new Date(batch.expDate).toLocaleDateString('en-GB') : '---'}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Ngày xuất phiếu:</span> <span className="font-bold">{new Date(res.testDate).toLocaleDateString('en-GB')}</span></div>
          <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Quy cách:</span> <span className="font-bold">{batch?.packaging || tccs?.packaging || '---'}</span></div>
        </div>
      </div>

      <div className="mb-10 font-sans">
        <h4 className="text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-1.5 mb-4">Kết quả Phân tích</h4>
        <table className="w-full text-xs border-collapse">
          <thead className="bg-slate-50 text-left border-b">
            <tr>
              <th className="py-2 px-2">Chỉ tiêu</th>
              <th className="py-2 px-2">Yêu cầu</th>
              <th className="py-2 px-2 text-center">Đơn vị tính</th>
              <th className="py-2 px-2 text-right">Thực tế</th>
            </tr>
          </thead>
          <tbody>
            {groupedResults.map((group) => (
              <React.Fragment key={group.title}>
                <tr className="bg-slate-50/50 print:bg-transparent">
                  <td colSpan={4} className="py-2 px-2 font-bold text-slate-800 italic border-b">{group.title}</td>
                </tr>
                {group.items.map((r, i) => (
              (() => {
                // Tìm hoạt chất tương ứng trong công thức đã công bố
                const formulaIngredient = formula?.ingredients.find(ing => ing.name === r.criteriaName);
                
                // Xử lý hàm lượng công bố (hợp chất)
                let declaredContent = formulaIngredient?.declaredContent;
                if (typeof declaredContent === 'string') declaredContent = parseNumberFromText(declaredContent);

                // Xử lý hàm lượng nguyên tố
                let elementalContent = (formulaIngredient as any)?.elementalContent;
                if (typeof elementalContent === 'string') elementalContent = parseNumberFromText(elementalContent);

                // Ưu tiên dùng hàm lượng nguyên tố để tính %, nếu không có thì dùng hàm lượng hợp chất
                const basisForCalculation = (elementalContent != null && elementalContent > 0) ? elementalContent : declaredContent;

                // Sử dụng parseNumberFromText để xử lý kết quả kiểm nghiệm (hỗ trợ số mũ 10^3, 1.5x10^5...)
                const actualValue = parseNumberFromText(String(r.value));
                let percentageView = null;

                // Nếu có hàm lượng công bố và kết quả là số, tính toán và hiển thị %
                if (basisForCalculation && basisForCalculation > 0 && actualValue > 0) {
                  const percentage = (actualValue / (basisForCalculation as number)) * 100;
                  percentageView = (
                    <span className="text-[10px] text-blue-600 font-mono ml-2 font-normal">
                      ({percentage.toFixed(1)}%)
                    </span>
                  );
                }

                return (
                  <tr key={r.criteriaName} className="border-b">
                    <td className="py-2 px-2 font-medium">{r.criteriaName}</td>
                    <td className="py-2 px-2 text-slate-500"><span className="font-bold text-slate-800">{getLimitText(r)}</span></td>
                    <td className="py-2 px-2 text-center text-slate-500">{getUnitText(r)}</td>
                    <td className={`py-2 px-2 text-right font-black ${r.isPass ? 'text-slate-900' : 'text-red-600'}`}>
                      {formatScientific(r.value)}{percentageView}
                    </td>
                  </tr>
                );
              })()
            ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-16 pt-8 border-t-2 border-slate-900 flex justify-between items-end font-sans">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase">KẾT LUẬN:</span>
          <span className={`px-6 py-1 rounded text-sm font-black uppercase ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {res.overallStatus === TEST_RESULT_STATUS.PASS ? 'ĐẠT' : 'KHÔNG ĐẠT'}
          </span>
        </div>
        <div className="text-center w-56">
          <p className="text-xs font-bold uppercase mb-20">Người phê duyệt</p>
          <p className="font-black text-sm uppercase underline">GIÁM ĐỐC CHẤT LƯỢNG</p>
        </div>
      </div>
    </div>
  );
});

export default CoAReport;