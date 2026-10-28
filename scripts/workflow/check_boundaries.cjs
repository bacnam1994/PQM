/**
 * PQM ARCHITECTURAL BOUNDARY & STATIC GUARD
 *
 * Kiểm tra các ranh giới kiến trúc bất biến:
 * 1. UI Pages, Components, Hooks không được import trực tiếp firebase/database (ngoại trừ sync engine hooks).
 * 2. UI Pages, Components, Hooks không được import trực tiếp Firebase Repositories.
 * 3. UI Pages, Components không được gọi logAuditAction trực tiếp (SSoT audit thuộc về Workflow Executor).
 * 4. AI Services không được import mutation repositories (chỉ được hoạt động theo mô hình Proposal).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const ALLOWED_FIREBASE_DB_FILES = new Set([
  path.join(SRC_DIR, 'hooks', 'useAuthSync.ts'),
  path.join(SRC_DIR, 'hooks', 'useFirebaseSync.ts'),
  path.join(SRC_DIR, 'hooks', 'operational', 'useOperationalWorkflow.ts'),
  path.join(SRC_DIR, 'services', 'databaseService.ts'),
  path.join(SRC_DIR, 'services', 'authService.ts'),
]);

const FORBIDDEN_RULES = [
  {
    id: 'FORBIDDEN_DB_WRITE_IN_UI',
    description: 'Cấm import các hàm mutation (set, push, update, remove) từ firebase/database trong UI/Hooks',
    matcher: (filePath, content) => {
      if (!filePath.includes('/pages/') && !filePath.includes('/components/') && !filePath.includes('/hooks/')) {
        return null;
      }
      const match = content.match(/import\s+{[^}]*\b(set|push|update|remove)\b[^}]*}\s+from\s+['"]firebase\/database['"]/);
      return match ? `Tìm thấy import mutation trực tiếp từ firebase/database: ${match[0]}` : null;
    },
  },
  {
    id: 'FORBIDDEN_REPO_DIRECT_IMPORT_IN_PAGES',
    description: 'Cấm import trực tiếp Firebase Repositories trong UI Pages & Components (phải qua App Service / Facade)',
    matcher: (filePath, content) => {
      if (!filePath.includes('/pages/') && !filePath.includes('/components/')) {
        return null;
      }
      const match = content.match(/from\s+['"][^'"]*(repositories\/firebase\/Firebase|infrastructure\/repositories\/Firebase)[^'"]*['"]/);
      return match ? `Tìm thấy import trực tiếp FirebaseRepository trong UI: ${match[0]}` : null;
    },
  },
  {
    id: 'FORBIDDEN_AUDIT_LOG_IN_UI',
    description: 'Cấm gọi logAuditAction trực tiếp từ UI Pages & Components (Audit phải do Workflow Executor xử lý)',
    matcher: (filePath, content) => {
      // Ngoại trừ trang hiển thị audit log và unit tests
      if (filePath.includes('AuditLogPage') || filePath.includes('.test.') || filePath.includes('__tests__')) {
        return null;
      }
      if (!filePath.includes('/pages/') && !filePath.includes('/components/')) {
        return null;
      }
      const match = content.match(/\blogAuditAction\s*\(/);
      return match ? `Tìm thấy lệnh gọi logAuditAction trực tiếp trong UI: ${match[0]}` : null;
    },
  },
  {
    id: 'FORBIDDEN_AI_MUTATION_REPOS',
    description: 'Cấm AI Services import trực tiếp Repositories để mutate dữ liệu (AI chỉ hoạt động dạng Advisory / Proposal)',
    matcher: (filePath, content) => {
      if (!filePath.includes('/services/ai/tools/')) {
        return null;
      }
      const match = content.match(/from\s+['"][^'"]*repositories\/[^'"]*['"]/);
      return match ? `Tìm thấy import repository trong AI tools: ${match[0]}` : null;
    },
  },
];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

console.log('====================================================');
console.log('🛡️  PQM ARCHITECTURAL BOUNDARY STATIC GUARD');
console.log('====================================================');

const allSourceFiles = getAllFiles(SRC_DIR);
let totalViolations = 0;
const violationsReport = [];

for (const filePath of allSourceFiles) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');

  for (const rule of FORBIDDEN_RULES) {
    const error = rule.matcher(normalizedPath, content);
    if (error) {
      totalViolations++;
      violationsReport.push({
        ruleId: rule.id,
        file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        detail: error,
      });
    }
  }
}

if (totalViolations === 0) {
  console.log(`✅ Đã quét ${allSourceFiles.length} source files.`);
  console.log('🎉 GATE PASSED: 0 vi phạm ranh giới kiến trúc!');
  process.exit(0);
} else {
  console.error(`❌ PHÁT HIỆN ${totalViolations} VI PHẠM RANH GIỚI KIẾN TRÚC:`);
  for (const v of violationsReport) {
    console.error(`- [${v.ruleId}] tại ${v.file}: ${v.detail}`);
  }
  process.exit(1);
}
