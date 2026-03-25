import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { authService } from '../services/authService';

export type UserRole = 'ADMIN' | 'USER';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.setPersistence().catch(console.error);
    let unsubscribeRole: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = undefined;
      }

      if (currentUser) {
        // Sử dụng onValue để lắng nghe thay đổi quyền hạn theo thời gian thực
        // Kiểm tra quyền trong users/admins
        const roleRef = ref(db, `users/admins/${currentUser.uid}`);
        unsubscribeRole = onValue(roleRef, (snapshot) => {
          const isAdmin = snapshot.exists();
          setRole(isAdmin ? 'ADMIN' : 'USER');
          setLoading(false);
        }, (error) => {
          console.error("Lỗi lấy quyền user:", error);
          setRole('USER');
          setLoading(false);
        });
      } else {
        setRole(null);
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeRole) unsubscribeRole();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    await authService.login(email, pass);
  };

  const signup = async (email: string, pass: string) => {
    await authService.signup(email, pass);
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    await authService.changePassword(currentPass, newPass);
  };

  const resetPassword = async (email: string) => {
    await authService.resetPassword(email);
  };

  const logout = async () => {
    await authService.logout();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, signup, changePassword, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
