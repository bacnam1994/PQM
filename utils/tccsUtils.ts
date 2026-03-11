import { TCCS } from '../types';

/**
 * Tìm TCCS phù hợp cho lô hàng dựa trên ngày sản xuất (mfgDate) và ngày ban hành TCCS (issueDate)
 * 
 * QUY TẮC:
 * - Ưu tiên 1: Nếu lô đã có tccsId được gán trước đó và TCCS đó còn active, giữ nguyên
 * - Ưu tiên 2: Tìm TCCS có issueDate gần nhất nhưng <= mfgDate (áp dụng cho lô đã sản xuất)
 * - Ưu tiên 3: Nếu không có TCCS phù hợp (lô sản xuất trước khi có TCCS nào), dùng TCCS cũ nhất
 * - Ưu tiên 4: Nếu lô không có ngày SX, lấy TCCS mới nhất
 * 
 * @param productId - ID của sản phẩm
 * @param mfgDate - Ngày sản xuất của lô (ISO string hoặc null)
 * @param tccsList - Danh sách TCCS của sản phẩm (đã được lọc theo productId và isActive)
 * @param existingTccsId - TCCS ID hiện tại của lô (nếu có) - optional
 * @returns TCCS phù hợp nhất hoặc null
 */
export const findTCCSByMfgDate = (
  productId: string,
  mfgDate: string | null,
  tccsList: TCCS[] | undefined | null,
  existingTccsId?: string | null
): TCCS | null => {
  // Safety check: tccsList must be a valid array
  if (!tccsList || !Array.isArray(tccsList) || tccsList.length === 0) {
    return null;
  }

  // Lọc TCCS active của sản phẩm và sort giảm dần theo ngày ban hành (mới nhất trước)
  const productTccsList = tccsList
    .filter(t => t && t.productId === productId && t.isActive)
    .sort((a, b) => new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime());

  if (productTccsList.length === 0) return null;

  // Bước 1: Nếu lô đã có tccsId được gán trước đó, kiểm tra xem TCCS đó có tồn tại và active không
  if (existingTccsId) {
    const existingTccs = productTccsList.find(t => t.id === existingTccsId);
    if (existingTccs) {
      return existingTccs;
    }
  }

  // Bước 2: Nếu có ngày sản xuất, tìm TCCS phù hợp
  if (mfgDate) {
    const mfgTime = new Date(mfgDate).getTime();
    
    // Kiểm tra validity của mfgTime
    if (isNaN(mfgTime)) {
      // Ngày không hợp lệ, fallback về TCCS mới nhất
      return productTccsList[0];
    }
    
    // Tìm TCCS có issueDate gần nhất nhưng <= mfgDate
    const match = productTccsList.find(t => {
      const issueTime = new Date(t.issueDate || 0).getTime();
      return !isNaN(issueTime) && issueTime <= mfgTime;
    });
    
    if (match) {
      return match;
    }
    
    // Fallback: Nếu không có TCCS nào có issueDate <= mfgDate (lô sản xuất trước khi có TCCS),
    // dùng TCCS cũ nhất
    return productTccsList[productTccsList.length - 1];
  }

  // Bước 3: Nếu không có ngày SX, lấy TCCS mới nhất
  return productTccsList[0];
};

/**
 * Lấy thông tin TCCS đang áp dụng cho lô (bao gồm cả logic fallback)
 * 
 * @param batch - Thông tin lô hàng (cần có productId, mfgDate, tccsId)
 * @param tccsList - Danh sách TCCS của sản phẩm
 * @returns TCCS đang áp dụng hoặc null
 */
export const getActiveTCCSForBatch = (
  batch: { productId: string; mfgDate?: string; tccsId?: string | null },
  tccsList: TCCS[] | undefined | null
): TCCS | null => {
  // Safety check
  if (!batch || !batch.productId) {
    return null;
  }
  
  return findTCCSByMfgDate(
    batch.productId,
    batch.mfgDate || null,
    tccsList,
    batch.tccsId
  );
};

/**
 * Kiểm tra xem TCCS hiện tại của lô có phải là TCCS đúng theo ngày SX không
 * (Dùng để hiển thị cảnh báo cho người dùng)
 * 
 * @param batch - Thông tin lô hàng
 * @param tccsList - Danh sách TCCS của sản phẩm
 * @returns true nếu TCCS hiện tại là đúng theo logic, false nếu cần cập nhật
 */
export const isTCCSUpToDate = (
  batch: { productId: string; mfgDate?: string; tccsId?: string | null },
  tccsList: TCCS[] | undefined | null
): boolean => {
  // Safety check
  if (!batch || !batch.productId) {
    return false;
  }

  const correctTCCS = findTCCSByMfgDate(
    batch.productId,
    batch.mfgDate || null,
    tccsList
  );
  
  return correctTCCS ? correctTCCS.id === batch.tccsId : false;
};

