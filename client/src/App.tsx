import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './portals/auth/LoginView';
import { FastPosScreen } from './portals/pos/FastPosScreen';
import { OwnerDashboard } from './portals/owner/OwnerDashboard';
import { SuperAdminPanel } from './portals/superadmin/SuperAdminPanel';
import { PublicRegisterScreen } from './portals/onboarding/PublicRegisterScreen';

export const App: React.FC = () => {
  const { token, user, activeTenant } = useAuth();
  const [view, setView] = useState<'auth' | 'register'>('auth');

  if (view === 'register') {
    return <PublicRegisterScreen onBackToLogin={() => setView('auth')} />;
  }

  if (!token || !user) {
    return <LoginView onNavigateToRegister={() => setView('register')} />;
  }

  // SuperAdmin Platform View
  if (user.isSuperAdmin || activeTenant?.role === 'SUPER_ADMIN') {
    return <SuperAdminPanel />;
  }

  // Merchant Owner View
  if (activeTenant?.role === 'MERCHANT_OWNER') {
    return <OwnerDashboard />;
  }

  // Fast POS View for Cashiers (Default retail operator)
  return <FastPosScreen />;
};
