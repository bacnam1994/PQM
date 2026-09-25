/**
 * PQM WORKFLOW MATRICES & CATALOG GENERATOR (PHASE 5 REGENERATION)
 *
 * Tái sinh các tài liệu đặc tả quy chuẩn từ nguồn chân lý SSoT duy nhất:
 * 1. docs/workflow/CANONICAL_ACTION_CATALOG.md
 * 2. docs/workflow/RBAC_CAPABILITY_MATRIX.md
 * 3. docs/workflow/ACTIVITY_TO_ACTION_MATRIX.md
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKFLOW_DIR = path.join(ROOT_DIR, 'docs/workflow');

// Đọc định nghĩa CANONICAL_ACTION_REGISTRY từ src/workflow/definitions/index.ts
const definitionsFilePath = path.join(ROOT_DIR, 'src/workflow/definitions/index.ts');
const definitionsContent = fs.readFileSync(definitionsFilePath, 'utf8');

// Trích xuất metadata của từng Action ID qua Regex Parser an toàn
const actionBlocks = definitionsContent.matchAll(/([A-Z0-9_]+):\s*\{\s*actionId:\s*['"]([A-Z0-9_]+)['"],\s*entityType:\s*['"]([A-Z0-9_]+)['"],\s*category:\s*['"]([A-Z0-9_]+)['"],\s*description:\s*['"]([^'"]+)['"],\s*allowedRoles:\s*\[([^\]]+)\],\s*risk:\s*['"]([A-Z0-9_]+)['"],\s*requiresAudit:\s*(true|false),\s*requiresReason:\s*(true|false),/g);

const actions = [];
for (const match of actionBlocks) {
  const [_, key, actionId, entityType, category, description, rolesRaw, risk, requiresAudit, requiresReason] = match;
  const allowedRoles = rolesRaw.split(',').map(r => r.trim().replace(/['"]/g, ''));
  actions.push({
    actionId,
    entityType,
    category,
    description,
    allowedRoles,
    risk,
    requiresAudit: requiresAudit === 'true',
    requiresReason: requiresReason === 'true',
  });
}

console.log(`Đã trích xuất ${actions.length} Canonical Actions từ definitions/index.ts.`);

// ============================================================
// 1. TẠO CANONICAL_ACTION_CATALOG.md
// ============================================================
let catalogMd = `# 📑 DANH MỤC HÀNH ĐỘNG QUY CHUẨN (CANONICAL ACTION CATALOG)

> **Tài liệu sinh tự động từ Single Source of Truth:** \`src/workflow/definitions/index.ts\`  
> **Tổng số hành động đã chuẩn hóa:** **${actions.length}**  
> **Cập nhật lần cuối:** ${new Date().toISOString().split('T')[0]}

---

| Action ID | Thực thể (Entity) | Phân loại | Mức rủi ro | Vai trò thẩm quyền (Allowed Roles) | Audit Trail | Bắt buộc Lý do | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- |
`;

actions.forEach(a => {
  const riskBadge = a.risk === 'HIGH' ? '🔴 HIGH' : a.risk === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW/NONE';
  catalogMd += `| \`${a.actionId}\` | \`${a.entityType}\` | \`${a.category}\` | ${riskBadge} | \`${a.allowedRoles.join(', ')}\` | ${a.requiresAudit ? '✅' : '❌'} | ${a.requiresReason ? '✅' : '❌'} | ${a.description} |\n`;
});

fs.writeFileSync(path.join(WORKFLOW_DIR, 'CANONICAL_ACTION_CATALOG.md'), catalogMd, 'utf8');
console.log('✅ Đã xuất: docs/workflow/CANONICAL_ACTION_CATALOG.md');

// ============================================================
// 2. TẠO RBAC_CAPABILITY_MATRIX.md
// ============================================================
const ROLES = ['ADMIN', 'QA', 'QC', 'LAB', 'PRODUCTION', 'USER', 'VIEWER', 'GUEST'];

let rbacMd = `# 🛡️ MA TRẬN THẨM QUYỀN HÀNH ĐỘNG (RBAC CAPABILITY MATRIX)

> **Tài liệu sinh tự động từ Single Source of Truth:** \`src/workflow/definitions/index.ts\`  
> **Số vai trò chuẩn hóa:** **8** (\`ADMIN\`, \`QA\`, \`QC\`, \`LAB\`, \`PRODUCTION\`, \`USER\`, \`VIEWER\`, \`GUEST\`)  
> **Cập nhật lần cuối:** ${new Date().toISOString().split('T')[0]}

---

| Action ID | Entity | ADMIN | QA | QC | LAB | PROD | USER | VIEWER | GUEST |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

actions.forEach(a => {
  const hasRole = (role) => a.allowedRoles.includes(role) || a.allowedRoles.includes('ADMIN');
  const cells = ROLES.map(r => a.allowedRoles.includes(r) ? '✅' : '—').join(' | ');
  rbacMd += `| \`${a.actionId}\` | \`${a.entityType}\` | ${cells} |\n`;
});

fs.writeFileSync(path.join(WORKFLOW_DIR, 'RBAC_CAPABILITY_MATRIX.md'), rbacMd, 'utf8');
console.log('✅ Đã xuất: docs/workflow/RBAC_CAPABILITY_MATRIX.md');

// ============================================================
// 3. TẠO ACTIVITY_TO_ACTION_MATRIX.md (TỪ ACTIVITY_INVENTORY.json)
// ============================================================
const inventoryPath = path.join(WORKFLOW_DIR, 'ACTIVITY_INVENTORY.json');
if (fs.existsSync(inventoryPath)) {
  const inventoryData = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const activities = inventoryData.activities || [];

  let matrixMd = `# 🔗 MA TRẬN ÁNH XẠ HOẠT ĐỘNG SANG WORKFLOW ACTION (ACTIVITY TO ACTION MATRIX)

> **Tài liệu sinh tự động từ Single Source of Truth:** \`docs/workflow/ACTIVITY_INVENTORY.json\`  
> **Tổng số hoạt động quét được:** **${activities.length}**  
> **Cập nhật lần cuối:** ${new Date().toISOString().split('T')[0]}

---

| Activity ID | Loại hoạt động | Điểm kích hoạt trong mã (Location) | Thực thể | Mutation? | Đường dẫn hiện tại | Canonical Action ID | Vai trò tối thiểu | Rủi ro |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: | :---: |
`;

  activities.forEach(act => {
    matrixMd += `| \`${act.id}\` | \`${act.category}\` | \`${act.location}\` | \`${act.entity}\` | ${act.mutation ? '✅' : '❌'} | \`${act.currentPath}\` | \`${act.desiredAction}\` | \`${act.ownerRole}\` | \`${act.risk}\` |\n`;
  });

  fs.writeFileSync(path.join(WORKFLOW_DIR, 'ACTIVITY_TO_ACTION_MATRIX.md'), matrixMd, 'utf8');
  console.log('✅ Đã xuất: docs/workflow/ACTIVITY_TO_ACTION_MATRIX.md');
}

console.log('🎉 Hoàn thành tái sinh toàn bộ ma trận quy trình Workflow!');
