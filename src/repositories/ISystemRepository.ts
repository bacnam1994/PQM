import { SystemMaintenanceConfig } from '../domains/system/domain/types';

export interface ISystemRepository {
  backupDatabase(): Promise<Record<string, any>>;
  restoreDatabase(data: Record<string, any>): Promise<void>;
  wipeDatabase(): Promise<void>;
  resetDemoData(demoData: Record<string, any>): Promise<void>;
  getMaintenanceConfig(): Promise<SystemMaintenanceConfig | null>;
  setMaintenanceConfig(config: SystemMaintenanceConfig): Promise<void>;
  listenMaintenanceConfig(callback: (config: SystemMaintenanceConfig | null) => void): () => void;
}
