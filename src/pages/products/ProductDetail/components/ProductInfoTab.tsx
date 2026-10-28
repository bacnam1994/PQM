import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TagIcon,
  EyeIcon,
  Square3Stack3DIcon,
  BeakerIcon,
  DocumentTextIcon,
  CubeIcon,
  ChartBarSquareIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Product, ProductFormula, TCCS, Batch, TestResult } from '../../../../types';
import { formatDateStandard } from '../../../../utils';

interface ProductInfoTabProps {
  product: Product;
  productFormula: ProductFormula | undefined;
  activeTCCS: TCCS | undefined;
  productTCCSList: TCCS[];
  batches: Batch[];
  allProductResults: TestResult[];
  setActiveTab: (tab: 'info' | 'formula' | 'tccs' | 'history' | 'analytics') => void;
}

const InfoItem: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-ink-muted">{label}</p>
    <p className="font-medium text-ink mt-0.5">{value || '---'}</p>
  </div>
);

export const ProductInfoTab: React.FC<ProductInfoTabProps> = ({
  product,
  productFormula,
  activeTCCS,
  productTCCSList,
  batches,
  allProductResults,
  setActiveTab,
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Cột trái: Hồ sơ Pháp lý */}
      <div className="space-y-6">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2 border-b border-border pb-2">
          <TagIcon className="h-4 w-4 text-emerald-600" />
          Hồ sơ Pháp lý
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <InfoItem label="Số Công bố / ĐKCB" value={product.registrationNo} />
          <InfoItem label="Ngày cấp ĐKCB" value={formatDateStandard(product.registrationDate)} />
          <InfoItem label="Đơn vị sở hữu" value={product.registrant} />
          <InfoItem label="Nhóm sản phẩm" value={product.group} />
        </div>
        <div className="pt-4 space-y-2">
          <p className="text-xs font-semibold text-ink-muted">Mô tả tóm lược</p>
          <p className="text-ink-soft leading-relaxed text-sm">{product.description || 'Không có mô tả.'}</p>
        </div>
      </div>

      {/* Cột phải: Đặc tính & Nhận diện */}
      <div className="space-y-6">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2 border-b border-border pb-2">
          <EyeIcon className="h-4 w-4 text-emerald-600" />
          Đặc tính & Nhận diện
        </h3>
        {productFormula ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-ink-muted uppercase mb-1">Dạng bào chế</p>
              <p className="text-xs font-bold text-ink">{productFormula.sensory?.dosageForm || '---'}</p>
            </div>
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-ink-muted uppercase mb-1">Quy cách</p>
              <p className="text-xs font-bold text-ink">{productFormula.packaging || '---'}</p>
            </div>
            <div className="col-span-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Đặc điểm cảm quan</p>
              <p className="text-xs font-medium text-ink italic">"{productFormula.sensory?.appearance || '---'}"</p>
            </div>
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-ink-muted uppercase mb-1">Hạn dùng</p>
              <p className="text-xs font-bold text-ink">{productFormula.shelfLife || '---'}</p>
            </div>
            <div className="p-3 bg-surface-2 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-ink-muted uppercase mb-1">Bảo quản</p>
              <p className="text-xs font-bold text-ink">{productFormula.storage || '---'}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-surface-2 rounded-xl border border-border text-center">
            <p className="text-xs text-ink-muted">Chưa cấu hình công thức kỹ thuật và đặc tính cảm quan cho sản phẩm này.</p>
          </div>
        )}
      </div>

      {/* Ecosystem Linkages Card */}
      <div className="col-span-1 md:col-span-2 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Square3Stack3DIcon className="h-4 w-4 text-emerald-600" />
          Hệ sinh thái Liên kết Dữ liệu (Data Ecosystem)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Formula Link */}
          <div 
            onClick={() => setActiveTab('formula')}
            className="p-3.5 bg-surface rounded-xl border border-border hover:border-emerald-500/50 cursor-pointer transition-all group shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">Công thức</span>
              <BeakerIcon className="h-4 w-4 text-emerald-600 group-hover:scale-105 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-ink">
              {productFormula ? `${productFormula.ingredients.length} hoạt chất` : 'Chưa có'}
            </p>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1 inline-flex items-center gap-1 group-hover:underline">
              Xem công thức <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>

          {/* TCCS Link */}
          <div 
            onClick={() => setActiveTab('tccs')}
            className="p-3.5 bg-surface rounded-xl border border-border hover:border-emerald-500/50 cursor-pointer transition-all group shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">Tiêu chuẩn TCCS</span>
              <DocumentTextIcon className="h-4 w-4 text-emerald-600 group-hover:scale-105 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-ink truncate" title={activeTCCS?.code || 'Chưa có'}>
              {activeTCCS?.code || 'Chưa có TCCS'}
            </p>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1 inline-flex items-center gap-1 group-hover:underline">
              {productTCCSList.length} phiên bản <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>

          {/* Batches Link */}
          <div 
            onClick={() => navigate(`/batches?productId=${product.id}`)}
            className="p-3.5 bg-surface rounded-xl border border-border hover:border-amber-500/50 cursor-pointer transition-all group shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">Lô sản xuất</span>
              <CubeIcon className="h-4 w-4 text-amber-500 group-hover:scale-105 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-ink">
              {batches.filter(b => b.productId === product.id).length} lô đã tạo
            </p>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-1 inline-flex items-center gap-1 group-hover:underline">
              Quản lý lô hàng <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>

          {/* Quality / Lab Results Link */}
          <div 
            onClick={() => setActiveTab('history')}
            className="p-3.5 bg-surface rounded-xl border border-border hover:border-violet-500/50 cursor-pointer transition-all group shadow-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">Kiểm nghiệm Lab</span>
              <ChartBarSquareIcon className="h-4 w-4 text-violet-500 group-hover:scale-105 transition-transform" />
            </div>
            <p className="text-sm font-semibold text-ink">
              {allProductResults.length} phiếu đã nhập
            </p>
            <span className="text-xs text-violet-700 dark:text-violet-400 font-medium mt-1 inline-flex items-center gap-1 group-hover:underline">
              Lịch sử chi tiết <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
