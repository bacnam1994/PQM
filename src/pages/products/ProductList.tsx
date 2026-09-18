import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  CubeIcon,
  Square3Stack3DIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  MagnifyingGlassCircleIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  BuildingOffice2Icon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ChevronUpDownIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Product, ProductStatus } from '../../types';
import { logAuditAction } from '../../services/auditService';
import {
  StatusBadge,
  PageHeader,
  Modal,
  Pagination,
  DSFilterBar,
  DSSearchInput,
  DSSelect,
  DSViewToggle,
  DSCard,
  DSTable,
  ActionButtons,
  DeleteModal,
  AddButton,
  DSEmptyState,
} from '../../components';
import { useDebounce, useCrud, useDataGraph } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';
import { PRODUCT_STATUS, generateId, formatDateStandard } from '../../utils';
import { useShallow } from 'zustand/react/shallow';

const SELF_ANNOUNCED_COMPANY = 'CÔNG TY CỔ PHẦN CÔNG NGHỆ SINH PHẨM NAM VIỆT';

// --- SUB-COMPONENT: Grid Item (Memoized) ---
const ProductGridItem = memo(
  ({
    product,
    hProduct,
    onEdit,
    onDelete,
    isAdmin,
  }: {
    product: Product;
    hProduct: any;
    onEdit: (p: Product) => void;
    onDelete: (p: Product) => void;
    isAdmin: boolean;
  }) => {
    const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
    return (
      <div className="p-4 flex flex-col gap-3 rounded-xl transition-all duration-200 group relative overflow-hidden bg-surface border border-border shadow-xs hover:border-emerald-500/30">
        {/* Header: Eyebrow text and Status */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted truncate">
            <CubeIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="truncate max-w-[150px]" title={product.group}>
              {product.group} · {isSelf ? 'Tự công bố' : 'Gia công'}
            </span>
          </div>
          <StatusBadge type="PRODUCT" status={product.status} />
        </div>

        {/* Main Info: Name and Icon */}
        <div className="flex items-center gap-3 pt-1">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border shadow-2xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <CubeIcon className="h-5 w-5" />
            </div>
          )}
          <Link to={`/products/${product.id}`} className="flex flex-col group/link min-w-0">
            <h3 className="font-semibold text-ink text-sm leading-snug group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors line-clamp-2">
              {product.name}
            </h3>
            <p className="text-xs font-mono text-ink-muted mt-0.5">{product.code}</p>
          </Link>
        </div>

        {/* Meta Info */}
        <div className="space-y-1 pt-2.5 border-t border-border/80 text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="text-ink-muted font-normal whitespace-nowrap shrink-0">Số ĐKCB:</span>
            <span className="text-ink font-medium text-right truncate">
              {product.registrationNo || '-'}
            </span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-ink-muted font-normal whitespace-nowrap shrink-0">Ngày cấp:</span>
            <span className="text-ink font-medium text-right">
              {formatDateStandard(product.registrationDate)}
            </span>
          </div>
        </div>

        {/* --- MINI STATS: Lô, Kết quả, Tỷ lệ đạt --- */}
        {hProduct && (
          <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-border/80">
            <Link
              to={`/batches?productId=${product.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[11px] font-medium border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
            >
              <Square3Stack3DIcon className="h-3 w-3" />{' '}
              {hProduct.batchesCount > 0 ? `${hProduct.batchesCount} lô` : 'Chưa có lô'}
            </Link>
            {hProduct.testResultsCount > 0 && (
              <Link
                to={`/test-results?productId=${product.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[11px] font-medium border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
              >
                <ClipboardDocumentCheckIcon className="h-3 w-3" /> {hProduct.testResultsCount} KN
              </Link>
            )}
            {hProduct.testResultsCount > 0 && hProduct.passRate !== null && (
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  hProduct.passRate >= 80
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : hProduct.passRate >= 50
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                }`}
              >
                <ArrowTrendingUpIcon className="h-3 w-3" /> {hProduct.passRate}%
              </span>
            )}
            {hProduct.activeTCCS && (
              <Link
                to={`/tccs/detail/${hProduct.activeTCCS.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted text-[11px] font-medium border border-border hover:text-ink transition-colors"
              >
                <DocumentTextIcon className="h-3 w-3" /> TCCS
              </Link>
            )}
          </div>
        )}

        {/* Footer: Actions */}
        <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-border/80 relative z-10">
          {isAdmin && (
            <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <ActionButtons onEdit={() => onEdit(product)} onDelete={() => onDelete(product)} />
            </div>
          )}
          <Link
            to={`/products/${product.id}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors ml-auto"
          >
            Chi tiết hồ sơ
          </Link>
        </div>
      </div>
    );
  }
);

// --- SUB-COMPONENT: List Item (Memoized) ---
const ProductListItem = memo(
  ({
    product,
    onEdit,
    onDelete,
    isAdmin,
  }: {
    product: Product;
    onEdit: (p: Product) => void;
    onDelete: (p: Product) => void;
    isAdmin: boolean;
  }) => {
    const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
    return (
      <tr className="hover:bg-surface-2/60 transition-colors group">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-border shadow-2xs"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium text-xs shrink-0 ${product.status === PRODUCT_STATUS.ACTIVE ? 'bg-emerald-600' : 'bg-surface-3 text-ink-muted'}`}
              >
                <CubeIcon className="h-4 w-4" />
              </div>
            )}
            <div>
              <Link
                to={`/products/${product.id}`}
                className="font-medium text-ink hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors block text-sm"
              >
                {product.name}
              </Link>
              <span className="text-xs font-mono text-ink-muted">{product.code}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 font-normal text-ink-soft text-xs">
          <div>{product.group}</div>
          <div
            className={`text-[11px] font-medium mt-0.5 ${isSelf ? 'text-sky-600 dark:text-sky-400' : 'text-ink-muted'}`}
          >
            {isSelf ? 'Tự công bố' : 'Gia công'}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-xs font-medium text-ink">{product.registrationNo || '-'}</div>
          <div className="text-xs text-ink-muted">
            {formatDateStandard(product.registrationDate)}
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge type="PRODUCT" status={product.status} />
        </td>
        <td className="px-4 py-3 text-right">
          {isAdmin && (
            <div className="flex justify-end gap-1">
              <ActionButtons
                onView={() => {
                  /* Navigate handled by Link */
                }}
                onEdit={() => onEdit(product)}
                onDelete={() => onDelete(product)}
              />
            </div>
          )}
        </td>
      </tr>
    );
  }
);

const ProductDataList = ({
  viewMode,
  data,
  hydratedProductMap,
  onEdit,
  onDelete,
  isAdmin,
}: any) => {
  if (data.length === 0) {
    return (
      <DSEmptyState
        icon={MagnifyingGlassCircleIcon}
        title="Không tìm thấy sản phẩm"
        message="Chưa có sản phẩm nào khớp với từ khóa hoặc bộ lọc."
      />
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((product: Product) => (
          <ProductGridItem
            key={product.id}
            product={product}
            hProduct={hydratedProductMap?.get(product.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-surface-2/60 border-b border-border">
        <tr className="text-ink-muted text-xs font-semibold">
          <th className="px-4 py-3 text-left">Sản phẩm</th>
          <th className="px-4 py-3 text-left">Phân loại</th>
          <th className="px-4 py-3 text-left">Số ĐKCB</th>
          <th className="px-4 py-3 text-left">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((product: Product) => (
          <ProductListItem
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            isAdmin={isAdmin}
          />
        ))}
      </tbody>
    </DSTable>
  );
};

const ProductList: React.FC = () => {
  // Zustand Selectors
  // Tối ưu 1: Gom nhóm Zustand Selectors bằng useShallow
  const { products, deleteProduct, bulkAddProducts, notify, user, isAdmin } = useAppStore(
    useShallow((state) => ({
      products: state.products,
      deleteProduct: state.deleteProduct,
      bulkAddProducts: state.bulkAddProducts,
      notify: state.notify,
      user: state.user,
      isAdmin: state.isAdmin,
    }))
  );
  // Dùng useDataGraph để lấy HydratedProduct (có batchesCount, testResultsCount, passRate, activeTCCS)
  const { products: hydratedProducts } = useDataGraph();
  const hydratedProductMap = useMemo(
    () => new Map(hydratedProducts.map((p) => [p.id, p])),
    [hydratedProducts]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramSearchTerm = searchParams.get('q') || '';
  const [currentPage, setCurrentPage] = useState(1);

  // Local state for immediate input feedback, debounced value for filtering
  const [localSearchTerm, setLocalSearchTerm] = useState(paramSearchTerm);
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const viewMode = useUIStore((s) => s.productViewMode);
  const setViewMode = useUIStore((s) => s.setProductViewMode);
  // --- FILTER & SORT (persisted via UIStore / localStorage) ---
  const sortConfig = useUIStore((s) => s.productSort);
  const setSortConfig = useUIStore((s) => s.setProductSort);
  const filterType = useUIStore((s) => s.productFilterType);
  const setFilterType = useUIStore((s) => s.setProductFilterType);
  const filterStatus = useUIStore((s) => s.productFilterStatus);
  const setFilterStatus = useUIStore((s) => s.setProductFilterStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const crud = useCrud<Product>();

  const itemsPerPage = 12;

  const sortOptions: Record<string, string> = {
    'createdAt-desc': 'Mới tạo nhất',
    'createdAt-asc': 'Cũ nhất',
    'name-asc': 'Tên (A-Z)',
    'name-desc': 'Tên (Z-A)',
  };

  const filteredProducts = useMemo(() => {
    const searchLower = paramSearchTerm.toLowerCase();
    const hasSearch = searchLower.length > 0;

    let result = products.filter((p) => {
      // Tối ưu 2: Early return để tránh tính toán chuỗi thừa
      if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;

      if (filterType !== 'ALL') {
        const isSelf = p.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
        if (filterType === 'SELF' && !isSelf) return false;
        if (filterType === 'OUTSOURCE' && isSelf) return false;
      }

      if (hasSearch) {
        if (
          !p.name.toLowerCase().includes(searchLower) &&
          !p.code.toLowerCase().includes(searchLower) &&
          !p.registrant.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    });

    // Sorting logic
    result.sort((a, b) => {
      const sortKey = sortConfig.key as keyof Product;
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (sortConfig.key === 'createdAt' || sortConfig.key === 'registrationDate') {
        // Tối ưu 3: So sánh chuỗi ISO trực tiếp thay vì khởi tạo Date object
        const dateA = (aValue as string) || '';
        const dateB = (bValue as string) || '';
        return sortConfig.direction === 'asc'
          ? dateA.localeCompare(dateB)
          : dateB.localeCompare(dateA);
      }

      const strA = String(aValue || '');
      const strB = String(bValue || '');
      return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [products, paramSearchTerm, sortConfig, filterType, filterStatus]);

  // Effect to update URL search param when debounced term changes
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearchTerm) {
          next.set('q', debouncedSearchTerm);
        } else {
          next.delete('q');
        }
        return next;
      },
      { replace: true }
    ); // Use replace to avoid polluting browser history
    setCurrentPage(1); // Reset to first page on new search
  }, [debouncedSearchTerm, setSearchParams]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsSubmitting(true);

    try {
      const lines = importText.trim().split('\n');
      const productsToCreate: Product[] = [];
      const errors: string[] = [];

      // Use existing products + products in this batch for duplicate checks
      const existingProductSignatures = new Set(
        products.map((p) => `${p.code?.trim().toUpperCase()}|${p.name?.trim()}`)
      );

      for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const code = parts[0]?.trim().toUpperCase() || '';
        const name = parts[1]?.trim() || '';
        const signature = `${code}|${name}`;

        if (!code && !name) {
          errors.push(`Bỏ qua dòng trống: "${line.substring(0, 50)}..."`);
          continue;
        }

        if (existingProductSignatures.has(signature)) {
          errors.push(`Bỏ qua sản phẩm đã tồn tại: "${code} - ${name}"`);
          continue;
        }

        const newProd: Product = {
          id: generateId('prod'),
          code: code,
          name: name,
          group: parts[2]?.trim() || 'TPBS',
          registrationNo: parts[3]?.trim() || '',
          registrationDate: parts[4]?.trim() || new Date().toISOString().split('T')[0],
          registrant: parts[5]?.trim() || 'V-Biotech',
          status: PRODUCT_STATUS.ACTIVE,
          description: parts[6]?.trim() || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        productsToCreate.push(newProd);
        existingProductSignatures.add(signature); // Add to set to prevent duplicates within the same import
      }

      if (productsToCreate.length > 0) {
        await bulkAddProducts(productsToCreate);
      }

      let alertMessage = `Đã nhập thành công ${productsToCreate.length} sản phẩm.`;
      if (errors.length > 0) {
        notify({
          type: 'WARNING',
          title: 'Nhập liệu có cảnh báo',
          message: `${alertMessage} Có ${errors.length} dòng bị bỏ qua.`,
        });
      } else {
        notify({ type: 'SUCCESS', title: 'Nhập liệu hoàn tất', message: alertMessage });
      }

      setIsImportModalOpen(false); // Chỉ đóng khi thành công
      setImportText('');
    } catch (error) {
      console.error(error);
      // AppContext đã alert lỗi chi tiết, ở đây chỉ cần giữ form mở
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
    // Reset input value to allow selecting the same file again if needed
    e.target.value = '';
  };

  // --- Handlers for Memoized Components ---
  const handleEditClick = useCallback(
    (product: Product) => {
      navigate(`/products/edit/${product.id}`);
    },
    [navigate]
  );

  const handleDeleteClick = useCallback(
    (product: Product) => {
      crud.openDelete(product);
    },
    [crud]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteProduct(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({
          type: 'SUCCESS',
          title: 'Đã xóa',
          message: `Đã xóa sản phẩm ${crud.selectedItem!.name}`,
        });

        // Ghi log an toàn
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'PRODUCTS',
            documentId: crud.selectedItem!.id,
            details: `Xóa sản phẩm: ${crud.selectedItem!.name}`,
            performedBy: user?.email || 'unknown',
          });
        } catch (logErr) {
          console.warn('Ghi log thất bại:', logErr);
        }
      } catch (error) {
        console.error('Failed to delete product:', error);
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteProduct, user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="Danh mục Sản phẩm"
        subtitle="Quản lý sản phẩm và hồ sơ pháp lý V-Biotech."
        icon={CubeIcon}
        action={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border text-ink rounded-lg hover:bg-surface-2 font-medium text-xs transition-colors shadow-2xs"
              >
                <ArrowUpTrayIcon className="h-4 w-4 text-ink-muted" /> Nhập Excel
              </button>
              <AddButton onClick={() => navigate('/products/new')} label="Thêm sản phẩm" />
            </div>
          ) : undefined
        }
      />

      <DSFilterBar>
        <DSSearchInput
          placeholder="Tìm theo tên, mã sản phẩm..."
          value={localSearchTerm}
          onChange={(e) => setLocalSearchTerm(e.target.value)}
          onClear={() => setLocalSearchTerm('')}
        />

        <DSSelect
          icon={BuildingOffice2Icon}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="w-36"
        >
          <option value="ALL">Tất cả nguồn</option>
          <option value="SELF">Tự công bố</option>
          <option value="OUTSOURCE">Gia công</option>
        </DSSelect>

        <DSSelect
          icon={ExclamationCircleIcon}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="w-36"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value={PRODUCT_STATUS.ACTIVE}>Đang lưu hành</option>
          <option value={PRODUCT_STATUS.DISCONTINUED}>Ngừng sản xuất</option>
          <option value={PRODUCT_STATUS.RECALLED}>Đã thu hồi</option>
        </DSSelect>

        <DSSelect
          icon={ChevronUpDownIcon}
          value={`${sortConfig.key}-${sortConfig.direction}`}
          onChange={(e) => {
            const [key, direction] = e.target.value.split('-');
            setSortConfig({ key, direction: direction as 'asc' | 'desc' });
          }}
          className="w-36"
        >
          <option value="createdAt-desc">Mới tạo nhất</option>
          <option value="createdAt-asc">Cũ nhất</option>
          <option value="name-asc">Tên (A-Z)</option>
          <option value="name-desc">Tên (Z-A)</option>
        </DSSelect>

        <DSViewToggle
          viewMode={viewMode}
          setViewMode={setViewMode}
          gridIcon={Squares2X2Icon}
          listIcon={ListBulletIcon}
        />
      </DSFilterBar>

      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <span className="bg-surface-2 text-ink-soft px-2.5 py-1 rounded-md border border-border">
            Tổng: {products.length}
          </span>
          <span className="text-border">|</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            Kết quả: {filteredProducts.length}
          </span>
          {paramSearchTerm && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">
              • Tìm kiếm: "{paramSearchTerm}"
            </span>
          )}
        </div>
        <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider flex items-center gap-2">
          <span>Sắp xếp:</span>
          <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30">
            {sortOptions[`${sortConfig.key}-${sortConfig.direction}`] || 'Tùy chỉnh'}
          </span>
        </div>
      </div>

      <ProductDataList
        viewMode={viewMode}
        data={currentProducts}
        hydratedProductMap={hydratedProductMap}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        isAdmin={isAdmin}
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <DeleteModal
        isOpen={crud.mode === 'DELETE'}
        onClose={crud.close}
        onConfirm={handleConfirmDelete}
        itemName={crud.selectedItem?.name}
        warningMessage="Tất cả dữ liệu liên quan (TCCS, Lô, Kết quả Lab) cũng sẽ bị xóa vĩnh viễn."
        isDeleting={false}
      />

      {/* Modal Nhập Excel với Hướng dẫn Chi tiết */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Nhập dữ liệu hàng loạt"
        icon={TableCellsIcon}
        color="bg-emerald-600"
      >
        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <h4 className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider mb-3">
              <InformationCircleIcon className="h-4 w-4" /> Hướng dẫn xếp cột (Excel/Google Sheets)
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-3 leading-relaxed">
              Bạn có thể copy trực tiếp các vùng dữ liệu từ Excel và dán vào ô bên dưới. Hệ thống sẽ
              tự nhận diện theo thứ tự các cột như sau:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                '1. Mã Sản phẩm (Bắt buộc)',
                '2. Tên Sản phẩm (Bắt buộc)',
                '3. Nhóm hàng (VD: TPBS, Mỹ phẩm...)',
                '4. Số ĐKCB / Công bố',
                '5. Ngày cấp (Định dạng: YYYY-MM-DD)',
                '6. Đơn vị sở hữu',
                '7. Mô tả tóm tắt',
              ].map((txt, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-surface/60 px-3 py-1.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />{' '}
                  {txt}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-200/50 dark:border-emerald-900/30">
              <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1.5">
                Ví dụ dữ liệu chuẩn:
              </p>
              <code className="block p-2.5 bg-surface rounded-lg text-[10px] text-ink font-mono border border-border">
                VB-001, Nano Curcumin, TPBS, 123/2024, 2024-05-15, V-Biotech, Chiết xuất nghệ Nano
              </code>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileRead}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-3.5 py-2 bg-surface-2 hover:bg-surface-3 text-ink-soft rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-border">
                <ArrowUpTrayIcon className="h-4 w-4" /> Tải lên file CSV/TXT
              </button>
            </div>
            <p className="text-[10px] text-ink-muted italic">
              Hỗ trợ file văn bản (.txt, .csv) ngăn cách bởi dấu phẩy hoặc tab.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-1">
              Dán dữ liệu vào đây
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={7}
              className="w-full p-4 bg-surface-2 border border-dashed border-border rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-ink"
              placeholder="Copy từ Excel và dán tại đây..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="px-5 py-2.5 text-ink-soft hover:text-ink font-semibold text-xs rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleBulkImport}
              disabled={!importText.trim() || isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold uppercase text-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors"
            >
              {isSubmitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              Tiến hành nhập kho dữ liệu
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductList;
