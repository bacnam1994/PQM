import { RawMaterial } from '../../../types';

export interface AggregatedFormulaItem {
  id: string;
  name: string;
  type: 'ACTIVE' | 'EXCIPIENT';
  materialId?: string;
  linkedMaterial?: RawMaterial;
  relatedProducts: {
    id: string;
    name: string;
    code?: string;
    content?: string;
    formulaId: string;
  }[];
}

export type MaterialTab = 'CATALOG' | 'MATRIX' | 'CONSISTENCY';
export type MaterialCategoryFilter = 'ALL' | 'ACTIVE' | 'EXCIPIENT' | 'OTHER';
export type MaterialUsageFilter = 'ALL' | 'USED' | 'UNUSED';
