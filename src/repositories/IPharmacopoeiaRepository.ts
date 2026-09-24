import { PharmacopoeiaStandard } from '../services/pharmacopoeiaService';

export interface IPharmacopoeiaRepository {
  findById(id: string): Promise<PharmacopoeiaStandard | null>;
  findAll(): Promise<PharmacopoeiaStandard[]>;
  save(standard: PharmacopoeiaStandard): Promise<void>;
  update(standard: PharmacopoeiaStandard): Promise<void>;
  delete(id: string): Promise<void>;
  seedDefaults(standards: PharmacopoeiaStandard[]): Promise<void>;
}
