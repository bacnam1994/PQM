/**
 * Từ điển viết tắt và thuật ngữ phổ biến trong phiếu kiểm nghiệm dược phẩm.
 * Dùng để bổ sung vào prompt giúp AI nhận diện chính xác hơn.
 */
const ABBREVIATION_GUIDE = `
BẢNG QUY ƯỚC VÀ VIẾT TẮT PHỔ BIẾN (Áp dụng khi phân tích phiếu):

─── L Ý HÓA & ĐỊNH LƯỢNG ───
- LOD / Loss on Drying / Moisture Content / Water Content / Hàm lượng nước → Chỉ tiêu về độ ẩm
- KF / Karl Fischer / Water Determination → Xác định nước bằng phương pháp Karl Fischer
- NMT (Not More Than) = Không được vượt quá (≤)
- NLT (Not Less Than) = Không được thấp hơn (≥)
- BP = British Pharmacopoeia | USP = US Pharmacopoeia | DĐVN = Dược điển Việt Nam | EP = European Pharmacopoeia | JP = Japanese Pharmacopoeia
- Assay / Content / Định lượng / Hàm lượng / Purity / Potency / Label claim / Drug content → Chỉ tiêu định lượng hoạt chất
- RS / Related Substances / Related Compounds / Tạp chất liên quan / Organic Impurities → Tạp chất liên quan
- pH / Hydrogen ion concentration → Độ pH
- Clarity / Appearance / Description / Màu sắc / Hình thức / Organoleptic / Cảm quan / Colour / Color / Odour → Chỉ tiêu cảm quan
- Disintegration / Thời gian tan rã / Dissolution time / Rã → Chỉ tiêu thời gian rã
- Dissolution / Thử hòa tan / Độ hòa tan / Drug Release / In-vitro dissolution → Chỉ tiêu hòa tan
- Optical rotation / [α] / Specific rotation / Góc quay cực → Chỉ tiêu góc quay cực
- Melting point / MP / Melting range / Điểm chảy → Chỉ tiêu điểm chảy
- Particle size / D50 / D90 / PSD / Cỡ hạt / Kích thước hạt → Phân tích cỡ hạt
- Viscosity / Brookfield / Kinematic viscosity / Độ nhớt → Chỉ tiêu độ nhớt
- Specific gravity / Relative density / Tỷ trọng → Chỉ tiêu tỷ trọng
- Bulk density / Tapped density / Khối lượng biểu kiến → Tỷ trọng biểu kiến
- Osmolality / Osmolarity / Độ thẩm thấu → Chỉ tiêu độ thẩm thấu
- Residue on ignition / Tro sulfat / Sulfated ash / Sulphated ash / Tro toàn phần → Chỉ tiêu tro
- Acid value / Acid number / Chỉ số acid → Chỉ số acid
- Iodine value / Iodine number / Chỉ số iod → Chỉ số iod
- Absorbance / OD / Optical density / A(1%,1cm) / E(1%,1cm) → Độ hấp thụ quang
- Turbidity / Opalescence / Clarity of solution → Độ trong/Độ đục
- Uniformity of mass / Weight variation / Mass variation / UoM / Đồng đều khối lượng → Độ đồng đều khối lượng
- Hardness / Crushing strength / Tensile strength / Độ cứng → Chỉ tiêu độ cứng viên
- Friability / Độ mài mòn / Attrition → Chỉ tiêu độ mài mòn viên
- w/w = theo khối lượng | v/v = theo thể tích | w/v = khối lượng/thể tích

─── PHƯƠNG PHÁP PHÂN TÍCH ───
- HPLC = High Performance Liquid Chromatography (Sắc ký lỏng hiệu năng cao)
- GC = Gas Chromatography / GLC (Sắc ký khí)
- UV-Vis = UV Spectrophotometry (Quang phổ UV-Vis)
- ICP-MS / ICP-OES / AAS = Phương pháp xác định kim loại nặng
- TLC = Thin Layer Chromatography (Sắc ký lớp mỏng)
- LOQ = Limit of Quantification (Giới hạn định lượng)
- LOD = Limit of Detection (Giới hạn phát hiện) ≠ LOD viết tắt của Loss on Drying
  → Phân biệt bằng ngữ cảnh: nếu là "LOD (%)" và đi kèm với giới hạn % → là Độ ẩm
  → Nếu là "<LOD" trong cột kết quả vi sinh/kim loại → là Dưới giới hạn phát hiện

─── VI SINH VẬT ───
- TAMC / Total Aerobic Microbial Count / TVKHK / Tổng số vi khuẩn hiếu khí / TPC / APC / TVC → Vi sinh vật hiếu khí
- TYMC / Total Yeast & Mold Count / Yeast & Mould / Nấm mốc-nấm men / TSNM / Fungal count → Tổng số nấm mốc và nấm men
- E.coli / Coliforms / Faecal coliforms → Vi khuẩn đường ruột
- Pseudomonas / Salmonella / Staphylococcus / S.aureus / Candida albicans / Clostridium → Vi khuẩn đặc hiệu
- CFU = cfu = KL (Khuẩn lạc) — đơn vị đếm vi sinh vật

─── KIM LOẠI NẶNG ───
- Heavy metals / Kim loại nặng / KLN → Chỉ tiêu tổng kim loại nặng
- As = Arsenic / Asen | Pb = Lead / Chì | Hg = Mercury / Thủy ngân | Cd = Cadmium / Cadmi
- Cu = Copper / Đồng | Cr = Chromium / Krom | Ni = Nickel / Niken

─── ĐƠN VỊ ĐO LƯỜNG ───
- ppm = mg/kg = µg/g = mcg/g (phần triệu theo khối lượng)
- ppb = µg/kg = mcg/kg (phần tỷ)
- % = g/100g = g/100mL (tùy ngữ cảnh)
- CFU/g = cfu/g = CFU/mL = KL/g (cùng đơn vị, chỉ khác cách viết hoa/thường)
- mg = milligam | µg = mcg = microgram | ng = nanogram

BẢNG QUY TẮC KẾT QUẢ ĐỊNH TÍNH (Qualitative results):
- "Âm tính" / "Negative" / "Absent" / "Not detected" / "ND" / "Không phát hiện" / "<LOD" / "<LOQ" → Không phát hiện
- "Dương tính" / "Positive" / "Detected" / "Phát hiện" → Phát hiện được
- "Đạt" / "Pass" / "Conform" / "Complies" / "Conforms" / "Satisfactory" / "Yes" → KẾT QUẢ ĐẠT (giữ nguyên chuỗi)
- "Không đạt" / "Fail" / "Non-conform" / "Does not comply" / "Unsatisfactory" / "No" → KẾT QUẢ KHÔNG ĐẠT (giữ nguyên chuỗi)
- "Miễn kiểm" / "Not tested" / "NT" / "N/A" / "Exempted" → Miễn kiểm (giữ nguyên)

QUY TẮC CHUẨN HÓA SỐ:
- Dấu phẩy thập phân kiểu Châu Âu (1,5 hoặc 1,50) → chuyển thành 1.5 trong field "value"
- Ký hiệu ×10³ hoặc 10^3 hoặc E3 → giữ nguyên dạng chuỗi, KHÔNG chuyển đổi
- Kết quả dạng "< 10" hoặc "≤ 0.5%" hoặc "90 - 110%" → giữ nguyên dạng chuỗi (bao gồm cả ký hiệu so sánh và khoảng)
- Kết quả "Đạt" / "Conform" / "Complies" / "Pass" → giữ nguyên, KHÔNG dịch
- Kết quả "Không đạt" / "Fail" / "Non-Conform" → giữ nguyên
- Kết quả "ND" / "Âm tính" / "Negative" / "Không phát hiện" → giữ nguyên dạng chuỗi gốc
`;

/**
 * Hướng dẫn phân tích cấu trúc bảng phức tạp trong phiếu kiểm nghiệm.
 */
const TABLE_PARSING_GUIDE = `
HƯỚNG DẪN ĐỌC BẢNG KẾT QUẢ KIỂM NGHIỆM:

1. Cấu trúc bảng ngang phổ biến nhất (CoA):
   [Cột 1: STT] | [Cột 2: Tên chỉ tiêu] | [Cột 3: Yêu cầu/Giới hạn] | [Cột 4: Kết quả] | [Cột 5: Đơn vị] | [Cột 6: Đánh giá]
   field "criteriaName" = Cột 2, "limit" = Cột 3, "value" = Cột 4, "unit" = Cột 5

2. Cấu trúc bảng đơn giản (Phiếu nội bộ):
   [Cột 1: Tên chỉ tiêu] | [Cột 2: Giới hạn] | [Cột 3: Kết quả]
   field "criteriaName" = Cột 1, "limit" = Cột 2, "value" = Cột 3

3. Cấu trúc bảng dọc (Chỉ tiêu ở hàng):
   [Hàng 1: "Chỉ tiêu" | Hàng 2: "Phương pháp" | Hàng 3: "Kết quả" | Hàng 4: "Đạt/KĐ"]
   Đọc theo cột, mỗi cột là một chỉ tiêu riêng biệt

4. Xử lý ô ghép (Merged cells):
   - Nếu tên chỉ tiêu ở hàng này trống, tên thuộc về nhóm phía trên (ô gộp)
   - Nếu cột "Kết quả" trống, kết quả thuộc về dòng có tên chỉ tiêu gần nhất phía trên
   - Ví dụ: "Giới hạn vi sinh vật" (hàng gộp) có sub-hàng: "TVKHK: 1.0E3", "Nấm mốc: 1.0E2"

5. Chỉ tiêu có sub-chỉ tiêu (nhóm):
   - "Giới hạn vi sinh vật" tạo từng object RIÊNG cho: TVKHK, Nấm mốc, E. coli, Salmonella...
   - "Kim loại nặng" tạo từng object RIÊNG cho: As, Pb, Hg, Cd...
   - "Tạp chất liên quan" tạo từng object RIÊNG cho: Tạp chất A, B, Tạp chất tổng...

6. Đơn vị ở header cột:
   - Nếu cột có header "Kết quả (%)": đơn vị "%" áp dụng cho TẤT CẢ giá trị trong cột đó
   - Nếu cột có header "Hàm lượng (mg/viên)": đơn vị là "mg/viên"

7. Chú thích và ghi chú:
   - Các ký hiệu (*), (**), (1), (a) cuối tên chỉ tiêu bỏ qua, chỉ lấy tên
   - Dòng "Ghi chú:" hoặc "Note:" hoặc "Remarks:" KHÔNG trích xuất thành chỉ tiêu nhưng nên ghi vào field "notes" của document
   - Dòng tiêu đề bảng ("BẢNG KẾT QUẢ", "TABLE OF RESULTS") KHÔNG trích xuất
   - Hàng tóm tắt "KẾT LUẬN: ĐẠT" KHÔNG trích xuất thành chỉ tiêu riêng

8. Phiếu có nhiều bảng (Lý hóa + Vi sinh + Kim loại nặng):
   Trích xuất TẤT CẢ các bảng, không bỏ sót.
   Mỗi bảng có thể có cấu trúc khác nhau, phân tích từng bảng độc lập.
`;

/**
 * Hướng dẫn xử lý chữ viết tay và ký tự bị mờ/nhòe.
 */
const HANDWRITING_GUIDE = `
XỬ LÝ CHỮ VIẾT TAY VÀ KÝ TỰ MỜ:

1. Chữ viết tay trong cột "Kết quả":
   - Đọc cẩn thận từng chữ số, đặc biệt phân biệt: 1 vs l vs 7, 0 vs O vs 6 vs 8, 5 vs S, 3 vs 8
   - Nếu chữ số không rõ ràng nhưng vẫn đọc được nghĩa → ghi giá trị đọc được, KHÔNG để trống
   - Nếu tuyệt đối không thể đọc → ghi "?" để báo hiệu cần xem lại thủ công

2. Chữ số dạng gạch chân, gạch ngang trong phiếu Việt Nam:
   - Số viết tay thường có dấu gạch ngang (ví dụ: 7̶ để phân biệt với 1) → đọc là 7
   - Dấu phẩy thập phân kiểu Châu Âu (1,5) → chuyển thành 1.5

3. Ký tự đặc biệt bị nhòe:
   - "≤" bị nhòe có thể trông như "<" hoặc "⊆" → luôn hiểu là "≤" trong ngữ cảnh giới hạn
   - "≥" tương tự → luôn hiểu là "≥"
   - "%" bị nhòe → dùng ngữ cảnh xung quanh để xác định đơn vị

4. Giá trị bị ghi đè hoặc sửa:
   - Nếu thấy ký tự bị gạch đi và viết đè → đọc giá trị mới (bên trên hoặc cạnh)
   - Ghi chú trong field "notes" nếu phát hiện có giá trị bị sửa: "Phát hiện giá trị bị sửa tay tại chỉ tiêu [tên]"
`;

/**
 * Hướng dẫn xử lý phiếu có nhiều cột song song (đa cột).
 */
const MULTI_COLUMN_GUIDE = `
XỬ LÝ PHIẾU ĐA CỘT VÀ BỐ CỤC PHỨC TẠP:

1. Phiếu 2 cột song song (2 bộ chỉ tiêu trên cùng trang):
   - Xác định ranh giới phân cột bằng đường kẻ dọc hoặc khoảng trắng lớn ở giữa trang
   - Đọc CỘT TRÁI hoàn toàn trước, sau đó đọc CỘT PHẢI
   - KHÔNG lẫn dữ liệu giữa hai cột

2. Phiếu có phần Header thông tin + Phần bảng:
   - Header (tên sản phẩm, số lô, ngày...) thường ở phần trên cùng hoặc trong khung riêng
   - Phần bảng chỉ tiêu bên dưới hoặc trong khung riêng
   - Trích xuất header vào các field: labName, batchNo, mfgDate, expDate, testDate

3. Phiếu nhiều trang (multi-page PDF):
   - Tiếp tục đọc TẤT CẢ các trang, gộp chỉ tiêu vào một danh sách duy nhất
   - Trang 1 thường là header + chỉ tiêu lý hóa; Trang 2+ thường là vi sinh, kim loại nặng
   - Ghi số trang thực tế vào field "pageCount"

4. Phiếu dạng form điền tay (template có sẵn, điền vào chỗ trống):
   - Tên chỉ tiêu đã in sẵn, kết quả được viết vào ô trống
   - Đọc từng ô trống theo thứ tự, ghép với tên chỉ tiêu tương ứng bên cạnh
   - Ô trống bỏ trống → bỏ qua chỉ tiêu đó (không tạo record)

5. Format phòng lab phổ biến tại Việt Nam:
   - **Quatest 3 (TP.HCM)**: Header có "Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3", bảng kết quả theo chuẩn TCVN, có ký hiệu phiếu dạng "KN-YYYY-XXXXXX"
   - **CASE (Hà Nội)**: Header có "Trung tâm Phân tích và Kiểm nghiệm Thực phẩm Quốc gia" hoặc "CASE", số phiếu dạng "CASE-YYYY/XXX"
   - **Eurofins (Sắc Ký Hà Nội)**: Header tiếng Anh, cột "Specification" = Giới hạn, "Result" = Kết quả, "Conclusion" = Đạt/KĐ
   - **Phòng QC nội bộ**: Thường có tem/logo công ty, cột đơn giản, chữ viết tay kết quả
   - **Vimedimex / VQC**: Phiếu kiểm nghiệm dược phẩm chuẩn GMP, có số hiệu TCCS rõ ràng
`;

/**
 * Hướng dẫn xử lý watermark, con dấu và nội dung nhiễu.
 */
const WATERMARK_STAMP_GUIDE = `
XỬ LÝ WATERMARK, CON DẤU VÀ NỘI DUNG NHIỄU:

1. Watermark chéo trên tài liệu:
   - "DRAFT" / "BẢN NHÁP" / "KHÔNG CHÍNH THỨC" → BỎ QUA watermark, đọc nội dung bên dưới
   - "CONFIDENTIAL" / "BẢO MẬT" → BỎ QUA, vẫn trích xuất dữ liệu kiểm nghiệm
   - "SAMPLE" / "MẪU" → BỎ QUA, vẫn đọc bình thường

2. Con dấu tròn / chữ ký:
   - Con dấu tròn "ĐÃ KIỂM TRA", "ĐÃ DUYỆT", "APPROVED" → KHÔNG trích xuất thành chỉ tiêu
   - Chữ ký tay → KHÔNG đọc, bỏ qua
   - Dấu "PASSED" hoặc "FAILED" đóng lên bảng kết quả → bỏ qua (không ảnh hưởng đến việc đọc giá trị từng chỉ tiêu)

3. Nội dung nhiễu khác:
   - Số trang "Trang 1/3" → bỏ qua, nhưng dùng để xác định "pageCount"
   - Footer "In lúc: DD/MM/YYYY" hoặc "Printed on" → bỏ qua (không phải testDate)
   - Mã vạch / QR code → bỏ qua
   - Logo công ty, hình ảnh sản phẩm → bỏ qua
   - Header lặp lại ở trang 2, 3... → bỏ qua (chỉ đọc 1 lần)

4. Ảnh chất lượng thấp / chụp nghiêng:
   - Cố gắng đọc dù ảnh nghiêng ≤ 15 độ
   - Nếu phần bảng bị khuất / bị bóng → đọc phần thấy được, bỏ qua phần không rõ
   - Nếu ảnh quá mờ (< 50% ký tự đọc được) → trả về mảng testResults rỗng và ghi notes: "Ảnh chất lượng thấp, không thể đọc đáng tin cậy"
`;

/**
 * Tên loại phiếu và viết tắt phổ biến trong ngành kiểm nghiệm VN.
 */
const VN_LAB_TERMINOLOGY = `
THUẬT NGỮ VÀ TÊN PHIẾU KIỂM NGHIỆM VIỆT NAM:

Tên phiếu thường gặp (KHÔNG trích xuất làm chỉ tiêu):
- PHIẾU KIỂM NGHIỆM / PHIẾU KẾT QUẢ KIỂM NGHIỆM (PKQKN)
- PHIẾU KIỂM NGHIỆM THÀNH PHẨM (PKNTF)
- PHIẾU PHÂN TÍCH / PHIẾU PHÂN TÍCH THÀNH PHẨM
- CERTIFICATE OF ANALYSIS (CoA) / CERTIFICATE OF CONFORMANCE (CoC)
- BIÊN BẢN KIỂM NGHIỆM / KẾT QUẢ THỬ NGHIỆM
- TTKT = Thử nghiệm kết thúc | PKN = Phiếu kiểm nghiệm
- HSKN = Hồ sơ kiểm nghiệm | KQKN = Kết quả kiểm nghiệm

Tên đơn vị kiểm nghiệm → điền vào field "labName":
- Quatest 1 / Quatest 3 → "Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3"
- CASE → "Trung tâm Phân tích và Kiểm nghiệm Thực phẩm Quốc gia (CASE)"
- Eurofins → "Eurofins Sắc Ký Hà Nội" hoặc "Eurofins Vietnam"
- Sắc Ký Hà Nội → "Công ty TNHH Sắc Ký Hà Nội"
- Vimedimex → "Vimedimex"
- Nếu có "Phòng QC" hoặc "Phòng kiểm nghiệm nội bộ" → điền theo tên công ty trên phiếu

Phân loại phiếu → điền vào field "documentType":
- Phiếu từ cơ quan kiểm nghiệm bên ngoài (Quatest, CASE, Eurofins...) → "External_Lab"
- Phiếu kiểm nghiệm nội bộ của nhà máy/phòng QC → "Internal"
- CoA từ nhà sản xuất nguyên liệu/thành phẩm → "CoA"
- Phiếu phân tích từ nhà cung cấp → "Supplier_CoA"
`;

/**
 * Tạo prompt động cho việc trích xuất dữ liệu từ Phiếu Kiểm Nghiệm.
 * Nếu có danh sách tên chỉ tiêu chuẩn từ TCCS, AI sẽ cố gắng map thẳng về tên chuẩn.
 * @param tccsNames Danh sách tên chỉ tiêu chuẩn từ TCCS hiệu lực (tùy chọn)
 */
export const buildExtractionPrompt = (tccsNames: string[] = []): string => {
  const hasTccsContext = tccsNames.length > 0;

  const tccsSection = hasTccsContext
    ? `
DANH SÁCH TÊN CHỈ TIÊU CHUẨN TRONG HỆ THỐNG (TCCS):
${tccsNames.map((n, i) => `  ${i + 1}. "${n}"`).join('\n')}

NHIỆM VỤ MAP TÊN & SUY LUẬN SẮC BÉN:
- Với mỗi chỉ tiêu đọc được từ phiếu, hãy thực hiện suy luận ngữ nghĩa và đối chiếu viết tắt, từ đồng nghĩa tiếng Anh/Việt để tìm tên tương ứng TRONG DANH SÁCH TCCS trên.
- Áp dụng BẢNG QUY ƯỚC VÀ VIẾT TẮT để nhận diện thuật ngữ tương đương.
- QUY TẮC NGUYÊN TỐ & DẠNG MUỐI (Elemental vs Salt form):
  * Nếu Phiếu ghi dạng nguyên tố (ví dụ: "Kẽm (Zn)", "Hàm lượng Kẽm", "Zinc") nhưng TCCS ghi dạng "Kẽm (Kẽm gluconat)" hoặc "Kẽm gluconat (tính theo Kẽm)" -> Map ngay về chỉ tiêu đó trong TCCS (confidence = "high").
  * Tương tự với Sắt (Sắt fumarat/Sắt sulfat), Canxi (Canxi carbonat/Canxi glucoheptonat), Magie (Magnesi lactat/Magnesi oxyd), Đồng, Mangan, Selen...
- Quy trình suy luận logic (Self-Reasoning):
  * Xác định bản chất chỉ tiêu (Ví dụ: LOD = Loss on Drying = Hàm lượng nước bốc hơi -> tương đương "Độ ẩm").
  * Đối chiếu phương pháp thử nếu có (Ví dụ: Assay by HPLC -> tương đương chỉ tiêu định lượng của hoạt chất chính tương ứng).
  * So sánh với danh sách TCCS để tìm từ khóa gần nhất (Ví dụ: RS hoặc Related substances -> tương đương "Tạp chất liên quan").
- Nếu tìm được tên khớp thông qua suy luận hợp lý, điền vào field "mappedName" đúng tên TCCS chuẩn và "confidence" = "high".
- Nếu KHÔNG tìm được tên khớp hoặc không chắc chắn, để "mappedName" = "" và "confidence" = "low".

VÍ DỤ MAPPING (Cụ thể & Đầy đủ):
- Phiếu ghi "Kẽm (Zn)" hoặc "Hàm lượng Kẽm" → mappedName = "Kẽm (Kẽm gluconat)" (nếu TCCS có tên này), confidence = "high"
- Phiếu ghi "Sắt (Fe)" hoặc "Iron content" → mappedName = "Sắt (Sắt fumarat)", confidence = "high"
- Phiếu ghi "Canxi (Ca)" hoặc "Calcium" → mappedName = "Canxi (Canxi carbonat)", confidence = "high"
- Phiếu ghi "Magnesi (Mg)" hoặc "Magnesium" → mappedName = "Magnesi (Magnesi lactat)", confidence = "high"
- Phiếu ghi "Moisture content (%)" hoặc "LOD (%)" hoặc "Loss on Drying" → mappedName = "Độ ẩm", confidence = "high"
- Phiếu ghi "As (Asen)" hoặc "Arsenic" → mappedName = "Asen", confidence = "high"
- Phiếu ghi "Assay (by HPLC)" hoặc "Assay by GC" → mappedName = tên chỉ tiêu định lượng phù hợp trong TCCS, confidence = "high"
- Phiếu ghi "Related substances (RS)" → mappedName = "Tạp chất liên quan", confidence = "high"
- Phiếu ghi "TAMC" hoặc "TPC (Total Plate Count)" → mappedName = "Tổng số vi khuẩn hiếu khí", confidence = "high"
- Phiếu ghi "TYMC" hoặc "Yeast & Mould" → mappedName = "Tổng số nấm mốc và nấm men", confidence = "high"
- Phiếu ghi "Dissolution (Q, 45 min)" → mappedName = "Độ hòa tan", confidence = "high"
- Phiếu ghi "XYZ Specific test" mà không có trong TCCS → mappedName = "", confidence = "low"
`
    : `
LƯU Ý: Không có danh sách TCCS. Hãy trích xuất tên chỉ tiêu nguyên bản từ phiếu, để "mappedName" = "" và "confidence" = "low" cho tất cả.
`;

  return `Bạn là một chuyên gia phân tích tài liệu kiểm nghiệm dược phẩm, được giao nhiệm vụ đọc và trích xuất thông tin từ Phiếu Kiểm Nghiệm (Certificate of Analysis - CoA / Phiếu Kết Quả Kiểm Nghiệm) để điền vào Form Nhập Kết Quả.

CẤU TRÚC JSON YÊU CẦU (Trả về đúng định dạng này, bao gồm đầy đủ các field mới):
{
  "labName": "Tên đơn vị kiểm nghiệm / Phòng thí nghiệm (ví dụ: CASE, Quatest 3, Eurofins, Phòng QC nội bộ...)",
  "documentType": "Loại phiếu: External_Lab | Internal | CoA | Supplier_CoA (xem hướng dẫn VN_LAB_TERMINOLOGY)",
  "pageCount": 1,
  "batchNo": "Số lô sản xuất (nếu có, không có thì để rỗng)",
  "mfgDate": "Ngày sản xuất (định dạng DD/MM/YYYY, nếu không có để rỗng)",
  "expDate": "Hạn sử dụng (định dạng DD/MM/YYYY, nếu không có để rỗng)",
  "testDate": "Ngày kiểm nghiệm / Ngày xuất phiếu (định dạng DD/MM/YYYY, nếu không có để rỗng)",
  "notes": "Ghi chú đặc biệt từ phiếu (ghi chú cuối bảng, phát hiện giá trị sửa tay, ảnh chất lượng thấp...); để rỗng nếu không có",
  "testResults": [
    {
      "criteriaName": "Tên chỉ tiêu NGUYÊN BẢN từ phiếu (giữ nguyên, không dịch, không thêm bớt)",
      "mappedName": "Tên chỉ tiêu chuẩn trong TCCS nếu map được, để rỗng nếu không chắc",
      "confidence": "high hoặc low — mức độ tự tin khi map tên",
      "value": "Kết quả kiểm nghiệm (ví dụ: 1.5, Đạt, Trắng trong, < 10). Trả về dưới dạng chuỗi.",
      "unit": "Đơn vị tính (ví dụ: %, mg, CFU/g. Nếu không có để rỗng)",
      "limit": "Yêu cầu / Mức tiêu chuẩn / Giới hạn cho phép từ phiếu (nếu có, ví dụ: NMT 5.0%, 95.0-105.0%)",
      "analysisMethod": "Phương pháp thử nghiệm nếu ghi trên phiếu (ví dụ: HPLC, UV-Vis, AAS, TCVN 9632:2013...); để rỗng nếu không có"
    }
  ]
}

${ABBREVIATION_GUIDE}

${TABLE_PARSING_GUIDE}

${HANDWRITING_GUIDE}

${MULTI_COLUMN_GUIDE}

${WATERMARK_STAMP_GUIDE}

${VN_LAB_TERMINOLOGY}

${tccsSection}

LƯU Ý QUAN TRỌNG:
1. CHỈ trả về duy nhất chuỗi JSON hợp lệ. KHÔNG bọc trong markdown (không dùng \`\`\`json). KHÔNG thêm bất kỳ giải thích nào ngoài JSON.
2. Giữ nguyên các ký tự toán học hoặc ký tự đặc biệt trong kết quả và giới hạn (như <, >, ≤, ≥, ±, ×10³).
3. Nếu giá trị ngày tháng có định dạng khác (MM/DD/YYYY, YYYY-MM-DD...), hãy chuyển đổi về DD/MM/YYYY.
4. Ưu tiên tìm kiếm "Lab Name" ở phần đầu phiếu, con dấu, chữ ký, hoặc header của bảng.
5. Trích xuất TẤT CẢ các chỉ tiêu từ mọi bảng trong phiếu (lý hóa, vi sinh, kim loại nặng).
6. Nếu một chỉ tiêu có nhiều sub-chỉ tiêu (ví dụ: Giới hạn vi sinh gồm TVKHK, Nấm mốc...), hãy tạo từng object riêng cho mỗi sub-chỉ tiêu.
7. Khi "value" là kết quả định tính (Đạt/Pass/Không phát hiện...), KHÔNG điền số 0 hay giá trị giả — giữ nguyên chuỗi gốc.
8. Điền "pageCount" bằng số trang thực tế đã đọc được trong tài liệu.
9. Điền "documentType" dựa theo hướng dẫn VN_LAB_TERMINOLOGY ở trên.
10. Điền "analysisMethod" cho từng chỉ tiêu nếu phiếu ghi rõ phương pháp thử (cột "Phương pháp", "Method", "Test method").
`;
};

// Export tương thích ngược cho code cũ nếu cần
export const PKN_EXTRACTION_PROMPT = buildExtractionPrompt([]);
