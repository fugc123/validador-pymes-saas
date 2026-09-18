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
  Plus,
  Sparkles,
  X,
  Key,
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
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'lifetime';
  isLifetime?: boolean;
  daysRemaining: number;
  currentPeriodEnd: string;
}

interface PaymentReport {
  id: string;
  tenantId: string;
  merchantName: string;
  payerName: string;
  status: 'pending' | 'matched';
  createdAt: string;
}

export const SuperAdminPanel: React.FC = () => {
  const { user, logout, token } = useAuth();
  const [requests, setRequests] = useState<MerchantRequest[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentReports, setPaymentReports] = useState<PaymentReport[]>([]);
  const [reportActionMessage, setReportActionMessage] = useState<{ type: 'success' | 'warning', text: string } | null>(null);
  const [simulationPayer, setSimulationPayer] = useState('Franco Galeano');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    city: 'Asunción',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateFreeMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/onboarding/superadmin/create-free-merchant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedResult(data);
        setCreateForm({
          businessName: '',
          ownerName: '',
          email: '',
          password: '',
          phone: '',
          city: 'Asunción',
        });
        fetchSubscriptions();
        fetchRequests();
      } else {
        const errData = await res.json();
        setCreateError(errData.message || 'Error al crear el comercio');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Error de conexión');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

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

  const fetchPaymentReports = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/subscription/payment-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentReports(data);
        const firstPending = data.find((r: PaymentReport) => r.status === 'pending');
        if (firstPending) {
          setSimulationPayer(firstPending.payerName);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchSubscriptions();
    fetchPaymentReports();
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

  const handleValidateReport = async (reportId: string) => {
    if (!token) return;
    setReportActionMessage(null);
    try {
      const res = await fetch(`/api/v1/subscription/validate-payment-report/${reportId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.matched) {
        setReportActionMessage({ type: 'success', text: `¡Validación Exitosa! Se acreditó el pago y se renovó la suscripción por 30 días.` });
        fetchPaymentReports();
        fetchSubscriptions();
      } else {
        setReportActionMessage({ type: 'warning', text: data.message || 'No se encontró la transferencia correspondiente en SIPAP aún.' });
      }
    } catch (err) {
      setReportActionMessage({ type: 'warning', text: 'Error al intentar validar.' });
    }
  };

  const handleSimulateTransfer = async () => {
    if (!token || !simulationPayer.trim()) return;
    setReportActionMessage(null);
    try {
      const res = await fetch(`/api/v1/subscription/simulate-incoming-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payerName: simulationPayer }),
      });
      if (res.ok) {
        setReportActionMessage({ type: 'success', text: `Transferencia entrante simulada en cuenta de Franco. Ahora hacé clic en 'Validar Recepción SIPAP'.` });
      }
    } catch (err) {
      setReportActionMessage({ type: 'warning', text: 'Error al simular la transferencia.' });
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
      <header className="border-b border-[#24324D] bg-[#151D2F] px-4 sm:px-8 py-3 h-auto min-h-16 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="font-bold text-white">CajaSegura — Panel de Administración</div>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => { setCreatedResult(null); setCreateError(null); setShowCreateModal(true); }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Comercio / Dueño Gratuito</span>
          </button>
          <div className="text-sm text-gray-400 hidden sm:block">{user?.email}</div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Payment Reports Card */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Reportes de Pagos de Suscripción (SIPAP)</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-[#0B0F19] p-2 rounded-xl border border-[#24324D]">
              <input
                type="text"
                value={simulationPayer}
                onChange={(e) => setSimulationPayer(e.target.value)}
                placeholder="Nombre del Pagador"
                className="bg-transparent border-none outline-none text-xs text-white px-2 w-full sm:w-40"
              />
              <button
                onClick={handleSimulateTransfer}
                className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
              >
                Simular Transferencia Bancaria (Demo)
              </button>
            </div>
          </div>
          
          {reportActionMessage && (
            <div className={`p-3 border rounded-xl text-xs font-medium ${reportActionMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {reportActionMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono">
                <tr>
                  <th className="p-3">Comercio</th>
                  <th className="p-3">Pagador Reportado</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24324D]">
                {paymentReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">No hay reportes de pago.</td>
                  </tr>
                ) : (
                  paymentReports.map(r => (
                    <tr key={r.id} className="hover:bg-[#1A253C]/40 transition-colors">
                      <td className="p-3 font-semibold text-white">{r.merchantName}</td>
                      <td className="p-3 text-gray-300 font-medium">{r.payerName}</td>
                      <td className="p-3 text-emerald-400 font-mono font-bold">Gs. 150.000</td>
                      <td className="p-3 text-gray-400">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="p-3">
                        {r.status === 'pending' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                            ⏳ Pendiente de Validación
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                            ✓ Acreditado (+30 Días)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleValidateReport(r.id)}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
                          >
                            🔍 Validar Recepción SIPAP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Solicitudes Queue */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Solicitudes de Alta</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
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
            <table className="w-full text-left text-xs min-w-[650px]">
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
                  if (s.isLifetime || s.status === 'lifetime') badge = <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">Gratis Permanente</span>;
                  else if (s.status === 'trial') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-500/20 text-blue-400">Trial</span>;
                  else if (s.status === 'active') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Activo</span>;
                  else if (s.status === 'past_due') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-red-500/20 text-red-400">Moroso</span>;
                  else if (s.status === 'cancelled') badge = <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-gray-500/20 text-gray-400">Cancelado</span>;

                  return (
                    <tr key={s.tenantId} className="hover:bg-[#1A253C]/40 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-white">{s.merchantName || 'Sin Nombre'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{s.tenantId}</div>
                      </td>
                      <td className="p-3">{badge}</td>
                      <td className="p-3 font-mono text-gray-300">
                        {s.isLifetime || s.status === 'lifetime' ? <span className="text-purple-300 font-bold">∞ Permanente</span> : s.daysRemaining}
                      </td>
                      <td className="p-3 text-gray-400">
                        {s.isLifetime || s.status === 'lifetime' ? <span className="text-purple-300">Sin vencimiento</span> : new Date(s.currentPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right flex items-center justify-end space-x-2">
                        {s.isLifetime || s.status === 'lifetime' ? (
                          <span className="text-xs text-purple-400 font-bold flex items-center space-x-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>Bonificado VIP</span>
                          </span>
                        ) : (
                          <>
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
                          </>
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

      {/* Modal: Crear Comercio Bonificado / Dueño Gratuito */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#0B0F19] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Crear Comercio Bonificado</h3>
                <p className="text-xs text-purple-300 font-medium">Plan Permanente Gratis (VIP / Muestra)</p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {createError}
              </div>
            )}

            {createdResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 text-xs">
                  <div className="text-emerald-400 font-bold text-sm flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>¡Comercio y Dueño Creados con Éxito!</span>
                  </div>
                  <div className="text-gray-300 pt-2 space-y-1">
                    <div><span className="text-gray-400 font-medium">Comercio:</span> <span className="text-white font-bold">{createdResult.merchantName}</span></div>
                    <div><span className="text-gray-400 font-medium">Email de Acceso:</span> <span className="text-white font-mono font-bold">{createdResult.ownerEmail}</span></div>
                    <div><span className="text-gray-400 font-medium">Plan:</span> <span className="text-purple-300 font-bold">Permanente Gratuito (100% Bonificado)</span></div>
                    <div className="pt-2">
                      <div className="text-gray-400 font-medium mb-1">Webhook Secret (para Google Script):</div>
                      <code className="block p-2 bg-[#0B0F19] rounded-lg text-emerald-300 font-mono text-[11px] break-all select-all">
                        {createdResult.webhookSecret}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Tu amiga ya puede ingresar directamente a <span className="text-white font-bold">https://cajasegura.com.py</span> con su email y la contraseña que le asignaste.
                </div>
                <button
                  onClick={() => { setShowCreateModal(false); setCreatedResult(null); }}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateFreeMerchant} className="space-y-4">
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-[11px] text-purple-300 leading-relaxed">
                  💡 Este comercio no tendrá alertas de pago, días de prueba ni requerimientos de transferencias bancarias. Su acceso será permanente y 100% libre.
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Nombre del Comercio / Negocio *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Farmacia San José o Kiosko Lili"
                    value={createForm.businessName}
                    onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Nombre del Dueño / Amiga *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura Benítez"
                    value={createForm.ownerName}
                    onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Email de Acceso *</label>
                    <input
                      type="email"
                      required
                      placeholder="amiga@farmacia.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Contraseña Inicial *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contraseña segura"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Ciudad (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Asunción"
                      value={createForm.city}
                      onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Teléfono (Opcional)</label>
                    <input
                      type="text"
                      placeholder="0981xxxxxx"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#24324D]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#0B0F19] hover:bg-[#1E293B] text-gray-400 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCreate}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                  >
                    {isSubmittingCreate ? 'Creando...' : 'Crear Comercio Permanente'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
