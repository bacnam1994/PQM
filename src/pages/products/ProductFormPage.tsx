import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ArrowPathIcon, 
  ArrowUpTrayIcon, 
  XMarkIcon, 
  PhotoIcon, 
  CloudIcon 
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput } from '../../components';
import { PRODUCT_STATUS, generateId } from '../../utils';
import { Product, ProductStatus } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { useUIStore } from '../../store/useUIStore';
import { storage } from '../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const ProductFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // 1. Khởi tạo Hook & Bóc tách State
  const { products, addProduct, updateProduct, notify, user } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  
  // Image Upload State
  const [imageUrl, setImageUrl] = useState('');
  const { googleDriveFolderUrl, googleDriveFolderId, googleDriveClientId, googleDriveApiKey, useGoogleDriveUpload } = useUIStore();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 2. Nạp dữ liệu khi ở chế độ Edit
  useEffect(() => {
    if (id) {
      const prod = products.find(p => p.id === id);
      if (prod) {
        setProductToEdit(prod);
        setImageUrl(prod.imageUrl || '');
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy sản phẩm!' });
        navigate('/products');
      }
    }
  }, [id, products, navigate, notify]);

  // Upload Logic
  const uploadToFirebaseStorage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const path = `products/${id || 'temp'}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          }, 
          (error) => {
            console.error(error);
            notify({ type: 'ERROR', message: "Lỗi khi tải file lên Storage: " + error.message });
            reject(error);
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  const uploadToGoogleDrive = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const gClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: googleDriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error));
          }
          const accessToken = tokenResponse.access_token;
          
          try {
            setUploadProgress(30);
            const metadata = {
              name: file.name,
              parents: googleDriveFolderId ? [googleDriveFolderId] : []
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);
            
            setUploadProgress(60);
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`
              },
              body: form
            });
            
            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Upload API error: ${errText}`);
            }
            
            const driveFile = await response.json();
            setUploadProgress(90);
            
            const fileId = driveFile.id;
            const directUrl = `https://docs.google.com/uc?export=view&id=${fileId}`;
            
            setUploadProgress(null);
            resolve(directUrl);
          } catch (err) {
            reject(err);
          }
        }
      });
      
      if (!gClient) {
        reject(new Error("Không thể khởi tạo Google Identity Services. Hãy đảm bảo đã thêm script của Google."));
      } else {
        gClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let url = '';
      if (useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey) {
        setUploadProgress(10);
        try {
          url = await uploadToGoogleDrive(file);
          notify({ type: 'SUCCESS', message: 'Tải ảnh lên Google Drive thành công!' });
        } catch (err: any) {
          console.error("Google Drive Upload Error, falling back to Firebase Storage:", err);
          notify({ type: 'WARNING', message: "Lỗi tải lên Google Drive. Đang chuyển sang lưu Firebase Storage..." });
          url = await uploadToFirebaseStorage(file);
          notify({ type: 'SUCCESS', message: 'Tải ảnh lên Firebase Storage thành công!' });
        }
      } else {
        url = await uploadToFirebaseStorage(file);
        notify({ type: 'SUCCESS', message: 'Tải ảnh lên Firebase Storage thành công!' });
      }
      setImageUrl(url);
    } catch (error: any) {
      notify({ type: 'ERROR', message: 'Tải ảnh thất bại: ' + error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // 3. Hàm xử lý lưu chung (Gom Add và Edit)
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        code: (formData.get('code')?.toString() || '').trim().toUpperCase(),
        name: (formData.get('name')?.toString() || '').trim(),
        group: formData.get('group')?.toString() || '',
        registrationNo: formData.get('registrationNo')?.toString() || '',
        registrationDate: formData.get('registrationDate')?.toString() || '',
        registrant: formData.get('registrant')?.toString() || '',
        status: (formData.get('status')?.toString() || PRODUCT_STATUS.ACTIVE) as ProductStatus,
        description: formData.get('description')?.toString() || '',
        imageUrl: imageUrl || '',
      };

      if (!data.code && !data.name) {
        notify({ type: 'WARNING', message: 'Vui lòng nhập tối thiểu Mã sản phẩm hoặc Tên sản phẩm!' });
        setIsSubmitting(false);
        return;
      }

      const isDuplicate = products.some(p => p.id !== id && p.code === data.code && p.name === data.name);
      if (isDuplicate) {
        notify({ type: 'ERROR', title: 'Trùng lặp', message: 'Sản phẩm với cùng Mã và Tên đã tồn tại!' });
        setIsSubmitting(false);
        return;
      }

      if (id && productToEdit) {
        await updateProduct({ ...productToEdit, ...data, updatedAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Thông tin sản phẩm đã được lưu.' });
        
        logAuditAction({
          action: 'UPDATE',
          collection: 'PRODUCTS',
          documentId: productToEdit.id,
          details: `Cập nhật sản phẩm: ${data.code} - ${data.name}`,
          performedBy: user?.email || 'unknown'
        });
      } else {
        const newId = generateId('prod');
        await addProduct({ id: newId, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã thêm sản phẩm mới.' });
        
        logAuditAction({
          action: 'CREATE',
          collection: 'PRODUCTS',
          documentId: newId,
          details: `Thêm mới sản phẩm: ${data.code} - ${data.name}`,
          performedBy: user?.email || 'unknown'
        });
      }
      navigate('/products');
    } catch (error) {
      console.error("Lỗi khi lưu sản phẩm:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/products')} 
          className="p-2 bg-surface text-ink-muted hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg border border-border shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {id ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {id ? 'Cập nhật danh mục và hồ sơ kỹ thuật sản phẩm' : 'Đăng ký sản phẩm thương mại mới vào hệ thống'}
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-xs border border-border p-6">
        {(!id || productToEdit) && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DSFormInput label="Mã sản phẩm *" name="code" defaultValue={productToEdit?.code} placeholder="VD: VB-001" required />
              <DSFormInput label="Nhóm hàng" name="group" defaultValue={productToEdit?.group} placeholder="VD: TPBS / Mỹ phẩm..." />
            </div>
            
            <DSFormInput label="Tên sản phẩm đầy đủ *" name="name" defaultValue={productToEdit?.name} placeholder="Nhập tên sản phẩm..." required />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DSFormInput label="Số ĐKCB / Công bố" name="registrationNo" defaultValue={productToEdit?.registrationNo} placeholder="VD: 1234/2024/ATTP-XNCB" />
              <DSFormInput type="date" label="Ngày cấp" name="registrationDate" defaultValue={productToEdit?.registrationDate?.split('T')[0] || new Date().toISOString().split('T')[0]} />
            </div>
            
            <DSFormInput label="Công ty đăng ký / Sở hữu" name="registrant" defaultValue={productToEdit?.registrant} placeholder="CÔNG TY CỔ PHẦN..." />
            
            {/* Ảnh sản phẩm */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                <PhotoIcon className="w-4 h-4 text-emerald-600" />
                Ảnh sản phẩm
              </label>
              
              <div className="flex items-center gap-6 bg-surface-2/60 p-4 rounded-xl border border-border">
                {imageUrl ? (
                  <div className="relative group shrink-0">
                    <img src={imageUrl} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-border shadow-xs" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute -top-2 -right-2 p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
                      title="Gỡ ảnh"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center text-ink-muted shrink-0">
                    <PhotoIcon className="w-7 h-7 text-ink-muted/60" />
                    <span className="text-[10px] font-medium mt-1 text-ink-muted">Chưa có ảnh</span>
                  </div>
                )}
                
                <div className="space-y-2 flex-grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="product-image-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="product-image-upload"
                      className={`px-3.5 py-1.5 bg-surface border border-border text-ink-soft rounded-lg hover:bg-surface-2 font-medium text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {isUploading ? <ArrowPathIcon className="w-4 h-4 animate-spin text-emerald-600" /> : <ArrowUpTrayIcon className="w-4 h-4 text-emerald-600" />}
                      Tải ảnh lên
                    </label>
                    
                    {useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                        <CloudIcon className="w-3.5 h-3.5" /> Google Drive
                      </span>
                    )}
                  </div>
                  
                  {isUploading && uploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <p className="text-[10px] font-medium text-ink-muted">Đang tải lên: {uploadProgress}%</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey 
                      ? 'Ảnh sẽ được tải và lưu trữ trực tiếp trên thư mục Google Drive của hệ thống.' 
                      : 'Hệ thống sẽ tải ảnh lưu trữ lên Firebase Storage (do chưa cấu hình hoặc tắt Google Drive API).'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted">Mô tả tóm tắt</label>
              <textarea 
                name="description" 
                defaultValue={productToEdit?.description || ''} 
                rows={3} 
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-faint outline-none text-sm focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all" 
                placeholder="Mô tả ngắn về sản phẩm..."
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted">Trạng thái lưu hành</label>
              <select 
                name="status" 
                defaultValue={productToEdit?.status || PRODUCT_STATUS.ACTIVE} 
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink outline-none text-sm focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value={PRODUCT_STATUS.ACTIVE}>Đang công bố & Sản xuất</option>
                <option value={PRODUCT_STATUS.DISCONTINUED}>Ngừng sản xuất</option>
                <option value={PRODUCT_STATUS.RECALLED}>Đã thu hồi hồ sơ</option>
              </select>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border mt-6">
              <button 
                type="button" 
                onClick={() => navigate('/products')} 
                className="px-4 py-2 text-ink-muted hover:text-ink font-medium text-xs hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
              >
                Hủy & Quay lại
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg font-medium text-xs flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                {id ? 'Cập nhật Sản phẩm' : 'Lưu Sản phẩm mới'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProductFormPage;