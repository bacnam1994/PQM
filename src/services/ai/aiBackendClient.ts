/**
 * src/services/ai/aiBackendClient.ts
 * Frontend Client for Server-Authoritative AI Intelligence Suite (Phases 15, 17, 18)
 *
 * Communicates with External Backend Authority (/api/ai/analyze) using Firebase ID Token.
 * NEVER requires or uses Gemini API Key in the browser!
 */

import { getAuth } from 'firebase/auth';
import { getBackendApiUrl } from '../../utils/backendApiUrl';

export interface AIEvidence {
  sourceType: 'BATCH' | 'TEST_RESULT' | 'SPECIFICATION' | 'DEVIATION' | 'DOCUMENT';
  sourceId: string;
  quoteOrMetric?: string;
}

export interface AIFinding {
  title: string;
  description: string;
  evidence: AIEvidence[];
}

export interface AISummaryResult {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  findings: AIFinding[];
  recommendations: string[];
  limitations: string[];
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AIAuditMetadata {
  aiAnalysisId: string;
  uid: string;
  userEmail: string;
  timestamp: string;
  model: string;
  promptVersion: string;
  analysisType: string;
  contextHash: string;
  inputRecordIds: string[];
  correlationId: string;
}

export interface AIAnalyzeApiResponse {
  success: boolean;
  data: AISummaryResult;
  metadata: AIAuditMetadata;
}

export interface AIHealthResponse {
  success: boolean;
  data: {
    service: string;
    model: string;
    isConfigured: boolean;
    providerStatus?: string;
    supportedTypes: string[];
  };
  correlationId: string;
}

export interface AIConfigResponse {
  success: boolean;
  data: {
    isConfigured: boolean;
    maskedKey: string;
    model: string;
    source: string;
  };
  correlationId: string;
}

export interface AITestResponse {
  success: boolean;
  message: string;
  data: {
    latencyMs: number;
    model: string;
  };
  correlationId: string;
}

export interface AIConfigUpdateResponse {
  success: boolean;
  message: string;
  data: {
    isConfigured: boolean;
    maskedKey: string;
    model: string;
  };
  correlationId: string;
}

export class AIBackendClient {
  private static apiUrl = getBackendApiUrl();

  public static setApiUrl(url: string): void {
    this.apiUrl = url;
  }

  public static getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Retrieves fresh Firebase ID Token for current user
   */
  private static async getIdToken(): Promise<string> {
    // In test sandbox: allow fallback token if set
    if (typeof window !== 'undefined' && (window as any).__TEST_AI_TOKEN__) {
      return (window as any).__TEST_AI_TOKEN__;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('Yêu cầu đăng nhập trước khi sử dụng tính năng Trợ lý AI.');
      }

      return await user.getIdToken();
    } catch (err: any) {
      if (err?.message?.includes('Yêu cầu đăng nhập')) {
        throw err;
      }
      throw new Error('Yêu cầu đăng nhập trước khi sử dụng tính năng Trợ lý AI.');
    }
  }

  /**
   * Check backend AI service health and readiness
   */
  public static async checkHealth(): Promise<AIHealthResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/api/ai/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err: any) {
      throw new Error(`Không thể kết nối đến máy chủ AI Backend: ${err.message || String(err)}`);
    }
  }

  /**
   * Get server-side AI configuration (ADMIN only, masked secret)
   */
  public static async getConfig(): Promise<AIConfigResponse> {
    const token = await this.getIdToken();
    try {
      const response = await fetch(`${this.apiUrl}/api/ai/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || `Lỗi khi lấy cấu hình AI (HTTP ${response.status})`);
      }
      return json;
    } catch (err: any) {
      throw new Error(`Không thể lấy cấu hình máy chủ AI: ${err.message || String(err)}`);
    }
  }

  /**
   * Update server-side AI configuration (ADMIN only, validates before saving)
   */
  public static async updateConfig(payload: {
    apiKey: string;
    model?: string;
  }): Promise<AIConfigUpdateResponse> {
    const token = await this.getIdToken();
    try {
      const response = await fetch(`${this.apiUrl}/api/ai/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message || `Lỗi khi cập nhật cấu hình AI (HTTP ${response.status})`
        );
      }
      return json;
    } catch (err: any) {
      throw new Error(`Không thể cập nhật cấu hình máy chủ AI: ${err.message || String(err)}`);
    }
  }

  /**
   * Test AI connection from server (ADMIN only)
   */
  public static async testConfig(payload?: {
    apiKey?: string;
    model?: string;
  }): Promise<AITestResponse> {
    const token = await this.getIdToken();
    try {
      const response = await fetch(`${this.apiUrl}/api/ai/config/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload || {}),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message || `Lỗi khi kiểm tra kết nối AI (HTTP ${response.status})`
        );
      }
      return json;
    } catch (err: any) {
      throw new Error(`Kiểm tra kết nối AI thất bại: ${err.message || String(err)}`);
    }
  }

  /**
   * Core analysis request
   */
  public static async analyze(requestPayload: {
    type:
      | 'batch_analysis'
      | 'test_result_analysis'
      | 'deviation_analysis'
      | 'document_analysis'
      | 'capa_assistant';
    batchId?: string;
    testResultId?: string;
    deviationId?: string;
    documentId?: string;
    promptOverride?: string;
  }): Promise<{ data: AISummaryResult; metadata: AIAuditMetadata }> {
    const token = await this.getIdToken();

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (fetchErr: any) {
      throw new Error(`Không thể kết nối đến máy chủ AI Backend Authority: ${fetchErr.message}`);
    }

    const json = await response.json();

    if (!response.ok || !json.success) {
      const errorCode = json.error?.code || 'AI_ERROR';
      const errorMsg = json.error?.message || 'Lỗi khi xử lý phân tích AI.';

      if (errorCode === 'AI_PERMISSION_DENIED') {
        throw new Error(`[Quyền hạn] ${errorMsg}`);
      }
      if (errorCode === 'AI_RATE_LIMITED') {
        throw new Error(`[Hạn mức] ${errorMsg}`);
      }
      if (errorCode === 'AI_UNAVAILABLE') {
        throw new Error(`[Dịch vụ AI] ${errorMsg}`);
      }
      throw new Error(errorMsg);
    }

    return {
      data: json.data,
      metadata: json.metadata,
    };
  }

  public static async analyzeBatch(batchId: string, promptOverride?: string) {
    return this.analyze({ type: 'batch_analysis', batchId, promptOverride });
  }

  public static async analyzeTestResult(testResultId: string, promptOverride?: string) {
    return this.analyze({ type: 'test_result_analysis', testResultId, promptOverride });
  }

  public static async analyzeDeviation(deviationId: string, promptOverride?: string) {
    return this.analyze({ type: 'deviation_analysis', deviationId, promptOverride });
  }

  public static async analyzeDocument(documentId: string, promptOverride?: string) {
    return this.analyze({ type: 'document_analysis', documentId, promptOverride });
  }

  public static async assistCapa(deviationId: string, promptOverride?: string) {
    return this.analyze({ type: 'capa_assistant', deviationId, promptOverride });
  }
}
