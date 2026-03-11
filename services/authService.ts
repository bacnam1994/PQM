import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updatePassword, 
  sendPasswordResetEmail, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { ref, set } from 'firebase/database';

export const authService = {
  login: (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass),
  
  signup: async (email: string, pass: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    // Tạo thông tin user trong DB
    await set(ref(db, `users/${user.uid}`), {
      email,
      createdAt: new Date().toISOString()
    });
    return user;
  },

  logout: () => signOut(auth),

  changePassword: async (currentPass: string, newPass: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("Không tìm thấy thông tin người dùng.");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPass);
  },

  resetPassword: (email: string) => sendPasswordResetEmail(auth, email),
  
  setPersistence: () => setPersistence(auth, browserLocalPersistence)
};