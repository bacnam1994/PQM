/**
 * COA DOMAIN: READ QUERIES
 */

import {
  CoAVerificationData,
  CoADocumentPayload,
  GenerateCoAPayloadOptions,
} from '../domain/types';
import { CoAService, coaService } from './service';

export class CoAQueries {
  constructor(private service: CoAService = coaService) {}

  /**
   * Lấy dữ liệu thẩm tra CoA công khai qua mã định danh lô hoặc phiếu kiểm nghiệm
   */
  async getVerificationData(id: string): Promise<CoAVerificationData> {
    return this.service.getCoAVerificationData(id);
  }

  /**
   * Sinh bản in tài liệu CoA từ bản chụp EvaluationSnapshot đã niêm phong
   */
  getDocumentPayload(options: GenerateCoAPayloadOptions): CoADocumentPayload {
    return this.service.generateCoAPayload(options);
  }
}

export const coaQueries = new CoAQueries();
