import React from 'react';
import { Filter, ShieldCheck, Layers, Package, LayoutGrid, List } from 'lucide-react';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle } from '../../../../components';
import { Product } from '../../../../types';
import { MaterialCategoryFilter, MaterialTab, MaterialUsageFilter } from '../types';

interface MaterialFilterSectionProps {
  activeTab: MaterialTab;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterCategory: MaterialCategoryFilter;
  setFilterCategory: (v: MaterialCategoryFilter) => void;
  filterStandard: string;
  setFilterStandard: (v: string) => void;
  filterUsage: MaterialUsageFilter;
  setFilterUsage: (v: MaterialUsageFilter) => void;
  filterProductId: string;
  setFilterProductId: (v: string) => void;
  products: Product[];
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
}

export const MaterialFilterSection: React.FC<MaterialFilterSectionProps> = ({
  activeTab,
  searchTerm,
  setSearchTerm,
  filterCategory,
  setFilterCategory,
  filterStandard,
  setFilterStandard,
  filterUsage,
  setFilterUsage,
  filterProductId,
  setFilterProductId,
  products,
  viewMode,
  setViewMode
}) => {
  return (
    <DSFilterBar>
      <DSSearchInput 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
        placeholder={activeTab === 'CATALOG' ? "Tìm theo tên chuẩn, mã NL, tiêu chuẩn Dược điển, mã CAS hoặc alias..." : "Tìm thành phần trong công thức sản phẩm..."} 
      />

      <DSSelect 
        icon={Filter} 
        value={filterCategory} 
        onChange={(e) => setFilterCategory(e.target.value as any)} 
        className="w-36"
      >
        <option value="ALL">Tất cả loại</option>
        <option value="ACTIVE">Hoạt chất</option>
        <option value="EXCIPIENT">Tá dược</option>
        {activeTab === 'CATALOG' && <option value="OTHER">Khác</option>}
      </DSSelect>

      {activeTab === 'CATALOG' ? (
        <>
          <DSSelect 
            icon={ShieldCheck} 
            value={filterStandard} 
            onChange={(e) => setFilterStandard(e.target.value)} 
            className="w-44 truncate"
          >
            <option value="ALL">Tất cả Tiêu chuẩn</option>
            <option value="DĐVN">Dược điển VN (DĐVN)</option>
            <option value="USP">USP (Mỹ)</option>
            <option value="Ph.Eur">Ph.Eur (Châu Âu)</option>
            <option value="BP">BP (Anh)</option>
            <option value="TCCS">TCCS - NSX</option>
          </DSSelect>

          <DSSelect 
            icon={Layers} 
            value={filterUsage} 
            onChange={(e) => setFilterUsage(e.target.value as any)} 
            className="w-40"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="USED">Đã dùng trong SP</option>
            <option value="UNUSED">Chưa sử dụng</option>
          </DSSelect>
        </>
      ) : (
        <DSSelect 
          icon={Package} 
          value={filterProductId} 
          onChange={(e) => setFilterProductId(e.target.value)} 
          className="w-48 truncate"
        >
          <option value="">Tất cả sản phẩm</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
          ))}
        </DSSelect>
      )}

      {activeTab !== 'CONSISTENCY' && (
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      )}
    </DSFilterBar>
  );
};
