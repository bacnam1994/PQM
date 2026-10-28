/**
 * Đánh giá rủi ro chất lượng (FMEA / RPN) theo hướng dẫn ICH Q9
 */
export const assessQualityRisk = async (
  processStep: string,
  potentialFailure: string,
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
) => {
  if (!generateText) {
    return {
      processStep,
      potentialFailure,
      riskScores: { severity: 5, occurrence: 3, detection: 3, rpn: 45 },
      riskLevel: "MEDIUM 🟡",
      mitigationStrategy: "Cần cấu hình API để gọi đánh giá rủi ro động."
    };
  }

  const systemPrompt = `Bạn là chuyên gia Quản lý rủi ro chất lượng (QRM) theo hướng dẫn ICH Q9 trong sản xuất dược phẩm đạt chuẩn GMP.
Nhiệm vụ: Đánh giá rủi ro chất lượng (FMEA) cho một bước quy trình sản xuất và lỗi tiềm ẩn đi kèm.
Hãy cho điểm từ 1-10 cho:
- Severity (S: Mức độ nghiêm trọng)
- Occurrence (O: Tần suất xuất hiện)
- Detection (D: Khả năng phát hiện nhờ IPC/kiểm soát)
Tính điểm RPN = S * O * D.
Xác định mức độ rủi ro (Risk Level): HIGH (nếu RPN >= 100), MEDIUM (nếu RPN từ 50-99), LOW (nếu RPN < 50).
Trả về một đối tượng JSON có cấu trúc chính xác như sau:
{
  "processStep": "tên bước quy trình",
  "potentialFailure": "tên lỗi tiềm ẩn",
  "riskScores": {
    "severity": số S từ 1-10,
    "occurrence": số O từ 1-10,
    "detection": số D từ 1-10,
    "rpn": điểm RPN (S * O * D)
  },
  "riskLevel": "Ví dụ: 'HIGH 🔴', 'MEDIUM 🟡', 'LOW 🟢'",
  "mitigationStrategy": "Đề xuất biện pháp kiểm soát và giảm thiểu rủi ro (ví dụ: in-process control, kiểm tra bổ sung, đào tạo...)"
}
Lưu ý: Chỉ trả về chuỗi JSON thô, không định dạng markdown (không sử dụng \`\`\`json).`;

  const prompt = `Đánh giá rủi ro cho bước quy trình: "${processStep}" với lỗi tiềm ẩn có thể xảy ra: "${potentialFailure}".`;

  try {
    const responseText = await generateText(prompt, systemPrompt);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("FMEA AI Error:", error);
    return {
      processStep,
      potentialFailure,
      riskScores: { severity: 5, occurrence: 5, detection: 5, rpn: 125 },
      riskLevel: "UNKNOWN",
      mitigationStrategy: "Lỗi kết nối AI khi đánh giá rủi ro. Vui lòng thử lại sau."
    };
  }
};
