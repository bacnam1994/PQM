import { TestingLaboratory } from '../types/laboratory';

export interface ILaboratoryRepository {
  findById(id: string): Promise<TestingLaboratory | null>;
  findAll(): Promise<TestingLaboratory[]>;
  save(lab: TestingLaboratory): Promise<void>;
  update(lab: TestingLaboratory): Promise<void>;
  delete(id: string): Promise<void>;
}
