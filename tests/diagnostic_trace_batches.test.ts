import { describe, it } from 'vitest';
import fs from 'fs';
import {
  resolveAuthoritativeTestResultsForBatch,
  resolveFinalTestResultForBatch,
  calculateOverallStatusForTestResult,
  resolveTestResultStatus,
} from '../src/domain/test-result/testResultStatusResolver';
import { evaluateBatchReleaseIntegrity } from '../src/domain/batch/batchIntegrityValidator';

describe('Diagnostic Real Batches Trace', () => {
  it('traces 362605, 332605, 292605', () => {
    if (!fs.existsSync('temp_batches.json') || !fs.existsSync('temp_test_results.json')) {
      return;
    }

    function readJsonFile(filePath: string) {
      if (!fs.existsSync(filePath)) return {};
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
      if (boundTccs) {
        console.log(`Bound TCCS Code: ${boundTccs.code}, Name: ${boundTccs.productName}`);
        console.log(
          `Main criteria:`,
          (boundTccs.mainQualityCriteria || []).map((c: any) => ({
            name: c.name,
            min: c.min,
            max: c.max,
            exp: c.expectedText,
          }))
        );
        console.log(
          `Safety criteria:`,
          (boundTccs.safetyCriteria || []).map((c: any) => ({
            name: c.name,
            min: c.min,
            max: c.max,
            exp: c.expectedText,
          }))
        );
      }
      console.log(`Candidate PKN: Primary=${primary.length}, Legacy=${legacy.length}`);

      primary.forEach((p, idx) => {
        console.log(
          `  [P${idx + 1}] ID=${p.id}, Lab=${p.labName}, Date=${p.testDate}, Ver=${p.version}, Status=${p.status}, WF=${p.workflowStatus}, OS=${p.overallStatus}, QS=${p.qualityStatus}`
        );
      });

      console.log(`\n=== CANDIDATE DETAILS ===`);
      primary.forEach((p, idx) => {
        const res = p.results || p.criteria || [];
        const passC = res.filter((r: any) => r.isPass === true).length;
        const failC = res.filter((r: any) => r.isPass === false).length;
        const pendC = res.filter((r: any) => r.isPass !== true && r.isPass !== false).length;
        const failedDetails = res
          .filter((r: any) => r.isPass === false)
          .map((r: any) => `${r.criteriaName}: "${r.value}" (limit: ${r.limit})`);

        console.log(
          `  [P${idx + 1}] ID=${p.id} | Lab=${p.labName} | Date=${p.testDate} | Updated=${p.updatedAt} | Ver=${p.version} | WF=${p.workflowStatus} | LegacyStatus=${p.status} | QualityStatus=${p.qualityStatus} | OverallStatus=${p.overallStatus} | SnapOverall=${p.evaluationSnapshot?.overallStatus} | Criteria=${res.length} (PASS:${passC}, FAIL:${failC}, PEND:${pendC}) | FailedCrit=[${failedDetails.join('; ')}]`
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
  });
});
