import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Package, Layers, FileText, Activity, 
  Printer, TrendingUp, AlertTriangle, GitPullRequest, 
  ExternalLink, CheckCircle2, FlaskConical, Sparkles 
} from 'lucide-react';
import { useDataGraph } from '../../../hooks/useDataGraph';
import { ensureArray, formatDateStandard } from '../../../utils';
import { ProductTccsHistory } from './components/ProductTccsHistory';
import { ProductBatchReleaseMatrix } from './components/ProductBatchReleaseMatrix';

export const Product360Page: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products } = useDataGraph();

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'TCCS' | 'FORMULA'>('BATCHES');

  // Lấy dữ liệu sản phẩm đã được hydrate đầy đủ
  const product = useMemo(() => {
    if (!id) return null;
    return products.find(p => p.id === id) || null;
  }, [id, products]);

  const batches = useMemo(() => ensureArray(product?.batches), [product]);
  const tccsList = useMemo(() => ensureArray(product?.allTCCS), [product]);
  const activeTccs = useMemo(() => product?.activeTCCS, [product]);
  const formula = useMemo(() => product?.formula, [product]);

  const totalBatches = batches.length;
  const releasedBatches = batches.filter(b => b.status === 'RELEASED').length;
  const releaseRate = totalBatches > 0 ? Math.round((releasedBatches / totalBatches) * 100) : 100;

  if (!product) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
          <Package className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Không tìm thấy sản phẩm</h2>
        <p className="text-slate-500 text-sm mt-1">Sản phẩm không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh mục Sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header điều hướng & Tiêu đề Product 360 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate(`/products/${product.id}`)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition-colors"
            title="Quay lại chi tiết sản phẩm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                PRODUCT 360° QUALITY COCKPIT
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                product.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {product.status || 'ACTIVE'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {product.name} ({product.code})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hồ sơ chất lượng toàn diện vòng đời sản phẩm, tiến trình tiêu chuẩn và hiệu năng sản xuất
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/products/${product.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Hồ sơ gốc</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In hồ sơ 360</span>
          </button>
        </div>
      </div>

      {/* Thông tin vắn tắt KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Nhóm sản phẩm</span>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate block mt-0.5">
            {product.group || 'Chưa phân nhóm'}
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">TCCS hiện hành</span>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate block mt-0.5">
            {activeTccs ? activeTccs.code : 'Chưa kích hoạt'}
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tổng số lô đã sản xuất</span>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate block mt-0.5">
            {totalBatches} lô ({releasedBatches} đạt)
          </span>
        </div>
        <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tỷ lệ xuất xưởng</span>
          <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
            {releaseRate}%
          </span>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'BATCHES'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Ma trận Lô & Tỷ lệ Đạt (Release Matrix)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {totalBatches}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('TCCS')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'TCCS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Lịch sử Tiến hóa TCCS (Standards History)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {tccsList.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('FORMULA')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'FORMULA'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Công thức & Nguyên liệu (Formula)</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'BATCHES' && (
        <ProductBatchReleaseMatrix batches={batches} />
      )}

      {activeTab === 'TCCS' && (
        <ProductTccsHistory tccsList={tccsList} activeTccsId={activeTccs?.id} />
      )}

      {activeTab === 'FORMULA' && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                Định mức Công thức & Nguyên vật liệu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thành phần hoạt chất, hàm lượng công bố và nguyên tố quy đổi
              </p>
            </div>
            {formula && (
              <Link
                to={`/product-formulas/edit/${formula.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Chỉnh sửa công thức <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {!formula || !formula.ingredients || formula.ingredients.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Sản phẩm chưa có hồ sơ công thức định mức.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Thành phần hoạt chất</th>
                    <th className="p-3">Hàm lượng công bố</th>
                    <th className="p-3">Hàm lượng nguyên tố</th>
                    <th className="p-3">Đơn vị</th>
                    <th className="p-3">Nguyên liệu liên kết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {formula.ingredients.map((ing, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{ing.name}</td>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{ing.declaredContent ?? '—'}</td>
                      <td className="p-3 text-slate-800 dark:text-slate-200">{ing.elementalContent ?? '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{ing.unit || '—'}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {ing.materialId ? (
                          <Link to="/materials" className="text-blue-600 hover:underline">
                            Mã: {ing.materialId}
                          </Link>
                        ) : 'Chưa gắn'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
