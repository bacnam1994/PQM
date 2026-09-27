import fs from 'fs';
import {
  resolveAuthoritativeTestResultsForBatch,
  resolveFinalTestResultForBatch,
  calculateOverallStatusForTestResult,
  resolveTestResultStatus,
} from '../src/domain/test-result/testResultStatusResolver';
import { evaluateBatchReleaseIntegrity } from '../src/domain/batch/batchIntegrityValidator';

function readJsonFile(filePath: string) {
  const buf = fs.readFileSync(filePath);
  let str = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  return JSON.parse(str.replace(/^\uFEFF/, ''));
}

const batches = readJsonFile('temp_batches.json');
const testResults = readJsonFile('temp_test_results.json');
const tccsList = readJsonFile('temp_tccs.json');

const testResultList = Object.entries(testResults).map(([id, tr]: [string, any]) => ({
  id,
  ...tr,
}));
const tccsMap = new Map(Object.entries(tccsList));

const targetBatchNos = ['362605', '332605', '292605'];

for (const targetNo of targetBatchNos) {
  console.log(`\n========================================================================`);
  console.log(`>>> TRACING BATCH: ${targetNo}`);
  console.log(`========================================================================`);

  const batchEntry = Object.entries(batches).find(
    ([k, b]: [string, any]) => b && String(b.batchNo).trim() === targetNo
  );
  if (!batchEntry) continue;

  const [batchId, rawBatch] = batchEntry as [string, any];
  const batch = { id: batchId, ...rawBatch };
  const boundTccs = batch.tccsId ? (tccsMap.get(batch.tccsId) as any) : undefined;

  const primary = testResultList.filter((r) => r.batchId === batch.id);
  const legacy = testResultList.filter(
    (r) => r.batchId !== batch.id && (r.batchId === targetNo || r.batchNo === targetNo)
  );

  console.log(
    `Batch: ID=${batch.id}, No=${batch.batchNo}, Status=${batch.status}, TCCS ID=${batch.tccsId}`
  );
  console.log(`Candidate PKN: Primary=${primary.length}, Legacy=${legacy.length}`);

  primary.forEach((p, idx) => {
    console.log(
      `  [P${idx + 1}] ID=${p.id}, Lab=${p.labName}, Date=${p.testDate}, Ver=${p.version}, Status=${p.status}, WF=${p.workflowStatus}, OS=${p.overallStatus}, QS=${p.qualityStatus}`
    );
  });

  const resolution = {
    batch,
    primaryResults: primary,
    legacyResults: legacy,
    invalidResults: [],
    allCandidateResults: [...primary, ...legacy],
    hasPrimaryMatch: primary.length > 0,
    hasLegacyMatch: legacy.length > 0,
    hasInvalidMatch: false,
  };

  const finalRes = resolveFinalTestResultForBatch(batch, primary, boundTccs);
  console.log(`\n--- resolveFinalTestResultForBatch ---`);
  console.log(`Selected finalTestResult ID: ${finalRes.finalTestResult?.id}`);
  console.log(`Selected Lab: ${finalRes.finalTestResult?.labName}`);
  console.log(`Calculated status: ${finalRes.status}`);
  console.log(`Diagnostics:`, finalRes.diagnostics);

  const authResults = resolveAuthoritativeTestResultsForBatch(batch, primary, boundTccs);
  console.log(`\n--- resolveAuthoritativeTestResultsForBatch ---`);
  console.log(`Total authoritative PKNs: ${authResults.length}`);
  authResults.forEach((a, idx) => {
    const s = calculateOverallStatusForTestResult(a, boundTccs, authResults);
    const r = resolveTestResultStatus(a);
    console.log(
      `  [Auth ${idx + 1}] ID=${a.id}, Lab=${a.labName}, Date=${a.testDate}, calcOverall=${s}, resolveStatus=${r}`
    );
  });

  const evaluation = evaluateBatchReleaseIntegrity(
    batch,
    resolution,
    { isStale: false, dataLagSeconds: 0 },
    boundTccs
  );
  console.log(`\n--- evaluateBatchReleaseIntegrity ---`);
  console.log(`Integrity Status: ${evaluation.integrityStatus}`);
  console.log(`Should Alert: ${evaluation.shouldAlert}`);
  console.log(`Alert Type: ${evaluation.alertType}`);
  console.log(`Summary Message: ${evaluation.summaryMessage}`);
}
