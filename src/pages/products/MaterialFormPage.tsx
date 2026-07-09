import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput } from '../../components';
import { generateId } from '../../utils';
import { RawMaterial } from '../../types';
import { logAuditAction } from '../../services/auditService';

const MaterialFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & State
  const { rawMaterials, addRawMaterial, updateRawMaterial, notify, user } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<RawMaterial | null>(null);
  
  // 2. Load dữ liệu
  useEffect(() => {
    if (id) {
      // Tìm theo ID chính xác trước
      let material = rawMaterials.find(m => m.id === id);
      
      // Nếu không thấy (có thể ID truyền vào là Name từ MaterialList), tìm theo Name hoặc Aliases
      if (!material) {
        const decodedId = decodeURIComponent(id);
        material = rawMaterials.find(m => 
          m.name.toLowerCase() === decodedId.toLowerCase() || 
          (m.aliases || []).some(a => a.toLowerCase() === decodedId.toLowerCase())
        );
      }

      if (material) {
        setMaterialToEdit(material);
      } else if (!id.startsWith('new')) { // Chỉ báo lỗi nếu không phải là mode tạo mới
        notify({ type: 'ERROR', message: 'Không tìm thấy thông tin nguyên liệu này trong danh mục!' });
        // Không navigate về ngay để người dùng có thể tạo mới với tên này nếu muốn
      }
    }
  }, [id, rawMaterials, notify]);

  // 3. Hàm Save
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     setIsSubmitting(true);
     try {
       const formData = new FormData(e.currentTarget);
       const data = {
         name: formData.get('name')?.toString() || '',
         category: (formData.get('category')?.toString() || 'OTHER') as any,
         description: formData.get('description')?.toString() || '',
       };

       if (!data.name) {
         notify({ type: 'WARNING', message: 'Vui lòng nhập Tên nguyên liệu!' });
         setIsSubmitting(false);
         return;
       }

       if (materialToEdit) {
         await updateRawMaterial({ ...materialToEdit, ...data, updatedAt: new Date().toISOString() });
         notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Thông tin nguyên liệu đã được lưu.' });
         
         logAuditAction({
           action: 'UPDATE',
           collection: 'SYSTEM',
           documentId: materialToEdit.id,
           details: `Cập nhật nguyên liệu: ${data.name}`,
           performedBy: user?.email || 'unknown'
         });
       } else {
         const newId = generateId('mat');
         await addRawMaterial({ id: newId, ...data, aliases: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
         notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã thêm nguyên liệu mới vào danh mục.' });
         
         logAuditAction({
           action: 'CREATE',
           collection: 'SYSTEM',
           documentId: newId,
           details: `Thêm mới nguyên liệu: ${data.name}`,
           performedBy: user?.email || 'unknown'
         });
       }
       navigate('/materials');
     } catch (error) {
       console.error("Lỗi khi lưu nguyên liệu:", error);
     } finally {
       setIsSubmitting(false);
     }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/materials')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {materialToEdit ? 'Chỉnh sửa Nguyên liệu' : 'Thêm Nguyên liệu mới'}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <DSFormInput 
            label="Tên nguyên liệu *" 
            name="name" 
            defaultValue={materialToEdit?.name || (id && !materialToEdit ? decodeURIComponent(id) : '')} 
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Phân loại</label>
              <select name="category" defaultValue={materialToEdit?.category || 'OTHER'} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm focus:ring-2 focus:ring-indigo-100">
                <option value="ACTIVE">Hoạt chất</option>
                <option value="EXCIPIENT">Tá dược / Phụ liệu</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>
          <DSFormInput label="Mô tả" name="description" defaultValue={materialToEdit?.description} />
          <div className="flex justify-end gap-3 pt-6 border-t mt-6">
            <button type="button" onClick={() => navigate('/materials')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {materialToEdit ? 'Cập nhật' : 'Lưu Nguyên liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialFormPage;