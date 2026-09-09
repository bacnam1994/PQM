import React, { useMemo, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { 
  CubeIcon, 
  Square3Stack3DIcon, 
  MagnifyingGlassIcon, 
  ArrowRightIcon, 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon, 
  BeakerIcon, 
  ClockIcon 
} from '@heroicons/react/24/outline';
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
        <div className="flex flex-col items-center justify-center py-12 text-ink-muted">
          <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-ink-muted font-medium">Nhập từ khóa để tìm kiếm...</p>
        </div>

        {searchHistory.length > 0 && (
          <div className="max-w-xl mx-auto">
            <h3 className="text-sm font-bold text-ink-muted mb-3 flex items-center gap-2">
              <ClockIcon className="w-3.5 h-3.5" />
              Lịch sử tìm kiếm
            </h3>
            <div className="space-y-1.5">
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(h)}`)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-surface hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-border rounded-xl text-left transition-all group"
                >
                  <span className="flex items-center gap-2.5 text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    <ClockIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-emerald-500" />
                    {h}
                  </span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
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
        icon={MagnifyingGlassIcon} 
      />

      {/* Products */}
      {results.products.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <CubeIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Sản phẩm ({results.products.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.products.map(p => (
              <Link key={p.id} to={`/products/${p.id}`} className="block p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{p.name}</p>
                    <p className="text-xs text-ink-muted font-bold uppercase">{p.code}</p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-ink-muted group-hover:text-emerald-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Batches */}
      {results.batches.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Square3Stack3DIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Lô sản xuất ({results.batches.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.batches.map(b => (
              <Link key={b.id} to={`/batches/${b.id}`} className="block p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Lô: {b.batchNo}</p>
                    <p className="text-xs text-ink-muted">{b.productName}</p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-ink-muted group-hover:text-emerald-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      {results.materials.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <BeakerIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Nguyên liệu ({results.materials.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.materials.map(m => (
              <Link key={m.id} to={`/materials/edit/${m.id}`} className="block p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-ink group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{m.name}</p>
                    <p className="text-xs text-ink-muted font-bold uppercase">{m.code || m.category}</p>
                    {m.aliases?.length > 0 && <p className="text-[10px] text-ink-muted mt-0.5 italic">{m.aliases.slice(0, 2).join(', ')}</p>}
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-ink-muted group-hover:text-amber-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Test Results */}
      {results.testResults.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Phiếu Kiểm nghiệm ({results.testResults.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.testResults.map((r: any) => (
              <Link key={r.id} to={`/test-results/print/${r.id}`} className="block p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-ink group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Lô: {r.batchNo || r.batchId}</p>
                    <p className="text-xs text-ink-muted truncate">{r.productName}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${r.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>{r.overallStatus}</span>
                      <span className="text-[10px] text-ink-muted">{formatDateStandard(r.testDate)}</span>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-ink-muted group-hover:text-purple-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TCCS */}
      {results.tccs.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <DocumentTextIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" /> Tiêu chuẩn cơ sở ({results.tccs.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.tccs.map(t => (
              <Link key={t.id} to={`/tccs/detail/${t.id}`} className="block p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-ink group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{t.code}</p>
                    <p className="text-xs text-ink-muted">{t.productName}</p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-ink-muted group-hover:text-sky-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalCount === 0 && (
        <div className="text-center py-12 bg-surface-2 rounded-2xl border border-border border-dashed">
          <p className="text-ink-muted font-medium">Không tìm thấy kết quả nào cho "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;