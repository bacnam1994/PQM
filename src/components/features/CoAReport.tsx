import React, { memo, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  TestResult,
  Batch,
  Product,
  TCCS,
  TestResultEntry,
  ProductFormula,
  FormulaIngredient,
  Criterion,
} from '../../types';
import {
  TEST_RESULT_STATUS,
  parseNumberFromText,
  formatDateStandard,
  calculateOverallStatus,
  getActiveLocale,
  calculateRelativePercentage,
  generateDefaultReportNo,
} from '../../utils';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName, diceScore } from '../../services/criteriaAliasService';
import { lookupPharmaTerm, isCriteriaMatch } from '../../utils/aiMapping';
import { AlternateRuleResolver, isEvaluationSnapshotStale } from '../../domain/evaluation';
import { detectLabOrganization } from '../../services/ai/externalLabTemplates';
import { matchLaboratory } from '../../services/laboratoryService';

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
const ND_KEYWORDS = [
  'ND',
  'NOT DETECTED',
  'KHÔNG PHÁT HIỆN',
  'K.P.H',
  'KPH',
  'ÂM TÍNH',
  'NEGATIVE',
  'KHÔNG CÓ',
  'KHÔNG ĐƯỢC CÓ',
];

// Helper: Format số sang dạng mũ (VD: 1000 -> 10³)
const formatScientific = (value: string | number, limitText?: string) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value).trim();

  // Tách các toán tử (<, >, ≤, ≥, ~) ra khỏi giá trị số để bảo toàn khi hiển thị
  const match = stringValue.match(/^([<≤>≥~=]+)?\s*(.+)$/);
  const prefix = match && match[1] ? match[1] + ' ' : '';
  const coreValue = match ? match[2] : stringValue;

  let num = Number(coreValue);
  const isSciFormat =
    /[eE][+-]?\d+/.test(coreValue) ||
    coreValue.includes('^') ||
    /\d+\s*[xX]\s*10/i.test(coreValue) ||
    /10\s+\d+/.test(coreValue);

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
        {prefix.trim()}
        {prefix ? ' ' : ''}
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
      decimalMatches.forEach((m) => {
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
  const coaUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${res.id || (batch ? batch.id : '')}`
      : '';

  // Hook giải mã tên chỉ tiêu qua bảng alias — hỗ trợ cả tên cũ lẫn tên mới
  const resolver = useCriteriaResolver(tccs);

  // Map tên chuẩn (normalize) → Criterion — duyën mới chỉ dùng tên chuẩn hiện tại làm key
  const allCriteriaMap = useMemo(() => {
    const map = new Map<string, Criterion>();
    if (tccs) {
      (tccs.mainQualityCriteria || []).forEach(
        (c) => c && c.name && c.name.trim() !== '' && map.set(normalizeName(c.name), c)
      );
      (tccs.safetyCriteria || []).forEach(
        (c) => c && c.name && c.name.trim() !== '' && map.set(normalizeName(c.name), c)
      );
    }
    return map;
  }, [tccs]);

  const formulaItemMap = useMemo(() => {
    const map = new Map<string, FormulaIngredient>();
    if (formula) {
      (formula.ingredients || []).forEach(
        (ing) => ing && ing.name && map.set(normalizeName(ing.name), ing)
      );
      (formula.excipients || []).forEach(
        (exc) => exc && exc.name && map.set(normalizeName(exc.name), exc)
      );
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
      let bestDiceScore = 0.6; // ngưỡng tối thiểu
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

  // Kiểm tra xem Lô / Phiếu kiểm nghiệm đã có EvaluationSnapshot niêm phong chính thức chưa (SC-14 & BR-COA-001)
  const snapshot = res.evaluationSnapshot || (batch as any)?.evaluationSnapshot;
  const isApprovedDocument =
    res.workflowStatus === 'APPROVED' ||
    res.workflowStatus === 'RELEASED' ||
    (batch as any)?.status === 'RELEASED' ||
    (res as any)?.status === 'APPROVED';

  const snapshotStaleCheck = useMemo(() => {
    if (!snapshot) return { stale: true, reason: 'Chưa có bản chụp thẩm định' };
    return isEvaluationSnapshotStale(snapshot, res, tccs);
  }, [snapshot, res, tccs]);

  const isOfficialSnapshot = Boolean(
    isApprovedDocument &&
    snapshot &&
    Array.isArray(snapshot.criterionResults) &&
    snapshot.criterionResults.length > 0 &&
    !snapshotStaleCheck.stale
  );

  // Ngày ký phiếu theo chuẩn văn bản hành chính Việt Nam (Khánh Hòa, ngày ... tháng ... năm ...)
  const signDate = useMemo(() => {
    const rawDate =
      snapshot?.timestamp || res.testDate || (res as any).createdAt || new Date().toISOString();
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      return { day: '...', month: '...', year: '....' };
    }
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: String(d.getFullYear()),
    };
  }, [snapshot?.timestamp, res.testDate, (res as any).createdAt]);

  // Xác định phiếu kiểm nghiệm là Nội bộ (V-Biotech) hay Ngoại kiểm (Đơn vị bên ngoài)
  const isInternalLab = useMemo(() => {
    if (res.labId === 'lab_internal') return true;
    const lab = (res.labName || '').trim().toLowerCase();
    if (!lab) return true; // Mặc định là nội bộ nếu không nhập lab
    if (
      lab.includes('nội bộ') ||
      lab.includes('v-biotech') ||
      lab.includes('nam việt') ||
      lab.includes('phòng qc') ||
      lab.includes('phòng qa') ||
      lab === 'qc' ||
      lab === 'qa/qc' ||
      lab === 'pqm'
    ) {
      return true;
    }
    const matched = matchLaboratory(res.labName);
    if (matched && matched.lab.type === 'INTERNAL') return true;
    if (matched && matched.lab.type === 'EXTERNAL') return false;
    return false;
  }, [res.labId, res.labName]);

  // Cấu hình mẫu form phiếu kiểm nghiệm ngoại kiểm tương ứng theo đơn vị bên ngoài
  const externalLabInfo = useMemo(() => {
    const labKey = detectLabOrganization(res.labName || '');
    const rawName = (res.labName || '').trim();

    switch (labKey) {
      case 'QUATEST3':
        return {
          parentOrg: 'BỘ KHOA HỌC VÀ CÔNG NGHỆ - TỔNG CỤC TIÊU CHUẨN ĐO LƯỜNG CHẤT LƯỢNG',
          name: 'TRUNG TÂM KỸ THUẬT TIÊU CHUẨN ĐO LƯỜNG CHẤT LƯỢNG 3',
          subName: 'QUALITY ASSURANCE AND TESTING CENTER 3 (QUATEST 3)',
          address: '49 Pasteur, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh | ĐT: (028) 3829 4274',
          reportTitle: 'PHIẾU KẾT QUẢ THỬ NGHIỆM',
          reportSubTitle: 'TEST REPORT',
          location: 'TP. Hồ Chí Minh',
          signerTitle: 'TRƯỞNG PHÒNG THỬ NGHIỆM',
          signerSubTitle: 'HEAD OF TESTING LABORATORY',
          defaultMethod: 'TCVN / AOAC / SMEWW',
        };
      case 'CASE':
        return {
          parentOrg: 'SỞ KHOA HỌC VÀ CÔNG NGHỆ THÀNH PHỐ HỒ CHÍ MINH',
          name: 'TRUNG TÂM DỊCH VỤ PHÂN TÍCH THÍ NGHIỆM TP.HCM',
          subName: 'CENTER OF ANALYTICAL SERVICES AND EXPERIMENTATION (CASE)',
          address:
            '02 Nguyễn Văn Thủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh | ĐT: (028) 3911 7211',
          reportTitle: 'PHIẾU KẾT QUẢ PHÂN TÍCH',
          reportSubTitle: 'TEST REPORT',
          location: 'TP. Hồ Chí Minh',
          signerTitle: 'GIÁM ĐỐC / TRƯỞNG PHÒNG PHÂN TÍCH',
          signerSubTitle: 'DIRECTOR / HEAD OF LABORATORY',
          defaultMethod: 'CASE-SOP / AOAC / TCVN',
        };
      case 'PASTEUR':
        return {
          parentOrg: 'BỘ Y TẾ',
          name: 'VIỆN PASTEUR THÀNH PHỐ HỒ CHÍ MINH',
          subName: 'PASTEUR INSTITUTE IN HO CHI MINH CITY',
          address: '167 Pasteur, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh | ĐT: (028) 3823 0352',
          reportTitle: 'PHIẾU KẾT QUẢ XÉT NGHIỆM',
          reportSubTitle: 'TEST REPORT',
          location: 'TP. Hồ Chí Minh',
          signerTitle: 'TRƯỞNG KHOA XÉT NGHIỆM',
          signerSubTitle: 'HEAD OF LABORATORY',
          defaultMethod: 'ISO / DĐVN / TCVN',
        };
      case 'NIFC':
        return {
          parentOrg: 'BỘ Y TẾ',
          name: 'VIỆN KIỂM NGHIỆM AN TOÀN VỆ SINH THỰC PHẨM QUỐC GIA',
          subName: 'NATIONAL INSTITUTE FOR FOOD CONTROL (NIFC)',
          address:
            '65 Phạm Thận Duật, Phường Mai Dịch, Quận Cầu Giấy, Hà Nội | ĐT: (024) 3933 5735',
          reportTitle: 'PHIẾU KẾT QUẢ KIỂM NGHIỆM',
          reportSubTitle: 'TEST REPORT',
          location: 'Hà Nội',
          signerTitle: 'VIỆN TRƯỞNG / TRƯỞNG PHÒNG THỬ NGHIỆM',
          signerSubTitle: 'DIRECTOR / HEAD OF TESTING LAB',
          defaultMethod: 'ISO / TCVN / AOAC',
        };
      case 'EUROFINS':
        return {
          parentOrg: 'EUROFINS SCIENTIFIC',
          name: 'CÔNG TY TNHH EUROFINS SẮC KÝ HẢI ĐĂNG',
          subName: 'EUROFINS SAC KY HAI DANG CO., LTD',
          address: 'Lô E2b-3, Đường D6, Khu Công nghệ cao, TP. Thủ Đức, TP. Hồ Chí Minh',
          reportTitle: 'PHIẾU KẾT QUẢ THỬ NGHIỆM',
          reportSubTitle: 'CERTIFICATE OF ANALYSIS',
          location: 'TP. Hồ Chí Minh',
          signerTitle: 'TRƯỞNG PHÒNG THÍ NGHIỆM',
          signerSubTitle: 'LABORATORY MANAGER',
          defaultMethod: 'AOAC / ISO / CEN',
        };
      default:
        return {
          parentOrg: 'ĐƠN VỊ THỬ NGHIỆM NGOẠI KIỂM',
          name: rawName || 'TRUNG TÂM KIỂM NGHIỆM ĐỘC LẬP',
          subName: 'ACCREDITED TESTING LABORATORY',
          address: 'Phòng thử nghiệm được công nhận / Hợp đồng dịch vụ phân tích',
          reportTitle: 'PHIẾU KẾT QUẢ THỬ NGHIỆM',
          reportSubTitle: 'TEST REPORT',
          location: 'Việt Nam',
          signerTitle: 'TRƯỞNG PHÒNG THÍ NGHIỆM',
          signerSubTitle: 'HEAD OF LABORATORY',
          defaultMethod: 'TCVN / AOAC / DĐVN',
        };
    }
  }, [res.labName]);

  // Lọc và trích xuất danh sách chỉ tiêu
  // Ưu tiên số 1: Nếu TestResult hoặc Batch đã có Frozen EvaluationSnapshot -> Đọc 100% trực tiếp từ snapshot!
  const deduplicatedResults = useMemo(() => {
    if (
      snapshot &&
      Array.isArray(snapshot.criterionResults) &&
      snapshot.criterionResults.length > 0 &&
      !snapshotStaleCheck.stale
    ) {
      return snapshot.criterionResults.map((snapCrit: any) => {
        const c = allCriteriaMap.get(normalizeName(snapCrit.criteriaName));
        return {
          criteriaName: snapCrit.criteriaName,
          criterionId: snapCrit.criterionId,
          value: snapCrit.alternateState === 'EXEMPTED' ? 'Miễn kiểm (*)' : snapCrit.value,
          isPass: snapCrit.isPass ?? true,
          isExempted: snapCrit.alternateState === 'EXEMPTED' || Boolean(snapCrit.isExempted),
          alternateState: snapCrit.alternateState,
          alternateNote: snapCrit.alternateNote,
          unit: snapCrit.unit || c?.unit,
          limit: snapCrit.note || snapCrit.limit || c?.expectedText,
          analysisMethod: snapCrit.analysisMethod || c?.analysisMethod,
        };
      });
    }

    if (!res.results) return [];
    const uniqueMap = new Map<string, TestResultEntry>();
    res.results.forEach((r) => {
      const rName = (r.criteriaName || '').trim();
      if (!rName) return;
      // Dùng resolveKey để normalize + resolve alias làm key
      const rKey = resolver.resolveKey(rName);
      const existing = uniqueMap.get(rKey);
      if (!existing || (r.isPass === true && existing.isPass !== true)) {
        uniqueMap.set(rKey, r);
      }
    });

    // Tự động phân giải các chỉ tiêu "Miễn kiểm" bị thiếu hoặc rỗng qua AlternateRuleResolver (Single Source of Truth)
    if (tccs) {
      const allCriteria = [
        ...(tccs.mainQualityCriteria || []),
        ...(tccs.safetyCriteria || []),
      ].filter((c) => c && c.name && c.name.trim() !== '');

      const currentEntries = Array.from(uniqueMap.values());

      allCriteria.forEach((c) => {
        const cKey = normalizeName(c.name);
        const existingEntry = uniqueMap.get(cKey);

        // Nội suy nếu chỉ tiêu bị thiếu, hoặc có tồn tại nhưng rỗng (dữ liệu cũ)
        const isMissingOrEmpty =
          !existingEntry ||
          existingEntry.value === null ||
          existingEntry.value === undefined ||
          String(existingEntry.value).trim() === '';

        if (isMissingOrEmpty) {
          const altStatus = AlternateRuleResolver.resolveCriterionState(
            c.name,
            undefined,
            currentEntries,
            tccs,
            c
          );

          if (altStatus.isExempted) {
            uniqueMap.set(cKey, {
              criteriaName: c.name,
              value: 'Miễn kiểm',
              isPass: true,
              isExtra: false,
              unit: c.unit,
              alternateState: 'EXEMPTED',
              alternateNote: altStatus.displayNote,
            });
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
      metal: [] as TestResultEntry[],
    };

    const safetyCriteriaMap = new Map(safetyCriteria.map((c) => [c.name, c]));

    deduplicatedResults.forEach((r) => {
      const safetyItem = safetyCriteriaMap.get(r.criteriaName);
      const nameLower = r.criteriaName.toLowerCase();

      if (safetyItem) {
        const cat = safetyItem.category;
        if (
          cat === 'metal' ||
          (!cat && HEAVY_METAL_KEYWORDS.some((kw) => nameLower.includes(kw)))
        ) {
          groups.metal.push(r);
        } else {
          groups.micro.push(r);
        }
      } else {
        // Phân loại thông minh cho Extra Criteria dựa trên từ khóa
        const MICRO_KEYWORDS = [
          'vi sinh',
          'e. coli',
          'e.coli',
          'salmonella',
          'staphylococcus',
          'pseudomonas',
          'tổng số',
          'nấm',
          'men',
          'mốc',
          'vsv',
          'aeruginosa',
          'aureus',
        ];
        if (HEAVY_METAL_KEYWORDS.some((kw) => nameLower.includes(kw))) {
          groups.metal.push(r);
        } else if (MICRO_KEYWORDS.some((kw) => nameLower.includes(kw))) {
          groups.micro.push(r);
        } else {
          groups.physical.push(r);
        }
      }
    });

    // Sort physical: Main criteria first (in order), then Extra
    const mainCriteriaIndexMap = new Map(mainCriteria.map((c, idx) => [c.name, idx]));
    groups.physical.sort((a, b) => {
      const idxA = mainCriteriaIndexMap.has(a.criteriaName)
        ? mainCriteriaIndexMap.get(a.criteriaName)!
        : -1;
      const idxB = mainCriteriaIndexMap.has(b.criteriaName)
        ? mainCriteriaIndexMap.get(b.criteriaName)!
        : -1;
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    const validGroups = [
      { title: 'Chỉ tiêu Lý hóa & Cảm quan', items: groups.physical },
      { title: 'Giới hạn Vi sinh vật', items: groups.micro },
      { title: 'Giới hạn Kim loại nặng', items: groups.metal },
    ].filter((g) => g.items.length > 0);

    const romanNumerals = ['I', 'II', 'III'];
    return validGroups.map((g, index) => ({
      title: `${romanNumerals[index]}. ${g.title}`,
      items: g.items,
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
      return <span className="italic text-slate-500 font-normal text-[11px]">Theo công thức</span>;
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

  const getAnalysisMethod = (r: TestResultEntry) => {
    if (r.analysisMethod && r.analysisMethod.trim() !== '') return r.analysisMethod;
    if (tccs) {
      const c = resolver.lookupCriterion(r.criteriaName, allCriteriaMap);
      if (c && c.analysisMethod && c.analysisMethod.trim() !== '') return c.analysisMethod;
    }
    return externalLabInfo.defaultMethod || 'TCVN / AOAC / DĐVN';
  };

  // Đánh giá lại kết luận chung: Phân biệt ĐẠT, KHÔNG ĐẠT và CHƯA HOÀN THIỆN
  // FIX: Dùng calculateOverallStatus() để xét đúng Alternate Rules (Miễn kiểm)
  // Tránh lỗi kết luận KHÔNG ĐẠT sai khi TC chính fail nhưng TC phụ đã đạt theo quy tắc thay thế
  const conclusion = useMemo(() => {
    if (deduplicatedResults.length === 0)
      return { label: 'CHƯA HOÀN THIỆN', color: 'bg-amber-500' };

    // Tạo mảng kết quả có đánh giá effectiveIsPass cho từng chỉ tiêu (kể cả ngoài TCCS nhưng có trong công thức)
    const effectiveResults = deduplicatedResults.map((r) => {
      let isPass = r.isPass;
      const rName = r.criteriaName.trim().toLowerCase();
      const isMainCriteria = tccs?.mainQualityCriteria?.some(
        (c) => c && c.name && c.name.trim().toLowerCase() === rName
      );

      if (!isMainCriteria) {
        const extraFormulaItem = lookupFormulaItem(r.criteriaName);
        if (extraFormulaItem) {
          let dc = extraFormulaItem.declaredContent;
          if (typeof dc === 'string') dc = parseNumberFromText(dc) as any;
          let ec = extraFormulaItem.elementalContent;
          if (typeof ec === 'string') ec = parseNumberFromText(ec as any) as any;
          const basis = ec != null && (ec as number) > 0 ? (ec as number) : (dc as number);
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
    if (overallStatus === TEST_RESULT_STATUS.FAIL)
      return { label: 'KHÔNG ĐẠT', color: 'bg-red-600' };

    if (tccs) {
      const mandatoryCriteria = [
        ...(tccs.mainQualityCriteria || []),
        ...(tccs.safetyCriteria || []),
      ].filter((c) => c && c.name);

      // [ALIAS FIX] buildResolvedTestedSet chuẩn hóa tên qua alias trước khi so sánh
      const resolvedTestedSet = resolver.buildResolvedTestedSet(
        deduplicatedResults.map((r) => r.criteriaName)
      );

      const isComplete = mandatoryCriteria.every((c) =>
        resolvedTestedSet.has(normalizeName(c.name))
      );

      if (!isComplete) return { label: 'CHƯA HOÀN THIỆN', color: 'bg-amber-500' };
    }

    return { label: 'ĐẠT', color: 'bg-emerald-600' };
  }, [deduplicatedResults, tccs, resolver]);

  return (
    <div
      id="coa-report-container"
      className="relative bg-white p-10 text-slate-900 max-w-[21cm] mx-auto print:shadow-none print:border-0 print:p-0 print:max-w-none print:mx-0 overflow-hidden"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Banner cảnh báo nếu bản chụp snapshot bị stale */}
      {snapshot && snapshotStaleCheck.stale && (
        <div className="mb-6 p-4 rounded-xl border-2 border-red-500 bg-red-50 text-red-900 print:hidden flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wide">
              PHIẾU KIỂM NGHIỆM ĐÃ THAY ĐỔI
            </h4>
            <p className="text-xs mt-0.5 leading-relaxed">
              Bản chụp thẩm định hiện tại không còn đồng nhất với dữ liệu Phiếu kiểm nghiệm mới nhất
              ({snapshotStaleCheck.reason}). Cần thực hiện đánh giá/thẩm tra lại trước khi phát hành
              CoA chính thức.
            </p>
          </div>
        </div>
      )}

      {/* Banner cảnh báo bản nháp nếu chưa có EvaluationSnapshot chính thức (SC-14) */}
      {!isOfficialSnapshot && !snapshotStaleCheck.stale && (
        <div className="mb-6 p-4 rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-900 print:hidden flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wide">
              Cảnh báo: Bản nháp CoA nội bộ (DRAFT)
            </h4>
            <p className="text-xs mt-0.5 leading-relaxed">
              Lô này chưa hoàn tất thẩm định chất lượng chính thức (chưa có Bản chụp niêm phong
              EvaluationSnapshot). Bản in dưới đây chỉ mang tính chất dự thảo nội bộ, không có giá
              trị pháp lý làm Phiếu phân tích (CoA) thương mại.
            </p>
          </div>
        </div>
      )}

      {/* Watermark DRAFT in mờ nếu chưa có snapshot chính thức */}
      {!isOfficialSnapshot && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] select-none z-0">
          <span className="text-6xl md:text-7xl font-black uppercase text-red-600 tracking-widest rotate-[-30deg] border-8 border-dashed border-red-600 p-8 rounded-3xl text-center">
            DRAFT
            <br />
            CHƯA PHÊ DUYỆT
          </span>
        </div>
      )}
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

      {/* Header Công ty & Phòng QC theo mẫu chính thức V-Biotech */}
      {/* Header phiếu kiểm nghiệm: Phân biệt Phiếu QC nội bộ V-Biotech vs Phiếu Ngoại kiểm bên ngoài */}
      {isInternalLab ? (
        <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900 mb-4 print:pb-2 print:mb-3">
          {/* Góc trái: Logo V-Biotech + PHÒNG QC */}
          <div className="flex flex-col items-center shrink-0 w-36 text-center">
            <img
              src="/logo.png"
              alt="V-Biotech"
              className="h-14 w-auto object-contain mb-1 print:h-12"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-[14px] font-black text-slate-950 uppercase tracking-wider">
              PHÒNG QC
            </span>
          </div>

          {/* Giữa: Thông tin pháp nhân công ty */}
          <div className="text-center flex-1 px-4 space-y-0.5 text-slate-900">
            <p className="text-[13px] font-black uppercase tracking-tight text-slate-950">
              CÔNG TY CỔ PHẦN CÔNG NGHỆ SINH PHẨM NAM VIỆT
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
              NAM VIET BIOTECHNOLOGY JOINT STOCK COMPANY
            </p>
            <p className="text-[11px] text-slate-700">
              Lô A3-A4 Cụm Công nghiệp vừa và nhỏ, Xã Diên Điền, Tỉnh Khánh Hòa.
            </p>
            <p className="text-[11px] text-slate-700">
              Điện thoại: 0258 3771868. Fax: 0258 3771869.
            </p>
          </div>

          {/* Góc phải: Mã QR tra cứu công khai theo SC-14 */}
          <div className="shrink-0 flex flex-col items-center justify-center p-1 bg-white border border-slate-300 rounded shadow-xs print:shadow-none">
            {coaUrl ? (
              <QRCodeSVG value={coaUrl} size={48} level="M" />
            ) : (
              <div className="w-[48px] h-[48px] bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                QR
              </div>
            )}
            <span className="text-[7px] text-slate-500 font-mono mt-0.5">Xác thực QR</span>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900 mb-4 print:pb-2 print:mb-3">
          {/* Thông tin Đơn vị thử nghiệm ngoại kiểm bên ngoài */}
          <div className="flex-1 space-y-0.5 text-slate-900 pr-4">
            {externalLabInfo.parentOrg && (
              <p className="text-[11px] font-bold uppercase tracking-tight text-slate-600">
                {externalLabInfo.parentOrg}
              </p>
            )}
            <p className="text-[14px] font-black uppercase tracking-tight text-slate-950">
              {externalLabInfo.name}
            </p>
            {externalLabInfo.subName && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
                {externalLabInfo.subName}
              </p>
            )}
            <p className="text-[11px] text-slate-700">{externalLabInfo.address}</p>
          </div>

          {/* Góc phải: Mã QR tra cứu */}
          <div className="shrink-0 flex flex-col items-center justify-center p-1 bg-white border border-slate-300 rounded shadow-xs print:shadow-none">
            {coaUrl ? (
              <QRCodeSVG value={coaUrl} size={48} level="M" />
            ) : (
              <div className="w-[48px] h-[48px] bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                QR
              </div>
            )}
            <span className="text-[7px] text-slate-500 font-mono mt-0.5">Xác thực QR</span>
          </div>
        </div>
      )}

      {/* Tiêu đề Phiếu kiểm nghiệm & Số hiệu báo cáo */}
      <div className="relative text-center mb-5 print:mb-3">
        <h1 className="text-2xl font-black uppercase tracking-wide text-slate-950">
          {isInternalLab ? 'PHIẾU KIỂM NGHIỆM' : externalLabInfo.reportTitle}
        </h1>
        {!isInternalLab && (
          <p className="text-[12px] font-bold text-slate-600 tracking-wider uppercase italic">
            {externalLabInfo.reportSubTitle}
          </p>
        )}
        <div className="text-right mt-1 text-[13px] font-medium text-slate-800">
          <span>{isInternalLab ? 'Số: ' : 'Số / No: '}</span>
          <span className="font-bold text-slate-950">
            {(res as any).reportNo ||
              generateDefaultReportNo({
                batchNo: batch?.batchNo,
                labName: res.labName,
                testDate: res.testDate,
              })}
          </span>
        </div>
      </div>

      {/* Thông tin mẫu thử & Khách hàng */}
      {isInternalLab ? (
        /* Form thông tin QC Nội bộ V-Biotech */
        <div className="space-y-1.5 mb-6 print:mb-4 text-[13px] text-slate-900 border-b border-slate-300 pb-3 print:pb-2">
          {/* Dòng 1: Tên sản phẩm */}
          <div className="flex">
            <span className="w-36 shrink-0 font-medium text-slate-800">Tên sản phẩm:</span>
            <span className="font-bold uppercase text-slate-950 flex-1">
              {product?.name || '---'}
            </span>
          </div>

          {/* Dòng 2: Mã số & Số lô */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-36 shrink-0 font-medium text-slate-800">Mã số:</span>
              <span className="font-bold text-slate-950">{product?.code || '---'}</span>
            </div>
            <div className="flex">
              <span className="w-28 shrink-0 font-medium text-slate-800">Số lô:</span>
              <span className="font-bold text-slate-950">{batch?.batchNo || '---'}</span>
            </div>
          </div>

          {/* Dòng 3: Ngày sản xuất & Hạn dùng */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-36 shrink-0 font-medium text-slate-800">Ngày sản xuất:</span>
              <span className="font-bold text-slate-950">
                {batch && batch.mfgDate ? formatDateStandard(batch.mfgDate) : '---'}
              </span>
            </div>
            <div className="flex">
              <span className="w-28 shrink-0 font-medium text-slate-800">Hạn dùng:</span>
              <span className="font-bold text-slate-950">
                {batch && batch.expDate ? formatDateStandard(batch.expDate) : '---'}
              </span>
            </div>
          </div>

          {/* Dòng 4: Dạng bào chế */}
          <div className="flex">
            <span className="w-36 shrink-0 font-medium text-slate-800">Dạng bào chế:</span>
            <span className="font-medium text-slate-950">
              {tccs?.sensory?.dosageForm ||
                formula?.sensory?.dosageForm ||
                (batch as any)?.dosageForm ||
                '---'}
            </span>
          </div>

          {/* Dòng 5: Quy cách đóng gói */}
          <div className="flex">
            <span className="w-36 shrink-0 font-medium text-slate-800">Quy cách đóng gói:</span>
            <span className="font-medium text-slate-950">
              {batch?.packaging || formula?.packaging || '---'}
            </span>
          </div>

          {/* Dòng 6: Tiêu chuẩn / Ngày thực hiện & Ngày kết thúc */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-36 shrink-0 font-medium text-slate-800">Tiêu chuẩn:</span>
              <span className="font-bold text-slate-950">{tccs?.code || '---'}</span>
            </div>
            <div className="flex">
              <span className="w-28 shrink-0 font-medium text-slate-800">Ngày kiểm:</span>
              <span className="font-bold text-slate-950">{formatDateStandard(res.testDate)}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Form thông tin Khách hàng & Mẫu thử dành cho Ngoại kiểm */
        <div className="space-y-1.5 mb-6 print:mb-4 text-[13px] text-slate-900 border-b border-slate-300 pb-3 print:pb-2">
          {/* Đơn vị gửi mẫu / Client */}
          <div className="flex">
            <span className="w-48 shrink-0 font-medium text-slate-800">
              Đơn vị gửi mẫu / Client:
            </span>
            <span className="font-bold uppercase text-slate-950 flex-1">
              CÔNG TY CỔ PHẦN CÔNG NGHỆ SINH PHẨM NAM VIỆT
            </span>
          </div>

          {/* Địa chỉ khách hàng / Address */}
          <div className="flex">
            <span className="w-48 shrink-0 font-medium text-slate-800">Địa chỉ / Address:</span>
            <span className="font-medium text-slate-900 flex-1">
              Lô A3-A4 Cụm Công nghiệp vừa và nhỏ, Xã Diên Điền, Huyện Diên Khánh, Tỉnh Khánh Hòa
            </span>
          </div>

          {/* Tên mẫu thử / Sample name */}
          <div className="flex">
            <span className="w-48 shrink-0 font-medium text-slate-800">Tên mẫu thử / Sample:</span>
            <span className="font-bold uppercase text-slate-950 flex-1">
              {product?.name || '---'}
            </span>
          </div>

          {/* Ký hiệu mẫu & Số lô */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-48 shrink-0 font-medium text-slate-800">Ký hiệu mẫu / Code:</span>
              <span className="font-bold text-slate-950">{product?.code || '---'}</span>
            </div>
            <div className="flex">
              <span className="w-32 shrink-0 font-medium text-slate-800">Số lô / Batch No:</span>
              <span className="font-bold text-slate-950">{batch?.batchNo || '---'}</span>
            </div>
          </div>

          {/* Ngày sản xuất & Hạn dùng */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-48 shrink-0 font-medium text-slate-800">Ngày sản xuất / Mfg:</span>
              <span className="font-bold text-slate-950">
                {batch && batch.mfgDate ? formatDateStandard(batch.mfgDate) : '---'}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 shrink-0 font-medium text-slate-800">Hạn dùng / Exp:</span>
              <span className="font-bold text-slate-950">
                {batch && batch.expDate ? formatDateStandard(batch.expDate) : '---'}
              </span>
            </div>
          </div>

          {/* Mô tả tình trạng mẫu khi nhận */}
          <div className="flex">
            <span className="w-48 shrink-0 font-medium text-slate-800">Mô tả mẫu / Condition:</span>
            <span className="font-medium text-slate-950">
              {tccs?.sensory?.dosageForm ||
              formula?.sensory?.dosageForm ||
              (batch as any)?.dosageForm
                ? `${tccs?.sensory?.dosageForm || formula?.sensory?.dosageForm || (batch as any)?.dosageForm}, `
                : ''}
              quy cách: {batch?.packaging || formula?.packaging || 'Mẫu nguyên bao bì niêm phong'}
            </span>
          </div>

          {/* Ngày nhận mẫu & Ngày thử nghiệm */}
          <div className="grid grid-cols-2 gap-x-8">
            <div className="flex">
              <span className="w-48 shrink-0 font-medium text-slate-800">
                Ngày nhận mẫu / Received:
              </span>
              <span className="font-bold text-slate-950">
                {formatDateStandard((batch as any)?.mfgDate || res.testDate)}
              </span>
            </div>
            <div className="flex">
              <span className="w-32 shrink-0 font-medium text-slate-800">Ngày thử / Tested:</span>
              <span className="font-bold text-slate-950">{formatDateStandard(res.testDate)}</span>
            </div>
          </div>

          {/* Đơn vị thực hiện kiểm nghiệm */}
          <div className="flex">
            <span className="w-48 shrink-0 font-medium text-slate-800">Nơi thử nghiệm / Lab:</span>
            <span className="font-bold text-slate-950">{res.labName || externalLabInfo.name}</span>
          </div>
        </div>
      )}

      {/* Bảng kết quả */}
      <div className="mb-10 print:mb-6">
        <h4 className="text-sm font-black uppercase tracking-widest bg-slate-100 border border-slate-800 text-slate-800 px-4 py-2 border-b-0">
          Kết quả Phân tích /{' '}
          <span className="italic font-bold normal-case">Analytical Results</span>
        </h4>
        <table className="w-full text-[13px] border-collapse border border-slate-800">
          <thead className="bg-slate-50 text-center table-header-group">
            {isInternalLab ? (
              /* Header bảng 5 cột cho Phiếu QC Nội bộ */
              <tr>
                <th className="py-2 print:py-1 px-2 border border-slate-800 w-[6%]">STT</th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[34%]">
                  Chỉ tiêu
                  <br />
                  <span className="text-[10px] font-normal italic">Test Parameter</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[28%]">
                  Yêu cầu
                  <br />
                  <span className="text-[10px] font-normal italic">Specification</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[14%]">
                  Đơn vị
                  <br />
                  <span className="text-[10px] font-normal italic">Unit</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[18%]">
                  Kết quả
                  <br />
                  <span className="text-[10px] font-normal italic">Result</span>
                </th>
              </tr>
            ) : (
              /* Header bảng 6 cột cho Phiếu Kiểm ngoài (Kèm Phương pháp thử) */
              <tr>
                <th className="py-2 print:py-1 px-2 border border-slate-800 w-[5%]">STT</th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[29%]">
                  Chỉ tiêu thử nghiệm
                  <br />
                  <span className="text-[10px] font-normal italic">Test Parameter</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[22%]">
                  Phương pháp thử
                  <br />
                  <span className="text-[10px] font-normal italic">Test Method</span>
                </th>
                <th className="py-2 print:py-1 px-2 border border-slate-800 w-[11%]">
                  Đơn vị
                  <br />
                  <span className="text-[10px] font-normal italic">Unit</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[18%]">
                  Mức quy định
                  <br />
                  <span className="text-[10px] font-normal italic">Specification</span>
                </th>
                <th className="py-2 print:py-1 px-3 print:px-2 border border-slate-800 w-[15%]">
                  Kết quả
                  <br />
                  <span className="text-[10px] font-normal italic">Result</span>
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              let runningStt = 0;
              return groupedResults.map((group) => (
                <React.Fragment key={group.title}>
                  <tr className="bg-slate-100 break-inside-avoid">
                    <td
                      colSpan={isInternalLab ? 5 : 6}
                      className="py-2 print:py-1 px-3 print:px-2 font-bold text-slate-800 border border-slate-800"
                    >
                      {group.title}
                    </td>
                  </tr>
                  {group.items.map((r) => {
                    runningStt++;
                    const itemStt = runningStt;
                    return (() => {
                      // Lấy thông tin chỉ tiêu TCCS tương ứng
                      const rName = r.criteriaName.trim().toLowerCase();
                      const criterion = allCriteriaMap.get(rName);

                      // Tìm thành phần tương ứng trong công thức đã công bố
                      let formulaItem = formulaItemMap.get(rName);

                      if (criterion && criterion.formulaIngredientId) {
                        const linkedName = criterion.formulaIngredientId.trim().toLowerCase();
                        const linkedItem = formulaItemMap.get(linkedName);
                        if (linkedItem) formulaItem = linkedItem;
                      }

                      // Xử lý hàm lượng công bố (hợp chất / muối)
                      let declaredContent = formulaItem?.declaredContent;
                      if (typeof declaredContent === 'string')
                        declaredContent = parseNumberFromText(declaredContent);

                      // Xử lý hàm lượng nguyên tố (ion / base)
                      let elementalContent = formulaItem?.elementalContent;
                      if (typeof elementalContent === 'string')
                        elementalContent = parseNumberFromText(elementalContent);

                      // Xác định có phải là Chỉ tiêu Chất lượng chính không
                      const isMainCriteria = tccs?.mainQualityCriteria?.some(
                        (c) => c && c.name && c.name.trim().toLowerCase() === rName
                      );

                      // Xác định giá trị chuẩn 100% để chia %
                      let basisForCalculation: number | undefined = undefined;

                      if (isMainCriteria) {
                        if (criterion && criterion.formulaIngredientId) {
                          if (
                            criterion.calculationBasis === 'ELEMENTAL' &&
                            elementalContent != null &&
                            elementalContent > 0
                          ) {
                            basisForCalculation = elementalContent;
                          } else if (
                            declaredContent != null &&
                            !isNaN(declaredContent as number) &&
                            (declaredContent as number) > 0
                          ) {
                            basisForCalculation = declaredContent as number;
                          } else if (criterion.declaredContent != null) {
                            basisForCalculation =
                              typeof criterion.declaredContent === 'string'
                                ? parseNumberFromText(criterion.declaredContent as any)
                                : criterion.declaredContent;
                          }
                        } else if (criterion?.declaredContent != null) {
                          basisForCalculation =
                            typeof criterion.declaredContent === 'string'
                              ? parseNumberFromText(criterion.declaredContent as any)
                              : criterion.declaredContent;
                        } else {
                          basisForCalculation =
                            elementalContent != null && elementalContent > 0
                              ? elementalContent
                              : (declaredContent as number);
                        }
                      } else {
                        const extraFormulaItem = lookupFormulaItem(r.criteriaName);
                        if (extraFormulaItem) {
                          let dc = extraFormulaItem.declaredContent;
                          if (typeof dc === 'string') dc = parseNumberFromText(dc) as any;
                          let ec = extraFormulaItem.elementalContent;
                          if (typeof ec === 'string') ec = parseNumberFromText(ec as any) as any;
                          basisForCalculation =
                            ec != null && (ec as number) > 0 ? (ec as number) : (dc as number);
                        }
                      }

                      let formulaDefaultMin: number | undefined;
                      let formulaDefaultMax: number | undefined;
                      if (
                        !isMainCriteria &&
                        basisForCalculation != null &&
                        basisForCalculation > 0
                      ) {
                        formulaDefaultMin = basisForCalculation * 0.8;
                        formulaDefaultMax = basisForCalculation * 1.2;
                      }

                      const actualValue = parseNumberFromText(String(r.value));
                      let percentageView = null;

                      let effectiveIsPass = r.isPass;
                      if (
                        !isOfficialSnapshot &&
                        formulaDefaultMin !== undefined &&
                        formulaDefaultMax !== undefined &&
                        !isNaN(actualValue) &&
                        actualValue > 0
                      ) {
                        effectiveIsPass =
                          actualValue >= formulaDefaultMin && actualValue <= formulaDefaultMax;
                      }

                      const limitText = getLimitText(r);
                      const limitTextDisplay = limitText === '__FORMULA__' ? '' : limitText;
                      const limitUpper = String(limitTextDisplay).toUpperCase();

                      let displayValue: React.ReactNode = formatScientific(
                        r.value,
                        String(limitTextDisplay)
                      );

                      if (
                        r.value === 'Miễn kiểm' ||
                        r.value === 'Đạt (theo quy tắc thay thế)' ||
                        r.value === 'Đạt (miễn kiểm theo điều kiện)'
                      ) {
                        displayValue = (
                          <span className="italic font-semibold text-slate-600">Miễn kiểm</span>
                        );
                      } else {
                        const isNumericZero =
                          actualValue === 0 && /^0(\.0+)?$/.test(String(r.value).trim());
                        if (isNumericZero && ND_KEYWORDS.some((kw) => limitUpper.includes(kw))) {
                          displayValue = 'Không phát hiện';
                        }
                      }

                      const relativePercText = calculateRelativePercentage(
                        r.value,
                        basisForCalculation,
                        limitTextDisplay
                      );
                      if (relativePercText) {
                        percentageView = (
                          <span className="text-[10px] text-slate-600 font-mono font-normal mt-0.5 block">
                            {relativePercText}
                          </span>
                        );
                      }

                      let limitCellContent: React.ReactNode;
                      if (formulaDefaultMin !== undefined && formulaDefaultMax !== undefined) {
                        const locale = getActiveLocale();
                        const minStr = formulaDefaultMin.toLocaleString(locale, {
                          maximumFractionDigits: 2,
                        });
                        const maxStr = formulaDefaultMax.toLocaleString(locale, {
                          maximumFractionDigits: 2,
                        });
                        limitCellContent = (
                          <span>
                            {minStr} ~ {maxStr}
                            <span className="block italic font-normal text-[10px] text-slate-400">
                              (±20% hàm lượng)
                            </span>
                          </span>
                        );
                      } else {
                        limitCellContent = renderLimitCell(r);
                      }

                      return (
                        <tr
                          key={r.criteriaName}
                          className="border-b border-slate-800 break-inside-avoid"
                        >
                          <td className="py-2 print:py-1.5 px-2 text-center border-r border-slate-800 font-medium">
                            {itemStt}
                          </td>
                          <td className="py-2 print:py-1.5 px-3 print:px-2 border-r border-slate-800 font-medium">
                            {r.criteriaName}
                          </td>
                          {!isInternalLab && (
                            <td className="py-2 print:py-1.5 px-3 print:px-2 border-r border-slate-800 text-[12px] text-slate-700">
                              {getAnalysisMethod(r)}
                            </td>
                          )}
                          <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-800 font-bold">
                            {limitCellContent}
                          </td>
                          <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-800">
                            {getUnitText(r)}
                          </td>
                          <td className="py-2 print:py-1.5 px-3 print:px-2 text-center border-slate-800">
                            <div
                              className={`font-bold ${effectiveIsPass ? 'text-slate-900' : 'text-red-600'}`}
                            >
                              {displayValue}
                            </div>
                            {percentageView}
                          </td>
                        </tr>
                      );
                    })();
                  })}
                </React.Fragment>
              ));
            })()}
          </tbody>
        </table>

        {/* Chú thích chân bảng */}
        {isInternalLab ? (
          /* Chú thích pháp lý Tiêu chuẩn cơ sở nội bộ */
          (deduplicatedResults.some((r: any) => r.isExempted || r.alternateState === 'EXEMPTED') ||
            (res.evaluationSnapshot?.footnotes && res.evaluationSnapshot.footnotes.length > 0)) && (
            <div className="mt-2 text-[11px] text-slate-600 italic space-y-0.5 border-t border-slate-300 pt-1.5 print:mt-1">
              <p>
                (*) Miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở khi chỉ tiêu chính tương ứng đã
                đạt yêu cầu.
              </p>
              {deduplicatedResults
                .filter((r: any) => r.alternateNote && String(r.alternateNote).trim() !== '')
                .map((r: any, idx: number) => (
                  <p key={`alt-note-${idx}`}>
                    - {r.criteriaName}: {r.alternateNote}
                  </p>
                ))}
              {res.evaluationSnapshot?.footnotes?.map((fn, idx) => (
                <p key={idx}>{fn}</p>
              ))}
            </div>
          )
        ) : (
          /* Ghi chú chuẩn cho phiếu kiểm nghiệm của đơn vị bên ngoài */
          <div className="mt-2 text-[11px] text-slate-600 italic space-y-0.5 border-t border-slate-300 pt-1.5 print:mt-1">
            <p>
              1. Các kết quả thử nghiệm ghi trong phiếu này chỉ có giá trị đối với mẫu thử do khách
              hàng gửi đến phòng thí nghiệm.
            </p>
            <p>
              2. Không được trích sao một phần phiếu kết quả thử nghiệm này nếu không có sự đồng ý
              bằng văn bản của phòng kiểm nghiệm.
            </p>
            <p>
              3. KPH (ND): Không phát hiện / Not Detected (dưới ngưỡng định lượng LOQ hoặc ngưỡng
              phát hiện LOD của phương pháp thử).
            </p>
            {res.evaluationSnapshot?.footnotes?.map((fn, idx) => (
              <p key={idx}>{fn}</p>
            ))}
          </div>
        )}
      </div>

      {/* Khối Kết luận Chất lượng */}
      <div className="mb-6 text-[13px] text-slate-900 leading-relaxed break-inside-avoid">
        <span className="font-bold underline uppercase">
          {isInternalLab ? 'KẾT LUẬN:' : 'KẾT LUẬN / CONCLUSION:'}
        </span>{' '}
        {isOfficialSnapshot && snapshot ? (
          <span
            className={
              snapshot.overallStatus === 'PASS'
                ? 'font-bold text-slate-950'
                : 'font-bold text-red-700'
            }
          >
            {snapshot.overallStatus === 'PASS'
              ? isInternalLab
                ? `Mẫu thử ${product?.name || ''} lô ${batch?.batchNo || ''} đạt yêu cầu chất lượng theo TCCS.`
                : `Các chỉ tiêu kiểm nghiệm trên mẫu thử đạt yêu cầu theo quy chuẩn kỹ thuật.`
              : isInternalLab
                ? `Mẫu thử ${product?.name || ''} lô ${batch?.batchNo || ''} không đạt yêu cầu chất lượng theo TCCS.`
                : `Mẫu thử không đạt ở một số chỉ tiêu kiểm nghiệm.`}
          </span>
        ) : (
          <span className="font-bold text-amber-700">
            {conclusion.label === 'ĐẠT'
              ? isInternalLab
                ? `Bản dự thảo: Mẫu thử ${product?.name || ''} lô ${batch?.batchNo || ''} đạt yêu cầu chất lượng theo TCCS (chưa thẩm định chính thức).`
                : `Các chỉ tiêu đã thử nghiệm phù hợp quy chuẩn kỹ thuật.`
              : `Bản dự thảo: Mẫu thử không đạt yêu cầu chất lượng.`}
          </span>
        )}
      </div>

      {/* Khối Chữ ký: Phân biệt rõ ràng giữa Nội bộ và Ngoại kiểm */}
      {isInternalLab ? (
        /* Khối Chữ ký Trưởng phòng QC theo mẫu Phiếu Kiểm Nghiệm nội bộ thực tế */
        <div className="flex justify-end mt-4 mb-6 break-inside-avoid">
          <div className="w-80 text-center text-slate-900">
            <p className="italic text-[12px] text-slate-700 mb-1">
              Khánh Hòa, ngày {signDate.day} tháng {signDate.month} năm {signDate.year}
            </p>
            <p className="font-bold text-[12px] uppercase tracking-wide text-slate-800">
              TL. GIÁM ĐỐC
            </p>
            <p className="font-black text-[13px] uppercase tracking-wide text-slate-950 mb-1">
              TRƯỞNG PHÒNG QC
            </p>

            {/* Vùng chừa trống chữ ký sống & con dấu đỏ công ty (bỏ ký số điện tử và tên in sẵn theo yêu cầu) */}
            <div className="h-28 flex items-center justify-center">
              {/* Khoảng trống để ký tay sống và đóng dấu mộc đỏ */}
            </div>
          </div>
        </div>
      ) : (
        /* Khối Chữ ký Đơn vị Thử nghiệm Ngoại kiểm (2 bên: Người thử nghiệm & Đại diện phòng thử nghiệm) */
        <div className="flex justify-between items-start mt-6 mb-6 break-inside-avoid">
          {/* Cột trái: Người thử nghiệm */}
          <div className="w-72 text-center text-slate-900">
            <p className="font-bold text-[12px] uppercase tracking-wide text-slate-800">
              NGƯỜI THỬ NGHIỆM
            </p>
            <p className="text-[10px] font-medium text-slate-600 uppercase italic mb-1">
              TESTED BY / ANALYST
            </p>
            <div className="h-28 flex items-end justify-center">
              <span className="text-[11px] italic text-slate-400">(Ký, ghi rõ họ tên)</span>
            </div>
          </div>

          {/* Cột phải: Trưởng phòng thí nghiệm / Đại diện đơn vị kiểm nghiệm */}
          <div className="w-80 text-center text-slate-900">
            <p className="italic text-[12px] text-slate-700 mb-1">
              {externalLabInfo.location}, ngày {signDate.day} tháng {signDate.month} năm{' '}
              {signDate.year}
            </p>
            <p className="font-bold text-[12px] uppercase tracking-wide text-slate-800">
              {externalLabInfo.signerTitle}
            </p>
            <p className="text-[10px] font-medium text-slate-600 uppercase italic mb-1">
              {externalLabInfo.signerSubTitle}
            </p>
            <div className="h-28 flex items-end justify-center">
              <span className="text-[11px] italic text-slate-400">
                (Ký tên và đóng dấu / Signature & Stamp)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chân trang Biểu mẫu: Nội bộ hiển thị HS-BM-03-QC-6-04, Ngoại kiểm không hiển thị mã biểu mẫu nội bộ */}
      {isInternalLab ? (
        <div className="mt-8 pt-3 border-t-2 border-slate-900 flex justify-between items-center text-[11px] text-slate-800 break-inside-avoid print:mt-4 print:pt-2">
          <div>
            <span className="font-bold">Mã số:</span> HS-BM-03-QC-6-04
          </div>
          <div>
            <span className="font-bold">Lần ban hành:</span> 02
            <span className="mx-3">|</span>
            <span className="font-bold">Ngày ban hành:</span> 03/01/2022
          </div>
          <div>
            <span className="font-bold">Trang:</span> 1/1
          </div>
        </div>
      ) : (
        <div className="mt-8 pt-3 border-t-2 border-slate-900 flex justify-between items-center text-[11px] text-slate-800 break-inside-avoid print:mt-4 print:pt-2">
          <div>
            <span className="font-bold">Đơn vị thử nghiệm:</span> {externalLabInfo.name}
          </div>
          <div>
            <span className="font-bold">Trang / Page:</span> 1/1
          </div>
        </div>
      )}

      {/* Chân trang ALCOA+ SHA-256 Hash niêm phong */}
      {isOfficialSnapshot && snapshot?.evaluationHash && (
        <div className="mt-1.5 pt-1 border-t border-slate-300 flex flex-wrap justify-between items-center text-[9px] text-slate-500 font-mono break-inside-avoid">
          <span>
            Mã bảo mật ALCOA+ SHA-256:{' '}
            <span className="font-bold text-slate-800">{snapshot.evaluationHash}</span>
          </span>
          <span>
            Niêm phong:{' '}
            {snapshot.timestamp
              ? formatDateStandard(snapshot.timestamp)
              : formatDateStandard(res.testDate)}
          </span>
        </div>
      )}

      {/* Tài liệu đính kèm (Attachments) */}
      {res.attachments && res.attachments.length > 0 && (
        <div className="mt-8 border-t-2 border-slate-800 pt-4 break-inside-avoid print:mt-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3">
            Tài liệu đính kèm / <span className="italic font-bold normal-case">Attachments</span>
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {res.attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 bg-slate-50 border border-slate-250 p-3 rounded-xl print:bg-white print:p-2 print:border-slate-300"
              >
                <div className="shrink-0 p-1 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center">
                  <QRCodeSVG value={att.url} size={44} level="M" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-800 truncate" title={att.name}>
                    {att.name}
                  </p>
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
