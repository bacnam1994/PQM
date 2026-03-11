import React, { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Package, Layers, FileText, Search as SearchIcon, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/CommonUI';

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { state } = useAppContext();

  const results = useMemo(() => {
    if (!query) return { products: [], batches: [], tccs: [] };
    const lowerQuery = query.toLowerCase();

    const products = state.products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.code.toLowerCase().includes(lowerQuery)
    );

    const batches = state.batches.filter(b => {
      const product = state.products.find(p => p.id === b.productId);
      const pName = product ? product.name.toLowerCase() : '';
      return b.batchNo.toLowerCase().includes(lowerQuery) || pName.includes(lowerQuery);
    }).map(b => ({
      ...b,
      productName: state.products.find(p => p.id === b.productId)?.name
    }));

    const tccs = state.tccsList.filter(t => {
      const product = state.products.find(p => p.id === t.productId);
      const pName = product ? product.name.toLowerCase() : '';
      return t.code.toLowerCase().includes(lowerQuery) || pName.includes(lowerQuery);
    }).map(t => ({
      ...t,
      productName: state.products.find(p => p.id === t.productId)?.name
    }));

    return { products, batches, tccs };
  }, [query, state]);

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <SearchIcon size={48} className="mb-4 opacity-20" />
        <p>Nhập từ khóa để tìm kiếm...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title={`Kết quả tìm kiếm: "${query}"`} 
        subtitle={`Tìm thấy ${results.products.length + results.batches.length + results.tccs.length} kết quả phù hợp.`}
        icon={SearchIcon} 
      />

      {/* Products */}
      {results.products.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Package className="text-indigo-600" size={20} /> Sản phẩm ({results.products.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.products.map(p => (
              <Link key={p.id} to={`/products/${p.id}`} className="block p-4 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{p.name}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase">{p.code}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Batches */}
      {results.batches.length > 0 && (
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Layers className="text-emerald-600" size={20} /> Lô sản xuất ({results.batches.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.batches.map(b => (
              <Link key={b.id} to={`/batches`} className="block p-4 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">Lô: {b.batchNo}</p>
                    <p className="text-xs text-slate-400">{b.productName}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.products.length === 0 && results.batches.length === 0 && results.tccs.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
          <p className="text-slate-500 font-medium">Không tìm thấy kết quả nào cho "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;