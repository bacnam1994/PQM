/**
 * Debug script: Mô phỏng logic tính % Tổng Bacillus trong calculateRelativePercentage & CoAReport
 * Chạy: node scripts/debug_bacillus_pct.mjs
 */

// ============================================================
// Inline các hàm cốt lõi từ ValueNormalizer & basisCalculation
// ============================================================

const SUPERSCRIPTS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
};

function standardizeDecimalString(str) {
  if (str === null || str === undefined) return '';
  let s = String(str).trim().replace(/[–—]/g, '-');
  s = s.replace(/(\d{1,3}(?:,\d{3})+)\.(\d+)/g, (_, p1, p2) => p1.replace(/,/g, '') + '.' + p2);
  s = s.replace(/(\d{1,3}(?:\.\d{3})+),(\d+)/g, (_, p1, p2) => p1.replace(/\./g, '') + '.' + p2);
  s = s.replace(/(\d{1,3}(?:,\d{3}){2,})/g, (match) => match.replace(/,/g, ''));
  s = s.replace(/(\d{1,3}(?:\.\d{3}){2,})/g, (match) => match.replace(/\./g, ''));
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');
  return s;
}

function normalizeNumericString(value) {
  if (value === null || value === undefined) return '';
  let str = standardizeDecimalString(value);
  // 1. Số mũ Unicode → ^
  str = str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (match) => {
    return '^' + match.split('').map((c) => SUPERSCRIPTS[c] || c).join('');
  });
  // 2. Khoa học linh hoạt (1.5 x 10^8, 1.5x10 8, v.v.)
  str = str.replace(
    /([+-]?\d*\.?\d+)\s*[xX*×]\s*10\s*(?:\^)?\s*([+-]?\d+)/gi,
    (_, p1, p2) => String(parseFloat(p1) * Math.pow(10, parseInt(p2, 10)))
  );
  // 3. 10^3 độc lập
  str = str.replace(/(^|[^\d.xX*×])10(?:\s*\^\s*|\s+)([+-]?\d+)/gi, (_, prefix, p1) => {
    return prefix + String(Math.pow(10, parseInt(p1, 10)));
  });
  // 4. 1.6e9
  str = str.replace(/([+-]?\d+(\.\d+)?)e([+-]?\d+)/gi, (match) => {
    try {
      const num = Number(match);
      if (!isNaN(num) && Math.abs(num) < 1e21) {
        return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
      }
    } catch {}
    return match;
  });
  return str;
}

function parseNumberFromText(text) {
  if (text === null || text === undefined) return NaN;
  const str = normalizeNumericString(text).trim();
  const match = str.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
}

function calculateRelativePercentage(actualValue, declaredContent, limitText) {
  if (!actualValue) return null;
  const actualNum = parseNumberFromText(actualValue);
  if (isNaN(actualNum)) return null;

  let baseNum = NaN;
  if (declaredContent !== undefined && declaredContent !== null && String(declaredContent).trim() !== '') {
    baseNum = parseNumberFromText(declaredContent);
  }
  if (isNaN(baseNum) || baseNum === 0) return null;

  const percentage = (actualNum / baseNum) * 100;
  const rounded = Math.round(percentage * 100) / 100;
  return `(${rounded}%)`;
}

// ============================================================
// Các kịch bản kiểm nghiệm lô 092603 - Tổng Bacillus
// (giả lập dữ liệu từ database dựa trên pattern phổ biến)
// ============================================================

console.log('='.repeat(60));
console.log('DEBUG: Tính % Tổng Bacillus - Lô 092603');
console.log('='.repeat(60));

const scenarios = [
  {
    desc: 'KN1: Kết quả 1.5x10^8, Hàm lượng công bố 10^9 (CFU/mL)',
    actual: '1.5 x 10^8',
    declared: '10^9',
    limit: '≥ 1x10^9',
  },
  {
    desc: 'KN2: Kết quả 1.5x10⁸, Hàm lượng công bố 10⁹ (Unicode superscript)',
    actual: '1.5 x 10⁸',
    declared: '10⁹',
    limit: '≥ 1x10⁹',
  },
  {
    desc: 'KN3: Kết quả 1.5x10^8, Hàm lượng công bố "10^9" chuỗi thường',
    actual: '1.5x10^8',
    declared: '10^9',
    limit: '≥ 10^9',
  },
  {
    desc: 'KN4: Kết quả 1.5e8, Hàm lượng công bố 1e9',
    actual: '1.5e8',
    declared: '1e9',
    limit: '≥ 1e9',
  },
  {
    desc: 'KN5: Kết quả 150000000, Hàm lượng công bố 1000000000',
    actual: '150000000',
    declared: '1000000000',
    limit: '≥ 1000000000',
  },
  {
    desc: 'KN6 (BUG SUSPECT): Kết quả 1.5x10^8, Hàm lượng công bố chưa điền (undefined)',
    actual: '1.5 x 10^8',
    declared: undefined,
    limit: '≥ 1x10^9',
  },
  {
    desc: 'KN7 (BUG: declared là "10⁹" nhưng parseNumber bị lỗi cũ → trả về 10)',
    actual: '1.5x10^8',
    declared: '10⁹',
    limit: '≥ 10^9',
  },
  {
    desc: 'KN8 (BUG: CoA dùng elemental = 15, còn actual = 150000000 → 15% SAI!)',
    actual: '150000000',
    declared: 15,          // BUG: declared bị set từ mg/viên thay vì CFU/mL
    limit: '≥ 1000000000',
  },
  {
    desc: 'KN9: Kết quả "1.5 x 10 8" (có khoảng trắng trước số mũ)',
    actual: '1.5 x 10 8',
    declared: '10^9',
    limit: '≥ 10^9',
  },
  {
    desc: 'KN10: Kết quả 1.5×10⁸ (×: dấu nhân Unicode)',
    actual: '1.5×10⁸',
    declared: '10⁹',
    limit: '≥ 10⁹',
  },
];

for (const s of scenarios) {
  const pct = calculateRelativePercentage(s.actual, s.declared, s.limit);
  const actualNum = parseNumberFromText(s.actual);
  const declaredNum = s.declared !== undefined ? parseNumberFromText(s.declared) : 'N/A';
  
  const flag = pct === '(15%)' || pct?.includes('15') ? ' ← 🚨 KHỚP VỚI LỖI 15%!' : '';
  
  console.log(`\n📋 ${s.desc}`);
  console.log(`   actual:   "${s.actual}" → parseNumber = ${actualNum}`);
  console.log(`   declared: "${s.declared}" → parseNumber = ${declaredNum}`);
  console.log(`   limit:    "${s.limit}"`);
  console.log(`   → Kết quả %: ${pct ?? 'null (không hiển thị)'}${flag}`);
}

// ============================================================
// Test mấu chốt: 15 mg/viên vs CFU/mL
// ============================================================

console.log('\n' + '='.repeat(60));
console.log('PHÂN TÍCH CĂN NGUYÊN LỖI 15%');
console.log('='.repeat(60));

console.log('\n🔍 Trường hợp điển hình sinh ra 15%:');
console.log('   → actualNum = 150,000,000 (CFU/mL)');
console.log('   → baseNum   = 1,000,000,000 (CFU/mL) → % = 15% ✓ (ĐÚNG, nhưng là FAIL vì < tiêu chuẩn)');
console.log('');
console.log('   → actualNum = 1.5e8 (CFU/mL)');
console.log('   → baseNum   = 15 (mg/viên) ← ĐỌC NHẦM declared từ công thức (hàm lượng chất)');
const bugPct = calculateRelativePercentage('150000000', 15, '≥ 10^9');
console.log(`   → Kết quả:  ${bugPct} ← 🚨 ĐÂY MỚI LÀ LỖI!`);

console.log('\n   → actualNum = 1.5e8 (CFU/mL)');
console.log('   → baseNum   = 1e9 (CFU/mL) ← declared đúng từ công thức vi sinh');
const correctPct = calculateRelativePercentage('150000000', 1e9, '≥ 10^9');
console.log(`   → Kết quả đúng:  ${correctPct} ← (15%, lô này thực sự rớt tiêu chuẩn!)`);

console.log('\n' + '='.repeat(60));
console.log('KẾT LUẬN:');
console.log('='.repeat(60));
console.log(`
Kết quả 15% LÀ ĐÚNG về mặt số học nếu:
  actual = 1.5×10⁸ CFU/mL
  declared/basis = 10⁹ CFU/mL

→ Lô 092603 có mật độ Bacillus đạt 15% so với hàm lượng công bố,
  tức là CHỈ ĐẠT 15% yêu cầu → ĐÂY LÀ LÔ KHÔNG ĐẠT.

Nếu ứng dụng hiển thị 15% là ĐÚNG → vậy vấn đề không phải ở code tính %.
Nếu người dùng kỳ vọng % phải > 100% → tiêu chuẩn ≥ 10⁹ không phải là hàm lượng
  công bố 100% mà là ngưỡng tối thiểu. Trong trường hợp này:

  A. Nếu hàm lượng công bố là 1×10⁹ → 15% là đúng (lô FAIL)
  B. Nếu muốn hiển thị "đạt X% tiêu chuẩn tối thiểu" → 15% là đúng (lô FAIL)
  C. Nếu không muốn hiển thị % cho chỉ tiêu vi sinh (≥ X, không có base %) → cần set
     criterion.declaredContent = undefined để hàm trả về null.

KHUYẾN NGHỊ: Không nên hiển thị % cho các chỉ tiêu vi sinh kiểu ≥ X
vì người đọc có thể hiểu nhầm "đạt 15%" là hợp lệ.
`);
