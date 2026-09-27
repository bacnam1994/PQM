const fs = require('fs');

function readJsonFile(filePath) {
  const buf = fs.readFileSync(filePath);
  let str;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    str = buf.toString('utf16le');
  } else {
    str = buf.toString('utf8');
  }
  return JSON.parse(str.replace(/^\uFEFF/, ''));
}

const batches = readJsonFile('temp_batches.json');
const testResults = readJsonFile('temp_test_results.json');
const tccsList = readJsonFile('temp_tccs.json');

const targetBatchNos = ['362605', '332605', '292605'];

console.log('========================================================================');
console.log('DIAGNOSTIC TRACE FOR BATCHES:', targetBatchNos.join(', '));
console.log('========================================================================\n');

for (const targetNo of targetBatchNos) {
  console.log(`\n========================================`);
  console.log(`>>> BATCH: ${targetNo}`);
  console.log(`========================================`);

  // Tìm batch trong DB
  let foundBatchKey = null;
  let batchData = null;

  for (const [key, b] of Object.entries(batches)) {
    if (b && String(b.batchNo).trim() === targetNo) {
      foundBatchKey = key;
      batchData = b;
      break;
    }
  }

  if (!batchData) {
    console.log(`Batch ${targetNo} NOT FOUND in database!`);
    continue;
  }

  const bId = String(batchData.id || foundBatchKey).trim();
  console.log(`Batch ID: ${bId}`);
  console.log(`Batch No: ${batchData.batchNo}`);
  console.log(`Batch Status: ${batchData.status}`);
  console.log(`Product ID: ${batchData.productId}`);
  console.log(`TCCS ID: ${batchData.tccsId}`);
  console.log(`Batch Quality Status: ${batchData.qualityStatus}`);

  // Tìm tất cả test results liên quan (khớp batchId hoặc batchNo)
  const matchedTRs = [];
  for (const [trKey, tr] of Object.entries(testResults)) {
    if (!tr) continue;
    const trBatchId = String(tr.batchId || '').trim();
    const trBatchNo = String(tr.batchNo || '').trim();

    if (trBatchId === bId || trBatchId === targetNo || trBatchNo === targetNo) {
      matchedTRs.push({ key: trKey, ...tr });
    }
  }

  console.log(`\nSố PKN tìm thấy: ${matchedTRs.length}`);

  for (const tr of matchedTRs) {
    console.log(`----------------------------------------`);
    console.log(`TestResult Key: ${tr.key}`);
    console.log(`TestResult ID: ${tr.id}`);
    console.log(`Report No / Code: ${tr.reportNo || tr.code || tr.soPhieu || 'N/A'}`);
    console.log(`Lab Name: ${tr.labName || 'N/A'}`);
    console.log(`Test Date: ${tr.testDate || 'N/A'}`);
    console.log(`Version: ${tr.version}`);
    console.log(`Workflow Status: ${tr.workflowStatus}`);
    console.log(`Legacy Status (tr.status): ${tr.status}`);
    console.log(`Quality Status (tr.qualityStatus): ${tr.qualityStatus}`);
    console.log(`Overall Status (tr.overallStatus): ${tr.overallStatus}`);
    console.log(`Snapshot Overall Status: ${tr.evaluationSnapshot?.overallStatus}`);
    
    const resultsArr = Array.isArray(tr.results) ? tr.results : (tr.results ? Object.values(tr.results) : []);
    const criteriaArr = Array.isArray(tr.criteria) ? tr.criteria : (tr.criteria ? Object.values(tr.criteria) : []);
    
    console.log(`results count: ${resultsArr.length}`);
    console.log(`criteria count: ${criteriaArr.length}`);

    const rawList = resultsArr.length > 0 ? resultsArr : criteriaArr;
    
    let passCount = 0;
    let failCount = 0;
    let pendingCount = 0;
    const criteriaDetails = [];

    for (const entry of rawList) {
      if (!entry) continue;
      const isPass = entry.isPass;
      const name = entry.criteriaName || entry.name || 'unnamed';
      const val = entry.value;

      if (isPass === true || String(isPass).toUpperCase() === 'TRUE' || String(isPass).toUpperCase() === 'PASS') {
        passCount++;
      } else if (isPass === false || String(isPass).toUpperCase() === 'FALSE' || String(isPass).toUpperCase() === 'FAIL') {
        failCount++;
        criteriaDetails.push({ name, value: val, isPass, reason: 'FAIL' });
      } else {
        pendingCount++;
        criteriaDetails.push({ name, value: val, isPass, reason: 'PENDING' });
      }
    }

    console.log(`Criteria Summary: Total=${rawList.length}, PASS=${passCount}, FAIL=${failCount}, PENDING=${pendingCount}`);
    if (criteriaDetails.length > 0) {
      console.log(`Non-PASS Criteria:`, JSON.stringify(criteriaDetails, null, 2));
    }
  }
}
