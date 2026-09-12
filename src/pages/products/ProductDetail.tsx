/**
 * ProductDetail.tsx
 * =================
 * Gateway / Re-export cho module ProductDetail đã được phân rã thành micro-components:
 * - src/pages/products/ProductDetail/index.tsx (Component chính)
 * - src/pages/products/ProductDetail/hooks/useProductDetail.ts (Custom hook)
 * - src/pages/products/ProductDetail/components/* (Sub-components)
 */

export { default, ProductDetail } from './ProductDetail/index';
export { useProductDetail } from './ProductDetail/hooks/useProductDetail';
