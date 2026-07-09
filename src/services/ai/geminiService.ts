import { GoogleGenerativeAI, SchemaType, Content } from "@google/generative-ai";
import { GEMINI_TOOL_DECLARATIONS, executeTool } from './aiTools';

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || "";
};

const getGenAI = () => {
  const key = getApiKey();
  if (!key) {
    throw new Error("Vui lòng cấu hình VITE_GEMINI_API_KEY trong file .env hoặc settings");
  }
  return new GoogleGenerativeAI(key);
};

export const getGeminiModel = (): string => {
  return localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
};

export const getIsThinkingEnabled = (): boolean => {
  const saved = localStorage.getItem('GEMINI_THINKING_ENABLED');
  return saved !== 'false'; // Mặc định là true nếu chưa set
};

export const extractThinking = (text: string): { thinking?: string; cleanText: string } => {
  if (!text) return { cleanText: text };

  // Case 1: Thẻ <thinking>...</thinking> đầy đủ
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
  const match = text.match(thinkingRegex);
  if (match) {
    const thinking = match[1].trim();
    // Xóa tất cả các block thinking (có thể có nhiều block) và clean whitespace thừa
    const cleanText = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    return { thinking, cleanText };
  }

  // Case 2: Có thẻ mở <thinking> nhưng KHÔNG có thẻ đóng (bị cắt, stream)
  const openTagIdx = text.toLowerCase().indexOf('<thinking>');
  if (openTagIdx !== -1) {
    const cleanText = text.substring(0, openTagIdx).trim();
    const thinking = text.substring(openTagIdx + '<thinking>'.length).trim();
    // Bỏ thẻ đóng lẻ nếu có
    return { thinking: thinking.replace(/<\/thinking>/gi, '').trim(), cleanText };
  }

  // Case 3: Không có thinking
  // Vẫn clean bất kỳ thẻ </thinking> lẻ nào còn sót
  const cleanText = text.replace(/<\/thinking>/gi, '').trim();
  return { cleanText };
};


export const geminiService = {
  /**
   * Gọi API Gemini để phân tích file tài liệu (ảnh hoặc PDF)
   * @param file File tài liệu upload từ input
   * @param systemPrompt Lệnh hướng dẫn AI
   */
  extractDataFromDocument: async (file: File, systemPrompt: string) => {
    const genAI = getGenAI();

    // Chuyển đổi File sang định dạng Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Bỏ đi phần prefix (VD: "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Sử dụng model cấu hình (mặc định gemini-2.5-flash)
    const modelName = getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            // FIX 1: Thêm labName và testDate vào schema để Gemini trả về đúng
            labName: {
              type: SchemaType.STRING,
              description: "Tên đơn vị kiểm nghiệm / Phòng thí nghiệm (ví dụ: CASE, Quatest 3, Eurofins, Phòng QC nội bộ). Để rỗng nếu không tìm thấy.",
            },
            batchNo: {
              type: SchemaType.STRING,
              description: "Số lô sản xuất (nếu có, không có thì để rỗng)",
            },
            mfgDate: {
              type: SchemaType.STRING,
              description: "Ngày sản xuất (định dạng DD/MM/YYYY, nếu không có để rỗng)",
            },
            expDate: {
              type: SchemaType.STRING,
              description: "Hạn sử dụng (định dạng DD/MM/YYYY, nếu không có để rỗng)",
            },
            testDate: {
              type: SchemaType.STRING,
              description: "Ngày kiểm nghiệm / Ngày xuất phiếu kết quả (định dạng DD/MM/YYYY, nếu không có để rỗng)",
            },
            testResults: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  criteriaName: {
                    type: SchemaType.STRING,
                    description: "Tên chỉ tiêu NGUYÊN BẢN từ phiếu (giữ nguyên, không dịch)",
                  },
                  mappedName: {
                    type: SchemaType.STRING,
                    description: "Tên chỉ tiêu chuẩn trong TCCS nếu map được, để rỗng nếu không chắc",
                  },
                  confidence: {
                    type: SchemaType.STRING,
                    description: "'high' nếu map được tên TCCS chắc chắn, 'low' nếu không chắc hoặc không tìm được",
                  },
                  value: {
                    type: SchemaType.STRING,
                    description: "Kết quả kiểm nghiệm (ví dụ: 1.5, Đạt, Trắng trong). Trả về dưới dạng chuỗi.",
                  },
                  unit: {
                    type: SchemaType.STRING,
                    description: "Đơn vị tính (ví dụ: %, mg, CFU/g. Nếu không có để rỗng)",
                  },
                  limit: {
                    type: SchemaType.STRING,
                    description: "Yêu cầu / Mức tiêu chuẩn / Giới hạn cho phép (nếu có)",
                  },
                },
                required: ["criteriaName", "value", "mappedName", "confidence"],
              },
            },
          },
        },
      },
    });

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: file.type,
      },
    };

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Gửi request lên Gemini API
        const result = await model.generateContent([systemPrompt, filePart]);
        const response = result.response;
        const text = response.text();
        
        // Do đã dùng responseSchema và responseMimeType="application/json", text chắc chắn là JSON chuẩn
        return JSON.parse(text);
      } catch (error: any) {
        attempt++;
        const errorMessage = error?.message || '';
        
        // Chỉ retry với lỗi quá tải (503) hoặc rate limit (429)
        if ((errorMessage.includes('503') || errorMessage.includes('429')) && attempt < maxRetries) {
          console.warn(`Gemini API overloaded in OCR. Retrying attempt ${attempt}...`);
          await new Promise(res => setTimeout(res, 2000 * attempt));
          continue;
        }
        
        console.error("Error calling Gemini API:", error);
        throw error;
      }
    }
    // FIX 2: Sau vòng while, ném lỗi rõ ràng thay vì trả về undefined im lặng
    throw new Error("Gemini OCR: Đã vượt quá số lần thử lại tối đa mà không thành công.");
  },

  /**
   * Gọi API sinh văn bản đơn giản (không có tools) từ Gemini.
   * Dùng cho các tác vụ phân tích tự động như RCA, FMEA.
   * @param prompt Nội dung yêu cầu phân tích
   * @param systemPrompt Lệnh định hướng hệ thống
   */
  generateText: async (prompt: string, systemPrompt?: string, modelName?: string): Promise<string> => {
    const genAI = getGenAI();
    const activeModel = modelName || getGeminiModel();
    const model = genAI.getGenerativeModel({
      model: activeModel,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },

  /**
   * Tính năng Chat bằng Text với dữ liệu ngữ cảnh của toàn bộ ứng dụng hỗ trợ Multi-turn + Function Calling
   * @param message Tin nhắn câu hỏi của người dùng
   * @param appContextData Object chứa toàn bộ dữ liệu ứng dụng
   * @param history Lịch sử đoạn chat trước đó để hỗ trợ Multi-turn
   */
  chatWithAppContext: async (message: string, appContextData: any, history: Content[] = [], modelName?: string) => {
    const genAI = getGenAI();
    const activeModel = modelName || getGeminiModel();
    const isThinkingEnabled = getIsThinkingEnabled();

    const model = genAI.getGenerativeModel({
      model: activeModel,
      tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS as any }],
    });

    // Rút gọn dữ liệu context (Chỉ lấy tối đa 50 bản ghi mới nhất để chống tràn Token)
    const leanContext = {
      products: (appContextData.products || []).slice(0, 50).map((p: any) => ({ id: p.id, code: p.code, name: p.name, status: p.status })),
      batches: (appContextData.batches || []).slice(0, 50).map((b: any) => ({ id: b.id, batchNo: b.batchNo, productId: b.productId, product: b.product?.name, status: b.status, mfg: b.mfgDate, exp: b.expDate })),
      tccs: (appContextData.tccsList || []).slice(0, 50).map((t: any) => ({ code: t.code, status: t.status, issueDate: t.issueDate, productId: t.productId })),
      testResults: (appContextData.testResults || []).slice(0, 50).map((tr: any) => ({ id: tr.id, lab: tr.labName, date: tr.testDate, status: tr.overallStatus, batchId: tr.batchId }))
    };

    const systemPrompt = `Bạn là Trợ lý AI chuyên môn của phần mềm V-BIOTECH Quality Management (Quản lý Chất lượng Dược phẩm).
Nhiệm vụ: Trả lời câu hỏi dựa trên DỮ LIỆU THỰC của ứng dụng và GỌI CÁC TOOL khi cần phân tích sâu hơn.

DỮ LIỆU ỨNG DỤNG HIỆN TẠI (JSON):
${JSON.stringify(leanContext, null, 2)}

QUY TẮC:
1. LUÔN dựa vào dữ liệu JSON để trả lời. Không bịa đặt thông tin.
2. Trả lời bằng Tiếng Việt, văn phong chuyên nghiệp, thân thiện.
3. Sử dụng Markdown (in đậm, danh sách) để làm câu trả lời dễ đọc hơn.
4. Nếu người dùng hỏi về xu hướng, thống kê → GỌI analyzeQualityTrends với productId phù hợp.
5. Nếu hỏi về tiêu chuẩn dược điển → GỌI lookupPharmacoeiaStandard.
6. Nếu hỏi về nguyên nhân sự cố → GỌI performRootCauseAnalysis.
7. Nếu hỏi về rủi ro quy trình → GỌI assessQualityRisk.
8. Nếu hỏi về tình trạng lô hàng tổng thể → GỌI getBatchSummary.
9. Nếu hỏi kiểm tra chất lượng dữ liệu → GỌI validateDataIntegrity.
10. Nếu thông tin không có trong dữ liệu, hãy nói rõ "Tôi không tìm thấy thông tin này trong hệ thống".
11. Nếu người dùng yêu cầu xuất báo cáo, tải file Excel, báo cáo tháng/quý → GỌI generateQualityReport với period phù hợp ('month', 'quarter', 'all').
12. Nếu người dùng hỏi về cảnh báo chất lượng, rủi ro, lô sắp hết hạn, xu hướng trôi → GỌI detectQualityAnomalies.
13. Nếu người dùng yêu cầu lập báo cáo chất lượng nâng cao, báo cáo tổng hợp theo ngày sản xuất, theo dõi phần trăm hoạt chất chính qua các lô sản xuất → GỌI generateProductionSynthesisReport với productId (và startDate, endDate nếu có). Bắt buộc phải tìm hoặc hỏi productId trước khi gọi tool.
${isThinkingEnabled ? `14. [QUAN TRỌNG - BẮT BUỘC] Bạn phải luôn bắt đầu phản hồi của mình bằng việc lập luận chi tiết quy trình suy nghĩ và phân tích dữ liệu bên trong cặp thẻ <thinking>...</thinking> (ví dụ: giải thích tại sao bạn chọn hành động hay quyết định gọi tool nào, đối chiếu số liệu thế nào). Chỉ đưa ra câu trả lời chính thức hoặc định dạng markdown cho người dùng bên ngoài cặp thẻ <thinking>...</thinking>. Không được hiển thị thẻ <thinking> trong markdown code blocks.` : ''}`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const chat = model.startChat({
          history: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Tôi đã hiểu quy tắc và bối cảnh dữ liệu. Tôi sẵn sàng hỗ trợ và sẽ gọi các tool khi cần thiết." }] },
            ...history
          ],
        });

        let accumulatedThinking = "";

        // Gửi tin nhắn đầu tiên
        let result = await chat.sendMessage(message);
        let response = result.response;

        // Trích xuất suy nghĩ bước 1 nếu có
        try {
          const firstText = response.text();
          if (firstText) {
            const parsed = extractThinking(firstText);
            if (parsed.thinking) {
              accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + parsed.thinking;
            }
          }
        } catch (e) {
          // Bỏ qua nếu response chỉ chứa functionCall
        }

        // ✅ Vòng lặp xử lý Function Calling
        // Gemini có thể gọi nhiều tool liên tiếp trước khi trả về văn bản cuối cùng
        let iterationCount = 0;
        const MAX_TOOL_ITERATIONS = 5; // Giới hạn để tránh vòng lặp vô tận

        while (response.candidates?.[0]?.content?.parts?.some((p: any) => p.functionCall) && iterationCount < MAX_TOOL_ITERATIONS) {
          iterationCount++;
          const toolCallParts = response.candidates[0].content.parts;
          const functionResponseParts: any[] = [];

          // Thực thi tất cả tool calls trong response hiện tại
          for (const part of toolCallParts) {
            if (part.functionCall) {
              const toolResult = await executeTool(
                part.functionCall.name,
                part.functionCall.args as Record<string, any>,
                appContextData, // Truyền dữ liệu thật, không phải leanContext
                geminiService.generateText
              );

              functionResponseParts.push({
                functionResponse: {
                  name: part.functionCall.name,
                  response: { result: toolResult }
                }
              });
            }
          }

          // Gửi kết quả tool về cho model
          result = await chat.sendMessage(functionResponseParts);
          response = result.response;

          // Trích xuất suy nghĩ sau mỗi bước gọi tool nếu có
          try {
            const stepText = response.text();
            if (stepText) {
              const parsed = extractThinking(stepText);
              if (parsed.thinking) {
                accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + parsed.thinking;
              }
            }
          } catch (e) {
            // Có thể chỉ chứa tool call tiếp theo
          }
        }

        // Lấy text cuối cùng từ model và trích xuất suy nghĩ cuối cùng
        let finalResponseText = response.text();
        const finalParsed = extractThinking(finalResponseText);
        if (finalParsed.thinking) {
          accumulatedThinking += (accumulatedThinking ? "\n\n" : "") + finalParsed.thinking;
          finalResponseText = finalParsed.cleanText;
        }

        return {
          text: finalResponseText,
          thinking: accumulatedThinking || undefined
        };

      } catch (error: any) {
        attempt++;
        const errorMessage = error?.message || '';

        // Chỉ retry với lỗi quá tải (503) hoặc rate limit (429)
        if ((errorMessage.includes('503') || errorMessage.includes('429')) && attempt < maxRetries) {
          console.warn(`Gemini API overloaded. Retrying attempt ${attempt}...`);
          await new Promise(res => setTimeout(res, 2000 * attempt));
          continue;
        }

        console.error("Error in chatWithAppContext:", error);
        throw error;
      }
    }
    // FIX 2: Sau vòng while, ném lỗi rõ ràng thay vì trả về undefined im lặng
    throw new Error("Gemini Chat: Đã vượt quá số lần thử lại tối đa mà không thành công.");
  }
};
