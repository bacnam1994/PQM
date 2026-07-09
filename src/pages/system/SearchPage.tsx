import React, { useMemo, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Package, Layers, Search as SearchIcon, ArrowRight, FileText, ClipboardCheck, FlaskConical, Clock, X } from 'lucide-react';
import { PageHeader } from '../../components';
import { formatDateStandard } from '../../utils';
import { useUIStore } from '../../store/useUIStore';

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const { addSearchHistory, searchHistory } = useUIStore(useShallow(s => ({
    addSearchHistory: s.addSearchHistory,
    searchHistory: s.searchHistory,
  })));

  // Lưu vào lịch sử khi có query hợp lệ
  useEffect(() => {
    if (query.trim().length >= 2) {
      addSearchHistory(query.trim());
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Tối ưu: gom nhóm selectors bằng useShallow để tránh re-render không cần thiết
  const { productsState, batchesState, tccsState, rawMaterialsState, testResultsState } = useAppStore(useShallow(state => ({
    productsState: state.products,
    batchesState: state.batches,
    tccsState: state.tccsList,
    rawMaterialsState: state.rawMaterials,
    testResultsState: state.testResults,
  })));

  const results = useMemo(() => {
    if (!query) return { products: [], batches: [], tccs: [], materials: [], testResults: [] };
    const lowerQuery = query.toLowerCase();

    const productMap = new Map(productsState.map(p => [p.id, p]));
    const batchMap = new Map(batchesState.map(b => [b.id, b]));

    const products = productsState.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.code.toLowerCase().includes(lowerQuery)
    );

    const batches = batchesState.filter(b => {
      const product = productMap.get(b.productId);
      const pName = product ? product.name.toLowerCase() : '';
      return b.batchNo.toLowerCase().includes(lowerQuery) || pName.includes(lowerQuery);
    }).map(b => ({
      ...b,
      productName: productMap.get(b.productId)?.name
    }));

    const tccs = tccsState.filter(t => {
      const product = productMap.get(t.productId);
      const pName = product ? product.name.toLowerCase() : '';
      return t.code.toLowerCase().includes(lowerQuery) || pName.includes(lowerQuery);
    }).map(t => ({
      ...t,
      productName: productMap.get(t.productId)?.name
    }));

    const materials = rawMaterialsState.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) || 
      (m.code || '').toLowerCase().includes(lowerQuery) ||
      m.aliases?.some(a => a.toLowerCase().includes(lowerQuery))
    );

    const testResults = testResultsState.filter(r => {
      const batch = batchMap.get(r.batchId);
      const product = batch ? productMap.get(batch.productId) : undefined;
      const batchNo = batch?.batchNo?.toLowerCase() || '';
      const productName = product?.name?.toLowerCase() || '';
      const labName = r.labName?.toLowerCase() || '';
      return batchNo.includes(lowerQuery) || productName.includes(lowerQuery) || labName.includes(lowerQuery);
    }).map(r => {
      const batch = batchMap.get(r.batchId);
      const product = batch ? productMap.get(batch.productId) : undefined;
      return { ...r, batchNo: batch?.batchNo, productName: product?.name };
    });

    return { products, batches, tccs, materials, testResults };
  }, [query, productsState, batchesState, tccsState, rawMaterialsState, testResultsState]);

  const totalCount = results.products.length + results.batches.length + results.tccs.length + results.materials.length + results.testResults.length;

  if (!query) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <SearchIcon size={48} className="mb-4 opacity-20" />
          <p className="text-slate-500 font-medium">Nhập từ khóa để tìm kiếm...</p>
        </div>

        {searchHistory.length > 0 && (
          <div className="max-w-xl mx-auto">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
              <Clock size={14} />
              Lịch sử tìm kiếm
            </h3>
            <div className="space-y-1.5">
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(h)}`)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-xl text-left transition-all group"
                >
                  <span className="flex items-center gap-2.5 text-slate-600 group-hover:text-indigo-700">
                    <Clock size={13} className="text-slate-300 group-hover:text-indigo-400" />
                    {h}
                  </span>
                  <ArrowRight size={13} className="text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title={`Kết quả tìm kiếm: "${query}"`} 
        subtitle={`Tìm thấy ${totalCount} kết quả phù hợp.`}
        icon={SearchIcon} 
      />

      {/* Products */}
      {results.products.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            <Package className="text-indigo-600 dark:text-indigo-400" size={20} /> Sản phẩm ({results.products.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.products.map(p => (
              <Link key={p.id} to={`/products/${p.id}`} className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">{p.code}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Batches */}
      {results.batches.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            <Layers className="text-emerald-600 dark:text-emerald-400" size={20} /> Lô sản xuất ({results.batches.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.batches.map(b => (
              <Link key={b.id} to={`/batches/${b.id}`} className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Lô: {b.batchNo}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{b.productName}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      {results.materials.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            <FlaskConical className="text-orange-600 dark:text-orange-400" size={20} /> Nguyên liệu ({results.materials.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.materials.map(m => (
              <Link key={m.id} to={`/materials/edit/${m.id}`} className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{m.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">{m.code || m.category}</p>
                    {m.aliases?.length > 0 && <p className="text-[10px] text-slate-400 mt-0.5 italic">{m.aliases.slice(0, 2).join(', ')}</p>}
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-orange-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Test Results */}
      {results.testResults.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            <ClipboardCheck className="text-purple-600 dark:text-purple-400" size={20} /> Phiếu Kiểm nghiệm ({results.testResults.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.testResults.map((r: any) => (
              <Link key={r.id} to={`/test-results/print/${r.id}`} className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Lô: {r.batchNo || r.batchId}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.productName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${r.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>{r.overallStatus}</span>
                      <span className="text-[10px] text-slate-400">{formatDateStandard(r.testDate)}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TCCS */}
      {results.tccs.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            <FileText className="text-blue-600 dark:text-blue-400" size={20} /> Tiêu chuẩn cơ sở ({results.tccs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.tccs.map(t => (
              <Link key={t.id} to={`/tccs/detail/${t.id}`} className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t.code}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t.productName}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalCount === 0 && (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed">
          <p className="text-slate-500 dark:text-slate-400 font-medium">Không tìm thấy kết quả nào cho "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;