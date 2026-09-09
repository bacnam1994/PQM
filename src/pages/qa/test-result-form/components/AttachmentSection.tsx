import React, { useState } from 'react';
import { 
  CloudIcon, 
  ArrowTopRightOnSquareIcon, 
  ArrowUpTrayIcon, 
  ArrowPathIcon, 
  PlusIcon, 
  DocumentTextIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
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
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
          <CloudIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Tài liệu & File đính kèm
        </label>
        <button
          type="button"
          onClick={() => window.open(googleDriveFolderUrl || 'https://drive.google.com', '_blank')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 text-ink rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-surface-3 transition-colors border border-border"
        >
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          Mở Google Drive
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-2 p-4 rounded-xl border border-border">
        <div className="space-y-3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
          <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Tải lên tài liệu</p>
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
              className="w-full flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-emerald-500 rounded-xl p-4 bg-surface hover:bg-surface-2 cursor-pointer transition-all duration-300 group"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-emerald-600" />
                  <p className="text-xs font-medium text-ink">
                    Đang tải lên... {uploadProgress != null ? `${uploadProgress}%` : ''}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <ArrowUpTrayIcon className="w-6 h-6 text-ink-muted group-hover:text-emerald-600 transition-colors" />
                  <p className="text-xs font-semibold text-ink mt-1">Chọn file ảnh hoặc PDF</p>
                  <p className="text-[11px] text-ink-muted">
                    Tải lên {useGoogleDriveUpload && googleDriveClientId && googleDriveApiKey ? 'Google Drive' : 'Firebase Storage'}
                  </p>
                </div>
              )}
            </label>
          </div>
          {uploadProgress !== null && (
            <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </div>

        <div className="space-y-3 flex flex-col justify-between pt-2 md:pt-0 md:pl-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Liên kết Google Drive thủ công</p>
            <input
              type="text"
              placeholder="Dán liên kết file trong Google Drive..."
              value={manualLink}
              onChange={(e) => setManualLink(e.target.value)}
              className="w-full px-3.5 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            <input
              type="text"
              placeholder="Tên gợi nhớ (VD: Ảnh phiếu QC, COA nguyên liệu...)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-3.5 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleAddManualLink}
            disabled={!manualLink}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Gắn liên kết tài liệu
          </button>
        </div>
      </div>

      {attachments && attachments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att: Attachment, index: number) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-emerald-500/50 shadow-sm transition-all group relative"
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  att.source === 'google_drive' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <DocumentTextIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <p className="text-xs font-semibold text-ink truncate" title={att.name}>
                  {att.name}
                </p>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium mt-0.5"
                >
                  Xem tài liệu <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(index)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted hover:text-rose-500 bg-surface-2 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Xóa tài liệu đính kèm"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-muted italic pl-1">
          Chưa có tài liệu hay file đính kèm nào cho phiếu kiểm nghiệm này.
        </p>
      )}
    </div>
  );
};
