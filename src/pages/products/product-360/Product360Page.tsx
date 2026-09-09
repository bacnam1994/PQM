import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  CubeIcon, 
  Square3Stack3DIcon, 
  DocumentTextIcon, 
  ChartBarSquareIcon, 
  PrinterIcon, 
  ArrowTrendingUpIcon, 
  ExclamationTriangleIcon, 
  ArrowsRightLeftIcon, 
  ArrowTopRightOnSquareIcon, 
  CheckCircleIcon, 
  BeakerIcon, 
  SparklesIcon 
} from '@heroicons/react/24/outline';
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
        <div className="inline-block p-4 bg-surface-2 rounded-2xl mb-4 border border-border">
          <CubeIcon className="w-8 h-8 text-ink-muted" />
        </div>
        <h2 className="text-xl font-bold text-ink">Không tìm thấy sản phẩm</h2>
        <p className="text-ink-muted text-sm mt-1">Sản phẩm không tồn tại hoặc đã bị xóa khỏi hệ thống.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh mục Sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header điều hướng & Tiêu đề Product 360 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate(`/products/${product.id}`)}
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-xl transition-colors border border-border"
            title="Quay lại chi tiết sản phẩm"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                PRODUCT 360° QUALITY COCKPIT
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                product.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' :
                'bg-surface-3 text-ink-muted border border-border'
              }`}>
                {product.status || 'ACTIVE'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-ink mt-1">
              {product.name} ({product.code})
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Hồ sơ chất lượng toàn diện vòng đời sản phẩm, tiến trình tiêu chuẩn và hiệu năng sản xuất
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/products/${product.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-soft bg-surface-2 hover:bg-surface-3 border border-border rounded-xl transition-colors shadow-sm"
          >
            <CubeIcon className="w-3.5 h-3.5" />
            <span>Hồ sơ gốc</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 border border-emerald-500/20 rounded-xl transition-colors shadow-sm"
          >
            <PrinterIcon className="w-3.5 h-3.5" />
            <span>In hồ sơ 360</span>
          </button>
        </div>
      </div>

      {/* Thông tin vắn tắt KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-sm">
          <span className="text-[11px] text-ink-muted block">Nhóm sản phẩm</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {product.group || 'Chưa phân nhóm'}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-sm">
          <span className="text-[11px] text-ink-muted block">TCCS hiện hành</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {activeTccs ? activeTccs.code : 'Chưa kích hoạt'}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-sm">
          <span className="text-[11px] text-ink-muted block">Tổng số lô đã sản xuất</span>
          <span className="font-semibold text-sm text-ink truncate block mt-0.5">
            {totalBatches} lô ({releasedBatches} đạt)
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-xl border border-border shadow-sm">
          <span className="text-[11px] text-ink-muted block">Tỷ lệ xuất xưởng</span>
          <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
            {releaseRate}%
          </span>
        </div>
      </div>

      {/* Tabs điều hướng */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'BATCHES'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Square3Stack3DIcon className="w-4 h-4" />
          <span>Ma trận Lô & Tỷ lệ Đạt (Release Matrix)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">
            {totalBatches}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('TCCS')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'TCCS'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          <span>Lịch sử Tiến hóa TCCS (Standards History)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">
            {tccsList.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('FORMULA')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'FORMULA'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <BeakerIcon className="w-4 h-4" />
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
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-semibold text-ink text-sm">
                Định mức Công thức & Nguyên vật liệu
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Thành phần hoạt chất, hàm lượng công bố và nguyên tố quy đổi
              </p>
            </div>
            {formula && (
              <Link
                to={`/product-formulas/edit/${formula.id}`}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                Chỉnh sửa công thức <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {!formula || !formula.ingredients || formula.ingredients.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-sm">
              Sản phẩm chưa có hồ sơ công thức định mức.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2 text-ink uppercase font-semibold">
                  <tr>
                    <th className="p-3">Thành phần hoạt chất</th>
                    <th className="p-3">Hàm lượng công bố</th>
                    <th className="p-3">Hàm lượng nguyên tố</th>
                    <th className="p-3">Đơn vị</th>
                    <th className="p-3">Nguyên liệu liên kết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {formula.ingredients.map((ing, idx) => (
                    <tr key={idx} className="hover:bg-surface-2 transition-colors">
                      <td className="p-3 font-medium text-ink">{ing.name}</td>
                      <td className="p-3 text-ink-soft">{ing.declaredContent ?? '—'}</td>
                      <td className="p-3 text-ink-soft">{ing.elementalContent ?? '—'}</td>
                      <td className="p-3 text-ink-muted">{ing.unit || '—'}</td>
                      <td className="p-3 text-ink-muted">
                        {ing.materialId ? (
                          <Link to="/materials" className="text-emerald-600 dark:text-emerald-400 hover:underline">
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
