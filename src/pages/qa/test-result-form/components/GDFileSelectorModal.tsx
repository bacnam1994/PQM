import React from 'react';
import { HardDrive, X, Loader2, FileText, FolderOpen, ExternalLink } from 'lucide-react';

export interface GDFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  size?: string;
}

export interface GDFileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: GDFile[];
  onSelectFile: (file: GDFile) => void;
  isLoading: boolean;
  folderUrl?: string;
}

export const GDFileSelectorModal: React.FC<GDFileSelectorModalProps> = ({
  isOpen,
  onClose,
  files,
  onSelectFile,
  isLoading,
  folderUrl
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <HardDrive size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Quét file từ Google Drive</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chọn tệp tài liệu trong thư mục Google Drive để AI phân tích.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách file từ Google Drive...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {files.map((file) => {
                const isImage = file.mimeType.startsWith('image/');
                const isPdf = file.mimeType === 'application/pdf';
                const isSupported = isImage || isPdf;
                
                return (
                  <div 
                    key={file.id} 
                    onClick={() => isSupported && onSelectFile(file)}
                    className={`flex items-center justify-between py-3 px-2 rounded-xl transition-all ${
                      isSupported 
                        ? 'hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 cursor-pointer active:scale-[0.99]' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg ${isPdf ? 'bg-red-50 text-red-500' : isImage ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={file.name}>{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {file.mimeType.split('/').pop()?.toUpperCase()} • {file.createdTime ? new Date(file.createdTime).toLocaleDateString('vi-VN') : 'Mới'}
                        </p>
                      </div>
                    </div>
                    
                    {isSupported ? (
                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Chọn & Quét
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">
                        Không hỗ trợ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <FolderOpen size={48} className="mx-auto text-slate-200" />
              <p className="text-xs font-bold text-slate-400 uppercase">Thư mục trống!</p>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                Không tìm thấy file tài liệu nào trong thư mục Google Drive của bạn. Bạn hãy tải ảnh chụp hoặc file PDF phiếu kiểm nghiệm vào thư mục này trước.
              </p>
              {folderUrl && (
                <button
                  type="button"
                  onClick={() => window.open(folderUrl, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 transition-colors shadow-sm"
                >
                  <ExternalLink size={12} />
                  Mở Thư mục Google Drive
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
