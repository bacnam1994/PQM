import { ref, get, set } from 'firebase/database';
import { db } from '../../firebase';
import { ISystemRepository } from '../ISystemRepository';

export class FirebaseSystemRepository implements ISystemRepository {
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
}

export const firebaseSystemRepository = new FirebaseSystemRepository();
