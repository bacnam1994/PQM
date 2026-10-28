/**
 * CAPA DOMAIN: READ QUERIES
 */

import { CAPAActionItem } from '../domain/types';
import type { IDeviationRepository } from '../../../repositories/interfaces/IDeviationRepository';
import { firebaseDeviationRepository } from '../../../repositories/firebase/FirebaseDeviationRepository';

export class CAPAQueries {
  constructor(private repo: IDeviationRepository = firebaseDeviationRepository as any) {}

  /**
   * Lấy toàn bộ danh sách các hành động CAPA từ tất cả sai lệch
   */
  async getAllCAPAItems(): Promise<
    (CAPAActionItem & { deviationId: string; deviationNo: string })[]
  > {
    const deviations = await this.repo.findAll();
    const items: (CAPAActionItem & { deviationId: string; deviationNo: string })[] = [];

    for (const dev of deviations) {
      if (dev.capaItems && dev.capaItems.length > 0) {
        for (const item of dev.capaItems) {
          items.push({
            ...item,
            deviationId: dev.id,
            deviationNo: dev.deviationNo,
          });
        }
      }
    }

    return items;
  }

  /**
   * Lấy các hành động CAPA thuộc về một sai lệch cụ thể
   */
  async getCAPAItemsByDeviationId(deviationId: string): Promise<CAPAActionItem[]> {
    const dev = await this.repo.findById(deviationId);
    return dev?.capaItems || [];
  }

  /**
   * Lấy các hành động CAPA đang chờ thực hiện hoặc đang tiến hành
   */
  async getPendingCAPAItems(): Promise<
    (CAPAActionItem & { deviationId: string; deviationNo: string })[]
  > {
    const all = await this.getAllCAPAItems();
    return all.filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS');
  }
}

export const capaQueries = new CAPAQueries();
