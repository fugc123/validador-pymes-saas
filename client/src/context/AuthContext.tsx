import React, { createContext, useContext, useState, useEffect } from 'react';

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
  login: (email: string, password: string) => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  switchTenant: (targetTenantId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTenant, setActiveTenant] = useState<ActiveTenant | null>(() => {
    const saved = localStorage.getItem('activeTenant');
    return saved ? JSON.parse(saved) : null;
  });
  const [availableMemberships, setAvailableMemberships] = useState<MembershipOption[]>([]);
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
        setIsSelectingTenant(true);
      } else {
        setToken(data.accessToken);
        setActiveTenant(data.activeTenant);
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('activeTenant', JSON.stringify(data.activeTenant));
      }
      return;
    }

    // Client fallback demo credentials if server is not connected
    if (email.includes('admin')) {
      const demoUser: UserProfile = { id: 'usr-admin', email, fullName: 'Super Admin', isSuperAdmin: true };
      const demoTenant: ActiveTenant = { tenantId: 'global', merchantName: 'Validador Platform', role: 'SUPER_ADMIN' };
      setUser(demoUser);
      setActiveTenant(demoTenant);
      setToken('demo-token-admin');
      localStorage.setItem('user', JSON.stringify(demoUser));
      localStorage.setItem('activeTenant', JSON.stringify(demoTenant));
      localStorage.setItem('token', 'demo-token-admin');
      return;
    }

    // Demo multi-store user
    const demoUser: UserProfile = { id: 'usr-franco', email, fullName: 'Franco Galeano', isSuperAdmin: false };
    setUser(demoUser);
    localStorage.setItem('user', JSON.stringify(demoUser));
    setAvailableMemberships([
      { tenantId: 'tenant-kiosko', merchantName: 'Kiosko San Roque', role: 'MERCHANT_OWNER' },
      { tenantId: 'tenant-boutique', merchantName: 'Boutique Asunción', role: 'CASHIER' },
    ]);
    setIsSelectingTenant(true);
  };

  const selectTenant = async (tenantId: string) => {
    const selected = availableMemberships.find((m) => m.tenantId === tenantId);

    if (user) {
      const res = await fetch('/api/v1/auth/select-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tenantId }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        const newActive: ActiveTenant = {
          tenantId: data.activeTenant.tenantId,
          merchantName: data.activeTenant.merchantName,
          role: data.activeTenant.role,
        };
        setActiveTenant(newActive);
        setToken(data.accessToken);
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('activeTenant', JSON.stringify(newActive));
        setIsSelectingTenant(false);
        return;
      }
    }

    if (selected) {
      const newActive: ActiveTenant = {
        tenantId: selected.tenantId,
        merchantName: selected.merchantName,
        role: selected.role as any,
      };
      setActiveTenant(newActive);
      setToken(`token-${tenantId}`);
      localStorage.setItem('token', `token-${tenantId}`);
      localStorage.setItem('activeTenant', JSON.stringify(newActive));
      setIsSelectingTenant(false);
    }
  };

  const switchTenant = async (targetTenantId: string) => {
    await selectTenant(targetTenantId);
  };

  const logout = () => {
    setToken(null);
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
