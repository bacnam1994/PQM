/**
 * PQM 3.0 - Danh mục Sản phẩm, Công thức & Nguyên liệu
 */

import { SensoryCharacteristics } from './tccs';

export type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'RECALLED';

export interface Product {
  id: string;
  code: string;
  name: string;
  group: string;
  registrationNo: string;
  registrationDate: string;
  registrant: string;
  status: ProductStatus;
  description: string;
  imageUrl?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormulaIngredient {
  id: string;
  name: string;
  declaredContent: number;
  elementalContent?: number;
  materialId?: string; // Liên kết với RawMaterial để quản lý kho/nhóm
  unit: string;
}

export interface ProductFormula {
  id: string;
  productId: string;
  ingredients: FormulaIngredient[];
  excipients?: FormulaIngredient[];
  sensory?: SensoryCharacteristics;
  packaging?: string;
  storage?: string;
  shelfLife?: string;
  standardRefs?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterial {
  id: string;
  code?: string; // Mã nguyên liệu (nếu có, ví dụ: NL-GINKGO-01)
  name: string; // Tên gốc/chuẩn
  aliases: string[]; // Các tên gọi khác
  category: 'ACTIVE' | 'EXCIPIENT' | 'OTHER'; // Phân loại: Hoạt chất, Tá dược, Khác
  standard?: string; // Tiêu chuẩn kỹ thuật: DĐVN V, USP, Ph.Eur, BP, TCCS-NSX...
  casNumber?: string; // Mã định danh hóa chất quốc tế CAS (nếu có)
  description?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}
