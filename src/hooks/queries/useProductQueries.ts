import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '../../repositories/firebase/FirebaseProductRepository';
import { formulaRepository } from '../../repositories/firebase/FirebaseFormulaRepository';
import { materialRepository } from '../../repositories/firebase/FirebaseMaterialRepository';
import { productAppService } from '../../services/app/ProductAppService';
import { useAppStore } from '../../store/useAppStore';
import { Product, ProductFormula, RawMaterial } from '../../types';

export const PRODUCT_QUERY_KEYS = {
  all: ['products'] as const,
  detail: (id: string) => ['products', id] as const,
  formulas: ['productFormulas'] as const,
  formulaDetail: (id: string) => ['productFormulas', id] as const,
  materials: ['rawMaterials'] as const,
  materialDetail: (id: string) => ['rawMaterials', id] as const,
};

/**
 * Hook tải danh sách Sản phẩm có Caching & Deduplication tự động
 */
export function useProductsQuery() {
  const storeProducts = useAppStore((state) => state.products);

  return useQuery<Product[]>({
    queryKey: PRODUCT_QUERY_KEYS.all,
    queryFn: async () => {
      const items = await productRepository.findAll();
      return items.length > 0 ? items : storeProducts;
    },
    initialData: storeProducts.length > 0 ? storeProducts : undefined,
  });
}

/**
 * Hook lấy chi tiết một Sản phẩm theo ID
 */
export function useProductQuery(id: string | undefined) {
  const storeProducts = useAppStore((state) => state.products);

  return useQuery<Product | null>({
    queryKey: PRODUCT_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const found = await productRepository.findById(id);
      return found || storeProducts.find((p) => p.id === id) || null;
    },
    enabled: Boolean(id),
    initialData: () => storeProducts.find((p) => p.id === id) || null,
  });
}

/**
 * Hook tải danh sách Công thức sản phẩm
 */
export function useProductFormulasQuery() {
  const storeFormulas = useAppStore((state) => state.productFormulas || []);

  return useQuery<ProductFormula[]>({
    queryKey: PRODUCT_QUERY_KEYS.formulas,
    queryFn: async () => {
      const items = await formulaRepository.findAll();
      return items.length > 0 ? items : storeFormulas;
    },
    initialData: storeFormulas.length > 0 ? storeFormulas : undefined,
  });
}

/**
 * Hook tải danh mục Nguyên liệu chuẩn
 */
export function useRawMaterialsQuery() {
  const storeMaterials = useAppStore((state) => state.rawMaterials || []);

  return useQuery<RawMaterial[]>({
    queryKey: PRODUCT_QUERY_KEYS.materials,
    queryFn: async () => {
      const items = await materialRepository.findAll();
      return items.length > 0 ? items : storeMaterials;
    },
    initialData: storeMaterials.length > 0 ? storeMaterials : undefined,
  });
}

/**
 * Mutation tạo sản phẩm mới với Invalidation tự động
 */
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async (product: Product) => {
      await productAppService.createProduct(product, user);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all });
    },
  });
}

/**
 * Mutation cập nhật sản phẩm với Invalidation tự động
 */
export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ product, oldProduct }: { product: Product; oldProduct?: Product }) => {
      await productAppService.updateProduct(product, user, oldProduct);
      return product;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.detail(variables.product.id) });
    },
  });
}
