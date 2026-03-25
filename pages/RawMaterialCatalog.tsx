import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BookUser, Plus, Search, Loader2, Save, Tag, Layers3, X as XIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useCrud } from '../hooks/useCrud';
import { PageHeader, Modal, Pagination } from '../components/CommonUI';
import { DSFilterBar, DSSearchInput, DSTable, DSFormInput, DSSelect } from '../components/DesignSystem';
import { AddButton, ActionButtons, DeleteModal } from '../components/CrudControls';
import { generateId } from '../utils/idGenerator';
import { RawMaterial } from '../types';

const RawMaterialCatalog: React.FC = () => {
  const { state, addRawMaterial, updateRawMaterial, deleteRawMaterial, notify } = useAppContext();
  const crud = useCrud<RawMaterial>();
  
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

  // Filter Data
  const filteredMaterials = useMemo(() => {
    return (state.rawMaterials || []).filter(m => {
      const searchLower = searchTerm.toLowerCase();
      return (
        m.name.toLowerCase().includes(searchLower) ||
        m.aliases.some(a => a.toLowerCase().includes(searchLower))
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.rawMaterials, searchTerm]);

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
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (crud.selectedItem) {
      // TODO: Check if material is in use before deleting
      await deleteRawMaterial(crud.selectedItem.id);
      notify({ type: 'SUCCESS', message: 'Đã xóa nguyên liệu.' });
      crud.close();
    }
  };

  const handleAddAlias = () => {
    const newAlias = aliasInput.trim();
    if (newAlias && !aliases.includes(newAlias)) {
      setAliases([...aliases, newAlias]);
      setAliasInput('');
    }
  };

  // Alias input handlers
  const handleAliasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    if (pastedData) {
      const newAliases = pastedData.split(/[,;\n]+/).map(s => s.trim()).filter(s => s && !aliases.includes(s));
      if (newAliases.length > 0) {
        setAliases(prev => [...prev, ...newAliases]);
      }
    }
  };

  const removeAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Nguyên liệu" 
        subtitle="Quản lý tập trung tên và phân loại các nguyên liệu sử dụng trong sản xuất." 
        icon={BookUser}
        action={<AddButton onClick={handleOpenAdd} label="Thêm Nguyên liệu" />}
      />

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm theo tên gốc hoặc tên thay thế..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </DSFilterBar>

      <DSTable>
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
            <th className="px-4 py-3">Tên Nguyên liệu (Tên chuẩn)</th>
            <th className="px-4 py-3">Các tên gọi khác (Aliases)</th>
            <th className="px-4 py-3 text-center">Phân loại</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {currentItems.map(material => (
            <tr key={material.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-bold text-slate-700 text-sm">{material.name}</td>
              <td className="px-4 py-3">
                {material.aliases && material.aliases.length > 0 ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">{material.aliases.length} tên</span>
                    <span className="text-slate-400 text-xs truncate hidden xl:inline" title={material.aliases.join(', ')}>
                      ({material.aliases.slice(0, 2).join(', ')}{material.aliases.length > 2 ? ', ...' : ''})
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs italic">Chưa có</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  material.category === 'ACTIVE' ? 'bg-rose-50 text-rose-600' :
                  material.category === 'EXCIPIENT' ? 'bg-slate-100 text-slate-600' :
                  'bg-sky-50 text-sky-600'
                }`}>
                  {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <ActionButtons 
                  onEdit={() => handleOpenEdit(material)} 
                  onDelete={() => crud.openDelete(material)} 
                />
              </td>
            </tr>
          ))}
          {currentItems.length === 0 && (
            <tr>
              <td colSpan={4} className="p-8 text-center text-slate-400 text-sm italic">
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
            placeholder="VD: Ferrous Fumarate"
            required
            icon={Tag}
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
                  title="Thêm tên gọi này"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic pl-2">* Nhập tên và nhấn Enter (hoặc nút +). Các tên này sẽ được dùng để tự động nhận diện nguyên liệu.</p>
          </div>

          <DSSelect
            label="Phân loại"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
          >
            <option value="ACTIVE">Hoạt chất</option>
            <option value="EXCIPIENT">Tá dược</option>
            <option value="OTHER">Khác</option>
          </DSSelect>

          <DSFormInput
            isTextArea
            label="Mô tả / Ghi chú"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả chi tiết, nguồn gốc, hoặc các thông tin khác..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-[#009639] text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSubmitting ? 'Đang lưu...' : 'Lưu Nguyên liệu'}
            </button>
          </div>
        </form>
      </Modal>

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleDelete} 
        itemName={crud.selectedItem?.name}
        warningMessage="Xóa nguyên liệu khỏi danh mục có thể ảnh hưởng đến việc liên kết dữ liệu. Bạn có chắc chắn?"
      />
    </div>
  );
};

export default RawMaterialCatalog;