import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataGraph, HydratedTestResult } from './useDataGraph';
import { TestResultEntry } from '../types';
import { ensureArray, parseNumberFromText, TEST_RESULT_STATUS, getFromCache } from '../utils';
import { calculateOverallStatusForTestResult } from '../domain/test-result/testResultStatusResolver';
import { AlternateRuleResolver } from '../domain/evaluation';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../firebase';

export const useTestResultPrint = () => {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedResultForPrint, setSelectedResultForPrint] = useState<HydratedTestResult | null>(
    null
  );
  const [isConsolidating, setIsConsolidating] = useState(false);

  const testResults = useAppStore((state) => state.testResults);
  const allTestResults = useAppStore((state) => state.allTestResults);
  const tccsList = useAppStore((state) => state.tccsList);
  const notify = useAppStore((state) => state.notify);
  const { batches: hydratedBatches } = useDataGraph();

  const handlePrint = useCallback((res: HydratedTestResult) => {
    setSelectedResultForPrint(res);
    setIsPrintModalOpen(true);
  }, []);

  const handlePrintConsolidatedCoa = useCallback(
    async (batchId: string) => {
      if (!batchId) return;
      setIsConsolidating(true);
      try {
        // 1. Lấy toàn bộ PKN của lô từ Firebase để tránh mất dữ liệu do phân trang
        let fetchedResults: any[] = [];
        try {
          const testResultsRef = ref(db, 'testResults');
          const batchQuery = query(testResultsRef, orderByChild('batchId'), equalTo(batchId));
          const snapshot = await get(batchQuery);
          if (snapshot.exists()) {
            fetchedResults = Object.values(snapshot.val());
          }
        } catch (error) {
          console.warn('Lỗi tải lịch sử PKN từ DB:', error);
        }

        // 2. Lấy thêm từ IndexedDB (Xử lý các lô cũ chưa đồng bộ, hoặc từ file backup)
        try {
          const cached = await getFromCache('testResults');
          if (cached && Array.isArray(cached)) {
            const localMatches = cached.filter((r: any) => r.batchId === batchId);
            fetchedResults = [...fetchedResults, ...localMatches];
          }
        } catch (error) {
          console.warn('Lỗi tải lịch sử PKN từ Cache:', error);
        }

        const sourceResults =
          allTestResults && allTestResults.length > 0 ? allTestResults : testResults;

        // 3. Gộp kết quả từ Database, Cache và State cục bộ, dùng Map để loại bỏ trùng lặp
        const uniqueResults = new Map<string, any>();
        [...fetchedResults, ...sourceResults].forEach((r) => {
          if (r.batchId === batchId) {
            uniqueResults.set(r.id, r);
          }
        });

        const resultsForBatch = Array.from(uniqueResults.values()).sort(
          (a: any, b: any) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime()
        );

        // Bơm dữ liệu vào Global Store để đồng bộ các UI khác
        const mergeTestResults = (useAppStore.getState() as any).mergeTestResults;
        if (mergeTestResults && resultsForBatch.length > 0) {
          mergeTestResults(resultsForBatch);
        }

        if (resultsForBatch.length === 0) {
          notify({ type: 'INFO', message: 'Lô này chưa có kết quả kiểm nghiệm nào.' });
          return;
        }

        const consolidatedResultsMap = new Map<string, TestResultEntry>();

        resultsForBatch.forEach((res) => {
          ensureArray(res.results).forEach((entry) => {
            if (entry && entry.criteriaName) {
              const rName = entry.criteriaName.trim().toLowerCase();
              const existing = consolidatedResultsMap.get(rName);
              // Ưu tiên giữ lại kết quả ĐẠT nếu có sự sai khác giữa các lần kiểm tra
              if (!existing || (entry.isPass === true && existing.isPass !== true)) {
                consolidatedResultsMap.set(rName, entry);
              }
            }
          });
        });

        const latestResult = resultsForBatch[resultsForBatch.length - 1];
        const batch = hydratedBatches.find((b) => b.id === batchId);
        if (!batch) return;

        const availableTCCSForBatch = tccsList
          .filter((t) => t.productId === batch.productId)
          .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

        let tccsForEvaluation = null;
        if (availableTCCSForBatch.length > 0) {
          if (batch.mfgDate) {
            const mfgTime = new Date(batch.mfgDate).getTime();
            const match = availableTCCSForBatch.find(
              (t) => new Date(t.issueDate).getTime() <= mfgTime
            );
            tccsForEvaluation = match || availableTCCSForBatch[availableTCCSForBatch.length - 1];
          } else {
            tccsForEvaluation = availableTCCSForBatch[0];
          }
        }

        // Tự động nội suy các chỉ tiêu "Miễn kiểm" bị thiếu (Dành cho các Lô cũ chưa được lưu "Miễn kiểm" vào CSDL)
        if (tccsForEvaluation) {
          const allCriteria = [
            ...ensureArray(tccsForEvaluation.mainQualityCriteria),
            ...ensureArray(tccsForEvaluation.safetyCriteria),
          ].filter((c) => c && c.name && c.name.trim() !== '');

          const currentEntries = Array.from(consolidatedResultsMap.values());
          allCriteria.forEach((c) => {
            const cName = c.name.trim().toLowerCase();
            if (!consolidatedResultsMap.has(cName)) {
              const altStatus = AlternateRuleResolver.resolveCriterionState(
                c.name,
                undefined,
                currentEntries,
                tccsForEvaluation,
                c
              );

              if (altStatus.isExempted) {
                consolidatedResultsMap.set(cName, {
                  criteriaName: c.name,
                  value: 'Miễn kiểm',
                  isPass: true,
                  isExtra: false,
                  unit: c.unit,
                  alternateState: 'EXEMPTED',
                  alternateNote: altStatus.displayNote,
                });
              }
            }
          });
        }

        const finalResults = Array.from(consolidatedResultsMap.values());
        const canonicalStatus = calculateOverallStatusForTestResult(
          { results: finalResults } as any,
          tccsForEvaluation
        );
        const overallStatus =
          canonicalStatus === 'PASS' ? TEST_RESULT_STATUS.PASS : TEST_RESULT_STATUS.FAIL;

        const batchSnapshot = (batch as any).evaluationSnapshot;
        const virtualResult: HydratedTestResult = {
          id: batchSnapshot ? `coa-${batchId}` : `consolidated-${batchId}`,
          batchId: batchId,
          labName: batchSnapshot ? 'Phòng Kiểm Nghiệm' : 'Tổng hợp',
          testDate: latestResult.testDate,
          results: finalResults,
          evaluationSnapshot: batchSnapshot,
          overallStatus: batchSnapshot
            ? batchSnapshot.overallStatus === 'PASS'
              ? TEST_RESULT_STATUS.PASS
              : TEST_RESULT_STATUS.FAIL
            : overallStatus,
          notes: batchSnapshot
            ? 'CoA phát hành từ Bản chụp thẩm định niêm phong.'
            : `Phiếu tổng hợp từ ${resultsForBatch.length} kết quả.`,
          createdAt: batchSnapshot?.timestamp || new Date().toISOString(),
          batch: { ...batch, tccs: tccsForEvaluation, evaluationSnapshot: batchSnapshot }, // Override TCCS & Snapshot for the report
          product: batch.product,
        };

        setSelectedResultForPrint(virtualResult);
        setIsPrintModalOpen(true);
      } finally {
        setIsConsolidating(false);
      }
    },
    [testResults, hydratedBatches, tccsList, notify]
  );

  return {
    isPrintModalOpen,
    setIsPrintModalOpen,
    selectedResultForPrint,
    setSelectedResultForPrint,
    handlePrint,
    handlePrintConsolidatedCoa,
    isConsolidating,
  };
};
