
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { get, ref, update } from 'firebase/database';
import { db } from '../firebase';
import { Database, Download, Upload, Trash2, RefreshCcw, ShieldAlert, FileJson, Settings2, Hash, Calendar, FlaskConical, Wand2 } from 'lucide-react';
import { ConfirmationModal } from '../components/CommonUI';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateId } from '../utils/idGenerator';
import { ProductFormula, FormulaIngredient } from '../types';

const SettingsPage: React.FC = () => {
  const { state, resetToDemoData, clearAllData, loadBackup, addProductFormula, updateProductFormula } = useAppContext();

  // Generic confirmation modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [decimalSeparator, setDecimalSeparator] = useLocalStorage<'dot' | 'comma'>('app_decimal_separator', 'dot');
  const [dateFormat, setDateFormat] = useLocalStorage<string>('app_date_format', 'DD/MM/YYYY');

  const openConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmProps({ title, message, onConfirm });
    setIsConfirmOpen(true);
  };

  const handleExportData = async () => {
    try {
      // Lấy toàn bộ dữ liệu TestResults từ Firebase để đảm bảo backup đầy đủ
      // (Vì trong state của AppContext hiện tại testResults chỉ là mảng rỗng)
      const trSnapshot = await get(ref(db, 'testResults'));
      const allTestResults = trSnapshot.exists() ? Object.values(trSnapshot.val()) : [];

      const fullData = {
        ...state,
        testResults: allTestResults
      };

      const dataStr = JSON.stringify(fullData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qa_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Lỗi khi tạo bản sao lưu:", error);
      alert("Không thể tạo bản sao lưu. Vui lòng kiểm tra kết nối mạng.");
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          // Basic validation structure check
          if (!data || typeof data !== 'object') {
             throw new Error("File không phải là JSON hợp lệ");
          }
          
          if (!Array.isArray(data.products) || !Array.isArray(data.batches) || !Array.isArray(data.testResults)) {
             throw new Error("Cấu trúc dữ liệu bị thiếu (products, batches, hoặc testResults)");
          }

          openConfirmation(
            'Xác nhận Khôi phục',
            'Khôi phục dữ liệu sẽ ghi đè toàn bộ thông tin hiện tại. Bạn có chắc chắn muốn tiếp tục?',
            () => loadBackup(data)
          );
        } catch (err) {
          alert('Tệp dữ liệu không hợp lệ hoặc bị hỏng!');
          console.error(err);
        }
      };
      reader.readAsText(file);
    }
  };

  // Helper to parse numbers, including scientific notation like 10^6
  const normalizeAndParseContent = (contentStr: string): { value: number, unit: string } => {
    if (!contentStr) return { value: 0, unit: '' };
    // Chuẩn hóa: thay dấu phẩy, xử lý ký hiệu 1.5x10^6 và 10^6
    let s = contentStr.toLowerCase().trim().replace(/,/g, '.');
    s = s.replace(/([\d.]+)\s*x\s*10\s*\^\s*(-?\d+)/g, '$1e$2'); // 1.5 x 10^3 -> 1.5e3
    s = s.replace(/10\s*\^\s*(-?\d+)/g, '1e$2'); // 10^3 -> 1e3
    const match = s.match(/^(-?[\d.]+(?:e[+-]?\d+)?)\s*(.*)/);
    return match ? { value: parseFloat(match[1]), unit: match[2].trim() } : { value: 0, unit: contentStr };
  };

  const handleMigrateTCCSToFormula = async () => {
    const updates: Promise<void>[] = [];
    const newFormulas: ProductFormula[] = [];
    let count = 0;

    state.tccsList.forEach(tccs => {
      const existingFormula = state.productFormulas.find(f => f.productId === tccs.productId);
      if (newFormulas.some(f => f.productId === tccs.productId)) return;

      const ingredients: FormulaIngredient[] = [];
      const lines = tccs.composition.split('\n');
      
      lines.forEach(line => {
         // Regex đơn giản để bắt định dạng: "- Tên hoạt chất: Hàm lượng"
         const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
         if (match) {
            const name = match[1].trim();
            const contentStr = match[2].trim();
            const { value, unit } = normalizeAndParseContent(contentStr);
            ingredients.push({ id: generateId('ing'), name, declaredContent: isNaN(value) ? 0 : value, unit });
         }
      });

      if (existingFormula) {
        // Cập nhật công thức hiện có nếu thiếu thông tin
        let hasChanges = false;
        const updatedFormula = { ...existingFormula };

        if (!updatedFormula.sensory?.appearance && tccs.sensory?.appearance) {
          updatedFormula.sensory = { ...updatedFormula.sensory, ...tccs.sensory };
          hasChanges = true;
        }
        if (!updatedFormula.packaging && tccs.packaging) {
          updatedFormula.packaging = tccs.packaging;
          hasChanges = true;
        }
        if (!updatedFormula.storage && tccs.storage) {
          updatedFormula.storage = tccs.storage;
          hasChanges = true;
        }
        if (!updatedFormula.shelfLife && tccs.shelfLife) {
          updatedFormula.shelfLife = tccs.shelfLife;
          hasChanges = true;
        }
        if (!updatedFormula.standardRefs && tccs.standardRefs) {
          updatedFormula.standardRefs = tccs.standardRefs;
          hasChanges = true;
        }

        if (hasChanges) {
          updatedFormula.updatedAt = new Date().toISOString();
          updates.push(updateProductFormula(updatedFormula));
          count++;
        }
      } else {
        // Tạo mới nếu chưa có
        if (ingredients.length > 0 || tccs.sensory || tccs.packaging || tccs.storage) {
          const newFormula: ProductFormula = {
            id: generateId('form'),
            productId: tccs.productId,
            ingredients,
            sensory: tccs.sensory,
            packaging: tccs.packaging,
            storage: tccs.storage,
            shelfLife: tccs.shelfLife,
            standardRefs: tccs.standardRefs,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          newFormulas.push(newFormula);
          updates.push(addProductFormula(newFormula));
          count++;
        }
      }
    });

    if (count > 0) {
       try {
         await Promise.all(updates);
        alert(`Đã chuyển đổi/cập nhật thành công ${count} công thức từ TCCS.`);
       } catch (e) {
         console.error(e);
         alert("Có lỗi xảy ra khi lưu dữ liệu.");
       }
    } else {
       alert("Không tìm thấy dữ liệu nào mới để chuyển đổi.");
    }
  };

  const handleCleanupOldTCCSData = async () => {
    const updates: Record<string, any> = {};
    let count = 0;

    state.tccsList.forEach(tccs => {
        let needsUpdate = false;
        if (tccs.composition && tccs.composition !== '') { updates[`tccs/${tccs.id}/composition`] = null; needsUpdate = true; }
        if (tccs.packaging && tccs.packaging !== '') { updates[`tccs/${tccs.id}/packaging`] = null; needsUpdate = true; }
        if (tccs.storage && tccs.storage !== '') { updates[`tccs/${tccs.id}/storage`] = null; needsUpdate = true; }
        if (tccs.shelfLife && tccs.shelfLife !== '') { updates[`tccs/${tccs.id}/shelfLife`] = null; needsUpdate = true; }
        if (tccs.standardRefs && tccs.standardRefs !== '') { updates[`tccs/${tccs.id}/standardRefs`] = null; needsUpdate = true; }
        if (tccs.sensory && Object.values(tccs.sensory).some(v => v)) {
            updates[`tccs/${tccs.id}/sensory`] = null;
            needsUpdate = true;
        }
        
        if(needsUpdate) {
            count++;
        }
    });

    if (count > 0) {
        openConfirmation(
            'Dọn dẹp dữ liệu TCCS',
            `Hệ thống sẽ xóa dữ liệu cũ (Thành phần, Cảm quan...) trên ${count} hồ sơ TCCS. Hành động này không thể hoàn tác. Bạn có chắc chắn?`,
            async () => {
                try {
                    await update(ref(db), updates);
                    alert(`Đã dọn dẹp thành công ${count} hồ sơ TCCS.`);
                } catch (e) {
                    console.error(e);
                    alert("Có lỗi xảy ra khi dọn dẹp dữ liệu.");
                }
            }
        );
    } else {
        alert("Không tìm thấy dữ liệu TCCS cũ để dọn dẹp.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">Cấu hình Hệ thống</h1>
        <p className="text-slate-500 mt-1">Quản lý cơ sở dữ liệu và các thiết lập nâng cao.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format Configuration */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <Settings2 size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Cấu hình Định dạng</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Number Format */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                 <Hash size={16} /> Định dạng số (Thập phân)
               </label>
               <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => setDecimalSeparator('dot')}
                   className={`p-3 rounded-xl border text-left transition-all ${decimalSeparator === 'dot' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                 >
                    <div className="font-bold text-slate-800 text-sm">Dấu chấm (.)</div>
                    <div className="text-[10px] text-slate-500 mt-1">VD: 1,234.56</div>
                 </button>
                 <button 
                   onClick={() => setDecimalSeparator('comma')}
                   className={`p-3 rounded-xl border text-left transition-all ${decimalSeparator === 'comma' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                 >
                    <div className="font-bold text-slate-800 text-sm">Dấu phẩy (,)</div>
                    <div className="text-[10px] text-slate-500 mt-1">VD: 1.234,56</div>
                 </button>
               </div>
            </div>

            {/* Date Format */}
            <div className="space-y-3">
               <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                 <Calendar size={16} /> Định dạng ngày tháng
               </label>
               <select 
                 value={dateFormat} 
                 onChange={(e) => setDateFormat(e.target.value)}
                 className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
               >
                 <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                 <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                 <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
               </select>
               <p className="text-[10px] text-slate-400 italic">
                 Lưu ý: Cấu hình này áp dụng cho việc hiển thị và nhập liệu ngày tháng trên toàn hệ thống.
               </p>
            </div>
          </div>
        </section>

        {/* Backup & Restore */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Dữ liệu & Sao lưu</h3>
          </div>
          <div className="space-y-3">
            <button 
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <Download className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Xuất dữ liệu (.json)</p>
                  <p className="text-xs text-slate-400">Tải toàn bộ cơ sở dữ liệu về máy.</p>
                </div>
              </div>
            </button>
            <div className="relative">
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" id="import-input" />
              <label 
                htmlFor="import-input"
                className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Upload className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-bold text-slate-700">Khôi phục dữ liệu</p>
                    <p className="text-xs text-slate-400">Tải lên tệp sao lưu .json đã có.</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* Development Tools */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <ShieldAlert size={20} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Tiện ích Admin</h3>
          </div>
          <div className="space-y-3">
            <button 
              onClick={handleCleanupOldTCCSData}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Wand2 className="text-blue-600 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Dọn dẹp dữ liệu TCCS cũ</p>
                  <p className="text-xs text-slate-400">Xóa các trường đã chuyển sang Công thức để tránh trùng lặp.</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => openConfirmation(
                'Chuyển đổi dữ liệu',
                'Hệ thống sẽ quét toàn bộ TCCS và tạo Công thức sản phẩm từ mục "Thành phần", "Cảm quan", "Bao bì", "Bảo quản". Bạn có muốn tiếp tục?',
                handleMigrateTCCSToFormula
              )}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <FlaskConical className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Chuyển đổi Dữ liệu TCCS sang Công thức</p>
                  <p className="text-xs text-slate-400">Tự động trích xuất dữ liệu cũ sang tính năng mới.</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => openConfirmation(
                'Nạp dữ liệu mẫu',
                'Tải dữ liệu mẫu sẽ xóa sạch dữ liệu hiện tại. Bạn có chắc chắn muốn đồng ý?',
                resetToDemoData
              )}
              className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <RefreshCcw className="text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
                <div className="text-left">
                  <p className="font-bold text-slate-700">Nạp dữ liệu mẫu</p>
                  <p className="text-xs text-slate-400">Reset và dùng bộ dữ liệu demo.</p>
                </div>
              </div>
            </button>
            <button 
              onClick={() => openConfirmation(
                'XÓA SẠCH DỮ LIỆU',
                'HÀNH ĐỘNG NÀY KHÔNG THỂ KHÔI PHỤC! Bạn có hoàn toàn chắc chắn muốn xóa toàn bộ dữ liệu ngay bây giờ không?',
                clearAllData
              )}
              className="w-full flex items-center justify-between p-3 border border-red-50 rounded-xl hover:bg-red-50 hover:border-red-100 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="text-red-500 group-hover:animate-bounce" />
                <div className="text-left">
                  <p className="font-bold text-red-700">Xóa sạch vĩnh viễn</p>
                  <p className="text-xs text-red-400">Xóa dữ liệu trên Cloud và Máy cục bộ.</p>
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>

      <div className="bg-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/20">
             <FileJson size={32} />
          </div>
          <div className="space-y-2">
            <h4 className="text-2xl font-bold">QA Manager v2.5 Enterprise</h4>
            <p className="text-indigo-200 text-sm leading-relaxed max-w-xl">Hệ thống đang hoạt động trong chế độ <b>Offline-First</b>. Dữ liệu của bạn được đồng bộ tự động lên Firebase Realtime Database ngay khi có kết nối mạng. Hãy đảm bảo bạn đã sao lưu dữ liệu trước khi thực hiện các thay đổi cấu trúc lớn.</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full -ml-10 -mb-10 blur-3xl" />
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={confirmProps.title}
        message={confirmProps.message}
        onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
        confirmText="Xác nhận"
        icon={ShieldAlert}
      />
    </div>
  );
};

export default SettingsPage;
