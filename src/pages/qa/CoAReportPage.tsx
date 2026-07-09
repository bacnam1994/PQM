import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CoAReport from '../../components/features/CoAReport';
import { useDataGraph, HydratedTestResult, HydratedBatch } from '../../hooks/useDataGraph';
import { useAppStore } from '../../store/useAppStore';
import { ArrowLeft, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { fetchTestResultsByBatchId, fetchTestResultById } from '../../services/testResultService';
import { calculateOverallStatus, ensureArray } from '../../utils';
import { TestResult, TestResultEntry, TCCS } from '../../types';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../firebase';

const CoAReportPage = () => {
  const { batchId, id } = useParams();
  const navigate = useNavigate();
  const { batches, testResults: hydratedResults, allTestResultsHydrated } = useDataGraph();
  const productFormulas = useAppStore(state => (state as any).productFormulas || []);
  const tccsList = useAppStore(state => state.tccsList);
  
  const [result, setResult] = useState<HydratedTestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [formula, setFormula] = useState<any>(null);
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (id) {
          // 1. In Phiếu riêng lẻ
          // Bước 1: Tìm trong store (nhanh, ưu tiên)
          const sourceData = allTestResultsHydrated.length > 0 ? allTestResultsHydrated : hydratedResults;
          const resFromStore = sourceData.find(r => r.id === id || r.id.endsWith(id));

          let finalResult: HydratedTestResult | null = null;
          let hydratedBatch: HydratedBatch | undefined = undefined;

          if (resFromStore) {
            finalResult = resFromStore as HydratedTestResult;
            hydratedBatch = finalResult.batch;
          } else {
            // Bước 2: Fallback – fetch trực tiếp từ Firebase (khi mở tab mới, store chưa load)
            const rawResult = await fetchTestResultById(id);
            if (rawResult) {
              // Hydrate batch: ưu tiên store, fallback Firebase
              hydratedBatch = batches.find(b => b.id === rawResult.batchId);
              let batchProduct = hydratedBatch?.product;
              let batchTccs = hydratedBatch?.tccs;

              if (!hydratedBatch) {
                // Store chưa load batch → fetch trực tiếp
                try {
                  const batchSnap = await get(ref(db, `batches/${rawResult.batchId}`));
                  if (batchSnap.exists()) {
                    hydratedBatch = batchSnap.val() as HydratedBatch;
                  }
                } catch (e) { console.warn('Batch fetch failed:', e); }
              }

              if (hydratedBatch) {
                if (!batchProduct && hydratedBatch.productId) {
                  try {
                    const productSnap = await get(ref(db, `products/${hydratedBatch.productId}`));
                    if (productSnap.exists()) {
                      batchProduct = productSnap.val();
                    }
                  } catch (e) { console.warn('Product fetch failed:', e); }
                }
                if (!batchTccs && hydratedBatch.tccsId) {
                  try {
                    const tccsSnap = await get(ref(db, `tccs/${hydratedBatch.tccsId}`));
                    if (tccsSnap.exists()) {
                      batchTccs = tccsSnap.val();
                    }
                  } catch (e) { console.warn('TCCS fetch failed:', e); }
                }
                hydratedBatch.product = batchProduct;
                hydratedBatch.tccs = batchTccs;
              }

              finalResult = {
                ...rawResult,
                batch: hydratedBatch,
                product: batchProduct,
              } as HydratedTestResult;
            } else {
              setNotFound(true);
            }
          }

          if (finalResult) {
            setResult(finalResult);
            // Tải công thức sản phẩm liên quan
            const prodId = finalResult.batch?.productId;
            if (prodId) {
              let fetchedFormula = productFormulas.find((f: any) => f.productId === prodId);
              if (!fetchedFormula) {
                try {
                  const formulaQuery = query(ref(db, 'product_formulas'), orderByChild('productId'), equalTo(prodId));
                  const formulaSnap = await get(formulaQuery);
                  if (formulaSnap.exists()) {
                    const formulas = Object.values(formulaSnap.val());
                    if (formulas.length > 0) {
                      fetchedFormula = formulas[0];
                    }
                  }
                } catch (e) { console.warn('Formula fetch failed:', e); }
              }
              setFormula(fetchedFormula || null);
            }
          }
        } else if (batchId) {
          // 2. In CoA Tổng hợp
          let batch = batches.find(b => b.id === batchId || b.id.endsWith(batchId));
          let batchProduct = batch?.product;
          let batchTccs = batch?.tccs;

          if (!batch) {
            try {
              const batchSnap = await get(ref(db, `batches/${batchId}`));
              if (batchSnap.exists()) {
                batch = batchSnap.val() as HydratedBatch;
              }
            } catch (e) { console.warn('Batch fetch failed:', e); }
          }

          if (!batch) {
            setNotFound(true);
            return;
          }

          // Tải thông tin sản phẩm và TCCS nếu thiếu
          if (!batchProduct && batch.productId) {
            try {
              const productSnap = await get(ref(db, `products/${batch.productId}`));
              if (productSnap.exists()) {
                batchProduct = productSnap.val();
              }
            } catch (e) { console.warn('Product fetch failed:', e); }
          }

          if (!batchTccs) {
            if (batch.tccsId) {
              try {
                const tccsSnap = await get(ref(db, `tccs/${batch.tccsId}`));
                if (tccsSnap.exists()) {
                  batchTccs = tccsSnap.val();
                }
              } catch (e) { console.warn('TCCS fetch failed:', e); }
            } else {
              // Tải tất cả TCCS cho sản phẩm này và chọn cái phù hợp với ngày sản xuất
              try {
                const tccsQuery = query(ref(db, 'tccs'), orderByChild('productId'), equalTo(batch.productId));
                const tccsSnap = await get(tccsQuery);
                if (tccsSnap.exists()) {
                  const productTCCSList = Object.values(tccsSnap.val()) as TCCS[];
                  const availableTCCSForBatch = productTCCSList.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
                  if (availableTCCSForBatch.length > 0) {
                    if (batch.mfgDate) {
                      const mfgTime = new Date(batch.mfgDate).getTime();
                      const match = availableTCCSForBatch.find(t => new Date(t.issueDate).getTime() <= mfgTime);
                      batchTccs = match || availableTCCSForBatch[availableTCCSForBatch.length - 1];
                    } else {
                      batchTccs = availableTCCSForBatch[0];
                    }
                  }
                }
              } catch (e) { console.warn('TCCS query failed:', e); }
            }
          }

          batch.product = batchProduct;
          batch.tccs = batchTccs;

          const fetchedResults = await fetchTestResultsByBatchId(batchId);
          const resultsForBatch = fetchedResults.reverse(); // Đảo ngược để phiếu cũ lên trước (nạp dữ liệu đè lên nhau)
          if (resultsForBatch.length === 0) {
            setNotFound(true);
            return;
          }

          const consolidatedResultsMap = new Map<string, TestResultEntry>();
          resultsForBatch.forEach((res: TestResult) => {
            ensureArray(res.results).forEach(entry => {
              if (entry && entry.criteriaName) {
                const key = entry.criteriaName.trim().toLowerCase();
                consolidatedResultsMap.set(key, entry);
              }
            });
          });

          const finalResults = Array.from(consolidatedResultsMap.values());
          const latestResult = resultsForBatch[resultsForBatch.length - 1];

          let tccsForEvaluation = batch.tccs || null;
          if (!tccsForEvaluation && tccsList.length > 0) {
            const availableTCCSForBatch = tccsList.filter(t => t.productId === batch.productId).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
            if (availableTCCSForBatch.length > 0) {
              if (batch.mfgDate) {
                const mfgTime = new Date(batch.mfgDate).getTime();
                const match = availableTCCSForBatch.find(t => new Date(t.issueDate).getTime() <= mfgTime);
                tccsForEvaluation = match || availableTCCSForBatch[availableTCCSForBatch.length - 1];
              } else {
                tccsForEvaluation = availableTCCSForBatch[0];
              }
            }
          }

          setResult({
            id: `consolidated-${batchId}`, batchId: batchId, labName: 'Tổng hợp', testDate: latestResult.testDate,
            results: finalResults, overallStatus: calculateOverallStatus(finalResults, tccsForEvaluation),
            notes: `Phiếu tổng hợp từ ${resultsForBatch.length} kết quả.`, createdAt: new Date().toISOString(),
            batch: { ...batch, tccs: tccsForEvaluation }, product: batch.product,
          } as HydratedTestResult);

          // Tải công thức sản phẩm liên quan
          let fetchedFormula = productFormulas.find((f: any) => f.productId === batch.productId);
          if (!fetchedFormula && batch.productId) {
            try {
              const formulaQuery = query(ref(db, 'product_formulas'), orderByChild('productId'), equalTo(batch.productId));
              const formulaSnap = await get(formulaQuery);
              if (formulaSnap.exists()) {
                const formulas = Object.values(formulaSnap.val());
                if (formulas.length > 0) {
                  fetchedFormula = formulas[0];
                }
              }
            } catch (e) { console.warn('Formula fetch failed:', e); }
          }
          setFormula(fetchedFormula || null);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    loadData();
  }, [id, batchId, batches, hydratedResults, allTestResultsHydrated, tccsList, productFormulas]);

  if (notFound) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={36} className="text-amber-500" />
          <p className="font-black text-slate-700 text-lg">Không tìm thấy phiếu</p>
          <p className="text-sm text-slate-400">Phiếu kết quả này không tồn tại hoặc đã bị xóa.</p>
          <button onClick={() => navigate('/test-results')} className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all">
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-slate-500 font-bold border border-slate-100 flex items-center gap-3">
          <Loader2 className="animate-spin" /> Đang thiết lập bản in CoA...
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
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 py-8 transition-colors duration-300 print:bg-white print:py-0">
      {/* Thanh công cụ (Sẽ tự động ẩn đi khi nhấn In) */}
      <div className="coa-page-toolbar max-w-[21cm] mx-auto mb-4 flex justify-between items-center print:hidden bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
         <button onClick={handleBack} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-all">
            <ArrowLeft size={18} /> Đóng / Quay lại
         </button>
         <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
            <Printer size={18} /> In CoA
         </button>
      </div>

      {/* Khung hiển thị CoA — trên màn hình: shadow + viền trắng; khi in: bỏ hết */}
      <div className="shadow-2xl mx-auto w-fit print:shadow-none print:m-0 print:w-full">
         <CoAReport res={result} batch={result.batch} product={result.product} tccs={result.batch?.tccs} formula={formula} />
      </div>
    </div>
  );
};

export default CoAReportPage;