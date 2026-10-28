/**
 * functions/src/customClaimsTrigger.ts
 * Cloud Function RTDB Trigger: Tự động đồng bộ Custom Claims (role, isAdmin)
 * vào Firebase Auth Token khi node /users/{uid} được tạo hoặc cập nhật.
 */

import * as admin from 'firebase-admin';

export async function syncUserCustomClaims(
  uid: string,
  userData: any,
  auth: admin.auth.Auth
): Promise<{ success: boolean; claims: any }> {
  if (!uid) return { success: false, claims: null };

  const role = userData?.role || 'VIEWER';
  const isAdmin = role === 'ADMIN' || Boolean(userData?.isAdmin);

  const customClaims = {
    role,
    isAdmin,
    updatedAt: Date.now()
  };

  try {
    await auth.setCustomUserClaims(uid, customClaims);
    console.log(`[CustomClaims] Successfully synced claims for uid ${uid}:`, customClaims);
    return { success: true, claims: customClaims };
  } catch (error) {
    console.error(`[CustomClaims] Failed to set claims for uid ${uid}:`, error);
    throw error;
  }
}
