export interface ISystemRepository {
  backupDatabase(): Promise<Record<string, any>>;
  restoreDatabase(data: Record<string, any>): Promise<void>;
  wipeDatabase(): Promise<void>;
  resetDemoData(demoData: Record<string, any>): Promise<void>;
}
