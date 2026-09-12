/**
 * geminiClientLoader.ts
 * Lazy loader cho SDK @google/generative-ai.
 * Tránh việc nạp SDK AI nặng vào Main Bundle khi người dùng chỉ duyệt qua các màn hình quản lý thường.
 */

let generativeAIModule: typeof import('@google/generative-ai') | null = null;

export async function getGenerativeAISDK() {
  if (!generativeAIModule) {
    generativeAIModule = await import('@google/generative-ai');
  }
  return generativeAIModule;
}

export async function createGoogleGenerativeAI(apiKey: string) {
  const { GoogleGenerativeAI } = await getGenerativeAISDK();
  return new GoogleGenerativeAI(apiKey);
}
