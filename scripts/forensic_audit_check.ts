import fs from 'fs';
import { resolveTestResultsForBatch } from '../src/domain/batch/batchTestResultResolver';
import { evaluateBatchReleaseIntegrity } from '../src/domain/batch/batchIntegrityValidator';
import { CanonicalStatusResolver } from '../src/domain/canonical/canonicalResolver';
import { ReleaseRules } from '../src/domain/rules/ReleaseRules';
import { ConsistencyAuditor } from '../src/domain/consistency/consistencyModel';
import { Batch, TestResult, TCCS } from '../src/types';

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const str = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  return JSON.parse(str.replace(/^\uFEFF/, ''));
}

async function main() {
  const rawBatches = readJsonFile('temp_batches.json') || {};
  const rawTestResults = readJsonFile('temp_test_results.json') || {};
  const rawTccs = readJsonFile('temp_tccs.json') || {};

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

  for (const targetNo of targetBatchNos) {
    console.log(`\n======================================================`);
    console.log(`FORENSIC AUDIT: LÔ ${targetNo}`);
    console.log(`======================================================`);

    const batch = allBatches.find((b) => b && String(b.batchNo).trim() === targetNo);
    if (!batch) {
      console.log(`Không tìm thấy lô ${targetNo}`);
      continue;
    }

    const boundTccs = batch.tccsId ? tccsMap.get(batch.tccsId) : undefined;
    const resolution = resolveTestResultsForBatch(batch, allTestResults, allBatches);

    console.log(`Batch: ID=${batch.id}, Status=${batch.status}, TCCS=${batch.tccsId}`);
    console.log(`Linked Primary Results: ${resolution.primaryResults.length}`);

    // 1. Thẩm định qua batchIntegrityValidator
    const integrityEval = evaluateBatchReleaseIntegrity(
      batch,
      resolution,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );
    console.log(`\n[batchIntegrityValidator]`);
    console.log(`- integrityStatus: ${integrityEval.integrityStatus}`);
    console.log(`- shouldAlert: ${integrityEval.shouldAlert}`);
    console.log(`- alertType: ${integrityEval.alertType || 'NONE'}`);
    console.log(`- summaryMessage: ${integrityEval.summaryMessage}`);

    // 2. Thẩm định qua CanonicalStatusResolver
    const canonicalQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(
      batch,
      resolution.primaryResults,
      boundTccs
    );
    const canonicalBatchRes = CanonicalStatusResolver.resolveBatchQuality(
      batch,
      resolution.primaryResults,
      boundTccs
    );
    console.log(`\n[CanonicalStatusResolver]`);
    console.log(`- calculateCanonicalBatchQualityStatus: ${canonicalQuality}`);
    console.log(
      `- resolveBatchQuality.batchQualityStatus: ${canonicalBatchRes.batchQualityStatus}`
    );
    console.log(`- resolveBatchQuality.blockers:`, canonicalBatchRes.blockers);
    console.log(
      `- resolveBatchQuality.qualityReason:`,
      canonicalBatchRes.decisionTrace?.qualityReason || 'N/A'
    );

    // 3. Thẩm định qua ReleaseRules
    const releaseEval = ReleaseRules.evaluateReleasePrerequisites({
      batch,
      testResults: resolution.primaryResults,
      boundTccs,
    });
    console.log(`\n[ReleaseRules]`);
    console.log(`- isEligibleForRelease: ${releaseEval.isEligibleForRelease}`);
    console.log(`- blockers:`, releaseEval.blockers);
    console.log(`- recommendation: ${releaseEval.recommendation}`);
  }
}

main().catch(console.error);
