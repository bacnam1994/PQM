import React, { memo, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TestResult, Batch, Product, TCCS, TestResultEntry, ProductFormula, FormulaIngredient, Criterion } from '../../types';
import { TEST_RESULT_STATUS, parseNumberFromText, formatDateStandard, calculateOverallStatus, getActiveLocale } from '../../utils';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName, diceScore } from '../../services/criteriaAliasService';
import { lookupPharmaTerm, isCriteriaMatch } from '../../utils/aiMapping';

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

// Đưa mảng hằng số ra ngoài component để tránh khởi tạo lại ở mỗi dòng render
const ND_KEYWORDS = ['ND', 'NOT DETECTED', 'KHÔNG PHÁT HIỆN', 'K.P.H', 'KPH', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ', 'KHÔNG ĐƯỢC CÓ'];

// Helper: Format số sang dạng mũ (VD: 1000 -> 10³)
const formatScientific = (value: string | number, limitText?: string) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value).trim();

  // Tách các toán tử (<, >, ≤, ≥, ~) ra khỏi giá trị số để bảo toàn khi hiển thị
  const match = stringValue.match(/^([<≤>≥~=]+)?\s*(.+)$/);
  const prefix = match && match[1] ? match[1] + ' ' : '';
  const coreValue = match ? match[2] : stringValue;

  let num = Number(coreValue);
  const isSciFormat = /[eE][+-]?\d+/.test(coreValue) || coreValue.includes('^') || /\d+\s*[xX]\s*10/i.test(coreValue) || /10\s+\d+/.test(coreValue);

  // Nếu không phải số hợp lệ (chuỗi chữ) thì parse, nếu vẫn lỗi thì trả về chuỗi gốc
  if (isNaN(num) || isSciFormat) {
    num = parseNumberFromText(coreValue);
    
    if (num === 0 && !/^0([.,]0+)?$/.test(coreValue)) return stringValue;
  }
  
  if (isNaN(num)) return stringValue;

  if (isSciFormat || Math.abs(num) >= 10000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.00001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    const roundedMantissa = Math.round((mantissa + Number.EPSILON) * 100000) / 100000;

    return (
      <span className="whitespace-nowrap">
        {prefix.trim()}{prefix ? ' ' : ''}
        {roundedMantissa !== 1 && <>{roundedMantissa} × </>}
        10<sup>{exponent}</sup>
      </span>
    );
  }
  
  // Đồng bộ số chữ số thập phân theo yêu cầu của TCCS
  let fractionDigits: number | undefined = undefined;
  if (limitText) {
    const decimalMatches = String(limitText).match(/\d+[.,]\d+/g);
    if (decimalMatches) {
      let maxDecimals = 0;
      decimalMatches.forEach(m => {
        const decimals = m.split(/[.,]/)[1]?.length || 0;
        if (decimals > maxDecimals) maxDecimals = decimals;
      });
      fractionDigits = maxDecimals;
    }
  }

  const formatOptions: Intl.NumberFormatOptions = { maximumFractionDigits: 10 };
  if (fractionDigits !== undefined) {
    formatOptions.minimumFractionDigits = fractionDigits;
    formatOptions.maximumFractionDigits = fractionDigits;
  }

  const locale = getActiveLocale();
  return `${prefix.trim()}${prefix ? ' ' : ''}${num.toLocaleString(locale, formatOptions)}`;
};

const CoAReport = memo(({ res, batch, product, tccs, formula }: CoAReportProps) => {
  // URL xác thực công khai khi quét mã QR trên CoA in ra
  const coaUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/verify/${res.id || (batch ? batch.id : '')}` 
    : '';

  // Hook giải mã tên chỉ tiêu qua bảng alias — hỗ trợ cả tên cũ lẫn tên mới
  const resolver = useCriteriaResolver(tccs);

  // Map tên chuẩn (normalize) → Criterion — duyën mới chỉ dùng tên chuẩn hiện tại làm key
  const allCriteriaMap = useMemo(() => {
    const map = new Map<string, Criterion>();
    if (tccs) {
      (tccs.mainQualityCriteria || []).forEach(c => c && c.name && c.name.trim() !== '' && map.set(normalizeName(c.name), c));
      (tccs.safetyCriteria || []).forEach(c => c && c.name && c.name.trim() !== '' && map.set(normalizeName(c.name), c));
    }
    return map;
  }, [tccs]);

  const formulaItemMap = useMemo(() => {
    const map = new Map<string, FormulaIngredient>();
    if (formula) {
      (formula.ingredients || []).forEach(ing => ing && ing.name && map.set(normalizeName(ing.name), ing));
      (formula.excipients || []).forEach(exc => exc && exc.name && map.set(normalizeName(exc.name), exc));
    }
    return map;
  }, [formula]);

  /**
   * Tra cứu thành phần công thức theo 3 lớp:
   * Lớp 1: Exact match tên (normalize)
   * Lớp 2: PHARMA_TERM_DICTIONARY → canonical name → tìm lại trong công thức
   * Lớp 3: isCriteriaMatch() fuzzy semantic — duyệt toàn bộ formulaItemMap
   * Trả về { item, matchedByFormula: true } nếu tìm được, null nếu không
   */
  const lookupFormulaItem = useMemo(() => {
    return (criteriaName: string): FormulaIngredient | null => {
      const rNorm = normalizeName(criteriaName);

      // Lớp 1: Exact match
      const exactMatch = formulaItemMap.get(rNorm);
      if (exactMatch) return exactMatch;

      // Lớp 2: PHARMA_TERM_DICTIONARY — tìm canonical name của chỉ tiêu KN,
      // sau đó duyệt formulaItemMap xem tên nào cùng canonical
      const canonicalOfCriteria = lookupPharmaTerm(criteriaName);
      if (canonicalOfCriteria) {
        for (const [formulaKey, formulaItem] of formulaItemMap.entries()) {
          const canonicalOfFormula = lookupPharmaTerm(formulaItem.name);
          // Cùng nhóm canonical → match (VD: "Kẽm (Zn)" và "Kẽm gluconat" đều → "Kẽm")
          if (canonicalOfFormula && canonicalOfFormula === canonicalOfCriteria) {
            return formulaItem;
          }
          // Canonical của chỉ tiêu KN trùng tên normalize của thành phần công thức
          if (normalizeName(canonicalOfCriteria) === formulaKey) {
            return formulaItem;
          }
        }
      }

      // Lớp 3: Fuzzy semantic — isCriteriaMatch() duyệt toàn bộ map
      for (const [, formulaItem] of formulaItemMap.entries()) {
        if (isCriteriaMatch(criteriaName, formulaItem.name)) {
          return formulaItem;
        }
      }

      // Lớp 4: Dice coefficient — fallback cho các tên gần giống nhau về cơ sở hoạt chất
      // nhưng khác phần muối/dạng (VD: "L-Lysine HCl" vs "L-Lysine hydrochloride")
      // Ngưỡng 0.6 = đủ chặt để tránh false positive nhưng đủ rộng cho biến thể muối
      let bestDiceItem: FormulaIngredient | null = null;
      let bestDiceScore = 0.60; // ngưỡng tối thiểu
      for (const [, formulaItem] of formulaItemMap.entries()) {
        const score = diceScore(criteriaName, formulaItem.name);
        if (score > bestDiceScore) {
          bestDiceScore = score;
          bestDiceItem = formulaItem;
        }
      }
      if (bestDiceItem) return bestDiceItem;

      return null;
    };
  }, [formulaItemMap]);

  // Lọc và loại bỏ các chỉ tiêu trùng lặp (khi gộp từ nhiều phiếu kiểm nghiệm)
  // Ư u tiên giữ lại kết quả ĐẠT nếu có sự sai khác giữa các lần kiểm tra
  // [ALIAS FIX] Dùng resolveKey làm key dedup — "Độ am" và "Độ ẩm" sẽ gộp lại thành 1 entry
  const deduplicatedResults = useMemo(() => {
    if (!res.results) return [];
    const uniqueMap = new Map<string, TestResultEntry>();
    res.results.forEach(r => {
      const rName = (r.criteriaName || '').trim();
      if (!rName) return;
      // Dùng resolveKey để normalize + resolve alias làm key
      const rKey = resolver.resolveKey(rName);
      const existing = uniqueMap.get(rKey);
      if (!existing || (r.isPass === true && existing.isPass !== true)) {
        uniqueMap.set(rKey, r);
      }
    });

    // Tự động nội suy các chỉ tiêu "Miễn kiểm" bị thiếu (Dành cho bản in phiếu cũ chưa có dữ liệu DB)
    if (tccs) {
        const rulesMap = new Map<string, any>();
        (tccs.alternateRules || []).forEach(r => { if (r && r.alt && r.alt.trim() !== '') rulesMap.set(resolver.resolveKey(r.alt), r); });

        const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])].filter(c => c && c.name && c.name.trim() !== '');
        allCriteria.forEach(c => {
            const cKey = normalizeName(c.name);
            const existingEntry = uniqueMap.get(cKey);

            // Nội suy nếu chỉ tiêu bị thiếu, hoặc có tồn tại nhưng rỗng (dữ liệu cũ)
            const isMissingOrEmpty = !existingEntry || (existingEntry.value === null || existingEntry.value === undefined || String(existingEntry.value).trim() === '');

            if (isMissingOrEmpty) {
                const rule = rulesMap.get(cKey);
                if (rule) {
                    const mainKey = resolver.resolveKey(rule.main || '');
                    const mainEntry = uniqueMap.get(mainKey);
                    if (mainEntry && mainEntry.isPass === true && mainEntry.value !== undefined && String(mainEntry.value).trim() !== '') {
                        let ruleSatisfied = false;
                        if (rule.type === 'CONDITIONAL_CHECK') {
                        const extractNum = (val: any) => { 
                            const str = String(val || '').trim().toUpperCase();
                            if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ', 'KHÔNG ĐƯỢC CÓ'].some(kw => str.includes(kw))) return 0;
                            const parsed = parseNumberFromText(str);
                            if (!isNaN(parsed)) return parsed;
                            const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/); 
                            return match ? Number(match[0].replace(',', '.')) : 0; 
                        };
                            if (extractNum(mainEntry.value) <= extractNum(rule.conditionValue)) ruleSatisfied = true;
                        } else {
                            ruleSatisfied = true;
                        }
                        if (ruleSatisfied) {
                            uniqueMap.set(cKey, { criteriaName: c.name, value: 'Miễn kiểm', isPass: true, isExtra: false, unit: c.unit });
                        }
                    }
                }
            }
        });
    }

    return Array.from(uniqueMap.values());
  }, [res.results, tccs, resolver]);

  const groupedResults = useMemo(() => {
    if (!deduplicatedResults.length) return [];
    
    const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
    const mainCriteria = tccs?.mainQualityCriteria || [];
    const safetyCriteria = tccs?.safetyCriteria || [];

    const groups = {
      physical: [] as TestResultEntry[],
      micro: [] as TestResultEntry[],
      metal: [] as TestResultEntry[]
    };

    const safetyCriteriaMap = new Map(safetyCriteria.map(c => [c.name, c]));

    deduplicatedResults.forEach(r => {
        const safetyItem = safetyCriteriaMap.get(r.criteriaName);
        const nameLower = r.criteriaName.toLowerCase();
        
        if (safetyItem) {
           const cat = safetyItem.category;
           if (cat === 'metal' || (!cat && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw)))) {
             groups.metal.push(r);
           } else {
             groups.micro.push(r);
           }
        } else {
           // Phân loại thông minh cho Extra Criteria dựa trên từ khóa
           const MICRO_KEYWORDS = ['vi sinh', 'e. coli', 'e.coli', 'salmonella', 'staphylococcus', 'pseudomonas', 'tổng số', 'nấm', 'men', 'mốc', 'vsv', 'aeruginosa', 'aureus'];
           if (HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) {
             groups.metal.push(r);
           } else if (MICRO_KEYWORDS.some(kw => nameLower.includes(kw))) {
             groups.micro.push(r);
           } else {
             groups.physical.push(r);
           }
        }
    });

    // Sort physical: Main criteria first (in order), then Extra
    const mainCriteriaIndexMap = new Map(mainCriteria.map((c, idx) => [c.name, idx]));
    groups.physical.sort((a, b) => {
        const idxA = mainCriteriaIndexMap.has(a.criteriaName) ? mainCriteriaIndexMap.get(a.criteriaName)! : -1;
        const idxB = mainCriteriaIndexMap.has(b.criteriaName) ? mainCriteriaIndexMap.get(b.criteriaName)! : -1;
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    const validGroups = [
        { title: 'Chỉ tiêu Lý hóa & Cảm quan', items: groups.physical },
        { title: 'Giới hạn Vi sinh vật', items: groups.micro },
        { title: 'Giới hạn Kim loại nặng', items: groups.metal }
    ].filter(g => g.items.length > 0);

    const romanNumerals = ['I', 'II', 'III'];
    return validGroups.map((g, index) => ({
        title: `${romanNumerals[index]}. ${g.title}`,
        items: g.items
    }));
  }, [deduplicatedResults, tccs]);

  const getLimitText = (r: TestResultEntry) => {
    if (r.isExtra) return (r as ExtraTestResultEntry).limit || '';
    
    if (!tccs) {
      // Không có TCCS: kiểm tra xem có trong công thức không
      const fi = lookupFormulaItem(r.criteriaName);
      if (fi) return '__FORMULA__'; // Sentinel — được render thành JSX bên dưới
      return '';
    }
    
    // [ALIAS FIX] Dùng resolver.lookupCriterion để tra cứu qua alias
    const c = resolver.lookupCriterion(r.criteriaName, allCriteriaMap);
    
    if (!c) {
      // Không có trong TCCS: thử tra cứu công thức 3 lớp
      const fi = lookupFormulaItem(r.criteriaName);
      if (fi) return '__FORMULA__'; // Sentinel — được render thành JSX bên dưới
      return '';
    }
    
    // LUÔN ƯU TIÊN EXPECTED TEXT: Giúp giữ nguyên định dạng số chữ số thập phân 
    // (VD: "≤ 0.50" thay vì "≤ 0.5") hoặc các text mô tả đi kèm giới hạn số.
    if (c.expectedText) return c.expectedText;

    if (c.type === 'NUMBER') {
      if (c.min != null && c.max != null) return `${c.min} ~ ${c.max}`;
      if (c.min != null) return `≥ ${c.min}`;
      if (c.max != null) return `≤ ${c.max}`;
    }
    return c.expectedText || '';
  };

  /** Render cột "Yêu cầu" với hỗ trợ Sentinel '__FORMULA__' */
  const renderLimitCell = (r: TestResultEntry) => {
    const text = getLimitText(r);
    if (text === '__FORMULA__') {
      return (
        <span className="italic text-slate-500 font-normal text-[11px]">
          Theo công thức
        </span>
      );
    }
    return text;
  };

  const getUnitText = (r: TestResultEntry) => {
    // Ưu tiên đơn vị từ TCCS gốc của phiếu kết quả
    if (tccs) {
      // [ALIAS FIX] Dùng resolver.lookupCriterion để tra cứu qua alias
      const c = resolver.lookupCriterion(r.criteriaName, allCriteriaMap);
      if (c && c.unit) return c.unit;
    }
    
    // Nếu không tìm thấy, dùng đơn vị đã lưu trong kết quả (fallback)
    return r.unit || '';
  };

  // Đánh giá lại kết luận chung: Phân biệt ĐẠT, KHÔNG ĐẠT và CHƯA HOÀN THIỆN
  // FIX: Dùng calculateOverallStatus() để xét đúng Alternate Rules (Miễn kiểm)
  // Tránh lỗi kết luận KHÔNG ĐẠT sai khi TC chính fail nhưng TC phụ đã đạt theo quy tắc thay thế
  const conclusion = useMemo(() => {
    if (deduplicatedResults.length === 0) return { label: 'CHƯA HOÀN THIỆN', color: 'bg-amber-500' };

    // Tạo mảng kết quả có đánh giá effectiveIsPass cho từng chỉ tiêu (kể cả ngoài TCCS nhưng có trong công thức)
    const effectiveResults = deduplicatedResults.map(r => {
      let isPass = r.isPass;
      const rName = r.criteriaName.trim().toLowerCase();
      const isMainCriteria = tccs?.mainQualityCriteria?.some(c => c && c.name && c.name.trim().toLowerCase() === rName);
      
      if (!isMainCriteria) {
        const extraFormulaItem = lookupFormulaItem(r.criteriaName);
        if (extraFormulaItem) {
          let dc = extraFormulaItem.declaredContent;
          if (typeof dc === 'string') dc = parseNumberFromText(dc) as any;
          let ec = extraFormulaItem.elementalContent;
          if (typeof ec === 'string') ec = parseNumberFromText(ec as any) as any;
          const basis = (ec != null && (ec as number) > 0) ? (ec as number) : (dc as number);
          if (basis != null && basis > 0) {
            const actualVal = parseNumberFromText(String(r.value));
            if (!isNaN(actualVal) && actualVal > 0) {
              const min = basis * 0.8;
              const max = basis * 1.2;
              isPass = actualVal >= min && actualVal <= max;
            }
          }
        }
      }
      return { ...r, isPass };
    });

    const overallStatus = calculateOverallStatus(effectiveResults, tccs ?? null);
    if (overallStatus === TEST_RESULT_STATUS.FAIL) return { label: 'KHÔNG ĐẠT', color: 'bg-red-600' };

    if (tccs) {
      const mandatoryCriteria = [
        ...(tccs.mainQualityCriteria || []),
        ...(tccs.safetyCriteria || [])
      ].filter(c => c && c.name);

      // [ALIAS FIX] buildResolvedTestedSet chuẩn hóa tên qua alias trước khi so sánh
      const resolvedTestedSet = resolver.buildResolvedTestedSet(
        deduplicatedResults.map(r => r.criteriaName)
      );

      const isComplete = mandatoryCriteria.every(c =>
        resolvedTestedSet.has(normalizeName(c.name))
      );

      if (!isComplete) return { label: 'CHƯA HOÀN THIỆN', color: 'bg-amber-500' };
    }

    return { label: 'ĐẠT', color: 'bg-emerald-600' };
  }, [deduplicatedResults, tccs, resolver]);

  return (
    <div id="coa-report-container" className="bg-white p-10 text-slate-900 max-w-[21cm] mx-auto print:shadow-none print:border-0 print:p-0 print:max-w-none print:mx-0" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* CSS đặc biệt để máy in tự động căn chỉnh khổ giấy A4 và đổ màu nền (Background graphics) */}
      <style>{`
        @media print {
          /* Thiết lập khổ giấy A4 với lề chuẩn */
          @page { 
            size: A4 portrait; 
            margin: 15mm 15mm 20mm 15mm; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          
          /* Container in: KHÔNG dùng position relative/absolute — để trang tự chảy */
          #coa-report-container { 
            position: static !important;
            width: 100% !important; 
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Khống chế ngắt trang tốt hơn */
          table { 
            page-break-inside: auto; 
            width: 100% !important;
          }
          tr { 
            page-break-inside: avoid; 
            break-inside: avoid; 
            page-break-after: auto; 
          }
          thead { 
            display: table-header-group; 
          }
          tfoot {
            display: table-footer-group;
          }
          
          .break-inside-avoid { 
            page-break-inside: avoid; 
            break-inside: avoid; 
          }

          /* Ẩn các outer wrappers của CoAReportPage khi in */
          .coa-page-toolbar {
            display: none !important;
          }
        }
      `}</style>
      


      {/* Tiêu đề chính */}
      <div className="flex items-center justify-between mb-8 print:mb-4 border-b-2 border-slate-800 pb-6 print:pb-4">
        {/* Lớp căn lề trái giả lập để giữ tiêu đề chính giữa tuyệt đối */}
        <div className="w-[62px] shrink-0" />

        <div className="text-center space-y-1 flex-grow">
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Phiếu Kiểm Nghiệm</h1>
          <p className="text-sm font-bold text-slate-600 uppercase">Certificate of Analysis (CoA)</p>
        </div>

        {/* QR Code liên kết đến COA ở góc trên bên phải */}
        <div className="shrink-0 flex flex-col items-center justify-center p-1 bg-white border border-slate-200 rounded shadow-sm">
          {coaUrl ? (
            <QRCodeSVG value={coaUrl} size={52} level="M" />
          ) : (
            <div className="w-[52px] h-[52px] bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">QR</div>
          )}
        </div>

      </div>

      {/* Thông tin mẫu thử */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-3 print:gap-y-1.5 mb-8 print:mb-4 text-[13px] text-slate-800">
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Sản phẩm / <span className="italic">Product</span>:</span> <span className="font-bold text-right ml-2">{product?.name}</span></div>
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Ngày SX / <span className="italic">MFG Date</span>:</span> <span className="font-bold text-right ml-2">{batch && batch.mfgDate ? formatDateStandard(batch.mfgDate) : '---'}</span></div>
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Số lô / <span className="italic">Batch No</span>:</span> <span className="font-bold text-right ml-2">{batch?.batchNo}</span></div>
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Hạn dùng / <span className="italic">EXP Date</span>:</span> <span className="font-bold text-right ml-2">{batch && batch.expDate ? formatDateStandard(batch.expDate) : '---'}</span></div>
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Tiêu chuẩn / <span className="italic">Specification</span>:</span> <span className="font-bold text-right ml-2">{tccs?.code || '---'}</span></div>
        <div className="flex justify-between border-b border-slate-300 border-dashed pb-1"><span className="text-slate-600">Ngày in / <span className="italic">Print Date</span>:</span> <span className="font-bold text-right ml-2">{formatDateStandard(res.testDate)}</span></div>
      </div>

      {/* Bảng kết quả */}
      <div className="mb-10 print:mb-6">
        <h4 className="text-sm font-black uppercase tracking-widest bg-slate-100 border border-slate-800 text-slate-800 px-4 py-2 border-b-0">
          Kết quả Phân tích / <span className="italic font-bold normal-case">Analytical Results</span>
        </h4>
        <table className="w-full text-[13px] border-collapse border border-slate-800">
          <thead className="bg-slate-50 text-center table-header-group">
            <tr>
              <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[35%]">Chỉ tiêu<br/><span className="text-[10px] font-normal italic">Test Parameter</span></th>
              <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[30%]">Yêu cầu<br/><span className="text-[10px] font-normal italic">Specification</span></th>
              <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[15%]">Đơn vị<br/><span className="text-[10px] font-normal italic">Unit</span></th>
              <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[20%]">Kết quả<br/><span className="text-[10px] font-normal italic">Result</span></th>
            </tr>
          </thead>
          <tbody>
            {groupedResults.map((group) => (
              <React.Fragment key={group.title}>
                <tr className="bg-slate-100 break-inside-avoid">
                  <td colSpan={4} className="py-2 print:py-1 px-3 print:px-2 font-bold text-slate-800 border border-slate-800">{group.title}</td>
                </tr>
                {group.items.map((r, i) => (
              (() => {
                // Lấy thông tin chỉ tiêu TCCS tương ứng
                const rName = r.criteriaName.trim().toLowerCase();
                const criterion = allCriteriaMap.get(rName);

                // Tìm thành phần tương ứng trong công thức đã công bố
                // Fallback: Tìm theo tên chính xác nếu không có liên kết
                let formulaItem = formulaItemMap.get(rName);
                
                // Nếu TCCS có khai báo liên kết rõ ràng với thành phần nào, sử dụng liên kết đó
                if (criterion && criterion.formulaIngredientId) {
                  const linkedName = criterion.formulaIngredientId.trim().toLowerCase();
                  const linkedItem = formulaItemMap.get(linkedName);
                  if (linkedItem) formulaItem = linkedItem;
                }
                
                // Xử lý hàm lượng công bố (hợp chất / muối)
                let declaredContent = formulaItem?.declaredContent;
                if (typeof declaredContent === 'string') declaredContent = parseNumberFromText(declaredContent);

                // Xử lý hàm lượng nguyên tố (ion / base)
                let elementalContent = formulaItem?.elementalContent;
                if (typeof elementalContent === 'string') elementalContent = parseNumberFromText(elementalContent);

                // Xác định có phải là Chỉ tiêu Chất lượng chính không
                const isMainCriteria = tccs?.mainQualityCriteria?.some(c => c && c.name && c.name.trim().toLowerCase() === rName);

                // Xác định giá trị chuẩn 100% để chia %
                let basisForCalculation: number | undefined = undefined;
                
                if (isMainCriteria) {
                  // Chỉ tiêu trong TCCS: ưu tiên declaredContent khai báo trực tiếp trong TCCS
                  if (criterion?.declaredContent != null) {
                    basisForCalculation = typeof criterion.declaredContent === 'string' ? parseNumberFromText(criterion.declaredContent as any) : criterion.declaredContent;
                  } 
                  // Ưu tiên 2: Fallback lại logic cũ tìm trong công thức
                  else if (criterion && criterion.formulaIngredientId) {
                    // Nếu người dùng chọn rõ cơ sở tính toán
                    if (criterion.calculationBasis === 'ELEMENTAL' && elementalContent != null && elementalContent > 0) {
                      basisForCalculation = elementalContent;
                    } else {
                      basisForCalculation = declaredContent as number;
                    }
                  } else {
                    // Nếu không có liên kết, sử dụng logic cũ: Ưu tiên dùng hàm lượng nguyên tố để tính %, nếu không có thì dùng hàm lượng hợp chất
                    basisForCalculation = (elementalContent != null && elementalContent > 0) ? elementalContent : declaredContent as number;
                  }
                } else {
                  // Chỉ tiêu ngoài TCCS: tra cứu công thức 3 lớp (exact → pharma dict → fuzzy)
                  const extraFormulaItem = lookupFormulaItem(r.criteriaName);
                  if (extraFormulaItem) {
                    let dc = extraFormulaItem.declaredContent;
                    if (typeof dc === 'string') dc = parseNumberFromText(dc) as any;
                    let ec = extraFormulaItem.elementalContent;
                    if (typeof ec === 'string') ec = parseNumberFromText(ec as any) as any;
                    basisForCalculation = (ec != null && (ec as number) > 0) ? ec as number : dc as number;
                  }
                }

                // Giới hạn mặc định ±20% áp dụng khi chỉ tiêu KHÔNG có trong TCCS nhưng có trong Công thức
                // Đây là dải chấp nhận theo thực hành GMP: 80% ~ 120% hàm lượng công bố
                let formulaDefaultMin: number | undefined;
                let formulaDefaultMax: number | undefined;
                if (!isMainCriteria && basisForCalculation != null && basisForCalculation > 0) {
                  formulaDefaultMin = basisForCalculation * 0.80;
                  formulaDefaultMax = basisForCalculation * 1.20;
                }

                // Sử dụng parseNumberFromText để xử lý kết quả kiểm nghiệm (hỗ trợ số mũ 10^3, 1.5x10^5...)
                const actualValue = parseNumberFromText(String(r.value));
                let percentageView = null;

                // Đánh giá lại isPass theo ±20% nếu chỉ tiêu không có TCCS nhưng có trong Công thức
                let effectiveIsPass = r.isPass;
                if (formulaDefaultMin !== undefined && formulaDefaultMax !== undefined && !isNaN(actualValue) && actualValue > 0) {
                  effectiveIsPass = actualValue >= formulaDefaultMin && actualValue <= formulaDefaultMax;
                }

                // Đồng bộ hiển thị "Không phát hiện" nếu Yêu cầu là nhóm ND và người dùng nhập 0
                const limitText = getLimitText(r);
                // Lọc sentinel '__FORMULA__' trước khi dùng vào các hàm xử lý chuỗi
                const limitTextDisplay = limitText === '__FORMULA__' ? '' : limitText;
                const limitUpper = String(limitTextDisplay).toUpperCase();
                
                let displayValue: React.ReactNode = formatScientific(r.value, String(limitTextDisplay));
                
                // Định dạng hiển thị riêng cho trạng thái miễn kiểm, quy đổi các chuỗi cũ về chung 1 format
                if (r.value === 'Miễn kiểm' || r.value === 'Đạt (theo quy tắc thay thế)' || r.value === 'Đạt (miễn kiểm theo điều kiện)') {
                  displayValue = <span className="italic font-semibold text-slate-600">Miễn kiểm</span>;
                } else {
                  // Ngăn chặn lỗi hiển thị "Không phát hiện" khi người dùng nhập "Dương tính" hoặc chuỗi chữ
                  const isNumericZero = actualValue === 0 && /^0(\.0+)?$/.test(String(r.value).trim());
                  if (isNumericZero && ND_KEYWORDS.some(kw => limitUpper.includes(kw))) {
                    displayValue = 'Không phát hiện';
                  }
                }

                // Nếu có hàm lượng công bố và kết quả là số, tính toán và hiển thị %
                if (basisForCalculation && basisForCalculation > 0 && actualValue > 0) {
                  const percentage = (actualValue / (basisForCalculation as number)) * 100;
                  const percentageFormatted = percentage.toLocaleString('en-US', { maximumFractionDigits: 2 });
                  percentageView = (
                    <span className="text-[10px] text-slate-600 font-mono font-normal mt-0.5 block">
                      ({percentageFormatted}%)
                    </span>
                  );
                }

                // Nội dung cột "Yêu cầu": ưu tiên giới hạn ±20% từ Công thức nếu không có TCCS
                let limitCellContent: React.ReactNode;
                if (formulaDefaultMin !== undefined && formulaDefaultMax !== undefined) {
                  const locale = getActiveLocale();
                  const minStr = formulaDefaultMin.toLocaleString(locale, { maximumFractionDigits: 2 });
                  const maxStr = formulaDefaultMax.toLocaleString(locale, { maximumFractionDigits: 2 });
                  limitCellContent = (
                    <span>
                      {minStr} ~ {maxStr}
                      <span className="block italic font-normal text-[10px] text-slate-400">(±20% hàm lượng)</span>
                    </span>
                  );
                } else {
                  limitCellContent = renderLimitCell(r);
                }

                return (
                  <tr key={r.criteriaName} className="border-b border-slate-800 break-inside-avoid">
                    <td className="py-2 print:py-1.5 px-3 print:px-2 border-r border-slate-800 font-medium">{r.criteriaName}</td>
                    <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-800 font-bold">{limitCellContent}</td>
                    <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-800">{getUnitText(r)}</td>
                    <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-slate-800">
                      <div className={`font-bold ${effectiveIsPass ? 'text-slate-900' : 'text-red-600'}`}>{displayValue}</div>
                      {percentageView}
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

      {/* Tài liệu đính kèm (Attachments) */}
      {res.attachments && res.attachments.length > 0 && (
        <div className="mt-8 border-t-2 border-slate-800 pt-4 break-inside-avoid print:mt-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3">
            Tài liệu đính kèm / <span className="italic font-bold normal-case">Attachments</span>
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {res.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-slate-50 border border-slate-250 p-3 rounded-xl print:bg-white print:p-2 print:border-slate-300">
                <div className="shrink-0 p-1 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={att.url} size={44} level="M" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-800 truncate" title={att.name}>{att.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Nguồn: {att.source === 'google_drive' ? 'Google Drive' : 'Hệ thống'}
                  </p>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-650 hover:underline truncate block font-bold mt-0.5 print:hidden"
                  >
                    Xem tài liệu gốc →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});


export default CoAReport;