import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Kiểm tra xem một URL có phải là file lưu trữ trên Firebase Storage hay không
 */
export const isFirebaseStorageUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.startsWith('gs://')
  );
};

/**
 * Xóa một tệp tin trên Firebase Storage bằng URL tải về (Download URL) hoặc đường dẫn Storage
 * @param fileUrl URL hoặc đường dẫn của tệp trên Firebase Storage
 * @returns true nếu xóa thành công, false nếu tệp không tồn tại hoặc lỗi
 */
export const deleteStorageFileByUrl = async (fileUrl?: string | null): Promise<boolean> => {
  if (!fileUrl || !isFirebaseStorageUrl(fileUrl)) {
    return false;
  }

  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
    return true;
  } catch (error: any) {
    // Nếu tệp không tồn tại (storage/object-not-found) thì bỏ qua coi như đã xóa
    if (error?.code === 'storage/object-not-found') {
      return true;
    }
    console.warn(`[StorageService] Không thể xóa tệp trên Storage: ${fileUrl}`, error);
    return false;
  }
};

/**
 * Xóa hàng loạt tệp tin trên Firebase Storage an toàn
 * @param urls Mảng các URL cần xóa
 * @returns Số lượng tệp đã xóa thành công
 */
export const deleteMultipleStorageFiles = async (
  urls: (string | undefined | null)[]
): Promise<number> => {
  const validUrls = urls.filter((url): url is string => isFirebaseStorageUrl(url));
  if (validUrls.length === 0) return 0;

  const results = await Promise.allSettled(
    validUrls.map(url => deleteStorageFileByUrl(url))
  );

  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
};
