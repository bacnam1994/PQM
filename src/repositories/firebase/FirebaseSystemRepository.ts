import { ref, get, set, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { ISystemRepository } from '../ISystemRepository';
import { SystemMaintenanceConfig } from '../../domains/system/domain/types';

export class FirebaseSystemRepository implements ISystemRepository {
  private readonly maintenancePath = 'system_config/maintenance';

  async backupDatabase(): Promise<Record<string, any>> {
    const rootSnapshot = await get(ref(db));
    if (!rootSnapshot.exists()) {
      return {};
    }
    return (rootSnapshot.val() as Record<string, any>) || {};
  }

  async restoreDatabase(data: Record<string, any>): Promise<void> {
    await set(ref(db), data);
  }

  async wipeDatabase(): Promise<void> {
    await set(ref(db), null);
  }

  async resetDemoData(demoData: Record<string, any>): Promise<void> {
    await set(ref(db), demoData);
  }

  async getMaintenanceConfig(): Promise<SystemMaintenanceConfig | null> {
    try {
      const snap = await get(ref(db, this.maintenancePath));
      if (!snap.exists()) return null;
      return (snap.val() as SystemMaintenanceConfig) || null;
    } catch (err) {
      console.warn('[FirebaseSystemRepository] Lỗi đọc cấu hình bảo trì:', err);
      return null;
    }
  }

  async setMaintenanceConfig(config: SystemMaintenanceConfig): Promise<void> {
    await set(ref(db, this.maintenancePath), config);
  }

  listenMaintenanceConfig(callback: (config: SystemMaintenanceConfig | null) => void): () => void {
    const maintenanceRef = ref(db, this.maintenancePath);
    const unsubscribe = onValue(
      maintenanceRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }
        callback(snapshot.val() as SystemMaintenanceConfig);
      },
      (error) => {
        console.warn('[FirebaseSystemRepository] Lỗi lắng nghe cấu hình bảo trì:', error);
      }
    );
    return () => unsubscribe();
  }
}

export const firebaseSystemRepository = new FirebaseSystemRepository();
