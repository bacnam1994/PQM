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
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
          <MagnifyingGlassIcon className="w-10 h-10 mb-3 opacity-30 text-ink-muted" />
          <p className="text-ink font-medium text-sm">Tìm kiếm dữ liệu toàn hệ thống</p>
          <p className="text-xs text-ink-muted mt-1">Nhập mã hoặc tên sản phẩm, số lô, nguyên liệu, TCCS...</p>
        </div>

        {searchHistory.length > 0 && (
          <div className="max-w-xl mx-auto">
            <h3 className="text-xs font-semibold text-ink-muted mb-3 flex items-center gap-2">
              <ClockIcon className="w-3.5 h-3.5" />
              Lịch sử tìm kiếm gần đây
            </h3>
            <div className="space-y-1.5">
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(h)}`)}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-surface hover:bg-surface-2 border border-border rounded-lg text-left transition-all group active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5 text-xs text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium">
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
    <div className="space-y-8 animate-in fade-in duration-200">
      <PageHeader 
        title={`Kết quả tìm kiếm: "${query}"`} 
        subtitle={`Tìm thấy ${totalCount} kết quả phù hợp trên toàn hệ thống.`}
        icon={MagnifyingGlassIcon} 
      />

      {/* Products */}
      {results.products.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Sản phẩm
            <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {results.products.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.products.map(p => (
              <Link key={p.id} to={`/products/${p.id}`} className="block p-3.5 bg-surface rounded-xl border border-border hover:bg-surface-2/50 shadow-xs hover:shadow-sm transition-all group active:scale-[0.99]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-ink text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{p.name}</p>
                    <p className="text-[10px] text-ink-muted font-mono font-medium uppercase mt-0.5">{p.code}</p>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-emerald-500 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Batches */}
      {results.batches.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Square3Stack3DIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Lô sản xuất
            <span className="text-[11px] font-medium bg-teal-500/10 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full border border-teal-500/20">
              {results.batches.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.batches.map(b => (
              <Link key={b.id} to={`/batches/${b.id}`} className="block p-3.5 bg-surface rounded-xl border border-border hover:bg-surface-2/50 shadow-xs hover:shadow-sm transition-all group active:scale-[0.99]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-ink text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Lô: {b.batchNo}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{b.productName}</p>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-emerald-500 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      {results.materials.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <BeakerIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Nguyên liệu
            <span className="text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
              {results.materials.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.materials.map(m => (
              <Link key={m.id} to={`/materials/edit/${m.id}`} className="block p-3.5 bg-surface rounded-xl border border-border hover:bg-surface-2/50 shadow-xs hover:shadow-sm transition-all group active:scale-[0.99]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-ink text-xs group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{m.name}</p>
                    <p className="text-[10px] text-ink-muted font-mono font-medium uppercase mt-0.5">{m.code || m.category}</p>
                    {m.aliases?.length > 0 && <p className="text-[10px] text-ink-muted mt-0.5 italic">{m.aliases.slice(0, 2).join(', ')}</p>}
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-amber-500 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Test Results */}
      {results.testResults.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ClipboardDocumentCheckIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Phiếu Kiểm nghiệm
            <span className="text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {results.testResults.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.testResults.map((r: any) => (
              <Link key={r.id} to={`/test-results/print/${r.id}`} className="block p-3.5 bg-surface rounded-xl border border-border hover:bg-surface-2/50 shadow-xs hover:shadow-sm transition-all group active:scale-[0.99]">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Lô: {r.batchNo || r.batchId}</p>
                    <p className="text-xs text-ink-muted truncate mt-0.5">{r.productName}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.overallStatus === 'PASS' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'}`}>{r.overallStatus}</span>
                      <span className="text-[10px] text-ink-muted">{formatDateStandard(r.testDate)}</span>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-indigo-500 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TCCS */}
      {results.tccs.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <DocumentTextIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Tiêu chuẩn cơ sở
            <span className="text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20">
              {results.tccs.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.tccs.map(t => (
              <Link key={t.id} to={`/tccs/detail/${t.id}`} className="block p-3.5 bg-surface rounded-xl border border-border hover:bg-surface-2/50 shadow-xs hover:shadow-sm transition-all group active:scale-[0.99]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-ink text-xs group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{t.code}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{t.productName}</p>
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-muted group-hover:text-sky-500 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalCount === 0 && (
        <div className="text-center py-12 bg-surface rounded-xl border border-border border-dashed shadow-2xs">
          <p className="text-ink-muted text-xs">Không tìm thấy kết quả nào phù hợp với từ khóa "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;