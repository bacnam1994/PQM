/**
 * src/services/releaseCommandPort.ts
 *
 * CANONICAL RELEASE COMMAND PORT & HTTP BACKEND ADAPTER
 *
 * In accordance with Hexagonal Architecture:
 * - Production UI/Application Service calls IReleaseCommandPort.
 * - Production implementation calls external Server Authority POST /api/batch-release/approve.
 * - Preserves Firebase Spark Free tier by eliminating Cloud Functions.
 * - Test suites can inject an in-memory/mock adapter without polluting production logic.
 */

import { getAuth } from 'firebase/auth';

export interface BatchReleaseCommandInput {
  batchId: string;
  expectedVersion: number;
  signatureId: string;
  idempotencyKey: string;
  correlationId?: string;
}

export interface BatchReleaseCommandOutput {
  success: boolean;
  batchId: string;
  newVersion: number;
  status: 'RELEASED';
  releasedAt: string;
  idempotencyReplayed?: boolean;
  durationMs?: number;
  correlationId: string;
  commandId: string;
}

import { getBackendApiUrl } from '../utils/backendApiUrl';

export interface IReleaseCommandPort {
  executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput>;
}

/**
 * Production HTTP Backend Implementation of Release Command
 */
export class HttpReleaseCommandAdapter implements IReleaseCommandPort {
  private customBaseUrl?: string;

  constructor(baseUrl?: string) {
    this.customBaseUrl = baseUrl;
  }

  private get baseUrl(): string {
    return this.customBaseUrl || getBackendApiUrl();
  }

  async executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const correlationId =
      input.correlationId || `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/batch-release/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify({
          batchId: input.batchId,
          expectedVersion: input.expectedVersion,
          signatureId: input.signatureId,
          idempotencyKey: input.idempotencyKey,
          correlationId,
        }),
      });
    } catch (networkErr: any) {
      const errorMsg =
        `Không thể kết nối đến Máy chủ Phê duyệt Xuất xưởng (Backend Authority tại ${this.baseUrl}). ` +
        `Yêu cầu mạng thất bại: ${networkErr?.message || 'Failed to fetch'}. ` +
        `CHƯA XÁC NHẬN trạng thái xuất xưởng của Lô. ` +
        `Lệnh xuất xưởng đã được bảo lưu khóa Idempotency (${input.idempotencyKey}). ` +
        `Vui lòng kiểm tra lại trạng thái Lô trước khi thử lại (Mã đối chiếu: ${correlationId}).`;

      const enhancedErr: any = new Error(errorMsg);
      enhancedErr.name = 'ReleaseNetworkError';
      enhancedErr.isNetworkError = true;
      enhancedErr.correlationId = correlationId;
      enhancedErr.idempotencyKey = input.idempotencyKey;
      throw enhancedErr;
    }

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Máy chủ xuất xưởng trả về định dạng phản hồi không hợp lệ (HTTP ${response.status}). Mã đối chiếu: ${correlationId}.`
      );
    }

    if (!response.ok || !data.success) {
      const serverCode = data.error?.code ? `[${data.error.code}] ` : '';
      const serverCorrelation = data.error?.correlationId || correlationId;
      const serverMessage = data.error?.message;
      const errMsg = serverMessage
        ? `${serverCode}${serverMessage} (Mã đối chiếu: ${serverCorrelation})`
        : `Lỗi xuất xưởng lô trên máy chủ (HTTP ${response.status}). Mã đối chiếu: ${serverCorrelation}.`;

      const enhancedErr: any = new Error(errMsg);
      enhancedErr.code = data.error?.code;
      enhancedErr.statusCode = response.status;
      enhancedErr.correlationId = serverCorrelation;
      throw enhancedErr;
    }

    return data;
  }
}

// Backward-compatible alias
export const CloudFunctionsReleaseCommandAdapter = HttpReleaseCommandAdapter;

// Canonical Singleton for production release command execution
let activeReleaseCommandPort: IReleaseCommandPort = new HttpReleaseCommandAdapter();

export function getReleaseCommandPort(): IReleaseCommandPort {
  return activeReleaseCommandPort;
}

export function setReleaseCommandPort(port: IReleaseCommandPort): void {
  activeReleaseCommandPort = port;
}
