/**
 * Script: exportAllSource.js
 * Mục đích: Tổng hợp toàn bộ mã nguồn của dự án PQM thành 1 file duy nhất
 * phục vụ cho việc tra cứu, đọc mã nguồn nội bộ offline trên máy.
 * 
 * Cách chạy:
 *   node scripts/exportAllSource.js
 *   npm run export:source
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE_TXT = path.join(ROOT_DIR, 'FULL_SOURCE_CODE.txt');
const OUTPUT_FILE_MD = path.join(ROOT_DIR, 'FULL_SOURCE_CODE.md');

// 1. Danh sách các file cấu hình và tài liệu ở thư mục gốc
const ROOT_CONFIG_FILES = [
  'PROJECT_OVERVIEW.md',
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'tailwind.config.cjs',
  'postcss.config.cjs',
  'index.html',
  'firebase.json',
  'database.rules.json',
  'storage.rules'
];

// 2. Đệ quy tìm tất cả các file trong thư mục
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// 3. Quy tắc sắp xếp theo nhóm chức năng
function getSortOrder(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'PROJECT_OVERVIEW.md') return '00_overview';
  if (norm.startsWith('package.json') || norm.startsWith('vite.') || norm.startsWith('tsconfig') || norm.startsWith('tailwind') || norm.startsWith('postcss') || norm.startsWith('index.html') || norm.startsWith('firebase') || norm.startsWith('database') || norm.startsWith('storage')) {
    return '01_config_' + norm;
  }
  if (norm === 'src/main.tsx') return '02_core_main';
  if (norm === 'src/App.tsx') return '03_core_app';
  if (norm === 'src/types.ts' || norm.startsWith('src/types/')) return '04_core_types_' + norm;
  if (norm === 'src/index.css') return '05_core_css';
  if (norm.startsWith('src/store/')) return '10_store_' + norm;
  if (norm.startsWith('src/repositories/')) return '15_repos_' + norm;
  if (norm.startsWith('src/services/ai/')) return '20_services_ai_' + norm;
  if (norm.startsWith('src/services/')) return '25_services_' + norm;
  if (norm.startsWith('src/hooks/')) return '30_hooks_' + norm;
  if (norm.startsWith('src/utils/')) return '40_utils_' + norm;
  if (norm.startsWith('src/providers/')) return '50_providers_' + norm;
  if (norm.startsWith('src/components/common/')) return '60_comp_common_' + norm;
  if (norm.startsWith('src/components/features/')) return '62_comp_features_' + norm;
  if (norm.startsWith('src/components/')) return '65_comp_' + norm;
  if (norm.startsWith('src/pages/')) return '70_pages_' + norm;
  return '90_' + norm;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = (bytes / 1024).toFixed(1);
  return kb + ' KB';
}

function run() {
  console.log('🚀 Bắt đầu quét toàn bộ mã nguồn dự án PQM...');

  // Thu thập các file root config hợp lệ
  const allConfigFiles = ROOT_CONFIG_FILES
    .filter(f => fs.existsSync(path.join(ROOT_DIR, f)))
    .map(f => f.replace(/\\/g, '/'));

  // Thu thập tất cả các file trong src/
  const srcFiles = getFilesRecursively(path.join(ROOT_DIR, 'src'))
    .map(f => path.relative(ROOT_DIR, f).replace(/\\/g, '/'));

  // Gộp lại và sắp xếp theo nhóm
  const allFiles = [...allConfigFiles, ...srcFiles].sort((a, b) => {
    return getSortOrder(a).localeCompare(getSortOrder(b));
  });

  console.log(`📦 Tìm thấy tổng cộng ${allFiles.length} file mã nguồn và cấu hình.`);

  // Thu thập thống kê từng file
  let totalLines = 0;
  let totalBytes = 0;
  const fileMetaList = [];

  for (let i = 0; i < allFiles.length; i++) {
    const relPath = allFiles[i];
    const fullPath = path.join(ROOT_DIR, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/).length;
    const stat = fs.statSync(fullPath);

    totalLines += lines;
    totalBytes += stat.size;

    fileMetaList.push({
      index: i + 1,
      relPath,
      fullPath,
      lines,
      bytes: stat.size,
      content
    });
  }

  const now = new Date();
  const dateString = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  // ==========================================
  // XÂY DỰNG NỘI DUNG FILE TXT
  // ==========================================
  const txtHeaderLines = [
    '================================================================================',
    '                   PQM - TỔNG HỢP TOÀN BỘ MÃ NGUỒN HỆ THỐNG                     ',
    '         Phần mềm Quản lý Kiểm nghiệm & Chất lượng Dược phẩm / Biotech           ',
    '================================================================================',
    `Thời gian xuất: ${dateString}`,
    `Tổng số file   : ${allFiles.length} files`,
    `Tổng số dòng   : ${totalLines.toLocaleString()} dòng code`,
    `Tổng dung lượng: ${formatBytes(totalBytes)}`,
    'Mục đích       : Xem và tra cứu toàn bộ mã nguồn nội bộ trên máy cục bộ',
    '--------------------------------------------------------------------------------',
    'CÁCH SỬ DỤNG NHANH:',
    '- Tìm kiếm mã file: Gõ Ctrl+F và tìm ">>> [FILE xxx]" (ví dụ: ">>> [FILE 001]")',
    '- Tìm kiếm theo tên file: Gõ Ctrl+F và tìm tên file (ví dụ: "AutoCreateBatchModal.tsx")',
    '- Trở về mục lục: Gõ Ctrl+F và tìm "MỤC LỤC TOÀN BỘ FILE"',
    '================================================================================\n',
    '================================================================================',
    '                            MỤC LỤC TOÀN BỘ FILE                                ',
    '================================================================================'
  ];

  fileMetaList.forEach(m => {
    const padIdx = String(m.index).padStart(3, '0');
    const padLines = String(m.lines + ' dòng').padEnd(12, ' ');
    const padSize = String(formatBytes(m.bytes)).padEnd(10, ' ');
    txtHeaderLines.push(`[FILE ${padIdx}] ${padLines} | ${padSize} | ${m.relPath}`);
  });

  txtHeaderLines.push('================================================================================\n\n');

  const txtChunks = [txtHeaderLines.join('\n')];

  fileMetaList.forEach(m => {
    const padIdx = String(m.index).padStart(3, '0');
    const totalPadded = String(fileMetaList.length).padStart(3, '0');
    const sep = '='.repeat(80);
    const subSep = '-'.repeat(80);

    const banner = [
      sep,
      `>>> [FILE ${padIdx}/${totalPadded}] ${m.relPath}`,
      subSep,
      `Đường dẫn : ${m.relPath}`,
      `Số dòng   : ${m.lines}`,
      `Dung lượng: ${formatBytes(m.bytes)}`,
      sep,
      m.content,
      subSep,
      `<<< [HẾT FILE ${padIdx}: ${m.relPath}]`,
      sep,
      '\n\n'
    ].join('\n');

    txtChunks.push(banner);
  });

  fs.writeFileSync(OUTPUT_FILE_TXT, txtChunks.join(''), 'utf8');
  console.log(`✅ Đã tạo thành công file TXT: ${OUTPUT_FILE_TXT} (${formatBytes(fs.statSync(OUTPUT_FILE_TXT).size)})`);

  // ==========================================
  // XÂY DỰNG NỘI DUNG FILE MD (Định dạng Markdown đẹp)
  // ==========================================
  const mdHeaderLines = [
    '# PQM - TỔNG HỢP TOÀN BỘ MÃ NGUỒN HỆ THỐNG',
    '',
    `> **Phần mềm Quản lý Kiểm nghiệm & Chất lượng Dược phẩm / Biotech**  `,
    `> **Thời gian xuất**: ${dateString}  `,
    `> **Tổng số file**: ${allFiles.length} files  `,
    `> **Tổng số dòng code**: ${totalLines.toLocaleString()} dòng  `,
    `> **Tổng dung lượng**: ${formatBytes(totalBytes)}  `,
    '',
    '---',
    '',
    '## 📑 Mục lục toàn bộ file',
    '',
    '| STT | File | Số dòng | Kích thước |',
    '| :---: | :--- | :---: | :---: |'
  ];

  fileMetaList.forEach(m => {
    const padIdx = String(m.index).padStart(3, '0');
    const anchor = `file-${padIdx}-${m.relPath.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    mdHeaderLines.push(`| ${padIdx} | [${m.relPath}](#${anchor}) | ${m.lines} | ${formatBytes(m.bytes)} |`);
  });

  mdHeaderLines.push('', '---', '');

  const mdChunks = [mdHeaderLines.join('\n')];

  fileMetaList.forEach(m => {
    const padIdx = String(m.index).padStart(3, '0');
    const totalPadded = String(fileMetaList.length).padStart(3, '0');
    const ext = path.extname(m.relPath).replace('.', '');
    const lang = ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'typescript' : ext === 'css' ? 'css' : ext === 'json' ? 'json' : ext === 'html' ? 'html' : 'text';
    const anchor = `file-${padIdx}-${m.relPath.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    // Đối với markdown nội dung, để không bị vỡ bởi triple backticks, dùng 4 dấu backticks ````
    const fileSection = [
      `### <a id="${anchor}"></a>[FILE ${padIdx}/${totalPadded}] \`${m.relPath}\``,
      '',
      `- **Đường dẫn**: \`${m.relPath}\``,
      `- **Số dòng**: ${m.lines}`,
      `- **Kích thước**: ${formatBytes(m.bytes)}`,
      '',
      '````' + lang,
      m.content,
      '````',
      '',
      `*([Quay lại mục lục](#-mục-lục-toàn-bộ-file))*`,
      '',
      '---',
      ''
    ].join('\n');

    mdChunks.push(fileSection);
  });

  fs.writeFileSync(OUTPUT_FILE_MD, mdChunks.join('\n'), 'utf8');
  console.log(`✅ Đã tạo thành công file MD: ${OUTPUT_FILE_MD} (${formatBytes(fs.statSync(OUTPUT_FILE_MD).size)})`);

  console.log('\n🎉 HOÀN TẤT! Bạn có thể xem mã nguồn tại:');
  console.log(`1. File TXT (Mở nhanh, nhẹ, không lag): ${OUTPUT_FILE_TXT}`);
  console.log(`2. File MD  (Có highlight cú pháp & link mục lục): ${OUTPUT_FILE_MD}`);
}

run();
