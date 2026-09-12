import { productAppService } from '../../services/app/ProductAppService';
import { formulaAppService } from '../../services/app/FormulaAppService';
import { materialAppService } from '../../services/app/MaterialAppService';
import { ProductSlice, StoreSlice } from './types';
import { Product, ProductFormula, RawMaterial } from '../../types';
import { resolveCurrentIdentity } from '../utils/storeHelpers';

export const createProductSlice: StoreSlice<ProductSlice> = (set, get) => ({
  // --- INITIAL PRODUCT STATE ---
  products: [],
  productFormulas: [],
  rawMaterials: [],

  // --- PRODUCT ACTIONS ---
  addProduct: async (p: Product) => {
    try {
      await productAppService.createProduct(p, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu sản phẩm', message: error.message });
      throw error;
    }
  },

  updateProduct: async (p: Product) => {
    try {
      const state = get();
      const oldProduct = state.products.find((item: Product) => item.id === p.id);
      await productAppService.updateProduct(p, resolveCurrentIdentity(state), oldProduct);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật sản phẩm', message: error.message });
      throw error;
    }
  },

  deleteProduct: async (id: string) => {
    try {
      const product = get().products.find((p: Product) => p.id === id);
      await productAppService.deleteProduct(id, resolveCurrentIdentity(get()), product?.name);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa sản phẩm', message: error.message });
      throw error;
    }
  },

  bulkAddProducts: async (products: Product[]) => {
    try {
      await productAppService.bulkCreateProducts(products, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi nạp sản phẩm', message: error.message });
      throw error;
    }
  },

  // --- PRODUCT FORMULA ACTIONS ---
  addProductFormula: async (f: ProductFormula) => {
    try {
      await formulaAppService.createFormula(f, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu công thức', message: error.message });
      throw error;
    }
  },

  updateProductFormula: async (f: ProductFormula) => {
    try {
      await formulaAppService.updateFormula(f, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật công thức', message: error.message });
      throw error;
    }
  },

  deleteProductFormula: async (id: string) => {
    try {
      await formulaAppService.deleteFormula(id, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa công thức', message: error.message });
      throw error;
    }
  },

  // --- RAW MATERIAL ACTIONS ---
  addRawMaterial: async (rm: RawMaterial) => {
    try {
      await materialAppService.createMaterial(rm, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu nguyên liệu', message: error.message });
      throw error;
    }
  },

  updateRawMaterial: async (rm: RawMaterial) => {
    try {
      await materialAppService.updateMaterial(rm, resolveCurrentIdentity(get()));
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật nguyên liệu', message: error.message });
      throw error;
    }
  },

  deleteRawMaterial: async (id: string) => {
    try {
      const state = get();
      const material = state.rawMaterials.find((m: RawMaterial) => m.id === id);
      await materialAppService.deleteMaterial(id, state.productFormulas, resolveCurrentIdentity(state), material?.name);
    } catch (error: any) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: error.message });
      throw error;
    }
  }
});
