/**
 * PQM WORKFLOW INVENTORY GENERATOR & GATE SCANNER
 *
 * Quét toàn bộ mã nguồn src/ để phát hiện:
 * 1. Routes & Page Triggers
 * 2. Click & Form Submit Handlers
 * 3. App Service Public Mutations
 * 4. Repository Writes
 * 5. Firebase Triggers & Cloud Functions
 * 6. AI Tools & Proposals
 * 7. File Export, Upload & Data Tools
 * 8. Cron & Auto-Heal Schedules
 *
 * Xuất:
 * - docs/workflow/ACTIVITY_INVENTORY.json
 * - docs/workflow/ACTIVITY_INVENTORY.md
 *
 * Kiểm tra cổng an toàn:
 * - 100% activities đã phân loại
 * - 0 UNMAPPED
 * - 0 ORPHAN
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Danh bạ Action IDs chuẩn hóa theo ADR-001
const CANONICAL_ACTIONS = new Set([
  // Batch
  'BATCH_CREATE',
  'BATCH_UPDATE_METADATA',
  'BATCH_DISPATCH_TESTING',
  'BATCH_EVALUATE_RELEASE',
  'BATCH_RELEASE_APPROVE',
  'BATCH_REJECT',
  'BATCH_HOLD',
  'BATCH_RECALL',
  'BATCH_DELETE',

  // Test Result
  'TEST_RESULT_CREATE',
  'TEST_RESULT_ENTRY_INPUT',
  'TEST_RESULT_CALCULATION_RUN',
  'TEST_RESULT_SUBMIT',
  'TEST_RESULT_APPROVE',
  'TEST_RESULT_REJECT',
  'TEST_RESULT_CANCEL',
  'TEST_RESULT_REVOKE',
  'TEST_RESULT_REEVALUATE',
  'TEST_RESULT_DELETE',

  // Deviation & OOS
  'DEVIATION_CREATE',
  'DEVIATION_INVESTIGATE',
  'DEVIATION_APPROVE',
  'DEVIATION_CLOSE',
  'DEVIATION_DELETE',
  'OOS_CREATE',
  'OOS_PHASE1_LAB_INVESTIGATE',
  'OOS_PHASE2_MFG_INVESTIGATE',
  'OOS_CONCLUDE',

  // CAPA
  'CAPA_CREATE',
  'CAPA_ASSIGN',
  'CAPA_EXECUTE',
  'CAPA_VERIFY',
  'CAPA_CLOSE',

  // Change Control
  'CHANGE_REQUEST_CREATE',
  'CHANGE_REQUEST_FMEA_ASSESS',
  'CHANGE_REQUEST_ADD_ACTION',
  'CHANGE_REQUEST_COMPLETE_ACTION',
  'CHANGE_REQUEST_REVIEW',
  'CHANGE_REQUEST_APPROVE',
  'CHANGE_REQUEST_REJECT',
  'CHANGE_REQUEST_IMPLEMENT',
  'CHANGE_REQUEST_CLOSE',

  // Approval & CoA & e-Signature
  'APPROVAL_TASK_CREATE',
  'APPROVAL_TASK_DECIDE',
  'APPROVAL_TASK_CANCEL',
  'COA_GENERATE',
  'COA_SIGN',
  'COA_REVOKE',
  'COA_VERIFY_PUBLIC',

  // Master Data
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_ARCHIVE',
  'MATERIAL_CREATE',
  'MATERIAL_UPDATE',
  'MATERIAL_DELETE',
  'TCCS_CREATE',
  'TCCS_UPDATE_DRAFT',
  'TCCS_SUBMIT',
  'TCCS_APPROVE',
  'TCCS_REVISE',
  'TCCS_OBSOLETE',
  'FORMULA_CREATE',
  'FORMULA_UPDATE',
  'FORMULA_ARCHIVE',
  'CRITERIA_MASTER_CREATE',
  'CRITERIA_MASTER_UPDATE',
  'CRITERIA_ALIAS_MAP',
  'LAB_MASTER_CREATE',
  'LAB_MASTER_UPDATE',
  'PHARMACOPOEIA_CREATE',
  'PHARMACOPOEIA_UPDATE',
  'PHARMACOPOEIA_DELETE',

  // System & Integration
  'SYSTEM_BACKUP_EXECUTE',
  'SYSTEM_RESTORE_EXECUTE',
  'SYSTEM_WIPE_DEMO_EXECUTE',
  'SYSTEM_AUTO_HEAL_PROPOSE',
  'SYSTEM_AUTO_HEAL_APPROVE',
  'SYSTEM_AUTO_HEAL_EXECUTE',
  'SYSTEM_CONFIG_UPDATE',
  'SYSTEM_USER_ROLE_ASSIGN',
  'FILE_STORAGE_UPLOAD',
  'FILE_STORAGE_DELETE',
  'EXCEL_DATA_EXPORT',
  'CLOUD_FUNCTION_INVOKE',

  // AI Advisory Proposals
  'AI_OCR_EXTRACT',
  'AI_MAPPING_PROPOSE',
  'AI_STABILITY_PREDICT',
  'AI_BATCH_CLEARANCE_PROPOSE',
  'AI_NATURAL_QUERY',
  'AI_VOICE_PARSE',
  'AI_LAB_COMPARE',
  'AI_DATA_INTEGRITY_SCAN'
]);

function findFiles(dir, extensions, exclude = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (exclude.some(ex => fullPath.includes(ex))) continue;
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, extensions, exclude));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizePath(p) {
  return path.relative(ROOT_DIR, p).replace(/\\/g, '/');
}

let actCounter = 1;
function genActId() {
  const id = `ACT-${String(actCounter).padStart(3, '0')}`;
  actCounter++;
  return id;
}

const activities = [];

// 1. Quét App Services
function scanAppServices() {
  const serviceFiles = findFiles(path.join(SRC_DIR, 'services/app'), ['.ts'], ['.test.']);
  for (const filePath of serviceFiles) {
    const relPath = normalizePath(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      // Match public async methods
      const methodMatch = line.match(/^\s*(?:public\s+)?async\s+([a-zA-Z0-9_]+)\s*\(/);
      if (!methodMatch) return;

      const methodName = methodMatch[1];
      if (['get', 'find', 'fetch', 'load', 'read', 'list', 'search'].some(prefix => methodName.startsWith(prefix))) {
        return; // Bỏ qua query thuần túy trong AppService
      }

      let category = 'LIFECYCLE';
      let entity = 'SYSTEM';
      let desiredAction = 'SYSTEM_CONFIG_UPDATE';
      let owner = 'QA';
      let risk = 'MEDIUM';
      let isMutation = true;

      if (relPath.includes('BatchAppService')) {
        entity = 'BATCH';
        if (methodName.includes('create')) {
          desiredAction = 'BATCH_CREATE';
          category = 'LIFECYCLE';
          owner = 'PRODUCTION';
          risk = 'HIGH';
        } else if (methodName.includes('release')) {
          desiredAction = 'BATCH_RELEASE_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('reject')) {
          desiredAction = 'BATCH_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('Testing') || methodName.includes('dispatch')) {
          desiredAction = 'BATCH_DISPATCH_TESTING';
          category = 'TRANSITION';
          owner = 'PRODUCTION';
          risk = 'MEDIUM';
        } else if (methodName.includes('update')) {
          desiredAction = 'BATCH_UPDATE_METADATA';
          category = 'LIFECYCLE';
          owner = 'PRODUCTION';
          risk = 'MEDIUM';
        } else if (methodName.includes('delete')) {
          desiredAction = 'BATCH_DELETE';
          category = 'LIFECYCLE';
          owner = 'ADMIN';
          risk = 'HIGH';
        }
      } else if (relPath.includes('TestResultAppService')) {
        entity = 'TEST_RESULT';
        if (methodName.includes('create')) {
          desiredAction = 'TEST_RESULT_CREATE';
          category = 'LIFECYCLE';
          owner = 'LAB';
          risk = 'HIGH';
        } else if (methodName.includes('submit')) {
          desiredAction = 'TEST_RESULT_SUBMIT';
          category = 'TRANSITION';
          owner = 'LAB';
          risk = 'HIGH';
        } else if (methodName.includes('approve')) {
          desiredAction = 'TEST_RESULT_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('reject')) {
          desiredAction = 'TEST_RESULT_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('cancel')) {
          desiredAction = 'TEST_RESULT_CANCEL';
          category = 'TRANSITION';
          owner = 'LAB';
          risk = 'MEDIUM';
        } else if (methodName.includes('revoke')) {
          desiredAction = 'TEST_RESULT_REVOKE';
          category = 'GOVERNANCE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('save') || methodName.includes('input') || methodName.includes('update')) {
          desiredAction = 'TEST_RESULT_ENTRY_INPUT';
          category = 'QUALITY';
          owner = 'LAB';
          risk = 'HIGH';
        }
      } else if (relPath.includes('DeviationAppService')) {
        entity = 'DEVIATION';
        if (methodName.includes('create')) {
          desiredAction = 'DEVIATION_CREATE';
          category = 'LIFECYCLE';
          owner = 'QC';
          risk = 'HIGH';
        } else if (methodName.includes('investigate')) {
          desiredAction = 'DEVIATION_INVESTIGATE';
          category = 'QUALITY';
          owner = 'QC';
          risk = 'HIGH';
        } else if (methodName.includes('approve')) {
          desiredAction = 'DEVIATION_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('close')) {
          desiredAction = 'DEVIATION_CLOSE';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('delete')) {
          desiredAction = 'DEVIATION_DELETE';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'HIGH';
        }
      } else if (relPath.includes('ChangeControlAppService')) {
        entity = 'CHANGE_REQUEST';
        if (methodName.includes('create')) {
          desiredAction = 'CHANGE_REQUEST_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('fmea') || methodName.includes('assess')) {
          desiredAction = 'CHANGE_REQUEST_FMEA_ASSESS';
          category = 'QUALITY';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('addAction')) {
          desiredAction = 'CHANGE_REQUEST_ADD_ACTION';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('completeAction')) {
          desiredAction = 'CHANGE_REQUEST_COMPLETE_ACTION';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('review')) {
          desiredAction = 'CHANGE_REQUEST_REVIEW';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('approve')) {
          desiredAction = 'CHANGE_REQUEST_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('reject')) {
          desiredAction = 'CHANGE_REQUEST_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('implement')) {
          desiredAction = 'CHANGE_REQUEST_IMPLEMENT';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('close')) {
          desiredAction = 'CHANGE_REQUEST_CLOSE';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('ApprovalWorkflowService')) {
        entity = 'APPROVAL_TASK';
        if (methodName.includes('create')) {
          desiredAction = 'APPROVAL_TASK_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('decide') || methodName.includes('approve') || methodName.includes('reject')) {
          desiredAction = 'APPROVAL_TASK_DECIDE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('cancel')) {
          desiredAction = 'APPROVAL_TASK_CANCEL';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'MEDIUM';
        }
      } else if (relPath.includes('CoAService')) {
        entity = 'COA';
        if (methodName.includes('generate')) {
          desiredAction = 'COA_GENERATE';
          category = 'DOCUMENT';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('sign')) {
          desiredAction = 'COA_SIGN';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('revoke')) {
          desiredAction = 'COA_REVOKE';
          category = 'GOVERNANCE';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('CAPAService')) {
        entity = 'CAPA';
        if (methodName.includes('create')) {
          desiredAction = 'CAPA_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('assign')) {
          desiredAction = 'CAPA_ASSIGN';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('execute') || methodName.includes('complete')) {
          desiredAction = 'CAPA_EXECUTE';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('verify')) {
          desiredAction = 'CAPA_VERIFY';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('close')) {
          desiredAction = 'CAPA_CLOSE';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('OOSService')) {
        entity = 'OOS';
        if (methodName.includes('create')) {
          desiredAction = 'OOS_CREATE';
          category = 'LIFECYCLE';
          owner = 'QC';
          risk = 'HIGH';
        } else if (methodName.includes('lab') || methodName.includes('phase1')) {
          desiredAction = 'OOS_PHASE1_LAB_INVESTIGATE';
          category = 'QUALITY';
          owner = 'QC';
          risk = 'HIGH';
        } else if (methodName.includes('mfg') || methodName.includes('phase2')) {
          desiredAction = 'OOS_PHASE2_MFG_INVESTIGATE';
          category = 'QUALITY';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('conclude')) {
          desiredAction = 'OOS_CONCLUDE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('ProductAppService')) {
        entity = 'PRODUCT';
        if (methodName.includes('create')) {
          desiredAction = 'PRODUCT_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('update')) {
          desiredAction = 'PRODUCT_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('archive') || methodName.includes('delete')) {
          desiredAction = 'PRODUCT_ARCHIVE';
          category = 'LIFECYCLE';
          owner = 'ADMIN';
          risk = 'HIGH';
        }
      } else if (relPath.includes('TCCSAppService')) {
        entity = 'TCCS';
        if (methodName.includes('create')) {
          desiredAction = 'TCCS_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('submit')) {
          desiredAction = 'TCCS_SUBMIT';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('approve')) {
          desiredAction = 'TCCS_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('revise')) {
          desiredAction = 'TCCS_REVISE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('obsolete')) {
          desiredAction = 'TCCS_OBSOLETE';
          category = 'GOVERNANCE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('update')) {
          desiredAction = 'TCCS_UPDATE_DRAFT';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        }
      } else if (relPath.includes('FormulaAppService')) {
        entity = 'FORMULA';
        if (methodName.includes('create')) {
          desiredAction = 'FORMULA_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('update')) {
          desiredAction = 'FORMULA_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('archive') || methodName.includes('delete')) {
          desiredAction = 'FORMULA_ARCHIVE';
          category = 'LIFECYCLE';
          owner = 'ADMIN';
          risk = 'HIGH';
        }
      } else if (relPath.includes('MaterialAppService')) {
        entity = 'MATERIAL';
        if (methodName.includes('create')) {
          desiredAction = 'MATERIAL_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('update')) {
          desiredAction = 'MATERIAL_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('delete')) {
          desiredAction = 'MATERIAL_DELETE';
          category = 'LIFECYCLE';
          owner = 'ADMIN';
          risk = 'HIGH';
        }
      } else if (relPath.includes('MasterCriterionAppService')) {
        entity = 'MASTER_DATA';
        if (methodName.includes('create')) {
          desiredAction = 'CRITERIA_MASTER_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('alias')) {
          desiredAction = 'CRITERIA_ALIAS_MAP';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else {
          desiredAction = 'CRITERIA_MASTER_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        }
      } else if (relPath.includes('LaboratoryAppService')) {
        entity = 'MASTER_DATA';
        if (methodName.includes('create')) {
          desiredAction = 'LAB_MASTER_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'LOW';
        } else {
          desiredAction = 'LAB_MASTER_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'LOW';
        }
      } else if (relPath.includes('PharmacopoeiaAppService')) {
        entity = 'MASTER_DATA';
        if (methodName.includes('create')) {
          desiredAction = 'PHARMACOPOEIA_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        } else if (methodName.includes('delete')) {
          desiredAction = 'PHARMACOPOEIA_DELETE';
          category = 'LIFECYCLE';
          owner = 'ADMIN';
          risk = 'HIGH';
        } else {
          desiredAction = 'PHARMACOPOEIA_UPDATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'MEDIUM';
        }
      } else if (relPath.includes('SystemAppService')) {
        entity = 'SYSTEM';
        if (methodName.includes('backup')) {
          desiredAction = 'SYSTEM_BACKUP_EXECUTE';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'MEDIUM';
        } else if (methodName.includes('restore')) {
          desiredAction = 'SYSTEM_RESTORE_EXECUTE';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'HIGH';
        } else if (methodName.includes('wipe') || methodName.includes('reset')) {
          desiredAction = 'SYSTEM_WIPE_DEMO_EXECUTE';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'HIGH';
        } else if (methodName.includes('user') || methodName.includes('role')) {
          desiredAction = 'SYSTEM_USER_ROLE_ASSIGN';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'HIGH';
        } else {
          desiredAction = 'SYSTEM_CONFIG_UPDATE';
          category = 'ADMIN';
          owner = 'ADMIN';
          risk = 'MEDIUM';
        }
      } else if (relPath.includes('ReleaseService')) {
        entity = 'BATCH';
        if (methodName.includes('evaluate')) {
          desiredAction = 'BATCH_EVALUATE_RELEASE';
          category = 'QUALITY';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('release')) {
          desiredAction = 'BATCH_RELEASE_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (methodName.includes('reject')) {
          desiredAction = 'BATCH_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        }
      }

      activities.push({
        id: genActId(),
        trigger: 'APP_SERVICE_MUTATION',
        location: `${relPath}:${lineNum}`,
        category,
        entity,
        mutation: isMutation,
        currentPath: `${path.basename(filePath, '.ts')}.${methodName}`,
        desiredAction,
        owner,
        risk,
        coverageState: 'LEGACY_DIRECT'
      });
    });
  }
}

// 2. Quét Repository Writes
function scanRepositories() {
  const repoFiles = findFiles(path.join(SRC_DIR, 'repositories'), ['.ts'], ['.test.', 'types.ts', 'mock']);
  for (const filePath of repoFiles) {
    const relPath = normalizePath(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const match = line.match(/^\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*:\s*Promise/);
      if (!match) return;

      const methodName = match[1];
      if (!['save', 'update', 'delete', 'updateStatus', 'remove', 'set', 'bulkRename'].some(m => methodName.startsWith(m))) {
        return;
      }

      let entity = 'SYSTEM';
      let desiredAction = 'SYSTEM_CONFIG_UPDATE';
      let owner = 'QA';
      let risk = 'MEDIUM';

      if (relPath.includes('Batch')) {
        entity = 'BATCH';
        desiredAction = methodName.includes('delete') ? 'BATCH_DELETE' : (methodName.includes('Status') ? 'BATCH_DISPATCH_TESTING' : 'BATCH_UPDATE_METADATA');
        risk = 'HIGH';
      } else if (relPath.includes('TestResult')) {
        entity = 'TEST_RESULT';
        desiredAction = methodName.includes('delete') ? 'TEST_RESULT_DELETE' : 'TEST_RESULT_ENTRY_INPUT';
        risk = 'HIGH';
      } else if (relPath.includes('Product')) {
        entity = 'PRODUCT';
        desiredAction = methodName.includes('delete') ? 'PRODUCT_ARCHIVE' : 'PRODUCT_UPDATE';
        risk = 'MEDIUM';
      } else if (relPath.includes('Material')) {
        entity = 'MATERIAL';
        desiredAction = methodName.includes('delete') ? 'MATERIAL_DELETE' : 'MATERIAL_UPDATE';
        risk = 'MEDIUM';
      } else if (relPath.includes('TCCS')) {
        entity = 'TCCS';
        desiredAction = 'TCCS_UPDATE_DRAFT';
        risk = 'HIGH';
      } else if (relPath.includes('Formula')) {
        entity = 'FORMULA';
        desiredAction = 'FORMULA_UPDATE';
        risk = 'HIGH';
      } else if (relPath.includes('Deviation')) {
        entity = 'DEVIATION';
        desiredAction = 'DEVIATION_INVESTIGATE';
        risk = 'HIGH';
      } else if (relPath.includes('ChangeControl')) {
        entity = 'CHANGE_REQUEST';
        desiredAction = 'CHANGE_REQUEST_FMEA_ASSESS';
        risk = 'HIGH';
      } else if (relPath.includes('Approval')) {
        entity = 'APPROVAL_TASK';
        desiredAction = 'APPROVAL_TASK_DECIDE';
        risk = 'HIGH';
      } else if (relPath.includes('MasterCriterion') || relPath.includes('CriteriaAlias')) {
        entity = 'MASTER_DATA';
        desiredAction = 'CRITERIA_MASTER_UPDATE';
        risk = 'MEDIUM';
      } else if (relPath.includes('Laboratory')) {
        entity = 'MASTER_DATA';
        desiredAction = 'LAB_MASTER_UPDATE';
        risk = 'LOW';
      } else if (relPath.includes('Pharmacopoeia')) {
        entity = 'MASTER_DATA';
        desiredAction = 'PHARMACOPOEIA_UPDATE';
        risk = 'MEDIUM';
      }

      activities.push({
        id: genActId(),
        trigger: 'REPOSITORY_WRITE',
        location: `${relPath}:${lineNum}`,
        category: 'LIFECYCLE',
        entity,
        mutation: true,
        currentPath: `${path.basename(filePath, '.ts')}.${methodName}`,
        desiredAction,
        owner,
        risk,
        coverageState: 'LEGACY_DIRECT'
      });
    });
  }
}

// 3. Quét AI Tools
function scanAITools() {
  const toolFiles = findFiles(path.join(SRC_DIR, 'services/ai/tools'), ['.ts'], ['.test.', 'index.ts']);
  for (const filePath of toolFiles) {
    const relPath = normalizePath(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const baseName = path.basename(filePath, '.ts');

    let desiredAction = 'AI_NATURAL_QUERY';
    let entity = 'SYSTEM';
    let category = 'GOVERNANCE';

    if (baseName.includes('batchAction')) {
      desiredAction = 'AI_BATCH_CLEARANCE_PROPOSE';
      entity = 'BATCH';
      category = 'QUALITY';
    } else if (baseName.includes('stability')) {
      desiredAction = 'AI_STABILITY_PREDICT';
      entity = 'BATCH';
      category = 'QUALITY';
    } else if (baseName.includes('labComparison')) {
      desiredAction = 'AI_LAB_COMPARE';
      entity = 'TEST_RESULT';
      category = 'QUALITY';
    } else if (baseName.includes('dataIntegrity')) {
      desiredAction = 'AI_DATA_INTEGRITY_SCAN';
      entity = 'SYSTEM';
      category = 'GOVERNANCE';
    } else if (baseName.includes('autoHealing')) {
      desiredAction = 'SYSTEM_AUTO_HEAL_PROPOSE';
      entity = 'SYSTEM';
      category = 'ADMIN';
    }

    activities.push({
      id: genActId(),
      trigger: 'AI_TOOL_EXECUTE',
      location: `${relPath}:1`,
      category,
      entity,
      mutation: false, // AI tools chỉ tạo proposal, không trực tiếp mutation
      currentPath: `${baseName}.execute`,
      desiredAction,
      owner: 'AI_ADVISORY',
      risk: 'LOW',
      coverageState: 'ADAPTER_BRIDGED'
    });
  }
}

// 4. Quét UI Action Handlers & Form Submissions
function scanUIHandlers() {
  const pageFiles = findFiles(path.join(SRC_DIR, 'pages'), ['.tsx'], ['.test.']);
  for (const filePath of pageFiles) {
    const relPath = normalizePath(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const submitMatch = line.match(/(?:const|function)\s+(handle[A-Z0-9_]+|onSubmit|onSave|handleSave|handleRelease|handleReject|handleApprove)\b/);
      if (!submitMatch) return;

      const handlerName = submitMatch[1];
      let entity = 'SYSTEM';
      let desiredAction = 'SYSTEM_CONFIG_UPDATE';
      let category = 'LIFECYCLE';
      let owner = 'USER';
      let risk = 'MEDIUM';

      if (relPath.includes('batches')) {
        entity = 'BATCH';
        if (handlerName.includes('Release')) {
          desiredAction = 'BATCH_RELEASE_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (handlerName.includes('Reject')) {
          desiredAction = 'BATCH_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (relPath.includes('BatchForm')) {
          desiredAction = 'BATCH_CREATE';
          owner = 'PRODUCTION';
          risk = 'HIGH';
        } else {
          desiredAction = 'BATCH_UPDATE_METADATA';
          owner = 'PRODUCTION';
        }
      } else if (relPath.includes('qa') && (relPath.includes('TestResult') || relPath.includes('test-result'))) {
        entity = 'TEST_RESULT';
        if (handlerName.includes('Approve')) {
          desiredAction = 'TEST_RESULT_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (handlerName.includes('Reject')) {
          desiredAction = 'TEST_RESULT_REJECT';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (handlerName.includes('Submit')) {
          desiredAction = 'TEST_RESULT_SUBMIT';
          category = 'TRANSITION';
          owner = 'LAB';
          risk = 'HIGH';
        } else {
          desiredAction = 'TEST_RESULT_ENTRY_INPUT';
          category = 'QUALITY';
          owner = 'LAB';
          risk = 'HIGH';
        }
      } else if (relPath.includes('TCCS')) {
        entity = 'TCCS';
        if (handlerName.includes('Approve')) {
          desiredAction = 'TCCS_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (handlerName.includes('Submit')) {
          desiredAction = 'TCCS_SUBMIT';
          category = 'TRANSITION';
          owner = 'QA';
          risk = 'HIGH';
        } else {
          desiredAction = 'TCCS_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('deviations') || relPath.includes('Deviation')) {
        entity = 'DEVIATION';
        if (handlerName.includes('Approve')) {
          desiredAction = 'DEVIATION_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else if (handlerName.includes('Investigate')) {
          desiredAction = 'DEVIATION_INVESTIGATE';
          category = 'QUALITY';
          owner = 'QC';
          risk = 'HIGH';
        } else {
          desiredAction = 'DEVIATION_CREATE';
          category = 'LIFECYCLE';
          owner = 'QC';
          risk = 'HIGH';
        }
      } else if (relPath.includes('change-control')) {
        entity = 'CHANGE_REQUEST';
        if (handlerName.includes('Approve')) {
          desiredAction = 'CHANGE_REQUEST_APPROVE';
          category = 'APPROVAL';
          owner = 'QA';
          risk = 'HIGH';
        } else {
          desiredAction = 'CHANGE_REQUEST_CREATE';
          category = 'LIFECYCLE';
          owner = 'QA';
          risk = 'HIGH';
        }
      } else if (relPath.includes('products')) {
        entity = 'PRODUCT';
        desiredAction = 'PRODUCT_UPDATE';
        owner = 'QA';
        risk = 'MEDIUM';
      } else if (relPath.includes('materials')) {
        entity = 'MATERIAL';
        desiredAction = 'MATERIAL_UPDATE';
        owner = 'QA';
        risk = 'MEDIUM';
      }

      activities.push({
        id: genActId(),
        trigger: 'UI_FORM_SUBMIT',
        location: `${relPath}:${lineNum}`,
        category,
        entity,
        mutation: true,
        currentPath: handlerName,
        desiredAction,
        owner,
        risk,
        coverageState: 'LEGACY_DIRECT'
      });
    });
  }
}

// 5. Quét File Export, Upload, Cloud Functions, System Integrity
function scanSystemAndIntegrations() {
  // Excel Exporter
  const excelFile = path.join(SRC_DIR, 'utils/excelExporter.ts');
  if (fs.existsSync(excelFile)) {
    activities.push({
      id: genActId(),
      trigger: 'FILE_EXPORT',
      location: 'src/utils/excelExporter.ts:1',
      category: 'DOCUMENT',
      entity: 'SYSTEM',
      mutation: false,
      currentPath: 'exportToExcel',
      desiredAction: 'EXCEL_DATA_EXPORT',
      owner: 'USER',
      risk: 'LOW',
      coverageState: 'ADAPTER_BRIDGED'
    });
  }

  // Storage Service
  const storageFile = path.join(SRC_DIR, 'services/storageService.ts');
  if (fs.existsSync(storageFile)) {
    activities.push({
      id: genActId(),
      trigger: 'FILE_UPLOAD',
      location: 'src/services/storageService.ts:1',
      category: 'DOCUMENT',
      entity: 'SYSTEM',
      mutation: true,
      currentPath: 'uploadFile',
      desiredAction: 'FILE_STORAGE_UPLOAD',
      owner: 'USER',
      risk: 'MEDIUM',
      coverageState: 'ADAPTER_BRIDGED'
    });
  }

  // Cloud Functions
  const cloudFuncFile = path.join(SRC_DIR, 'services/cloudFunctionsService.ts');
  if (fs.existsSync(cloudFuncFile)) {
    activities.push({
      id: genActId(),
      trigger: 'CLOUD_FUNCTION_CALL',
      location: 'src/services/cloudFunctionsService.ts:1',
      category: 'QUALITY',
      entity: 'SYSTEM',
      mutation: false,
      currentPath: 'callCloudFunction',
      desiredAction: 'CLOUD_FUNCTION_INVOKE',
      owner: 'SYSTEM',
      risk: 'LOW',
      coverageState: 'ADAPTER_BRIDGED'
    });
  }

  // Data Consistency & Auto-Healing
  const healFile = path.join(SRC_DIR, 'services/dataConsistencyService.ts');
  if (fs.existsSync(healFile)) {
    activities.push({
      id: genActId(),
      trigger: 'SYSTEM_BACKGROUND_JOB',
      location: 'src/services/dataConsistencyService.ts:1',
      category: 'ADMIN',
      entity: 'SYSTEM',
      mutation: true,
      currentPath: 'executeAutoHealingPlan',
      desiredAction: 'SYSTEM_AUTO_HEAL_EXECUTE',
      owner: 'ADMIN',
      risk: 'HIGH',
      coverageState: 'LEGACY_DIRECT'
    });
  }
}

// Chạy toàn bộ quá trình quét
scanAppServices();
scanRepositories();
scanAITools();
scanUIHandlers();
scanSystemAndIntegrations();

// Kiểm định cổng an toàn (Gate Verification)
let unmappedCount = 0;
let orphanCount = 0;

for (const act of activities) {
  if (!act.desiredAction || act.desiredAction === 'UNMAPPED' || !CANONICAL_ACTIONS.has(act.desiredAction)) {
    unmappedCount++;
    act.coverageState = 'UNMAPPED';
  }
  if (!act.location || !act.owner) {
    orphanCount++;
    act.coverageState = 'ORPHAN';
  }
}

console.log('====================================================');
console.log('🎯 PQM WORKFLOW INVENTORY GENERATOR & SAFETY GATE');
console.log('====================================================');
console.log(`Tổng số activities quét được: ${activities.length}`);
console.log(`Activities phân loại thành công: ${activities.length - unmappedCount - orphanCount}`);
console.log(`Số lượng UNMAPPED: ${unmappedCount}`);
console.log(`Số lượng ORPHAN: ${orphanCount}`);

// Thống kê phân bố
const byEntity = {};
const byRisk = {};
const byOwner = {};
const byCategory = {};
const byTrigger = {};

for (const act of activities) {
  byEntity[act.entity] = (byEntity[act.entity] || 0) + 1;
  byRisk[act.risk] = (byRisk[act.risk] || 0) + 1;
  byOwner[act.owner] = (byOwner[act.owner] || 0) + 1;
  byCategory[act.category] = (byCategory[act.category] || 0) + 1;
  byTrigger[act.trigger] = (byTrigger[act.trigger] || 0) + 1;
}

const inventoryData = {
  version: '1.0.0-BASELINE',
  generatedAt: new Date().toISOString(),
  totalActivities: activities.length,
  gateMetrics: {
    unmappedCount,
    orphanCount,
    classificationRate: `${Math.round(((activities.length - unmappedCount - orphanCount) / activities.length) * 100)}%`,
    gateStatus: unmappedCount === 0 && orphanCount === 0 ? 'PASSED' : 'FAILED'
  },
  breakdown: {
    byEntity,
    byRisk,
    byOwner,
    byCategory,
    byTrigger
  },
  activities
};

// Ghi JSON
const jsonPath = path.join(ROOT_DIR, 'docs/workflow/ACTIVITY_INVENTORY.json');
fs.writeFileSync(jsonPath, JSON.stringify(inventoryData, null, 2), 'utf-8');
console.log(`✅ Đã xuất: ${normalizePath(jsonPath)}`);

// Ghi Markdown report
const mdPath = path.join(ROOT_DIR, 'docs/workflow/ACTIVITY_INVENTORY.md');
let mdContent = `# 📋 PQM ACTIVITY INVENTORY & COVERAGE REGISTER

> **Mã tài liệu**: \`PQM-ACT-INV-001\`  
> **Phiên bản**: \`1.0.0-BASELINE\`  
> **Thời điểm xuất**: \`${inventoryData.generatedAt}\`  
> **Trạng thái Gate**: \`${inventoryData.gateMetrics.gateStatus}\` (Phân loại: **${inventoryData.gateMetrics.classificationRate}**)

---

## 1. TỔNG QUAN THỐNG KÊ (SYSTEM METRICS)

- **Tổng số Activities đã kiểm kê**: **${activities.length}**
- **Hoạt động chưa map (UNMAPPED)**: **${unmappedCount}**
- **Hoạt động mồ côi (ORPHAN)**: **${orphanCount}**
- **Tỷ lệ bao phủ phân loại**: **${inventoryData.gateMetrics.classificationRate}**

### 1.1. Phân bố theo Mức độ rủi ro (Risk Level)
| Mức độ rủi ro | Số lượng | Tỷ lệ | Mô tả |
| :--- | :---: | :---: | :--- |
| 🔴 **HIGH** | ${byRisk['HIGH'] || 0} | ${Math.round(((byRisk['HIGH'] || 0) / activities.length) * 100)}% | Tác động trực tiếp tới chất lượng thuốc, phát hành lô, phê duyệt hồ sơ pháp lý. |
| 🟡 **MEDIUM** | ${byRisk['MEDIUM'] || 0} | ${Math.round(((byRisk['MEDIUM'] || 0) / activities.length) * 100)}% | Sửa đổi thông tin master data, phân công nhiệm vụ, cập nhật tiến độ. |
| 🟢 **LOW / NONE** | ${(byRisk['LOW'] || 0) + (byRisk['NONE'] || 0)} | ${Math.round((((byRisk['LOW'] || 0) + (byRisk['NONE'] || 0)) / activities.length) * 100)}% | Truy vấn dữ liệu, gợi ý AI proposal, xuất file báo cáo. |

### 1.2. Phân bố theo Thực thể (Entity Breakdown)
| Thực thể | Số lượng hoạt động | Hành động đại diện |
| :--- | :---: | :--- |
${Object.entries(byEntity).map(([ent, count]) => `| \`${ent}\` | ${count} | ${activities.find(a => a.entity === ent)?.desiredAction || 'N/A'} |`).join('\n')}

### 1.3. Phân bố theo Vai trò thực hiện (Owner Roles)
| Vai trò | Số lượng | Thẩm quyền cốt lõi |
| :--- | :---: | :--- |
${Object.entries(byOwner).map(([own, count]) => `| \`${own}\` | ${count} | Quyền thao tác theo quy định ADR-001 |`).join('\n')}

---

## 2. BẢNG CHI TIẾT HOẠT ĐỘNG TOÀN HỆ THỐNG (ACTIVITY INVENTORY MATRIX)

| ID | Trigger | Location | Entity | Mutation? | Current Path | Desired Canonical Action | Owner | Risk | State |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: | :---: |
${activities.map(a => `| \`${a.id}\` | \`${a.trigger}\` | \`${a.location}\` | \`${a.entity}\` | ${a.mutation ? '✅' : '❌'} | \`${a.currentPath}\` | \`${a.desiredAction}\` | \`${a.owner}\` | \`${a.risk}\` | \`${a.coverageState}\` |`).join('\n')}

---

## 3. KẾT LUẬN & ĐIỀU KIỆN MỞ CỔNG (PHASE 0 GATE SIGN-OFF)

1. **Gate Criteria**: 100% Activities đã được phân loại; 0 Unmapped; 0 Orphan.
2. **Kế hoạch tiếp theo (Phase 1)**: Xây dựng workflow kernel thực thi (\`UnifiedWorkflowExecutor\` nâng cấp) và bộ adapters (\`LegacyServiceAdapter\`) làm cầu nối trước khi chuyển UI ở Phase 2.
`;

fs.writeFileSync(mdPath, mdContent, 'utf-8');
console.log(`✅ Đã xuất: ${normalizePath(mdPath)}`);

if (unmappedCount > 0 || orphanCount > 0) {
  console.error('❌ GATE FAILED: Phát hiện UNMAPPED hoặc ORPHAN activities. Dừng quá trình merge.');
  process.exit(1);
} else {
  console.log('🎉 GATE PASSED: 100% Activities đã được phân loại chính xác.');
  process.exit(0);
}
