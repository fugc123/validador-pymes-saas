import React, { useState, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './portals/auth/LoginView';
import { FastPosScreen } from './portals/pos/FastPosScreen';
import { OwnerDashboard } from './portals/owner/OwnerDashboard';
import { SuperAdminPanel } from './portals/superadmin/SuperAdminPanel';
import { PublicRegisterScreen } from './portals/onboarding/PublicRegisterScreen';
import { LandingPage } from './portals/landing/LandingPage';
import { BranchSelectorModal } from './components/BranchSelectorModal';
import { PublicCatalogView } from './portals/catalog/PublicCatalogView';

function resolvePublicCatalogSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname || '';
  const match = path.match(/^\/catalogo\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('catalogo');
  if (querySlug && querySlug.trim().length > 0) {
    return querySlug.trim();
  }
  return null;
}

export const App: React.FC = () => {
  const { token, user, activeTenant, isSelectingTenant, closeTenantSelector } = useAuth();
  const [view, setView] = useState<'landing' | 'auth' | 'register'>('landing');
  const publicCatalogSlug = useMemo(() => resolvePublicCatalogSlug(), []);

  // Public Storefront Catalog (/catalogo/:slug or ?catalogo=:slug)
  if (publicCatalogSlug) {
    return (
      <PublicCatalogView
        slug={publicCatalogSlug}
        onBackHome={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // Authenticated flows
  if (token && user) {
    let mainView = <FastPosScreen />;
    if (user.isSuperAdmin || activeTenant?.role === 'SUPER_ADMIN') {
      mainView = <SuperAdminPanel />;
    } else if (activeTenant?.role === 'MERCHANT_OWNER') {
      mainView = <OwnerDashboard />;
    }

    return (
      <>
        {mainView}
        {isSelectingTenant && (
          <BranchSelectorModal onClose={closeTenantSelector} />
        )}
      </>
    );
  }

  // Public Unauthenticated flows
  if (view === 'auth') {
    return (
      <LoginView
        onNavigateToRegister={() => setView('register')}
        onBackToLanding={() => setView('landing')}
      />
    );
  }

  if (view === 'register') {
    return <PublicRegisterScreen onBackToLogin={() => setView('auth')} />;
  }

  // Default view: Public High-Converting Landing Page
  return (
    <LandingPage
      onGoToLogin={() => setView('auth')}
      onGoToRegister={() => setView('register')}
    />
  );
};
