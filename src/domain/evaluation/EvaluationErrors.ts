/**
 * EvaluationErrors.ts
 * Chuẩn hóa các ngoại lệ phát sinh trong quá trình phân tích và thẩm định chất lượng.
 */

export class EvaluationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationDomainError';
  }
}

export class SpecificationParseError extends EvaluationDomainError {
  constructor(
    public readonly specification: string,
    message?: string
  ) {
    super(message || `Không thể phân tích tiêu chuẩn kỹ thuật: "${specification}"`);
    this.name = 'SpecificationParseError';
  }
}

export class ValueNormalizationError extends EvaluationDomainError {
  constructor(
    public readonly value: any,
    message?: string
  ) {
    super(message || `Không thể chuẩn hóa giá trị kiểm nghiệm: "${String(value)}"`);
    this.name = 'ValueNormalizationError';
  }
}
