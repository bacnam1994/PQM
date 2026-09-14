import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CoAReport from '../../components/features/CoAReport';
import { useDataGraph, HydratedTestResult, HydratedBatch } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import {
  ArrowLeftIcon,
  PrinterIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { fetchTestResultsByBatchId, fetchTestResultById } from '../../services/testResultService';
import { calculateOverallStatus, ensureArray } from '../../utils';
import { TestResult, TestResultEntry, TCCS } from '../../types';
import { batchRepository } from '../../repositories/firebase/FirebaseBatchRepository';
import { productRepository } from '../../repositories/firebase/FirebaseProductRepository';
import { tccsRepository } from '../../repositories/firebase/FirebaseTCCSRepository';
import { formulaRepository } from '../../repositories/firebase/FirebaseFormulaRepository';

const CoAReportPage = () => {
  const { batchId, id } = useParams();
  const navigate = useNavigate();
  const { batches, testResults: hydratedResults, allTestResultsHydrated } = useDataGraph();
  const productFormulas = useAppStore((state) => (state as any).productFormulas || []);
  const tccsList = useAppStore((state) => state.tccsList);

  const [result, setResult] = useState<HydratedTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formula, setFormula] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const appState = useAppStore.getState();
        const storeBatches = appState.batches || [];
        const storeProducts = appState.products || [];
        const storeTccsList = appState.tccsList || [];
        const storeFormulas = (appState as any).productFormulas || [];

        if (id) {
          // 1. In Phiếu riêng lẻ
          // Bước 1: Tìm trong Store hoặc Cache hoặc Firebase
          let rawResult: TestResult | null = null;

          const sourceData =
            allTestResultsHydrated.length > 0 ? allTestResultsHydrated : hydratedResults;
          const resFromStore = sourceData.find((r) => r && (r.id === id || r.id.endsWith(id)));

          if (resFromStore) {
            rawResult = resFromStore;
          } else {
            rawResult = await fetchTestResultById(id);
          }

          if (!isMounted) return;

          if (!rawResult) {
            setNotFound(true);
            return;
          }

          // Bước 2: Hydrate Batch, Product, TCCS đầy đủ
          let hydratedBatch: HydratedBatch | undefined = undefined;
          let batchProduct = undefined;
          let batchTccs: TCCS | undefined = undefined;

          // Tìm Batch
          if (rawResult.batchId) {
            hydratedBatch = batches.find(
              (b) => b.id === rawResult!.batchId || b.id.endsWith(rawResult!.batchId)
            );
            if (!hydratedBatch) {
              const localBatch = storeBatches.find(
                (b) => b.id === rawResult!.batchId || b.id.endsWith(rawResult!.batchId)
              );
              if (localBatch) {
                hydratedBatch = { ...localBatch };
              } else {
                try {
                  const b = await batchRepository.findById(rawResult.batchId);
                  if (b) {
                    hydratedBatch = b as HydratedBatch;
                  }
                } catch (e) {
                  console.warn('Batch fetch failed:', e);
                }
              }
            }
          }

          // Tìm Product
          if (hydratedBatch) {
            batchProduct = hydratedBatch.product;
            if (!batchProduct && hydratedBatch.productId) {
              batchProduct = storeProducts.find((p) => p.id === hydratedBatch!.productId);
              if (!batchProduct) {
                try {
                  const p = await productRepository.findById(hydratedBatch.productId);
                  if (p) {
                    batchProduct = p;
                  }
                } catch (e) {
                  console.warn('Product fetch failed:', e);
                }
              }
            }

            // Tìm TCCS
            batchTccs = hydratedBatch.tccs;
            if (!batchTccs) {
              if (hydratedBatch.tccsId) {
                batchTccs = storeTccsList.find((t) => t.id === hydratedBatch!.tccsId);
                if (!batchTccs) {
                  try {
                    const t = await tccsRepository.findById(hydratedBatch.tccsId);
                    if (t) {
                      batchTccs = t;
                    }
                  } catch (e) {
                    console.warn('TCCS fetch failed:', e);
                  }
                }
              }

              // Nếu vẫn chưa có TCCS, tìm theo productId và ngày sản xuất
              if (!batchTccs && hydratedBatch.productId) {
                const productTccs = storeTccsList
                  .filter((t) => t.productId === hydratedBatch!.productId)
                  .sort(
                    (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
                  );
                if (productTccs.length > 0) {
                  if (hydratedBatch.mfgDate) {
                    const mfgTime = new Date(hydratedBatch.mfgDate).getTime();
                    const match = productTccs.find(
                      (t) => new Date(t.issueDate).getTime() <= mfgTime
                    );
                    batchTccs = match || productTccs[productTccs.length - 1];
                  } else {
                    batchTccs = productTccs[0];
                  }
                }
              }
            }

            hydratedBatch.product = batchProduct;
            hydratedBatch.tccs = batchTccs;
          }

          const finalResult: HydratedTestResult = {
            ...rawResult,
            batch: hydratedBatch,
            product: batchProduct || (rawResult as any).product,
          };

          if (isMounted) {
            setResult(finalResult);
          }

          // Tải công thức sản phẩm liên quan
          const prodId = hydratedBatch?.productId;
          if (prodId) {
            let fetchedFormula = storeFormulas.find((f: any) => f.productId === prodId);
            if (!fetchedFormula) {
              try {
                const formulas = await formulaRepository.findByRelation('productId', prodId);
                if (formulas.length > 0) {
                  fetchedFormula = formulas[0];
                }
              } catch (e) {
                console.warn('Formula fetch failed:', e);
              }
            }
            if (isMounted) {
              setFormula(fetchedFormula || null);
            }
          }
        } else if (batchId) {
          // 2. In CoA Tổng hợp
          let batch = batches.find((b) => b.id === batchId || b.id.endsWith(batchId));
          if (!batch) {
            const localBatch = storeBatches.find((b) => b.id === batchId || b.id.endsWith(batchId));
            if (localBatch) {
              batch = { ...localBatch };
            } else {
              try {
                const b = await batchRepository.findById(batchId);
                if (b) {
                  batch = b as HydratedBatch;
                }
              } catch (e) {
                console.warn('Batch fetch failed:', e);
              }
            }
          }

          if (!batch) {
            if (isMounted) setNotFound(true);
            return;
          }

          // Tải thông tin sản phẩm nếu thiếu
          let batchProduct = batch.product;
          if (!batchProduct && batch.productId) {
            batchProduct = storeProducts.find((p) => p.id === batch!.productId);
            if (!batchProduct) {
              try {
                const p = await productRepository.findById(batch.productId);
                if (p) {
                  batchProduct = p;
                }
              } catch (e) {
                console.warn('Product fetch failed:', e);
              }
            }
          }

          // Tải TCCS nếu thiếu
          let batchTccs = batch.tccs;
          if (!batchTccs) {
            if (batch.tccsId) {
              batchTccs = storeTccsList.find((t) => t.id === batch!.tccsId);
              if (!batchTccs) {
                try {
                  const t = await tccsRepository.findById(batch.tccsId);
                  if (t) {
                    batchTccs = t;
                  }
                } catch (e) {
                  console.warn('TCCS fetch failed:', e);
                }
              }
            }

            if (!batchTccs && batch.productId) {
              const productTccs = storeTccsList
                .filter((t) => t.productId === batch!.productId)
                .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
              if (productTccs.length > 0) {
                if (batch.mfgDate) {
                  const mfgTime = new Date(batch.mfgDate).getTime();
                  const match = productTccs.find((t) => new Date(t.issueDate).getTime() <= mfgTime);
                  batchTccs = match || productTccs[productTccs.length - 1];
                } else {
                  batchTccs = productTccs[0];
                }
              }
            }
          }

          batch.product = batchProduct;
          batch.tccs = batchTccs;

          // Lấy toàn bộ kết quả kiểm nghiệm của Lô
          const fetchedResults = await fetchTestResultsByBatchId(batchId);
          if (!isMounted) return;

          if (fetchedResults.length === 0) {
            setNotFound(true);
            return;
          }

          const resultsForBatch = [...fetchedResults].reverse(); // Đảo ngược để phiếu cũ lên trước (nạp dữ liệu đè lên nhau)
          const consolidatedResultsMap = new Map<string, TestResultEntry>();
          resultsForBatch.forEach((res: TestResult) => {
            ensureArray(res.results).forEach((entry) => {
              if (entry && entry.criteriaName) {
                const key = entry.criteriaName.trim().toLowerCase();
                consolidatedResultsMap.set(key, entry);
              }
            });
          });

          const finalResults = Array.from(consolidatedResultsMap.values());
          const latestResult = resultsForBatch[resultsForBatch.length - 1];

          let tccsForEvaluation = batch.tccs || null;

          if (isMounted) {
            setResult({
              id: `consolidated-${batchId}`,
              batchId: batchId,
              labName: 'Tổng hợp',
              testDate: latestResult.testDate,
              results: finalResults,
              overallStatus: calculateOverallStatus(finalResults, tccsForEvaluation),
              notes: `Phiếu tổng hợp từ ${resultsForBatch.length} kết quả.`,
              createdAt: new Date().toISOString(),
              batch: { ...batch, tccs: tccsForEvaluation },
              product: batch.product,
            } as HydratedTestResult);
          }

          // Tải công thức sản phẩm liên quan
          let fetchedFormula = storeFormulas.find((f: any) => f.productId === batch!.productId);
          if (!fetchedFormula && batch.productId) {
            try {
              const formulas = await formulaRepository.findByRelation('productId', batch.productId);
              if (formulas.length > 0) {
                fetchedFormula = formulas[0];
              }
            } catch (e) {
              console.warn('Formula fetch failed:', e);
            }
          }
          if (isMounted) {
            setFormula(fetchedFormula || null);
          }
        }
      } catch (err) {
        console.error('Lỗi nạp dữ liệu CoA:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id, batchId]);

  if (notFound) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border flex flex-col items-center gap-3 text-center">
          <ExclamationTriangleIcon className="w-10 h-10 text-amber-500" />
          <p className="font-black text-ink text-lg">Không tìm thấy phiếu</p>
          <p className="text-sm text-ink-muted">Phiếu kết quả này không tồn tại hoặc đã bị xóa.</p>
          <button
            onClick={() => navigate('/test-results')}
            className="mt-2 px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-surface p-8 rounded-2xl shadow-sm text-ink-muted font-bold border border-border flex items-center gap-3">
          <ArrowPathIcon className="w-5 h-5 animate-spin text-emerald-600" /> Đang thiết lập bản in
          CoA...
        </div>
      </div>
    );
  }

  const handleBack = () => {
    // Nếu được mở bằng window.open('_blank'), history.state.idx sẽ undefined hoặc bằng 0
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      // Đóng tab hiện tại nếu mở ở tab mới
      window.close();
      // Fallback nếu trình duyệt chặn close()
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-surface-3 py-8 transition-colors duration-300 print:bg-white print:py-0">
      {/* Thanh công cụ (Sẽ tự động ẩn đi khi nhấn In) */}
      <div className="coa-page-toolbar max-w-[21cm] mx-auto mb-4 flex justify-between items-center print:hidden bg-surface p-4 rounded-xl shadow-sm border border-border">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 font-bold transition-all text-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Đóng / Quay lại
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all text-sm"
        >
          <PrinterIcon className="w-4 h-4" /> In CoA
        </button>
      </div>

      {/* Khung hiển thị CoA — trên màn hình: shadow + viền trắng; khi in: bỏ hết */}
      <div className="shadow-2xl mx-auto w-fit print:shadow-none print:m-0 print:w-full">
        <CoAReport
          res={result}
          batch={result.batch}
          product={result.product}
          tccs={result.batch?.tccs}
          formula={formula}
        />
      </div>
    </div>
  );
};

export default CoAReportPage;
