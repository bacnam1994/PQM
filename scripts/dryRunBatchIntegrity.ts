/**
 * scripts/dryRunBatchIntegrity.ts
 * ===============================
 * Script kiểm chứng Dry-Run trực tiếp trên dữ liệu thật (Firebase Production)
 * cho 3 Lô sản xuất: 362605, 332605, 292605.
 *
 * Tiêu chí nghiệm thu:
 * - Trạng thái toàn vẹn (integrityStatus) của cả 3 lô: 'PASS'
 * - Cảnh báo đỏ (shouldAlert): false
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
    console.log(`[Firebase RTDB] Đang kết nối tải dữ liệu từ ${url}...`);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        console.log(
          `[Firebase RTDB] Nạp thành công collection "${collection}" (${Object.keys(data).length} bản ghi).`
        );
        return data;
      }
    }
  } catch (error) {
    console.warn(
      `[Firebase RTDB] Không thể kết nối trực tiếp (${(error as Error).message}), kích hoạt local snapshot fallback...`
    );
  }

  // Fallback to local snapshot files if available
  const localFileName = `temp_${collection}.json`;
  const localData = readJsonFile(localFileName);
  if (localData) {
    console.log(
      `[Local Snapshot] Đã nạp thành công ${localFileName} (${Object.keys(localData).length} bản ghi).`
    );
    return localData;
  }

  return {};
}

async function runDryRun() {
  console.log('========================================================================');
  console.log('🚀 DRY-RUN XÁC MINH TOÀN VẸN CHẤT LƯỢNG LÔ (BATCH INTEGRITY VALIDATOR)');
  console.log('Target Batches: 362605, 332605, 292605');
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
  const summaryReport: Array<{
    batchNo: string;
    batchId: string;
    releaseStatus: string;
    supremeTestId: string;
    supremeLab: string;
    supremeStatus: string;
    integrityStatus: string;
    shouldAlert: boolean;
    pass: boolean;
  }> = [];

  let allPassed = true;

  for (const targetNo of targetBatchNos) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`🔍 KIỂM TRA LÔ: [${targetNo}]`);
    console.log(`------------------------------------------------------------------------`);

    const batch = allBatches.find((b) => b && String(b.batchNo).trim() === targetNo);

    if (!batch) {
      console.error(`❌ KHÔNG TÌM THẤY LÔ ${targetNo} trong cơ sở dữ liệu!`);
      allPassed = false;
      continue;
    }

    const boundTccs = batch.tccsId ? tccsMap.get(batch.tccsId) : undefined;
    console.log(`Lô ID: ${batch.id} | Số hiệu: ${batch.batchNo} | Trạng thái: ${batch.status}`);
    console.log(`TCCS ID: ${batch.tccsId || 'N/A'} | Mã TCCS: ${boundTccs?.code || 'N/A'}`);

    // Phân giải danh sách phiếu kiểm nghiệm liên kết
    const resolution = resolveTestResultsForBatch(batch, allTestResults, allBatches);
    console.log(
      `Tổng số phiếu liên kết: Primary=${resolution.primaryResults.length}, Legacy=${resolution.legacyResults.length}`
    );

    resolution.primaryResults.forEach((tr, idx) => {
      const entries =
        Array.isArray(tr.results) && tr.results.length > 0
          ? tr.results
          : (tr as any).criteria || [];
      console.log(
        `  [PKN ${idx + 1}] ID=${tr.id} | Lab=${tr.labName} | Ngày=${tr.testDate} | Ver=${tr.version} | WF=${(tr as any).workflowStatus} | Status=${(tr as any).status} | Chỉ tiêu=${entries.length}`
      );
    });

    // 1. Phân giải Canonical Supreme Test Result
    const finalResolution = resolveFinalTestResultForBatch(
      batch,
      resolution.primaryResults,
      boundTccs
    );

    const supreme = finalResolution.finalTestResult;
    console.log(
      `\n[Supreme Resolution] Phiếu tối cao: ID=${supreme?.id} | Lab=${supreme?.labName}`
    );
    console.log(`[Supreme Resolution] Trạng thái tính toán: ${finalResolution.status}`);

    // 2. Thẩm định toàn vẹn xuất xưởng
    const evaluation = evaluateBatchReleaseIntegrity(
      batch,
      resolution,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );

    console.log(`\n[Kết quả Thẩm định Toàn vẹn Lô]`);
    console.log(`- Trạng thái toàn vẹn (integrityStatus): ${evaluation.integrityStatus}`);
    console.log(`- Cảnh báo đỏ (shouldAlert): ${evaluation.shouldAlert}`);
    console.log(`- Mức độ cảnh báo (alertType): ${evaluation.alertType || 'NONE'}`);
    console.log(`- Thông điệp tóm tắt: ${evaluation.summaryMessage}`);

    const isSuccess = evaluation.integrityStatus === 'PASS' && evaluation.shouldAlert === false;

    if (isSuccess) {
      console.log(`✅ LÔ ${targetNo}: ĐẠT CHUẨN (PASS - 0 FALSE POSITIVE ALERT)`);
    } else {
      console.error(`❌ LÔ ${targetNo}: KHÔNG ĐẠT (Cảnh báo sai lệch vẫn còn tồn tại)`);
      allPassed = false;
    }

    summaryReport.push({
      batchNo: batch.batchNo,
      batchId: batch.id,
      releaseStatus: batch.status,
      supremeTestId: supreme?.id || 'N/A',
      supremeLab: supreme?.labName || 'N/A',
      supremeStatus: finalResolution.status,
      integrityStatus: evaluation.integrityStatus,
      shouldAlert: evaluation.shouldAlert,
      pass: isSuccess,
    });
  }

  console.log('\n========================================================================');
  console.log('📊 BẢNG TỔNG HỢP NGHIỆM THU DRY-RUN');
  console.log('========================================================================');
  console.table(summaryReport);

  if (allPassed) {
    console.log('\n🎉 KẾT QUẢ NGHIỆM THU: 100% CẢNH BÁO SAI ĐÃ ĐƯỢC LOẠI BỎ THÀNH CÔNG!');
    console.log(
      'Cả 3 lô (362605, 332605, 292605) đều đạt integrityStatus = "PASS" và shouldAlert = false.'
    );
  } else {
    console.error('\n❌ KẾT QUẢ NGHIỆM THU THẤT BẠI: Vẫn còn lô có trạng thái cảnh báo sai!');
    process.exitCode = 1;
  }
}

runDryRun().catch((err) => {
  console.error('Lỗi khi thực thi Dry-Run:', err);
  process.exitCode = 1;
});
