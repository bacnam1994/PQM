/**
 * scripts/dryRunBatchIntegrity.ts
 * ===============================
 * Dry-Run Verification Engine (Phase 10)
 * Kiểm chứng toàn diện trên Snapshot Production thật theo đúng pipeline:
 * Production snapshot -> Normalization -> Canonical Batch Quality Decision SSoT -> Alert Producer -> UI Alert Contracts
 *
 * Tiêu chí nghiệm thu:
 * - 362605, 332605, 292605:
 *   + Canonical Batch Quality: PASS
 *   + Batch Integrity Status: PASS
 *   + shouldAlert: false
 *   + alertType: NONE
 * - Genuine failure (synthetic):
 *   + Alert xuất hiện đúng (True Positive)
 */

import fs from 'fs';
import {
  resolveFinalTestResultForBatch,
  resolveAuthoritativeTestResultsForBatch,
  calculateOverallStatusForTestResult,
  resolveTestResultStatus,
} from '../src/domain/test-result/testResultStatusResolver';
import {
  evaluateBatchReleaseIntegrity,
  isValidTestResultForBatch,
} from '../src/domain/batch/batchIntegrityValidator';
import { resolveTestResultsForBatch } from '../src/domain/batch/batchTestResultResolver';
import {
  resolveCanonicalBatchQualityDecision,
  CANONICAL_DECISION_RESOLVER_VERSION,
} from '../src/domain/batch/canonicalBatchQualityDecision';
import { CanonicalStatusResolver } from '../src/domain/canonical/canonicalResolver';
import { auditDataConsistency } from '../src/services/dataConsistencyService';
import { ReleaseRules } from '../src/domain/rules/ReleaseRules';
import { Batch, TestResult, TCCS } from '../src/types';

const FIREBASE_RTDB_BASE_URL =
  'https://v-biotech-default-rtdb.asia-southeast1.firebasedatabase.app';

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const str = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  return JSON.parse(str.replace(/^\uFEFF/, ''));
}

async function fetchFromFirebase(collection: string): Promise<Record<string, any>> {
  try {
    const url = `${FIREBASE_RTDB_BASE_URL}/${collection}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch (error) {
    // Fallback to local snapshot
  }

  const localFileName = `temp_${collection}.json`;
  const localData = readJsonFile(localFileName);
  if (localData) {
    return localData;
  }

  return {};
}

async function runDryRun() {
  console.log('========================================================================');
  console.log('🚀 PHASE 10 DRY-RUN: END-TO-END CANONICAL DECISION & ALERT CONTRACT AUDIT');
  console.log('========================================================================\n');

  const [rawBatches, rawTestResults, rawTccs] = await Promise.all([
    fetchFromFirebase('batches'),
    fetchFromFirebase('test_results'),
    fetchFromFirebase('tccs'),
  ]);

  const allBatches: Batch[] = Object.entries(rawBatches).map(([id, b]) => ({
    id,
    ...(b as any),
  }));

  const allTestResults: TestResult[] = Object.entries(rawTestResults).map(([id, tr]) => ({
    id,
    ...(tr as any),
  }));

  const tccsMap = new Map<string, TCCS>(
    Object.entries(rawTccs).map(([id, t]) => [id, { id, ...(t as any) }])
  );

  const targetBatchNos = ['362605', '332605', '292605'];
  let allPassed = true;

  for (const targetNo of targetBatchNos) {
    const batch = allBatches.find((b) => b && String(b.batchNo).trim() === targetNo);

    if (!batch) {
      console.error(`❌ KHÔNG TÌM THẤY LÔ ${targetNo} trong cơ sở dữ liệu!`);
      allPassed = false;
      continue;
    }

    const boundTccs = batch.tccsId ? tccsMap.get(batch.tccsId) : undefined;
    const resolution = resolveTestResultsForBatch(batch, allTestResults, allBatches);

    // 1. Phân giải qua SSoT Canonical Batch Quality Decision Engine
    const decision = resolveCanonicalBatchQualityDecision({
      batch,
      testResults: resolution.primaryResults,
      tccs: boundTccs,
      dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
    });

    // 2. Thẩm định qua batchIntegrityValidator (Adapter gọi SSoT)
    const evaluation = evaluateBatchReleaseIntegrity(
      batch,
      resolution,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );

    // 3. Thẩm định qua CanonicalStatusResolver (Adapter gọi SSoT)
    const canonicalQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(
      batch,
      resolution.primaryResults,
      boundTccs
    );

    // 4. Thẩm định qua auditDataConsistency (Alert Producer thực tế trong UI)
    const consistencyReport = auditDataConsistency({
      products: [],
      batches: [batch],
      tccsList: boundTccs ? [boundTccs] : [],
      productFormulas: [],
      rawMaterials: [],
      testResults: resolution.primaryResults,
      dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
    });
    const alertProducerIssues = consistencyReport.issues.filter(
      (iss) =>
        (iss.entityId === batch.id || iss.entityId === batch.batchNo) &&
        (iss.type === 'STATUS_MISMATCH' ||
          iss.type === 'TEST_RESULT_STATUS_MISMATCH' ||
          iss.type === 'RELEASED_BATCH_NO_PASSING_TEST' ||
          iss.type === 'MISSING_TEST_RESULT')
    );

    // In format bắt buộc của Phase 10
    console.log(`BATCH ${targetNo}`);
    console.log('---------------------------------');
    console.log(`Candidate Results       : ${decision.candidateCount}`);
    console.log(`Supreme Result          : ${decision.supremeTestResultId || 'NONE'}`);
    console.log(`Supreme Lab             : ${decision.supremeTestResultLab || 'NONE'}`);
    console.log(`Workflow Status         : ${decision.workflowStatus}`);
    console.log(`Stored Quality Status   : ${batch.status}`);
    console.log(`Computed Quality Status : ${decision.qualityStatus}`);
    console.log(`Canonical Batch Status  : ${canonicalQuality}`);
    console.log(`Integrity Status        : ${decision.integrityStatus}`);
    console.log(`Alert Type              : ${decision.alertType || 'NONE'}`);
    console.log(`Should Alert            : ${decision.shouldAlert}`);
    console.log(`Decision Source         : ${decision.decisionReason}`);
    console.log(`Resolver Version        : ${decision.resolverVersion}`);
    console.log(`Alert Producer Issues   : ${alertProducerIssues.length}`);
    console.log('');

    const isSuccess =
      decision.qualityStatus === 'PASS' &&
      decision.integrityStatus === 'PASS' &&
      decision.shouldAlert === false &&
      evaluation.shouldAlert === false &&
      alertProducerIssues.length === 0;

    if (!isSuccess) {
      allPassed = false;
    }
  }

  // Verification của True Positive: Lô lỗi thật
  console.log('VERIFYING TRUE POSITIVE DETECTION (GENUINE FAILURE)');
  console.log('---------------------------------');
  const genuineFailBatch: Batch = {
    id: 'batch_genuine_fail',
    batchNo: 'FAIL_TEST',
    status: 'RELEASED',
    tccsId: 'tccs_dummy',
    productId: 'prod_dummy',
    mfgDate: '2026-06-01',
    expDate: '2028-06-01',
    theoreticalYield: 1000,
    actualYield: 990,
    yieldUnit: 'chai',
    createdAt: '2026-06-01T00:00:00Z',
  };
  const genuineFailResults: TestResult[] = [
    {
      id: 'res_genuine_fail',
      batchId: 'batch_genuine_fail',
      labName: 'Lab QC',
      testDate: '2026-07-01',
      version: 1,
      workflowStatus: 'APPROVED',
      status: 'APPROVED',
      overallStatus: 'FAIL',
      results: [{ criteriaName: 'Độ ẩm', value: '15.0', isPass: false, unit: '%' }],
      createdAt: '2026-07-01T00:00:00Z',
    },
  ];
  const failDecision = resolveCanonicalBatchQualityDecision({
    batch: genuineFailBatch,
    testResults: genuineFailResults,
    dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
  });
  console.log(`Genuine Fail Batch Quality : ${failDecision.qualityStatus}`);
  console.log(`Genuine Fail Integrity     : ${failDecision.integrityStatus}`);
  console.log(`Genuine Fail Alert Type    : ${failDecision.alertType}`);
  console.log(`Genuine Fail Should Alert  : ${failDecision.shouldAlert}`);

  const truePositiveOk =
    failDecision.qualityStatus === 'FAIL' &&
    failDecision.integrityStatus === 'TEST_RESULT_INVALID_STATUS' &&
    failDecision.shouldAlert === true;

  if (truePositiveOk) {
    console.log('✅ True Positive Check: PASS (Cảnh báo đỏ kích hoạt chính xác cho lô lỗi thật)\n');
  } else {
    console.error('❌ True Positive Check: FAILED\n');
    allPassed = false;
  }

  if (allPassed) {
    console.log('========================================================================');
    console.log('🎉 100% DRY RUN AUDIT PASSED: ZERO FALSE POSITIVE & RELIABLE TRUE POSITIVE');
    console.log('========================================================================');
  } else {
    console.error('❌ DRY RUN AUDIT FAILED');
    process.exitCode = 1;
  }
}

runDryRun().catch((err) => {
  console.error('Lỗi khi thực thi Dry-Run:', err);
  process.exitCode = 1;
});
