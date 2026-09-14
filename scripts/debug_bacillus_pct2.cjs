const SUPERSCRIPTS = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'};
function standardize(str) {
  if (str === null || str === undefined) return '';
  let s = String(str).trim().replace(/[–—]/g,'-');
  s = s.replace(/(\d{1,3}(?:,\d{3})+)\.(\d+)/g, function(_,p1,p2){ return p1.replace(/,/g,'') + '.' + p2; });
  s = s.replace(/(\d{1,3}(?:\.\d{3})+),(\d+)/g, function(_,p1,p2){ return p1.replace(/\./g,'') + '.' + p2; });
  s = s.replace(/(\d{1,3}(?:,\d{3}){2,})/g, function(m){ return m.replace(/,/g,''); });
  s = s.replace(/(\d{1,3}(?:\.\d{3}){2,})/g, function(m){ return m.replace(/\./g,''); });
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');
  return s;
}
function normalize(v) {
  if (v === null || v === undefined) return '';
  let s = standardize(v);
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, function(m) { return '^' + m.split('').map(function(c){ return SUPERSCRIPTS[c]||c; }).join(''); });
  s = s.replace(/([+-]?\d*\.?\d+)\s*[xX*×]\s*10\s*(?:\^)?\s*([+-]?\d+)/gi, function(_,p1,p2){ return String(parseFloat(p1)*Math.pow(10,parseInt(p2,10))); });
  s = s.replace(/(^|[^\d.xX*×])10(?:\s*\^\s*|\s+)([+-]?\d+)/gi, function(_,pre,p1){ return pre + String(Math.pow(10,parseInt(p1,10))); });
  s = s.replace(/([+-]?\d+(\.\d+)?)e([+-]?\d+)/gi, function(m) {
    try { const n=Number(m); if(!isNaN(n)&&Math.abs(n)<1e21) return n.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:20}); } catch(e) {}
    return m;
  });
  return s;
}
function parse(t) {
  if (t === null || t === undefined) return NaN;
  const s = normalize(t).trim();
  const m = s.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

console.log('=== CHỨNG MINH LỖI 15% ===\n');

const actual = '1.5 x 10^8';
const an = parse(actual);
console.log('[THỰC TẾ] actual = "' + actual + '" → ' + an.toExponential() + ' = ' + an);

console.log('\n[TRƯỜNG HỢP 1 - ĐÚNG] basis từ CÔNG THỨC: formulaItem.declaredContent = "10^8"');
const b1 = parse('10^8');
console.log('  parse("10^8") = ' + b1.toExponential() + ' = ' + b1);
const pct1 = Math.round(an/b1*10000)/100;
console.log('  % = ' + an + ' / ' + b1 + ' * 100 = ' + pct1 + '% ← KẾT QUẢ ĐÚNG!');

console.log('\n[TRƯỜNG HỢP 2 - LỖI 15%] basis từ TCCS: criterion.declaredContent = "10^9" (tiêu chuẩn ≥ 10^9)');
const b2 = parse('10^9');
console.log('  parse("10^9") = ' + b2.toExponential() + ' = ' + b2);
const pct2 = Math.round(an/b2*10000)/100;
console.log('  % = ' + an + ' / ' + b2 + ' * 100 = ' + pct2 + '% ← ĐÂY LÀ NGUỒN GỐC LỖI 15%!');

console.log('\n=== ROOT CAUSE ===');
console.log('CoAReport.tsx dòng 548-551:');
console.log('  if (criterion?.declaredContent != null) {');
console.log('    basisForCalculation = parseNumberFromText(criterion.declaredContent); // = 10^9!');
console.log('  }');
console.log('Ưu tiên này cao hơn formulaItem.declaredContent (10^8).');
console.log('→ Dùng ngưỡng tối thiểu TCCS (10^9) làm mẫu số thay vì hàm lượng công bố công thức (10^8).');

console.log('\n=== FIX ===');
console.log('Phương án A: Bỏ criterion.declaredContent trong TCCS mục Tổng Bacillus');
console.log('  → CoAReport sẽ fallback dùng formulaItem.declaredContent = 10^8 → % = 150%');
console.log('Phương án B: Trong CoAReport, ưu tiên formulaItem trước criterion.declaredContent');
console.log('  cho các chỉ tiêu vi sinh có đơn vị CFU (không chia % theo ngưỡng ≥ X)');
