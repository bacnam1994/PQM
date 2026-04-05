import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataGraph, HydratedTestResult } from './useDataGraph';
import { TestResultEntry } from '../types';
import { ensureArray, calculateOverallStatus } from '../utils';

export const useTestResultPrint = () => {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedResultForPrint, setSelectedResultForPrint] = useState<HydratedTestResult | null>(null);

  const testResults = useAppStore(state => state.testResults);
  const tccsList = useAppStore(state => state.tccsList);
  const notify = useAppStore(state => state.notify);
  const { batches: hydratedBatches } = useDataGraph();

  const handlePrint = useCallback((res: HydratedTestResult) => {
    setSelectedResultForPrint(res);
    setIsPrintModalOpen(true);
  }, []);

  const handlePrintConsolidatedCoa = useCallback((batchId: string) => {
    if (!batchId) return;

    const resultsForBatch = testResults
      .filter(r => r.batchId === batchId)
      .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());

    if (resultsForBatch.length === 0) {
      notify({ type: 'INFO', message: 'Lô này chưa có kết quả kiểm nghiệm nào.' });
      return;
    }

    const consolidatedResultsMap = new Map<string, TestResultEntry>();

    resultsForBatch.forEach(res => {
      ensureArray(res.results).forEach(entry => {
        if (entry && entry.criteriaName) {
          consolidatedResultsMap.set(entry.criteriaName, entry);
        }
      });
    });

    const finalResults = Array.from(consolidatedResultsMap.values());
    const latestResult = resultsForBatch[resultsForBatch.length - 1];
    const batch = hydratedBatches.find(b => b.id === batchId);
    if (!batch) return;

    const availableTCCSForBatch = tccsList
      .filter(t => t.productId === batch.productId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    
    let tccsForEvaluation = null;
    if (availableTCCSForBatch.length > 0) {
        if (batch.mfgDate) {
            const mfgTime = new Date(batch.mfgDate).getTime();
            const match = availableTCCSForBatch.find(t => new Date(t.issueDate).getTime() <= mfgTime);
            tccsForEvaluation = match || availableTCCSForBatch[availableTCCSForBatch.length - 1];
        } else {
            tccsForEvaluation = availableTCCSForBatch[0];
        }
    }

    const overallStatus = calculateOverallStatus(finalResults, tccsForEvaluation);

    const virtualResult: HydratedTestResult = {
      id: `consolidated-${batchId}`,
      batchId: batchId,
      labName: 'Tổng hợp',
      testDate: latestResult.testDate,
      results: finalResults,
      overallStatus: overallStatus,
      notes: `Phiếu tổng hợp từ ${resultsForBatch.length} kết quả.`,
      createdAt: new Date().toISOString(),
      batch: { ...batch, tccs: tccsForEvaluation }, // Override TCCS for the report
      product: batch.product,
    };

    setSelectedResultForPrint(virtualResult);
    setIsPrintModalOpen(true);
  }, [testResults, hydratedBatches, tccsList, notify]);

  return {
    isPrintModalOpen,
    setIsPrintModalOpen,
    selectedResultForPrint,
    setSelectedResultForPrint,
    handlePrint,
    handlePrintConsolidatedCoa
  };
};