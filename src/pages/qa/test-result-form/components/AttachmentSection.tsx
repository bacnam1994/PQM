import React, { useState } from 'react';
import { HardDrive, ExternalLink, FileUp, Loader2, Plus, FileText, X } from 'lucide-react';
import { useUIStore } from '../../../../store/useUIStore';
import { storage } from '../../../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

export interface Attachment {
  name: string;
  url: string;
  source: 'google_drive' | 'firebase';
  uploadedAt: string;
}

export interface AttachmentSectionProps {
  batchId: string;
  attachments: Attachment[];
  setFieldValue: (field: string, value: any) => void;
}

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({
  batchId,
  attachments,
  setFieldValue,
}) => {
  const {
    googleDriveFolderUrl,
    googleDriveFolderId,
    googleDriveClientId,
    googleDriveApiKey,
    useGoogleDriveUpload,
  } = useUIStore();

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [manualLink, setManualLink] = useState('');
  const [manualName, setManualName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleAddManualLink = () => {
    if (!manualLink) return;
    const name = manualName.trim() || manualLink.split('/').pop()?.split('?')[0] || 'Tài liệu Google Drive';
    const newAttachment: Attachment = {
      name,
      url: manualLink,
      source: 'google_drive',
      uploadedAt: new Date().toISOString(),
    };
    setFieldValue('attachments', [...(attachments || []), newAttachment]);
    setManualLink('');
    setManualName('');
    toast.success('Đã gắn liên kết Google Drive thành công!');
  };

  const uploadToFirebaseStorage = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const path = `attachments/${batchId || 'temp'}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            console.error(error);
            toast.error('Lỗi khi tải file lên Storage: ' + error.message);
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newAttachment: Attachment = {
              name: file.name,
              url: downloadURL,
              source: 'firebase',
              uploadedAt: new Date().toISOString(),
            };
            setFieldValue('attachments', [...(attachments || []), newAttachment]);
            toast.success(`Đã tải lên tệp ${file.name} thành công!`);
            setUploadProgress(null);
            resolve();
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  const uploadToGoogleDrive = async (file: File): Promise<void> => {
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
              parents: googleDriveFolderId ? [googleDriveFolderId] : [],
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            setUploadProgress(60);
            const response = await fetch(
              'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
                body: form,
              }
            );

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Upload API error: ${errText}`);
            }

            const driveFile = await response.json();
            setUploadProgress(90);

            const newAttachment: Attachment = {
              name: file.name,
              url: driveFile.webViewLink,
              source: 'google_drive',
              uploadedAt: new Date().toISOString(),
            };

            setFieldValue('attachments', [...(attachments || []), newAttachment]);
            toast.success(`Đã tải lên Google Drive: ${file.name}`);
            setUploadProgress(null);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      });

      if (!gClient) {
        reject(new Error('Không thể khởi tạo Google Identity Services. Hãy đảm bảo đã thêm script của Google.'));
      } else {
        gClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey) {
      setIsUploading(true);
      setUploadProgress(10);
      try {
        await uploadToGoogleDrive(file);
      } catch (err: any) {
        console.error('Google Drive Upload Error, falling back to Firebase Storage:', err);
        toast.error('Lỗi tải lên Google Drive: ' + err.message + '. Đang chuyển sang lưu Firebase Storage...');
        await uploadToFirebaseStorage(file);
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
        e.target.value = '';
      }
    } else {
      setIsUploading(true);
      await uploadToFirebaseStorage(file);
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    const newAttachments = [...(attachments || [])];
    newAttachments.splice(idx, 1);
    setFieldValue('attachments', newAttachments);
    toast.success('Đã gỡ bỏ tệp đính kèm.');
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
          <HardDrive size={14} className="text-slate-400" />
          Tài liệu & File đính kèm
        </label>
        <button
          type="button"
          onClick={() => window.open(googleDriveFolderUrl || 'https://drive.google.com', '_blank')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-sm"
        >
          <ExternalLink size={12} />
          Mở Thư mục Google Drive
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="space-y-3 flex flex-col justify-center border-r border-slate-200/50 pr-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tải lên tài liệu</p>
          <div className="relative">
            <input
              type="file"
              id="attachment-file-input"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
              accept="image/*,application/pdf"
            />
            <label
              htmlFor="attachment-file-input"
              className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-indigo-500 rounded-xl p-4 bg-white hover:bg-indigo-50/20 cursor-pointer transition-all duration-300 group"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <p className="text-xs font-bold text-slate-600">
                    Đang tải lên... {uploadProgress != null ? `${uploadProgress}%` : ''}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <FileUp size={24} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <p className="text-xs font-bold text-slate-700 mt-1">Chọn file ảnh hoặc PDF</p>
                  <p className="text-[10px] text-slate-400 italic">
                    Tải lên {useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey ? 'Google Drive' : 'Firebase Storage'}
                  </p>
                </div>
              )}
            </label>
          </div>
          {uploadProgress !== null && (
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>

        <div className="space-y-3 flex flex-col justify-between pl-2">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Liên kết Google Drive thủ công</p>
            <input
              type="text"
              placeholder="Dán liên kết file trong Google Drive..."
              value={manualLink}
              onChange={(e) => setManualLink(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder="Tên gợi nhớ (VD: Ảnh phiếu QC, COA nguyên liệu...)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={handleAddManualLink}
            disabled={!manualLink}
            className="w-full py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase hover:bg-slate-900 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
          >
            <Plus size={12} />
            Gắn liên kết tài liệu
          </button>
        </div>
      </div>

      {attachments && attachments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att: Attachment, index: number) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-white border border-slate-150 rounded-xl hover:shadow-md transition-all group relative"
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  att.source === 'google_drive' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <p className="text-xs font-bold text-slate-700 truncate" title={att.name}>
                  {att.name}
                </p>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-500 hover:underline inline-flex items-center gap-1 font-semibold mt-0.5"
                >
                  Xem tài liệu <ExternalLink size={8} />
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(index)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-350 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg transition-all"
                title="Xóa tài liệu đính kèm"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic pl-2">
          Chưa có tài liệu hay file đính kèm nào cho phiếu kiểm nghiệm này.
        </p>
      )}
    </div>
  );
};
