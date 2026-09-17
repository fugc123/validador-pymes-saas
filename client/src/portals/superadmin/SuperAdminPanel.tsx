import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  CheckCircle,
  Building,
  Users,
  DollarSign,
  LogOut,
  AlertTriangle,
  Clock,
  CreditCard,
} from 'lucide-react';

interface MerchantRequest {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  createdAt: string;
}

interface Subscription {
  tenantId: string;
  merchantName: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  daysRemaining: number;
  currentPeriodEnd: string;
}

export const SuperAdminPanel: React.FC = () => {
  const { user, logout, token } = useAuth();
  const [requests, setRequests] = useState<MerchantRequest[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const fetchRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/onboarding/superadmin/merchant-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubscriptions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/subscription/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchSubscriptions();
  }, [token]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/onboarding/superadmin/merchant-requests/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmPayment = async (tenantId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/subscription/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId }),
      });
      fetchSubscriptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkPastDue = async (tenantId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/subscription/mark-past-due`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId }),
      });
      fetchSubscriptions();
    } catch (err) {
      console.error(err);
    }
  };

  const activeComercios = subscriptions.filter(s => s.status === 'active' || s.status === 'trial').length;
  const mrrProyectado = activeComercios * 150000;
  const pendingRequests = requests.filter(r => r.status === 'requested').length;

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'requested' && b.status !== 'requested') return -1;
    if (a.status !== 'requested' && b.status === 'requested') return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-[#24324D] px-8 flex items-center justify-between bg-[#151D2F]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="font-bold text-white">CajaSegura — Panel de Administración</div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">{user?.email}</div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8">
        {/* Payment Info Card */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl flex items-center space-x-6">
          <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">📋 Datos para Transferencia</h2>
            <div className="flex space-x-8 text-sm">
              <div><span className="text-gray-400">Alias:</span> <span className="font-mono text-white font-bold">5644334</span></div>
              <div><span className="text-gray-400">Nombre:</span> <span className="text-white font-bold">Franco Girala</span></div>
              <div><span className="text-gray-400">Monto Mensual:</span> <span className="font-mono text-emerald-400 font-bold">Gs. 150.000</span></div>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Comercios Activos</span>
              <Building className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">{activeComercios}</div>
          </div>
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">MRR Proyectado</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">Gs. {mrrProyectado.toLocaleString('es-PY')}</div>
          </div>
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Solicitudes Pendientes</span>
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">{pendingRequests}</div>
          </div>
        </div>

        {/* Solicitudes Queue */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Solicitudes de Alta</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono">
                <tr>
                  <th className="p-3">Comercio</th>
                  <th className="p-3">Dueño</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Ciudad</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24324D]">
                {sortedRequests.map(r => (
                  <tr key={r.id} className="hover:bg-[#1A253C]/40 transition-colors">
                    <td className="p-3 font-semibold text-white">{r.businessName}</td>
                    <td className="p-3 text-gray-400">{r.ownerName}</td>
                    <td className="p-3 text-gray-400">{r.email}</td>
                    <td className="p-3 text-gray-400">{r.phone}</td>
                    <td className="p-3 text-gray-400">{r.city}</td>
                    <td className="p-3">
                      {r.status === 'requested' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                          Pendiente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                          Aprobado
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {r.status === 'requested' && (
                        <button
                          onClick={() => handleApprove(r.id)}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors"
                        >
                          Aprobar y Provisionar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Suscripciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono">
                <tr>
                  <th className="p-3">Comercio (Tenant)</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Días Restantes</th>
                  <th className="p-3">Vence</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24324D]">
                {subscriptions.map(s => {
                  let badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-gray-500/20 text-gray-400">Desconocido</span>;
                  if (s.status === 'trial') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-500/20 text-blue-400">Trial</span>;
                  if (s.status === 'active') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Activo</span>;
                  if (s.status === 'past_due') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-red-500/20 text-red-400">Moroso</span>;
                  if (s.status === 'cancelled') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-gray-500/20 text-gray-400">Cancelado</span>;

                  return (
                    <tr key={s.tenantId} className="hover:bg-[#1A253C]/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-white">{s.merchantName || 'Sin Nombre'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{s.tenantId}</div>
                      </td>
                      <td className="p-3">{badge}</td>
                      <td className="p-3 font-mono text-gray-300">{s.daysRemaining}</td>
                      <td className="p-3 text-gray-400">{new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                      <td className="p-3 text-right flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleConfirmPayment(s.tenantId)}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded flex items-center space-x-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Confirmar Pago</span>
                        </button>
                        {s.status !== 'past_due' && s.status !== 'cancelled' && (
                          <button
                            onClick={() => handleMarkPastDue(s.tenantId)}
                            className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded flex items-center space-x-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Marcar Moroso</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
