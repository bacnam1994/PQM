import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CubeIcon,
  InformationCircleIcon,
  BeakerIcon,
  DocumentTextIcon,
  ChartBarSquareIcon,
  ChartBarIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Product } from '../../../../types';
import { PageHeader, StatusBadge } from '../../../../components';

interface ProductHeaderProps {
  product: Product;
  activeTab: 'info' | 'formula' | 'tccs' | 'history' | 'analytics';
  onTabChange: (tab: 'info' | 'formula' | 'tccs' | 'history' | 'analytics') => void;
  isAdmin: boolean;
  onDeleteClick: () => void;
}

export const ProductHeader: React.FC<ProductHeaderProps> = ({
  product,
  activeTab,
  onTabChange,
  isAdmin,
  onDeleteClick,
}) => {
  const navigate = useNavigate();

  const tabs = [
    { id: 'info', label: 'Thông tin kỹ thuật', icon: InformationCircleIcon },
    { id: 'formula', label: 'Công thức & Thành phần', icon: BeakerIcon },
    { id: 'tccs', label: 'Hồ sơ TCCS', icon: DocumentTextIcon },
    { id: 'history', label: 'Lịch sử Kiểm nghiệm', icon: ChartBarSquareIcon },
    { id: 'analytics', label: 'Biến động Chất lượng', icon: ChartBarIcon },
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        subtitle={`Mã: ${product.code} • ${product.group || 'Chưa phân nhóm'}`}
        icon={CubeIcon}
        breadcrumb={[
          { label: 'Sản phẩm', onClick: () => navigate('/products') },
          { label: product.name },
        ]}
        badge={<StatusBadge status={product.status} />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/products/360/${product.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-medium border border-emerald-500/20 transition-all text-xs cursor-pointer shadow-xs"
            >
              <ChartBarSquareIcon className="h-3.5 w-3.5" /> Hồ sơ Product 360°
            </button>
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/products/${product.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 text-ink hover:bg-surface-3 rounded-lg font-medium border border-border transition-all text-xs cursor-pointer"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" /> Sửa
                </button>
                <button
                  type="button"
                  onClick={onDeleteClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-lg font-medium border border-rose-500/20 transition-all text-xs cursor-pointer"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Xóa
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer
              ${activeTab === tab.id 
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' 
                : 'border-transparent text-ink-muted hover:text-ink'}
            `}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
