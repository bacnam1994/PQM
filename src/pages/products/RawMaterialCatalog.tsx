import React, { useState, useMemo } from 'react';
import { BookUser, Plus, Search, Loader2, Save, Tag, Layers3, X as XIcon, Link2, ExternalLink, Package, FlaskConical } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCrud } from '../../hooks/useCrud';
import { useDataGraph } from '../../hooks/useDataGraph';
import { PageHeader, Modal, Pagination } from '../../components/ui/CommonUI';
import { DSFilterBar, DSSearchInput, DSTable, DSFormInput, DSSelect } from '../../components/ui/DesignSystem';
import { AddButton, ActionButtons, DeleteModal } from '../../components/ui/CrudControls';
import { generateId } from '../../utils/idGenerator';
import { RawMaterial } from '../../types';
import { Link, useNavigate } from 'react-router-dom';

const RawMaterialCatalog: React.FC = () => {
  const { rawMaterials: hydratedMaterials } = useDataGraph();
  const rawMaterials = useAppStore(state => state.rawMaterials);
  const addRawMaterial = useAppStore(state => state.addRawMaterial);
  const updateRawMaterial = useAppStore(state => state.updateRawMaterial);
  const deleteRawMaterial = useAppStore(state => state.deleteRawMaterial);
  const notify = useAppStore(state => state.notify);
  const crud = useCrud<RawMaterial>();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [category, setCategory] = useState<'ACTIVE' | 'EXCIPIENT' | 'OTHER'>('OTHER');
  const [description, setDescription] = useState('');
  const [aliasInput, setAliasInput] = useState('');

  // Map hydrated details
  const hydratedMap = useMemo(() => new Map(hydratedMaterials.map(m => [m.id, m])), [hydratedMaterials]);

  // Filter Data
  const filteredMaterials = useMemo(() => {
    return (rawMaterials || []).filter(m => {
      const searchLower = searchTerm.toLowerCase();
      return (
        m.name.toLowerCase().includes(searchLower) ||
        (m.aliases && m.aliases.some(a => a.toLowerCase().includes(searchLower)))
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawMaterials, searchTerm]);

  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage);
  const currentItems = filteredMaterials.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleOpenAdd = () => {
    setName('');
    setAliases([]);
    setCategory('OTHER');
    setDescription('');
    setAliasInput('');
    crud.openAdd();
  };

  const handleOpenEdit = (material: RawMaterial) => {
    setName(material.name);
    setAliases(material.aliases || []);
    setCategory(material.category);
    setDescription(material.description || '');
    setAliasInput('');
    crud.openEdit(material);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return notify({ type: 'WARNING', message: 'Vui lòng nhập Tên nguyên liệu!' });
    
    setIsSubmitting(true);

    const materialData: RawMaterial = {
      id: crud.selectedItem?.id || generateId('rm'),
      name: name.trim(),
      aliases: aliases.filter(a => a.trim() !== ''),
      category,
      description: description.trim(),
      createdAt: crud.selectedItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (crud.mode === 'EDIT') {
        await updateRawMaterial(materialData);
        notify({ type: 'SUCCESS', message: 'Đã cập nhật nguyên liệu.' });
      } else {
        await addRawMaterial(materialData);
        notify({ type: 'SUCCESS', message: 'Đã thêm nguyên liệu mới.' });
      }
      crud.close();
    } catch (error: any) {
      console.error(error);
      notify({ type: 'ERROR', message: error.message || 'Lỗi khi lưu nguyên liệu' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (crud.selectedItem) {
      try {
        await deleteRawMaterial(crud.selectedItem.id);
        notify({ type: 'SUCCESS', message: 'Đã xóa nguyên liệu.' });
        crud.close();
      } catch (error: any) {
        // Warning already shown in store
      }
    }
  };

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setAliasInput('');
    }
  };

  const removeAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const newAliases = pasteData
      .split(/[,;\n]+/)
      .map(item => item.trim())
      .filter(item => item !== '' && !aliases.includes(item));

    if (newAliases.length > 0) {
      setAliases(prev => [...prev, ...newAliases]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Nguyên liệu Chuẩn" 
        subtitle="Quản lý từ điển tên hoạt chất, tá dược và ánh xạ liên kết sang Công thức sản phẩm"
        icon={BookUser}
        action={<AddButton onClick={handleOpenAdd} label="Thêm Nguyên liệu" />}
      />

      <DSFilterBar>
        <DSSearchInput 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="Tìm kiếm theo tên chuẩn hoặc tên gọi khác (alias)..." 
        />
      </DSFilterBar>

      <DSTable>
        <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
          <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
            <th className="px-4 py-3">Tên Nguyên liệu (Tên chuẩn)</th>
            <th className="px-4 py-3">Các tên gọi khác (Aliases)</th>
            <th className="px-4 py-3 text-center">Phân loại</th>
            <th className="px-4 py-3">Sản phẩm & Công thức đang sử dụng</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-zinc-850">
          {currentItems.map(material => {
            const hydrated = hydratedMap.get(material.id);
            const usedProducts = hydrated?.usedInProducts || [];
            const usedFormulas = hydrated?.usedInFormulas || [];

            return (
              <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{material.name}</div>
                  {material.description && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{material.description}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {material.aliases && material.aliases.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {material.aliases.map((al, aIdx) => (
                        <span key={aIdx} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {al}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Chưa có alias</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    material.category === 'ACTIVE' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    material.category === 'EXCIPIENT' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                    'bg-sky-50 text-sky-600 border border-sky-100'
                  }`}>
                    {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {usedProducts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {usedProducts.map(p => (
                        <Link 
                          key={p.id} 
                          to={`/products/${p.id}`}
                          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold transition-colors"
                          title={`Xem sản phẩm: ${p.name}`}
                        >
                          <Package size={11} />
                          {p.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Chưa sử dụng trong công thức nào</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <ActionButtons 
                    onEdit={() => handleOpenEdit(material)} 
                    onDelete={() => crud.openDelete(material)} 
                  />
                </td>
              </tr>
            );
          })}
          {currentItems.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-slate-400 text-sm italic">
                Chưa có nguyên liệu nào trong danh mục.
              </td>
            </tr>
          )}
        </tbody>
      </DSTable>
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <Modal 
        isOpen={crud.mode === 'ADD' || crud.mode === 'EDIT'} 
        onClose={crud.close} 
        title={crud.mode === 'ADD' ? "Thêm Nguyên liệu" : "Cập nhật Nguyên liệu"} 
        icon={BookUser}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <DSFormInput
            label="Tên Nguyên liệu (Tên chuẩn)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Ginkgo Biloba Extract"
            required
          />
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
              <Layers3 size={12} />
              Các tên gọi khác (Aliases)
            </label>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap gap-2 min-h-[44px] items-center focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              {aliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-1 bg-white border border-indigo-100 text-indigo-700 text-sm font-bold px-2 py-1 rounded-lg shadow-sm animate-in zoom-in duration-200">
                  {alias}
                  <button type="button" onClick={() => removeAlias(i)} className="text-indigo-300 hover:text-red-500 transition-colors">
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
              <div className="flex-1 flex items-center min-w-[120px]">
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyDown={handleAliasKeyDown}
                  onPaste={handlePaste}
                  placeholder="Nhập tên gọi khác..."
                  className="flex-1 bg-transparent outline-none text-sm p-1 placeholder:text-slate-400 font-medium"
                />
                <button 
                  type="button" 
                  onClick={handleAddAlias}
                  disabled={!aliasInput.trim()}
                  className="ml-2 p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pl-2">Gợi ý: Nhấn Enter hoặc dán danh sách ngăn cách bởi dấu phẩy để thêm nhiều alias.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Phân loại</label>
            <DSSelect
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="ACTIVE">Hoạt chất</option>
              <option value="EXCIPIENT">Tá dược / Phụ liệu</option>
              <option value="OTHER">Khác</option>
            </DSSelect>
          </div>

          <DSFormInput
            label="Mô tả / Ghi chú"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ghi chú về nguồn gốc, quy chuẩn..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={crud.close} className="px-5 py-2.5 text-slate-400 font-bold uppercase text-xs hover:bg-slate-50 rounded-xl">
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold uppercase text-xs rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {crud.mode === 'ADD' ? "Thêm mới" : "Cập nhật"}
            </button>
          </div>
        </form>
      </Modal>

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleDelete} 
        itemName={crud.selectedItem?.name}
        warningMessage="Hành động xóa sẽ kiểm tra xem nguyên liệu này có đang được sử dụng trong Công thức sản phẩm nào hay không." 
      />
    </div>
  );
};

export default RawMaterialCatalog;