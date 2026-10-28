/**
 * MASTER DATA DOMAIN: APPLICATION QUERIES
 * Điểm truy vấn dữ liệu đồng nhất cho Master Data (Criteria, Pharmacopoeia, Laboratories).
 */

import { MasterCriterion, PharmacopoeiaStandard, TestingLaboratory } from '../domain/types';
import {
  masterCriterionRepository,
  firebasePharmacopoeiaRepository,
  firebaseLaboratoryRepository,
  IMasterCriterionRepository,
  IPharmacopoeiaRepository,
  ILaboratoryRepository,
} from '../infrastructure/repository';

export class MasterDataQueries {
  constructor(
    private criteriaRepo: IMasterCriterionRepository = masterCriterionRepository,
    private pharmaRepo: IPharmacopoeiaRepository = firebasePharmacopoeiaRepository,
    private labRepo: ILaboratoryRepository = firebaseLaboratoryRepository
  ) {}

  // Criteria
  async getAllCriteria(): Promise<MasterCriterion[]> {
    return this.criteriaRepo.findAll();
  }

  async getActiveCriteria(): Promise<MasterCriterion[]> {
    return this.criteriaRepo.findActive();
  }

  async getCriterionById(id: string): Promise<MasterCriterion | null> {
    return this.criteriaRepo.findById(id);
  }

  async getCriteriaByCategory(category: any): Promise<MasterCriterion[]> {
    if ((this.criteriaRepo as any).findByCategory) {
      return (this.criteriaRepo as any).findByCategory(category);
    }
    const all = await this.criteriaRepo.findAll();
    return all.filter((c: any) => c.category === category);
  }

  // Pharmacopoeia
  async getAllPharmacopoeiaStandards(): Promise<PharmacopoeiaStandard[]> {
    return this.pharmaRepo.findAll();
  }

  async getPharmacopoeiaStandardById(id: string): Promise<PharmacopoeiaStandard | null> {
    return this.pharmaRepo.findById(id);
  }

  // Laboratory
  async getAllLaboratories(): Promise<TestingLaboratory[]> {
    return this.labRepo.findAll();
  }

  async getLaboratoryById(id: string): Promise<TestingLaboratory | null> {
    return this.labRepo.findById(id);
  }
}

export const masterDataQueries = new MasterDataQueries();
