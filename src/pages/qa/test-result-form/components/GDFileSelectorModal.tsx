import React from 'react';
import { 
  CloudIcon, 
  XMarkIcon, 
  ArrowPathIcon, 
  DocumentTextIcon, 
  FolderOpenIcon, 
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <CloudIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink tracking-tight">Quét file từ Google Drive</h3>
              <p className="text-xs text-ink-muted">Chọn tệp tài liệu trong thư mục Google Drive để AI phân tích.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-xl text-ink-muted transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <ArrowPathIcon className="animate-spin text-emerald-600 w-8 h-8" />
              <p className="text-xs font-semibold text-ink-muted">Đang tải danh sách file từ Google Drive...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-border">
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
                        ? 'hover:bg-surface-2 cursor-pointer' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl ${isPdf ? 'bg-red-500/10 text-red-600' : isImage ? 'bg-blue-500/10 text-blue-600' : 'bg-surface-3 text-ink-muted'}`}>
                        <DocumentTextIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate" title={file.name}>{file.name}</p>
                        <p className="text-[10px] text-ink-muted mt-0.5">
                          {file.mimeType.split('/').pop()?.toUpperCase()} • {file.createdTime ? new Date(file.createdTime).toLocaleDateString('vi-VN') : 'Mới'}
                        </p>
                      </div>
                    </div>
                    
                    {isSupported ? (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/20">
                        Chọn & Quét
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-ink-muted bg-surface-3 px-2 py-0.5 rounded uppercase tracking-wider">
                        Không hỗ trợ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <FolderOpenIcon className="w-12 h-12 mx-auto text-ink-muted/40" />
              <p className="text-xs font-semibold text-ink-muted uppercase">Thư mục trống!</p>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Không tìm thấy file tài liệu nào trong thư mục Google Drive của bạn. Bạn hãy tải ảnh chụp hoặc file PDF phiếu kiểm nghiệm vào thư mục này trước.
              </p>
              {folderUrl && (
                <button
                  type="button"
                  onClick={() => window.open(folderUrl, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 text-ink rounded-lg text-xs font-semibold uppercase hover:bg-surface-3 transition-colors border border-border"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
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
