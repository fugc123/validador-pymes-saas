import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  CheckCircle,
  Building,
  Users,
  DollarSign,
  LogOut,
  ExternalLink,
} from 'lucide-react';

interface RequestItem {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status: 'requested' | 'approved';
}

export const SuperAdminPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([
    {
      id: 'req-101',
      businessName: 'Farmacia San Roque',
      ownerName: 'Marcos Duarte',
      email: 'marcos@farmacia.com',
      phone: '+595981123456',
      city: 'Asunción',
      status: 'requested',
    },
    {
      id: 'req-102',
      businessName: 'Supermercado Los Primos',
      ownerName: 'Silvia Benítez',
      email: 'silvia@losprimos.com',
      phone: '+595971998877',
      city: 'Fernando de la Mora',
      status: 'requested',
    },
  ]);

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)),
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      <header className="h-16 border-b border-[#24324D] px-8 flex items-center justify-between bg-[#151D2F]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white">SuperAdmin Control Panel — Validador PYME</div>
            <div className="text-xs text-gray-400">Sesión: {user?.email}</div>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        {/* Metric Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-mono">Comercios Activos</span>
              <Building className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-mono font-bold text-white">42 Locales</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-mono">MRR Proyectado ($15/mo)</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-mono font-bold text-white">$630 USD/mo</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs uppercase font-mono">Solicitudes Pendientes</span>
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-bold text-white">
              {requests.filter((r) => r.status === 'requested').length} Pendientes
            </div>
          </div>
        </div>

        {/* Onboarding Request Queue */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Cola de Solicitudes de Comercios (1-Click Approve)</h2>

          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-[#0B0F19] border border-[#24324D] rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-base text-white">{req.businessName}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Dueño: <span className="text-gray-200">{req.ownerName}</span> • Email:{' '}
                    <span className="text-gray-200">{req.email}</span> • Tel: {req.phone} • Ciudad:{' '}
                    {req.city}
                  </div>
                </div>

                {req.status === 'requested' ? (
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center space-x-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Aprobar y Provisionar</span>
                  </button>
                ) : (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-mono font-bold">
                    PROVISIONADO (Trial 7 Días)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
