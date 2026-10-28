/**
 * PQM Domain Types — Pharmacopoeia Standards
 * ==========================================
 * Định nghĩa chuẩn dữ liệu Dược điển (Pharmacopoeia Standards)
 * Được sử dụng bởi Repository, Service và AI Tools.
 */

export interface PharmacopoeiaStandard {
  id: string;
  title: string; // Tiêu đề ngắn gọn (vd: "Độ ẩm", "Độ rã", "Định lượng Paracetamol")
  keywords: string[]; // Mảng từ khóa nhận diện câu hỏi
  standard: string; // Nội dung tiêu chuẩn chi tiết (markdown)
  source: string; // DĐVN V, USP, BP, EP, ICH...
  category: string; // Lý hóa, Định lượng, Vi sinh vật, Kim loại nặng, Bao bì, Độ ổn định
  updatedAt?: string;
  updatedBy?: string;
}

export type PharmacoeiaEntry = PharmacopoeiaStandard;
