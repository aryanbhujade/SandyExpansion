import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '@/services/api';

export interface User {
  employee_id: string;
  name: string;
  email: string;
  level: string;
  role: string;
  department: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = 'sandy_connect_token';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      localStorage.removeItem(TOKEN_KEY);
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const userData = await authApi.getMe();
          setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user:", error);
          sessionStorage.removeItem(TOKEN_KEY);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: token is cleared client-side regardless.
    }
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
