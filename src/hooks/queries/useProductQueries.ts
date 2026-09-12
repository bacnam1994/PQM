import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '../../repositories/firebase/FirebaseProductRepository';
import { formulaRepository } from '../../repositories/firebase/FirebaseFormulaRepository';
import { materialRepository } from '../../repositories/firebase/FirebaseMaterialRepository';
import { productAppService } from '../../services/app/ProductAppService';
import { formulaAppService } from '../../services/app/FormulaAppService';
import { materialAppService } from '../../services/app/MaterialAppService';
import { useAppStore } from '../../store/useAppStore';
import { Product, ProductFormula, RawMaterial } from '../../types';

export const PRODUCT_QUERY_KEYS = {
  all: ['products'] as const,
  detail: (id: string) => ['products', id] as const,
  formulas: ['productFormulas'] as const,
  formulaDetail: (id: string) => ['productFormulas', id] as const,
  formulaByProduct: (productId: string) => ['productFormulas', 'byProduct', productId] as const,
  materials: ['rawMaterials'] as const,
  materialDetail: (id: string) => ['rawMaterials', id] as const,
};

/**
 * Hook tải danh sách Sản phẩm (TanStack Query Cache - Single Source of Truth)
 */
export function useProductsQuery() {
  return useQuery<Product[]>({
    queryKey: PRODUCT_QUERY_KEYS.all,
    queryFn: async () => {
      return await productRepository.findAll();
    },
  });
}

/**
 * Hook lấy chi tiết một Sản phẩm theo ID
 */
export function useProductQuery(id: string | undefined) {
  return useQuery<Product | null>({
    queryKey: PRODUCT_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      return await productRepository.findById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook tải danh sách Công thức sản phẩm
 */
export function useProductFormulasQuery() {
  return useQuery<ProductFormula[]>({
    queryKey: PRODUCT_QUERY_KEYS.formulas,
    queryFn: async () => {
      return await formulaRepository.findAll();
    },
  });
}

/**
 * Hook tải chi tiết Công thức theo productId
 */
export function useFormulaByProductQuery(productId: string | undefined) {
  return useQuery<ProductFormula | null>({
    queryKey: PRODUCT_QUERY_KEYS.formulaByProduct(productId || ''),
    queryFn: async () => {
      if (!productId) return null;
      return await formulaRepository.findByProductId(productId);
    },
    enabled: Boolean(productId),
  });
}

/**
 * Hook tải danh mục Nguyên liệu chuẩn
 */
export function useRawMaterialsQuery() {
  return useQuery<RawMaterial[]>({
    queryKey: PRODUCT_QUERY_KEYS.materials,
    queryFn: async () => {
      return await materialRepository.findAll();
    },
  });
}

/**
 * Mutations cho Sản phẩm (Products)
 */
export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async (product: Product) => {
      await productAppService.createProduct(product, user);
      return product;
    },
    onSuccess: (newProduct) => {
      queryClient.setQueryData<Product[]>(PRODUCT_QUERY_KEYS.all, (old = []) => [
        ...old,
        newProduct,
      ]);
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all });
    },
  });
}

export function useUpdateProductMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ product, oldProduct }: { product: Product; oldProduct?: Product }) => {
      await productAppService.updateProduct(product, user, oldProduct);
      return product;
    },
    onSuccess: (updatedProduct) => {
      queryClient.setQueryData<Product[]>(PRODUCT_QUERY_KEYS.all, (old = []) =>
        old.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
      queryClient.setQueryData(PRODUCT_QUERY_KEYS.detail(updatedProduct.id), updatedProduct);
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all });
    },
  });
}

export function useDeleteProductMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code?: string }) => {
      await productAppService.deleteProduct(id, user, code);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Product[]>(PRODUCT_QUERY_KEYS.all, (old = []) =>
        old.filter((p) => p.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.all });
    },
  });
}

/**
 * Mutations cho Công thức (Product Formulas)
 */
export function useCreateFormulaMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async (formula: ProductFormula) => {
      await formulaAppService.createFormula(formula, user);
      return formula;
    },
    onSuccess: (newFormula) => {
      queryClient.setQueryData<ProductFormula[]>(PRODUCT_QUERY_KEYS.formulas, (old = []) => [
        ...old,
        newFormula,
      ]);
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.formulas });
      if (newFormula.productId) {
        queryClient.invalidateQueries({
          queryKey: PRODUCT_QUERY_KEYS.formulaByProduct(newFormula.productId),
        });
      }
    },
  });
}

export function useUpdateFormulaMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ formula }: { formula: ProductFormula }) => {
      await formulaAppService.updateFormula(formula, user);
      return formula;
    },
    onSuccess: (updatedFormula) => {
      queryClient.setQueryData<ProductFormula[]>(PRODUCT_QUERY_KEYS.formulas, (old = []) =>
        old.map((f) => (f.id === updatedFormula.id ? updatedFormula : f))
      );
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.formulas });
      if (updatedFormula.productId) {
        queryClient.invalidateQueries({
          queryKey: PRODUCT_QUERY_KEYS.formulaByProduct(updatedFormula.productId),
        });
      }
    },
  });
}

export function useDeleteFormulaMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await formulaAppService.deleteFormula(id, user);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ProductFormula[]>(PRODUCT_QUERY_KEYS.formulas, (old = []) =>
        old.filter((f) => f.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.formulas });
    },
  });
}

/**
 * Mutations cho Nguyên liệu (Raw Materials)
 */
export function useCreateMaterialMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async (material: RawMaterial) => {
      await materialAppService.createMaterial(material, user);
      return material;
    },
    onSuccess: (newMat) => {
      queryClient.setQueryData<RawMaterial[]>(PRODUCT_QUERY_KEYS.materials, (old = []) => [
        ...old,
        newMat,
      ]);
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.materials });
    },
  });
}

export function useUpdateMaterialMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ material }: { material: RawMaterial }) => {
      await materialAppService.updateMaterial(material, user);
      return material;
    },
    onSuccess: (updatedMat) => {
      queryClient.setQueryData<RawMaterial[]>(PRODUCT_QUERY_KEYS.materials, (old = []) =>
        old.map((m) => (m.id === updatedMat.id ? updatedMat : m))
      );
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.materials });
    },
  });
}

export function useDeleteMaterialMutation() {
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const formulas =
        queryClient.getQueryData<ProductFormula[]>(PRODUCT_QUERY_KEYS.formulas) || [];
      await materialAppService.deleteMaterial(id, formulas, user, name);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<RawMaterial[]>(PRODUCT_QUERY_KEYS.materials, (old = []) =>
        old.filter((m) => m.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.materials });
    },
  });
}
