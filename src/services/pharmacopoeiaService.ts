/**
 * pharmacopoeiaService.ts
 * =======================
 * Dịch vụ quản lý Cơ sở dữ liệu Dược điển (Pharmacopoeia Standards)
 * Hỗ trợ lưu trữ động trên Firebase Realtime Database (/pharmacopoeia_standards)
 * và cung cấp dữ liệu ngữ cảnh động (Dynamic Context) cho AI Copilot.
 */

import { get, ref, set, remove, update } from 'firebase/database';
import { db } from '../firebase';

export interface PharmacopoeiaStandard {
  id: string;
  title: string;          // Tiêu đề ngắn gọn (vd: "Độ ẩm", "Độ rã", "Định lượng Paracetamol")
  keywords: string[];     // Mảng từ khóa nhận diện câu hỏi
  standard: string;      // Nội dung tiêu chuẩn chi tiết (markdown)
  source: string;        // DĐVN V, USP, BP, EP, ICH...
  category: string;      // Lý hóa, Định lượng, Vi sinh vật, Kim loại nặng, Bao bì, Độ ổn định
  updatedAt?: string;
  updatedBy?: string;
}

export type PharmacoeiaEntry = PharmacopoeiaStandard;

export const DEFAULT_PHARMACOPOEIA_DB: PharmacopoeiaStandard[] = [
  // ─── LÝ HÓA ───────────────────────────────────────────────────
  {
    id: 'pharma-std-001',
    title: 'Độ ẩm (Loss on Drying)',
    keywords: ['độ ẩm', 'hàm lượng nước', 'moisture', 'loss on drying', 'lod', 'water content', 'kf', 'karl fischer'],
    standard: `**Độ ẩm (Loss on Drying / Moisture):**\n- Viên nén thông thường: **NMT 5.0%** (trừ chỉ dẫn riêng)\n- Viên nang: **NMT 7.0%** (tùy thành phần vỏ nang)\n- Bột/Cốm: **NMT 2.0–5.0%** (theo TCCS từng sản phẩm)\n- Phương pháp Karl Fischer: áp dụng cho mẫu nhạy nhiệt`,
    source: 'DĐVN V, Phụ lục 9.6 / USP <731>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-002',
    title: 'Độ rã (Disintegration)',
    keywords: ['độ rã', 'thời gian rã', 'disintegration', 'rã', 'tan rã'],
    standard: `**Độ rã (Disintegration):**\n- Viên nén thông thường: **NMT 15 phút** (nước, 37°C)\n- Viên bao phim: **NMT 30 phút** (HCl 0.1N hoặc nước, 37°C)\n- Viên bao tan trong ruột (enteric): **không rã trong HCl 0.1N sau 2 giờ**, rã trong đệm phosphate pH 6.8 trong **NMT 60 phút**\n- Viên ngậm dưới lưỡi: **NMT 3 phút**\n- Viên sủi bọt: **NMT 5 phút** trong nước 15–25°C`,
    source: 'DĐVN V, Phụ lục 11.6 / USP <701>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-003',
    title: 'Độ hòa tan (Dissolution)',
    keywords: ['độ hòa tan', 'dissolution', 'hòa tan', 'drug release', 'in-vitro'],
    standard: `**Độ hòa tan (Dissolution):**\n- Yêu cầu chung: **NLT Q+5% sau 45 phút** (Q thường = 70–80% theo chuyên luận)\n- Thiết bị: Rổ quay (USP 1) hoặc Cánh khuấy (USP 2)\n- Môi trường: theo chỉ dẫn chuyên luận (nước, HCl 0.1N, đệm phosphate pH 4.5/6.8)\n- Nhiệt độ chuẩn: **37 ± 0.5°C**\n- Lưu ý: Với thuốc giải phóng có kiểm soát, theo profile đa điểm thời gian`,
    source: 'DĐVN V, Phụ lục 11.4 / USP <711>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-004',
    title: 'Độ cứng viên nén',
    keywords: ['độ cứng', 'hardness', 'crushing strength', 'tensile strength'],
    standard: `**Độ cứng viên nén:**\n- Yêu cầu: thường **30–200 N** (tùy kích thước và đường kính viên)\n- Không có quy định cứng trong dược điển — áp dụng theo TCCS sản phẩm\n- Viên 8mm đường kính: thường 60–100 N\n- Đo bằng máy đo độ cứng Schleuniger, Monsanto`,
    source: 'TCCS sản phẩm / Pharmatest internal specification',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-005',
    title: 'Độ mài mòn (Friability)',
    keywords: ['độ mài mòn', 'friability', 'attrition', 'abrasion'],
    standard: `**Độ mài mòn (Friability):**\n- Yêu cầu: **NMT 1.0%** (viên nén không bao)\n- Phương pháp: quay 100 vòng ở 25 rpm, sàng lọc bụi sau quay\n- Áp dụng cho viên không bao có khối lượng ≥ 650 mg: **NMT 0.5%**`,
    source: 'DĐVN V, Phụ lục 11.3 / USP <1216>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-006',
    title: 'Đồng đều khối lượng',
    keywords: ['đồng đều khối lượng', 'weight variation', 'mass variation', 'uniformity of mass', 'uom', 'đồng đều'],
    standard: `**Đồng đều khối lượng (Weight Variation):**\n- Viên nén < 80 mg: sai số ≤ **±10%**, không viên nào vượt ±20%\n- Viên nén 80–250 mg: sai số ≤ **±7.5%**, không viên nào vượt ±15%\n- Viên nén > 250 mg: sai số ≤ **±5%**, không viên nào vượt ±10%\n- Mẫu: thử 20 viên, không hơn 2 viên được sai số vượt ngưỡng trên`,
    source: 'DĐVN V, Phụ lục 11.2 / USP <2091>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-007',
    title: 'Đồng đều hàm lượng',
    keywords: ['đồng đều hàm lượng', 'content uniformity', 'uniformity of dosage', 'cu', 'uds'],
    standard: `**Đồng đều hàm lượng (Content Uniformity):**\n- AV (Acceptance Value) ≤ **L1 = 15.0** (thử lần 1 với 10 đơn vị)\n- Nếu không đạt: tiếp tục thử 20 đơn vị, AV ≤ **L2 = 25.0**\n- Áp dụng cho dạng bào chế chứa < 25 mg hoặc < 25% hoạt chất`,
    source: 'DĐVN V, Phụ lục 11.7 / USP <905> / ICH Q6A',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-008',
    title: 'Độ pH',
    keywords: ['ph', 'hydrogen ion', 'độ acid', 'độ kiềm', 'acidity', 'alkalinity'],
    standard: `**Độ pH:**\n- Dung dịch tiêm: thường **4.0–8.5** (theo chuyên luận từng sản phẩm)\n- Sirô uống: **3.0–5.0** (phụ thuộc thành phần)\n- Nhỏ mắt: **6.0–8.0** (gần sinh lý)\n- Đo bằng máy đo pH đã hiệu chuẩn với dung dịch đệm chuẩn`,
    source: 'DĐVN V, Phụ lục 6.2 / USP <791>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-009',
    title: 'Độ nhớt (Viscosity)',
    keywords: ['độ nhớt', 'viscosity', 'brookfield', 'kinematic'],
    standard: `**Độ nhớt (Viscosity):**\n- Gel/Kem/Mỡ: theo yêu cầu TCCS riêng, đo ở nhiệt độ xác định (thường 25°C)\n- Dung dịch tiêm: thường NMT 50 mPa·s\n- Phương pháp: Brookfield (rotational) hoặc Ostwald (kinematic)\n- Đơn vị: mPa·s (hoặc cP, 1 cP = 1 mPa·s)`,
    source: 'DĐVN V, Phụ lục 6.14 / USP <911>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-010',
    title: 'Tỷ trọng (Relative Density)',
    keywords: ['tỷ trọng', 'specific gravity', 'relative density', 'density'],
    standard: `**Tỷ trọng (Relative Density):**\n- Siro: thường **1.10–1.35**\n- Dung dịch tiêm: thường **0.9–1.1**\n- Đo bằng tỷ trọng kế (hydrometer) hoặc máy đo tỷ trọng điện tử (pycnometer)\n- Nhiệt độ đo tiêu chuẩn: **20°C**`,
    source: 'DĐVN V, Phụ lục 6.5 / USP <841>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-011',
    title: 'Tro sulfat (Sulfated Ash)',
    keywords: ['tro', 'residue on ignition', 'sulfated ash', 'sulphated ash', 'ash', 'tro sulfat'],
    standard: `**Tro sulfat (Sulfated Ash):**\n- Nguyên liệu: thường **NMT 0.1%** (tùy chuyên luận)\n- Thành phẩm viên: thường không quy định (trừ trường hợp đặc biệt)\n- Phương pháp: nung ở 600°C với H₂SO₄ đậm đặc`,
    source: 'DĐVN V, Phụ lục 9.8 / USP <281>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-012',
    title: 'Cảm quan (Appearance)',
    keywords: ['cảm quan', 'hình thức', 'appearance', 'description', 'color', 'colour', 'màu sắc', 'clarity'],
    standard: `**Chỉ tiêu cảm quan (Appearance/Description):**\n- Thường là chỉ tiêu định tính: mô tả hình dạng, màu sắc, mùi, vị\n- Tiêu chuẩn: "Đúng như mô tả" — không có ngưỡng số\n- Ví dụ: "Viên nén tròn, bao phim màu trắng, hai mặt lồi, không có vết nứt vỡ"\n- Đánh giá: So sánh với mẫu chuẩn (reference standard) bằng mắt thường`,
    source: 'DĐVN V, Phụ lục 3 / USP <631>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-013',
    title: 'Độ trong của dung dịch',
    keywords: ['độ trong', 'clarity of solution', 'opalescence', 'turbidity', 'trong suốt'],
    standard: `**Độ trong của dung dịch (Clarity of Solution):**\n- So sánh với thang đục chuẩn (Formazin): RS1–RS4\n- Thường yêu cầu: **không đục hơn RS1** hoặc RS2 (tùy chuyên luận)\n- Đo bằng máy đo độ đục (Turbidimeter) hoặc so sánh mắt thường trên nền đen/trắng`,
    source: 'DĐVN V, Phụ lục 9.2 / USP <631>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-014',
    title: 'Góc quay cực riêng [α]',
    keywords: ['góc quay cực', 'optical rotation', 'specific rotation', 'polarimetry'],
    standard: `**Góc quay cực riêng [α] (Optical Rotation):**\n- Đo bằng máy phân cực (Polarimeter) ở 589 nm (đèn Natri D-line), 20°C\n- Giá trị theo từng chuyên luận nguyên liệu\n- Ví dụ: Glucose anhydrous: **[α] = +52.5° đến +53.3°**`,
    source: 'DĐVN V, Phụ lục 6.7 / USP <781>',
    category: 'Lý hóa'
  },
  {
    id: 'pharma-std-015',
    title: 'Điểm chảy (Melting Point)',
    keywords: ['điểm chảy', 'melting point', 'mp', 'melting range'],
    standard: `**Điểm chảy (Melting Point):**\n- Giá trị theo từng chuyên luận nguyên liệu\n- Khoảng chảy: thường ≤ 2°C\n- Phương pháp: ống mao quản (capillary tube), máy đo điểm chảy tự động`,
    source: 'DĐVN V, Phụ lục 6.6 / USP <741>',
    category: 'Lý hóa'
  },

  // ─── ĐỊNH LƯỢNG (ASSAY) ───────────────────────────────────────
  {
    id: 'pharma-std-016',
    title: 'Định lượng Paracetamol',
    keywords: ['paracetamol', 'acetaminophen', 'panadol', 'tylenol'],
    standard: `**Định lượng Paracetamol (Acetaminophen):**\n- Hàm lượng: **95.0–105.0%** so với hàm lượng ghi trên nhãn\n- Phương pháp: HPLC (pha đảo, C18, detector UV 243 nm) hoặc UV-Vis (243 nm)\n- Nguyên liệu API: **98.0–101.0%** (tính theo dạng khan)`,
    source: 'DĐVN V, Chuyên luận Paracetamol / USP Acetaminophen / BP Paracetamol',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-017',
    title: 'Định lượng Amoxicillin',
    keywords: ['amoxicillin', 'amoxil', 'trimox'],
    standard: `**Định lượng Amoxicillin:**\n- Thành phẩm viên/nang: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **95.0–102.0%** (tính theo dạng khan)\n- Phương pháp: HPLC pha đảo, detector UV 254 nm\n- Bảo quản lạnh, tránh ẩm; kiểm tra độ ổn định thường xuyên`,
    source: 'USP Amoxicillin / BP Amoxicillin / DĐVN V',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-018',
    title: 'Định lượng Vitamin C',
    keywords: ['vitamin c', 'ascorbic acid', 'acid ascorbic', 'vitaminc'],
    standard: `**Định lượng Vitamin C (Acid Ascorbic):**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **99.0–100.5%**\n- Phương pháp: Chuẩn độ iod (iodimetry) hoặc HPLC\n- Lưu ý: Nhạy với nhiệt độ, ánh sáng và oxy — bảo quản kín, tránh sáng`,
    source: 'DĐVN V / USP Ascorbic Acid',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-019',
    title: 'Định lượng Vitamin D',
    keywords: ['vitamin d', 'cholecalciferol', 'ergocalciferol', 'd3', 'd2'],
    standard: `**Định lượng Vitamin D (Cholecalciferol/Ergocalciferol):**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Phương pháp: HPLC-UV (265 nm) hoặc LC-MS/MS (độ chính xác cao hơn)\n- Lưu ý: Nhạy sáng, bảo quản ở 2–8°C, tránh ánh sáng UV`,
    source: 'DĐVN V / USP Cholecalciferol Capsules / BP',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-020',
    title: 'Định lượng Ibuprofen',
    keywords: ['ibuprofen', 'brufen', 'advil'],
    standard: `**Định lượng Ibuprofen:**\n- Thành phẩm: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **98.0–102.0%**\n- Phương pháp: HPLC pha đảo C18, UV 221 nm`,
    source: 'DĐVN V / USP Ibuprofen / BP',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-021',
    title: 'Định lượng Metformin HCl',
    keywords: ['metformin', 'glucophage', 'tiểu đường'],
    standard: `**Định lượng Metformin HCl:**\n- Thành phẩm: **93.0–107.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu: **98.5–101.5%**\n- Phương pháp: HPLC, detector UV 218 nm; hoặc chuẩn độ acid-base`,
    source: 'USP Metformin HCl / BP / DĐVN',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-022',
    title: 'Định lượng chung (Assay General)',
    keywords: ['định lượng', 'assay', 'hàm lượng', 'content', 'purity', 'potency', 'label claim'],
    standard: `**Định lượng (Assay) — Yêu cầu chung:**\n- Thành phẩm thuốc thông thường: **90.0–110.0%** so với hàm lượng ghi nhãn\n- Nguyên liệu dược dụng: thường **98.0–102.0%** (tính theo dạng khan)\n- Thuốc kháng sinh, vitamin: kiểm tra đặc biệt, thường **95.0–105.0%**\n- Phương pháp: HPLC (tiêu chuẩn vàng), UV-Vis, hoặc chuẩn độ hóa học`,
    source: 'ICH Q6A / DĐVN V / USP General Chapter <905>',
    category: 'Định lượng'
  },
  {
    id: 'pharma-std-023',
    title: 'Tạp chất liên quan (Related Substances)',
    keywords: ['tạp chất', 'related substances', 'impurities', 'rs', 'related compounds', 'organic impurities'],
    standard: `**Tạp chất liên quan (Related Substances):**\n- Tạp đã biết (known impurity): thường **NMT 0.2%** (mỗi chất) theo ICH Q3A/B\n- Tạp chưa biết (unknown): **NMT 0.10%** (mỗi chất)\n- Tổng tạp: **NMT 0.5–2.0%** (tùy chuyên luận sản phẩm)\n- Thành phẩm: tổng tạp phân hủy **NMT 2.0%** (thường)\n- Phương pháp: HPLC độ nhạy cao, detector DAD hoặc MS`,
    source: 'ICH Q3A/B/C / DĐVN V, Phụ lục 9.3 / USP <621>',
    category: 'Định lượng'
  },

  // ─── VI SINH VẬT ─────────────────────────────────────────────
  {
    id: 'pharma-std-024',
    title: 'Giới hạn vi sinh vật (Microbial Limits)',
    keywords: ['vi sinh', 'microbial', 'tamc', 'tvkhk', 'tổng số vi khuẩn', 'total aerobic', 'tpc', 'apc', 'cfu'],
    standard: `**Giới hạn vi sinh vật (Microbial Limits) — Thuốc uống không yêu cầu vô khuẩn:**\n- TAMC (Tổng vi khuẩn hiếu khí): **NMT 10³ CFU/g hoặc mL**\n- TYMC (Nấm mốc + nấm men): **NMT 10² CFU/g hoặc mL**\n- E. coli: **Không được có** (trong 1g hoặc 1mL)\n- Salmonella, Staphylococcus aureus: **Không được có** (trong 1g)\n\n**Thuốc bôi ngoài da:**\n- TAMC: **NMT 10² CFU/g hoặc mL**\n- TYMC: **NMT 10¹ CFU/g hoặc mL**\n- P. aeruginosa, S. aureus: **Không được có** (trong 1g)`,
    source: 'DĐVN V, Phụ lục 13.6 / USP <61><62> / EP 5.1.4',
    category: 'Vi sinh vật'
  },
  {
    id: 'pharma-std-025',
    title: 'Tổng số nấm mốc và nấm men (TYMC)',
    keywords: ['nấm mốc', 'nấm men', 'tymc', 'yeast', 'mold', 'mould', 'fungal'],
    standard: `**Tổng số nấm mốc và nấm men (TYMC):**\n- Thuốc uống: **NMT 10² CFU/g hoặc mL**\n- Thuốc bôi ngoài: **NMT 10¹ CFU/g hoặc mL**\n- Môi trường: Sabouraud Dextrose Agar (SDA), ủ 5 ngày ở 22–25°C\n- Nếu dùng mẫu lỏng: pha loãng theo hệ số 10, đếm đĩa 1:10 hoặc 1:100`,
    source: 'DĐVN V, Phụ lục 13.6 / USP <62>',
    category: 'Vi sinh vật'
  },
  {
    id: 'pharma-std-026',
    title: 'Thử vô khuẩn (Sterility Test)',
    keywords: ['vô khuẩn', 'sterility', 'sterile', 'sterilization'],
    standard: `**Thử vô khuẩn (Sterility Test):**\n- Áp dụng: thuốc tiêm, thuốc nhỏ mắt, dịch truyền TM, implant\n- Phương pháp: Lọc màng (membrane filtration) — ưu tiên; hoặc nuôi cấy trực tiếp\n- Môi trường: Fluid Thioglycollate Medium (FTM) + Soybean Casein Digest Medium (SCDM)\n- Thời gian ủ: **14 ngày** ở 30–35°C (FTM) và 20–25°C (SCDM)\n- Kết quả: **Không có sự phát triển vi sinh vật**`,
    source: 'DĐVN V, Phụ lục 13.1 / USP <71> / EP 2.6.1',
    category: 'Vi sinh vật'
  },
  {
    id: 'pharma-std-027',
    title: 'Nội độc tố vi khuẩn (BET/LAL)',
    keywords: ['nội độc tố', 'endotoxin', 'lal', 'pyrogen', 'bacterial endotoxin'],
    standard: `**Thử nội độc tố vi khuẩn (Bacterial Endotoxins Test — BET/LAL):**\n- Thuốc tiêm tĩnh mạch: **NMT 0.25 EU/mL** (hoặc theo giới hạn K)\n- Dịch truyền: thường **NMT 0.5 EU/mL**\n- Phương pháp: Gel-clot, Turbidimetric hoặc Chromogenic\n- Giới hạn K = 5 EU/kg/h (người lớn 70 kg, 1h, IV)\n- Công thức: Giới hạn = K / M (M = liều mg/kg/h)`,
    source: 'DĐVN V, Phụ lục 13.2 / USP <85> / EP 2.6.14',
    category: 'Vi sinh vật'
  },

  // ─── KIM LOẠI NẶNG ───────────────────────────────────────────
  {
    id: 'pharma-std-028',
    title: 'Giới hạn kim loại nặng',
    keywords: ['kim loại nặng', 'heavy metals', 'kln', 'arsenic', 'asen', 'chì', 'lead', 'thủy ngân', 'mercury', 'cadmium', 'cadmi'],
    standard: `**Giới hạn kim loại nặng (Heavy Metals) — Thuốc uống:**\n- Asen (As): **NMT 2 ppm** (2 µg/g)\n- Chì (Pb): **NMT 5 ppm** (5 µg/g)\n- Thủy ngân (Hg): **NMT 0.5 ppm** (0.5 µg/g)\n- Cadmi (Cd): **NMT 0.5 ppm** (0.5 µg/g)\n- Tổng kim loại nặng: **NMT 20 ppm** (theo giới hạn chung)\n- Phương pháp: ICP-MS (độ nhạy cao), ICP-OES, AAS\n\n**Thuốc bôi ngoài:**\n- Pb: NMT 10 ppm; Cd: NMT 1 ppm; Hg: NMT 1 ppm`,
    source: 'DĐVN V, Phụ lục 9.4 / USP <232><233> / ICH Q3D',
    category: 'Kim loại nặng'
  },

  // ─── BAO BÌ & BẢO QUẢN ──────────────────────────────────────
  {
    id: 'pharma-std-029',
    title: 'Độ kín bao bì (Closure Integrity)',
    keywords: ['độ kín', 'container closure', 'seal', 'closure integrity', 'leak test'],
    standard: `**Kiểm tra độ kín bao bì (Container Closure Integrity):**\n- Màng bao blister/vỉ nhôm: ngâm nước màu xanh hoặc test áp suất\n- Lọ PE/HDPE: test rò rỉ dưới chân không\n- Lọ thủy tinh tiêm: kiểm tra bằng áp suất hoặc màu sắc\n- Tiêu chuẩn: **không rò rỉ**, không phát hiện màu thâm nhập`,
    source: 'DĐVN V, Phụ lục 1.3 / USP <1207>',
    category: 'Bao bì'
  },
  {
    id: 'pharma-std-030',
    title: 'Độ thấm hơi nước bao bì (WVTR)',
    keywords: ['độ ẩm bao bì', 'water vapor transmission', 'wvtr', 'moisture permeation'],
    standard: `**Độ thấm hơi nước bao bì (WVTR):**\n- Blister PVC/PVDC: thường **NMT 0.5 g/m²/ngày** ở 23°C, 85%RH\n- Blister Cold-form (Alu-Alu): **NMT 0.05 g/m²/ngày** (hầu như không thấm)\n- Lọ HDPE: **NMT 20 mg/day** (Class A: tighter packaging)`,
    source: 'USP <661> / ASTM F1249',
    category: 'Bao bì'
  },

  // ─── ĐỘ ỔN ĐỊNH ─────────────────────────────────────────────
  {
    id: 'pharma-std-031',
    title: 'Nghiên cứu độ ổn định (Stability Study)',
    keywords: ['độ ổn định', 'stability', 'shelf life', 'accelerated', 'long-term', 'real-time', 'ict'],
    standard: `**Nghiên cứu độ ổn định (Stability Study):**\n- **Dài hạn (Long-term):** 25°C ± 2°C / 60%RH ± 5% — thường 12–36 tháng\n- **Lão hóa cấp tốc (Accelerated):** 40°C ± 2°C / 75%RH ± 5% — 6 tháng\n- **Vùng khí hậu Việt Nam (Zone IVb):** 30°C ± 2°C / 75%RH ± 5%\n- Tiêu chí đánh giá: nằm trong giới hạn chỉ tiêu tại mỗi điểm kiểm tra\n- Điểm lấy mẫu dài hạn: T=0, 3, 6, 9, 12, 18, 24, 36 tháng`,
    source: 'ICH Q1A(R2) / ASEAN Guideline / WHO TRS 953',
    category: 'Độ ổn định'
  }
];

// In-memory cache
let inMemoryStandards: PharmacopoeiaStandard[] = [...DEFAULT_PHARMACOPOEIA_DB];
let isLoadedFromRTDB = false;

/**
 * Tính điểm relevance giữa câu hỏi và từ khóa của entry
 */
export const calcRelevanceScore = (query: string, entry: PharmacopoeiaStandard): number => {
  const q = query.toLowerCase().trim();
  let score = 0;
  for (const kw of entry.keywords) {
    const kwLower = kw.toLowerCase().trim();
    if (q === kwLower) { score += 15; continue; }
    if (q.includes(kwLower)) { score += 8; continue; }
    const words = kwLower.split(' ').filter(w => w.length >= 3);
    const matchCount = words.filter(w => q.includes(w)).length;
    if (matchCount > 0) score += matchCount * 3;
  }
  return score;
};

/**
 * Lấy toàn bộ tiêu chuẩn dược điển từ bộ nhớ đệm hoặc RTDB
 */
export const getPharmacopoeiaStandardsSync = (): PharmacopoeiaStandard[] => {
  return inMemoryStandards;
};

/**
 * Tải danh mục tiêu chuẩn dược điển từ Firebase RTDB
 */
export const fetchPharmacopoeiaStandards = async (): Promise<PharmacopoeiaStandard[]> => {
  try {
    const snapshot = await get(ref(db, 'pharmacopoeia_standards'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list: PharmacopoeiaStandard[] = Object.keys(data).map(key => ({
        ...data[key],
        id: key,
        keywords: Array.isArray(data[key].keywords) ? data[key].keywords : []
      }));
      inMemoryStandards = list;
      isLoadedFromRTDB = true;
      return list;
    } else {
      // Nếu node rỗng, nạp sẵn bộ mặc định
      await seedDefaultPharmacopoeiaStandards();
      return inMemoryStandards;
    }
  } catch (error) {
    console.warn('[Pharmacopoeia] Lỗi tải từ RTDB, sử dụng fallback cục bộ:', error);
    return inMemoryStandards;
  }
};

export const getPharmacopoeiaStandards = fetchPharmacopoeiaStandards;

/**
 * Nạp bộ dữ liệu mặc định lên RTDB
 */
export const seedDefaultPharmacopoeiaStandards = async (): Promise<void> => {
  try {
    const updatePayload: Record<string, any> = {};
    const now = new Date().toISOString();
    DEFAULT_PHARMACOPOEIA_DB.forEach(item => {
      updatePayload[`pharmacopoeia_standards/${item.id}`] = {
        ...item,
        updatedAt: now,
        updatedBy: 'SYSTEM_SEED'
      };
    });
    await update(ref(db), updatePayload);
    inMemoryStandards = [...DEFAULT_PHARMACOPOEIA_DB];
    isLoadedFromRTDB = true;
  } catch (error) {
    console.error('[Pharmacopoeia] Lỗi nạp dữ liệu mẫu lên RTDB:', error);
    throw error;
  }
};

export const seedPharmacopoeiaStandards = seedDefaultPharmacopoeiaStandards;

/**
 * Thêm mới hoặc cập nhật một tiêu chuẩn
 */
export const savePharmacopoeiaStandard = async (
  standard: Omit<PharmacopoeiaStandard, 'id'> & { id?: string },
  userEmail?: string
): Promise<PharmacopoeiaStandard> => {
  const id = standard.id || `pharma-std-${Date.now()}`;
  const now = new Date().toISOString();
  const payload: PharmacopoeiaStandard = {
    ...standard,
    id,
    updatedAt: now,
    updatedBy: userEmail || 'QA_ADMIN'
  };

  await set(ref(db, `pharmacopoeia_standards/${id}`), payload);

  // Cập nhật in-memory cache
  const idx = inMemoryStandards.findIndex(s => s.id === id);
  if (idx >= 0) {
    inMemoryStandards[idx] = payload;
  } else {
    inMemoryStandards.push(payload);
  }

  return payload;
};

/**
 * Xóa một tiêu chuẩn khỏi RTDB
 */
export const deletePharmacopoeiaStandard = async (id: string): Promise<void> => {
  await remove(ref(db, `pharmacopoeia_standards/${id}`));
  inMemoryStandards = inMemoryStandards.filter(s => s.id !== id);
};

/**
 * Tra cứu tiêu chuẩn dược điển phù hợp nhất với câu truy vấn
 */
export const lookupPharmacopoeiaDynamic = async (query: string): Promise<any> => {
  // Nếu chưa nạp từ RTDB, cố gắng fetch 1 lần
  if (!isLoadedFromRTDB) {
    try {
      await fetchPharmacopoeiaStandards();
    } catch {
      // Bỏ qua lỗi, dùng inMemory
    }
  }

  const standards = inMemoryStandards.length > 0 ? inMemoryStandards : DEFAULT_PHARMACOPOEIA_DB;

  const scored = standards.map(entry => ({
    entry,
    score: calcRelevanceScore(query, entry)
  })).filter(s => s.score >= 5)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      query,
      found: false,
      message: `Chưa có dữ liệu chính xác cho **"${query}"** trong cơ sở kiến thức dược điển (${standards.length} tiêu chuẩn đã lập chỉ mục).\n\n**Gợi ý:** Vui lòng kiểm tra trực tiếp tại:\n- Dược điển Việt Nam V (DĐVN V)\n- USP Online: https://www.uspnf.com\n- British Pharmacopoeia (BP)\n- Hoặc chuyên luận kỹ thuật của sản phẩm`
    };
  }

  const best = scored[0].entry;
  const related = scored.slice(1, 3).map(s => s.entry.keywords[0]);

  return {
    query,
    found: true,
    title: best.title,
    category: best.category,
    source: best.source,
    content: best.standard,
    relatedTopics: related.length > 0 ? related : undefined,
    note: `Thông tin tham khảo từ Cơ sở Dược điển động PQM. Luôn xác minh với phiên bản dược điển mới nhất và TCCS của sản phẩm cụ thể.`
  };
};
