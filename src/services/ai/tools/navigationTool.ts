import { useAppStore } from '../../../store/useAppStore';

/**
 * Chuyển hướng màn hình ứng dụng đến trang chức năng cụ thể theo yêu cầu AI
 */
export const navigateToAction = (
  args: { destination: string; identifier?: string },
  appContext: any
) => {
  const store = useAppStore.getState();
  const products = store.products?.length ? store.products : appContext.products || [];
  const batches = store.batches?.length ? store.batches : appContext.batches || [];
  const tccsList = store.tccsList?.length ? store.tccsList : appContext.tccsList || [];

  const dest = (args.destination || '').toLowerCase();
  const idQuery = (args.identifier || '').trim().toLowerCase();

  switch (dest) {
    case 'products': {
      if (idQuery) {
        const p = products.find(
          (prod: any) =>
            prod.id === idQuery ||
            prod.code?.toLowerCase() === idQuery ||
            prod.name?.toLowerCase().includes(idQuery)
        );
        if (p)
          return {
            path: `/products/${p.id}`,
            label: `Hồ sơ sản phẩm ${p.name}`,
            message: `👉 [Mở hồ sơ sản phẩm: ${p.name}](/products/${p.id})`,
          };
      }
      return {
        path: '/products',
        label: 'Danh mục Sản phẩm',
        message: '👉 [Mở Danh mục Sản phẩm](/products)',
      };
    }
    case 'batches': {
      if (idQuery) {
        const b = batches.find(
          (bat: any) => bat.id === idQuery || bat.batchNo?.toLowerCase() === idQuery
        );
        if (b)
          return {
            path: `/batches/${b.id}`,
            label: `Chi tiết lô ${b.batchNo}`,
            message: `👉 [Mở Chi tiết lô: ${b.batchNo}](/batches/${b.id})`,
          };
      }
      return {
        path: '/batches',
        label: 'Quản lý Lô sản xuất',
        message: '👉 [Mở Quản lý Lô sản xuất](/batches)',
      };
    }
    case 'tccs': {
      if (idQuery) {
        const t = tccsList.find(
          (tccs: any) => tccs.id === idQuery || tccs.code?.toLowerCase() === idQuery
        );
        if (t)
          return {
            path: `/tccs/detail/${t.id}`,
            label: `Tiêu chuẩn TCCS ${t.code}`,
            message: `👉 [Mở Chi tiết TCCS: ${t.code}](/tccs/detail/${t.id})`,
          };
      }
      return {
        path: '/tccs',
        label: 'Tiêu chuẩn Cơ sở (TCCS)',
        message: '👉 [Mở Danh sách TCCS](/tccs)',
      };
    }
    case 'product-formulas':
      return {
        path: '/product-formulas',
        label: 'Công thức Sản phẩm',
        message: '👉 [Mở Công thức Sản phẩm](/product-formulas)',
      };
    case 'test-results':
      return {
        path: '/test-results',
        label: 'Phiếu kiểm nghiệm',
        message: '👉 [Mở Danh sách Phiếu kiểm nghiệm](/test-results)',
      };
    case 'pqr':
    case 'quality-summary':
      return {
        path: '/reports/quality-summary',
        label: 'Báo cáo Tổng hợp Chất lượng',
        message: '👉 [Mở Báo cáo Tổng hợp Chất lượng](/reports/quality-summary)',
      };
    case 'spc':
    case 'trend':
      return {
        path: '/reports/trend-analysis',
        label: 'Phân tích Xu hướng',
        message: '👉 [Mở Phân tích Xu hướng](/reports/trend-analysis)',
      };
    case 'comparison':
      return {
        path: '/quality/comparison',
        label: 'So sánh Đối chiếu Lab',
        message: '👉 [Mở So sánh Đối chiếu Lab](/quality/comparison)',
      };
    case 'alerts':
      return {
        path: '/alerts',
        label: 'Cảnh báo Chất lượng',
        message: '👉 [Mở Trung tâm Cảnh báo Chất lượng](/alerts)',
      };
    case 'settings':
      return {
        path: '/settings',
        label: 'Cài đặt hệ thống',
        message: '👉 [Mở Cài đặt hệ thống](/settings)',
      };
    case 'audit-logs':
      return {
        path: '/audit-logs',
        label: 'Nhật ký Kiểm toán',
        message: '👉 [Mở Nhật ký Kiểm toán](/audit-logs)',
      };
    default:
      return { path: '/', label: 'Trang chủ', message: '👉 [Về Trang chủ](/) ' };
  }
};
