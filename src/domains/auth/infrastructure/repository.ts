/**
 * AUTH DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS (VS-16)
 * =======================================================
 * Liên kết các phương thức xác thực với Firebase Auth Client SDK.
 */

import { auth, db } from '../../../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  UserCredential,
  User,
} from 'firebase/auth';
import { ref, set } from 'firebase/database';

export interface IAuthRepository {
  signIn(email: string, pass: string): Promise<UserCredential>;
  signUp(email: string, pass: string): Promise<User>;
  signOut(): Promise<void>;
  changePassword(currentPass: string, newPass: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  setPersistence(): Promise<void>;
}

export class FirebaseAuthRepository implements IAuthRepository {
  async signIn(email: string, pass: string): Promise<UserCredential> {
    return await signInWithEmailAndPassword(auth, email, pass);
  }

  async signUp(email: string, pass: string): Promise<User> {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await set(ref(db, `users/${user.uid}`), {
      email,
      createdAt: new Date().toISOString(),
    });
    return user;
  }

  async signOut(): Promise<void> {
    await signOut(auth);
  }

  async changePassword(currentPass: string, newPass: string): Promise<void> {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Không tìm thấy thông tin người dùng.');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPass);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async setPersistence(): Promise<void> {
    await setPersistence(auth, browserLocalPersistence);
  }
}

export const firebaseAuthRepository = new FirebaseAuthRepository();
