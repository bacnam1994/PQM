import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput } from '../../components';
import { generateId } from '../../utils';

const CriteriaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & State
  const { criteriaDictionary, addCriteriaToDict, updateCriteriaInDict, notify } = useAppStore() as any;
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 2. Load dữ liệu
  useEffect(() => {
    if (id) {
      const criterion = criteriaDictionary?.find((c: any) => c.id === id);
      if (!criterion) {
        notify({ type: 'ERROR', message: 'Không tìm thấy Chỉ tiêu!' });
        navigate('/criteria');
      }
      // nạp dữ liệu vào form values...
    }
  }, [id, criteriaDictionary, navigate, notify]);

  // 3. Hàm Save
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     // Thêm logic Save tại đây
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/criteria')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {id ? 'Chỉnh sửa Chỉ tiêu' : 'Thêm Chỉ tiêu mới'}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="text-slate-500 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="font-bold">Chuyển Giao diện Form</p>
          <p className="text-sm">Cut/Paste thẻ &lt;form&gt; từ CriteriaList sang đây.</p>
        </div>
      </div>
    </div>
  );
};

export default CriteriaFormPage;