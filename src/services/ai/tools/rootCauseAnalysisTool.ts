/**
 * Phân tích nguyên nhân gốc rễ (RCA) theo phương pháp 5-Why và Fishbone (Ishikawa)
 */
export const performRootCauseAnalysis = async (
  issueDescription: string,
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
) => {
  if (!generateText) {
    return {
      methodology: "5-Why & Fishbone (Ishikawa)",
      issue: issueDescription,
      steps: [
        { why: `Tại sao xảy ra: "${issueDescription}"?`, answer: "Cần cấu hình API để gọi phân tích RCA động từ AI." }
      ],
      recommendation: "Vui lòng cấu hình VITE_GEMINI_API_KEY để phân tích."
    };
  }

  const systemPrompt = `Bạn là chuyên gia quản lý và kiểm soát chất lượng (QA/QC) chuyên nghiệp trong nhà máy dược phẩm đạt chuẩn GMP.
Nhiệm vụ: Phân tích nguyên nhân gốc rễ (RCA) cho sai lệch chất lượng bằng phương pháp 5-Why và Sơ đồ xương cá (Fishbone - Ishikawa).
Trả về một đối tượng JSON có cấu trúc chính xác như sau:
{
  "methodology": "5-Why & Fishbone (Ishikawa)",
  "issue": "mô tả lỗi hoặc sự cố chất lượng",
  "steps": [
    {"why": "Câu hỏi Why 1?", "answer": "Giải thích Why 1"},
    {"why": "Câu hỏi Why 2?", "answer": "Giải thích Why 2"},
    {"why": "Câu hỏi Why 3?", "answer": "Giải thích Why 3"},
    {"why": "Câu hỏi Why 4?", "answer": "Giải thích Why 4"},
    {"why": "Câu hỏi Why 5?", "answer": "Giải thích Why 5"}
  ],
  "fishboneCategories": {
    "Manpower": "Phân tích yếu tố con người (thao tác, đào tạo, SOP...)",
    "Machine": "Phân tích yếu tố máy móc (thiết bị, hiệu chuẩn, bảo dưỡng...)",
    "Method": "Phân tích yếu tố quy trình (công thức, IPC, SOP...)",
    "Material": "Phân tích yếu tố nguyên vật liệu (chất lượng, nhà cung cấp, CoA...)",
    "Environment": "Phân tích yếu tố môi trường (nhiệt độ, độ ẩm, áp suất, độ sạch...)"
  },
  "recommendation": "Đề xuất hành động khắc phục và phòng ngừa (CAPA) cụ thể, thực tế"
}
Lưu ý: Chỉ trả về chuỗi JSON thô, không định dạng markdown (không sử dụng \`\`\`json).`;

  const productsContext = (appContext.products || []).slice(0, 10).map((p: any) => ({ name: p.name, code: p.code }));
  const prompt = `Yêu cầu phân tích sự cố: "${issueDescription}".
Thông tin một số sản phẩm trong hệ thống: ${JSON.stringify(productsContext)}.
Hãy kết hợp bối cảnh GMP và kiến thức chuyên ngành để đưa ra phân tích phù hợp nhất.`;

  try {
    const responseText = await generateText(prompt, systemPrompt);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("RCA AI Error:", error);
    return {
      methodology: "5-Why & Fishbone (Ishikawa) - Fallback do lỗi kết nối AI",
      issue: issueDescription,
      error: error.message,
      recommendation: "Vui lòng kiểm tra lại kết nối mạng hoặc API Key của bạn."
    };
  }
};
