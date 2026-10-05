import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  requestTenantSelection,
  requestTenantSwitch,
  type IssuedSession,
} from './auth-requests';

export interface ActiveTenant {
  tenantId: string;
  merchantName: string;
  role: 'SUPER_ADMIN' | 'MERCHANT_OWNER' | 'CASHIER';
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
}

export interface MembershipOption {
  tenantId: string;
  merchantName: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  activeTenant: ActiveTenant | null;
  availableMemberships: MembershipOption[];
  isSelectingTenant: boolean;
  openTenantSelector: () => void;
  closeTenantSelector: () => void;
  login: (email: string, password: string) => Promise<void>;
  selectTenant: (tenantId: string, role?: string) => Promise<void>;
  switchTenant: (targetTenantId: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem('token');
    // Legacy fake `token-${tenantId}` values are not credentials: purge them.
    if (saved && saved.startsWith('token-')) {
      localStorage.removeItem('token');
      return null;
    }
    return saved;
  });
  // Temporary tenant-selection token: short-lived, memory only, never persisted.
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTenant, setActiveTenant] = useState<ActiveTenant | null>(() => {
    const saved = localStorage.getItem('activeTenant');
    return saved ? JSON.parse(saved) : null;
  });
  const [availableMemberships, setAvailableMemberships] = useState<MembershipOption[]>(() => {
    const saved = localStorage.getItem('memberships');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSelectingTenant, setIsSelectingTenant] = useState(false);

  const login = async (email: string, password: string) => {
    // Simulated fast login or real API bridge
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.requiresTenantSelection) {
        setAvailableMemberships(data.memberships);
        localStorage.setItem('memberships', JSON.stringify(data.memberships));
        setTempToken(data.tempToken || null);
        setIsSelectingTenant(true);
      } else {
        setTempToken(null);
        setToken(data.accessToken);
        setActiveTenant(data.activeTenant);
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('activeTenant', JSON.stringify(data.activeTenant));
      }
      return;
    }

    let errorMsg = 'Correo o contraseña incorrectos.';
    if (res) {
      try {
        const errData = await res.json();
        if (errData?.message) {
          errorMsg = Array.isArray(errData.message) ? errData.message.join(', ') : errData.message;
        }
      } catch {}
    } else {
      errorMsg = 'No se pudo conectar con el servidor. Verificá tu conexión.';
    }
    throw new Error(errorMsg);
  };

  const selectTenant = async (tenantId: string, role?: string) => {
    // Fail closed: selection requires a server-issued temporary token held in memory.
    if (!user || !tempToken) {
      throw new Error('Tu sesión de selección ya no es válida. Iniciá sesión de nuevo.');
    }

    let data: IssuedSession;
    try {
      data = await requestTenantSelection({
        temporaryToken: tempToken,
        userId: user.id,
        tenantId,
        role,
      });
    } catch {
      // Fail closed: never fabricate a session token when the API rejects the selection.
      throw new Error('No se pudo seleccionar la sucursal. Iniciá sesión de nuevo.');
    }

    const newActive: ActiveTenant = {
      tenantId: data.activeTenant.tenantId,
      merchantName: data.activeTenant.merchantName,
      role: data.activeTenant.role,
    };
    setActiveTenant(newActive);
    setToken(data.accessToken);
    setTempToken(null);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('activeTenant', JSON.stringify(newActive));
    setIsSelectingTenant(false);
  };

  const switchTenant = async (targetTenantId: string, role?: string) => {
    // Fail closed: switching requires the current scoped access token for this user.
    if (!user || !token) {
      throw new Error('Tu sesión ya no es válida. Iniciá sesión de nuevo.');
    }

    let data: IssuedSession;
    try {
      data = await requestTenantSwitch({
        accessToken: token,
        userId: user.id,
        targetTenantId,
        role,
      });
    } catch {
      // Fail closed: the current session stays untouched when the switch is rejected.
      throw new Error('No se pudo cambiar de sucursal.');
    }

    const newActive: ActiveTenant = {
      tenantId: data.activeTenant.tenantId,
      merchantName: data.activeTenant.merchantName,
      role: data.activeTenant.role,
    };
    setActiveTenant(newActive);
    setToken(data.accessToken);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('activeTenant', JSON.stringify(newActive));
  };

  const openTenantSelector = () => setIsSelectingTenant(true);
  const closeTenantSelector = () => setIsSelectingTenant(false);

  const logout = () => {
    setToken(null);
    setTempToken(null);
    setUser(null);
    setActiveTenant(null);
    setAvailableMemberships([]);
    setIsSelectingTenant(false);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        activeTenant,
        availableMemberships,
        isSelectingTenant,
        openTenantSelector,
        closeTenantSelector,
        login,
        selectTenant,
        switchTenant,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
