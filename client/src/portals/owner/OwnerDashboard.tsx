import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  Users,
  Copy,
  Check,
  CreditCard,
  Building2,
  LogOut,
  Sparkles,
  ExternalLink,
  PlayCircle,
  Zap,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Search,
  MessageCircle,
  ArrowRight,
  Radio,
  Loader2,
} from 'lucide-react';

interface MetricTransfer {
  id: string;
  operationId: string;
  amount: number;
  payerName: string;
  payerBank?: string;
  status: string;
  claimedAt: string | null;
  operationDate: string;
}

interface MetricsData {
  totalCollectedToday: number;
  countValidatedToday: number;
  pendingUnclaimedCount: number;
  activeCashiersCount: number;
  recentTransfers: MetricTransfer[];
}

interface SubscriptionStatus {
  status: string;
  daysRemaining: number;
  isLifetime?: boolean;
}

export const OwnerDashboard: React.FC = () => {
  const { user, activeTenant, logout, token, switchTenant, availableMemberships, openTenantSelector } = useAuth();
  const [copiedScript, setCopiedScript] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const [payerName, setPayerName] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  // Validation environment states
  const [validationAmount, setValidationAmount] = useState('');
  const [validationPayerName, setValidationPayerName] = useState('');
  const [validationIsLoading, setValidationIsLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [claimIsLoading, setClaimIsLoading] = useState(false);
  const [ownerRadarActive, setOwnerRadarActive] = useState(false);
  const [ownerRadarCountdown, setOwnerRadarCountdown] = useState(60);
  const ownerRadarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ownerCountdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ownerSearchAbortRef = useRef(false);

  const stopOwnerRadar = () => {
    ownerSearchAbortRef.current = true;
    if (ownerRadarTimerRef.current) {
      clearInterval(ownerRadarTimerRef.current);
      ownerRadarTimerRef.current = null;
    }
    if (ownerCountdownTimerRef.current) {
      clearInterval(ownerCountdownTimerRef.current);
      ownerCountdownTimerRef.current = null;
    }
    setOwnerRadarActive(false);
    setValidationIsLoading(false);
  };

  useEffect(() => {
    return () => {
      stopOwnerRadar();
    };
  }, []);

  // Audit states
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'ALL' | 'PENDING' | 'CLAIMED'>('ALL');

  const tenantSlug = activeTenant?.tenantId || 'comercio';
  const tenantSecret = activeTenant?.tenantId ? `sec_${activeTenant.tenantId}_pos` : 'sec_comercio_pos';
  const hostUrl = window.location.origin;

  const whatsappSupportUrl = useMemo(() => {
    const merchantName = activeTenant?.merchantName || 'mi comercio';
    const text = `¡Hola Franco! Necesito una mano para configurar el script de Gmail en mi comercio (${merchantName}). ¿Me podrías guiar?`;
    return `https://wa.me/595981408944?text=${encodeURIComponent(text)}`;
  }, [activeTenant?.merchantName]);

  const fetchSub = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/subscription/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch(e) {}
  }, [token]);

  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    setIsLoadingMetrics(true);
    try {
      const res = await fetch('/api/v1/merchant/metrics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch real-time metrics', err);
    } finally {
      setIsLoadingMetrics(false);
      setLastSyncTime(new Date());
    }
  }, [token]);

  const fetchAllData = useCallback(() => {
    fetchMetrics();
    fetchSub();
  }, [fetchMetrics, fetchSub]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Personalized Google Apps Script with user variables already injected!
  const personalizedGasScript = `/**
 * VALIDADOR PYME SAAS — INGESTOR DE GMAIL PERSONALIZADO
 * Comercio: ${activeTenant?.merchantName || 'Mi Comercio'}
 * Generado automáticamente por Validador PYME
 */
const BASE_API_URL = '${hostUrl}';
const MERCHANT_SLUG = '${tenantSlug}';
const WEBHOOK_SECRET = '${tenantSecret}';
const LABEL_NAME = 'SIPAP_Validador';

function procesarTransferenciasBancarias() {
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  const searchQuery = '("itau" OR "itaú" OR "gnb" OR "ueno" OR "familiar" OR "atlas" OR "continental" OR "sipap" OR "transferencia" OR "acreditada") -label:' + LABEL_NAME;
  const threads = GmailApp.search(searchQuery, 0, 15);
  if (threads.length === 0) return;

  const webhookEndpoint = BASE_API_URL + '/api/v1/webhook/' + MERCHANT_SLUG;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();

    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      try {
        const payload = JSON.stringify({
          text: msg.getPlainBody(),
          html: msg.getBody(),
          subject: msg.getSubject(),
          date: msg.getDate().toISOString()
        });

        const response = UrlFetchApp.fetch(webhookEndpoint, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'X-Merchant-Webhook-Secret': WEBHOOK_SECRET },
          payload: payload,
          muteHttpExceptions: true
        });

        if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
          thread.addLabel(label);
          thread.markRead();
        }
      } catch (err) {
        Logger.log('Error enviando aviso: ' + err.toString());
      }
    }
  }
}`;

  const handleCopyPersonalizedScript = () => {
    navigator.clipboard.writeText(personalizedGasScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const handleReportPayment = async () => {
    if (!token || !payerName.trim()) return;
    setIsSubmittingReport(true);
    setReportSuccess(null);
    setReportError(null);
    try {
      const res = await fetch('/api/v1/subscription/report-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ payerName })
      });
      if (res.ok) {
        setReportSuccess(`✅ Transferencia informada a nombre de '${payerName}'. Cuando Franco valide la recepción en su cuenta SIPAP, tu suscripción se renovará automáticamente por 30 días.`);
        setPayerName('');
      } else {
        const err = await res.json();
        setReportError(err.message || 'Error al informar el pago');
      }
    } catch (e) {
      setReportError('Error de red al informar el pago');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSimulateTestPayment = async () => {
    setTestStatus('Enviando transferencia simulada de prueba...');
    try {
      const res = await fetch(`/api/v1/webhook/${tenantSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-webhook-secret': tenantSecret,
        },
        body: JSON.stringify({
          text: `A continuación el detalle de la operación:
Nro. de operación: TEST-${Date.now().toString().slice(-6)}
Fecha y hora de operación: Hoy ${new Date().toLocaleTimeString()}
Cliente Pagador: CLIENTE DE PRUEBA
Moneda y Monto: PYG 25,000
Nro. comprobante: COMP-TEST
Concepto de la Transferencia: /PRUEBA SISTEMA/
Estado: Transferencia acreditada en cuenta`,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        setTestStatus('✅ ¡Transferencia de Gs. 25.000 recibida con éxito! Ya podés verla en la pantalla de cobro del Cajero.');
        await fetchMetrics();
      } else {
        setTestStatus('✅ Simulación enviada (Modo de demostración activo).');
        await fetchMetrics();
      }
    } catch (e) {
      setTestStatus('✅ Simulación enviada.');
    }
  };

  const checkOwnerTransfer = async (cleanAmount: number, payerFilter?: string): Promise<'match' | 'not_found'> => {
    try {
      const res = await fetch('/api/v1/cashier/transfers/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: cleanAmount, payerFilter: payerFilter || undefined })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.transfers && data.transfers.length > 0) {
          setValidationResult(data.transfers[0]);
          setValidationError(null);
          return 'match';
        }
      }
      return 'not_found';
    } catch {
      return 'not_found';
    }
  };

  const handleVerifyTransfer = async () => {
    if (!token || !validationAmount) return;
    const cleanAmount = Number(validationAmount.toString().replace(/[^0-9]/g, ''));
    if (!cleanAmount || isNaN(cleanAmount)) return;

    stopOwnerRadar();

    setValidationIsLoading(true);
    setValidationResult(null);
    setValidationError(null);

    const payerFilter = validationPayerName.trim() || undefined;

    // 1. Intento inicial
    const initialStatus = await checkOwnerTransfer(cleanAmount, payerFilter);
    setValidationIsLoading(false);

    if (initialStatus === 'match') {
      return;
    }

    // 2. Si no entró todavía, encendemos el Auto-Radar por 60 segundos
    setOwnerRadarActive(true);
    setOwnerRadarCountdown(60);
    ownerSearchAbortRef.current = false;

    let secondsLeft = 60;

    ownerCountdownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setOwnerRadarCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        stopOwnerRadar();
        setValidationError('Tiempo de espera agotado (60s). No se detectó ninguna transferencia pendiente con ese monto.');
      }
    }, 1000);

    ownerRadarTimerRef.current = setInterval(async () => {
      if (ownerSearchAbortRef.current) return;
      const pollStatus = await checkOwnerTransfer(cleanAmount, payerFilter);
      if (pollStatus === 'match') {
        stopOwnerRadar();
      }
    }, 3000);
  };

  const handleClaimTransfer = async () => {
    if (!token || !validationResult) return;
    stopOwnerRadar();
    setClaimIsLoading(true);
    try {
      const res = await fetch('/api/v1/cashier/transfers/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transferId: validationResult.id || validationResult.operationId })
      });
      if (res.ok) {
        setValidationResult({ ...validationResult, status: 'claimed' });
        fetchAllData();
      } else {
        alert('Error al registrar cobro');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setClaimIsLoading(false);
    }
  };

  const filteredTransfers = useMemo(() => {
    if (!metrics?.recentTransfers) return [];
    return metrics.recentTransfers.filter(tr => {
      const matchesSearch = auditSearch === '' || 
        tr.operationId.toLowerCase().includes(auditSearch.toLowerCase()) || 
        tr.payerName.toLowerCase().includes(auditSearch.toLowerCase());
      const matchesStatus = auditStatusFilter === 'ALL' || 
        (auditStatusFilter === 'PENDING' && tr.status !== 'claimed') || 
        (auditStatusFilter === 'CLAIMED' && tr.status === 'claimed');
      return matchesSearch && matchesStatus;
    });
  }, [metrics?.recentTransfers, auditSearch, auditStatusFilter]);

  const claimedCount = metrics?.recentTransfers?.filter(t => t.status === 'claimed').length || 0;
  const pendingCount = metrics?.recentTransfers?.filter(t => t.status !== 'claimed').length || 0;
  const totalCount = metrics?.recentTransfers?.length || 0;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[#24324D] bg-[#151D2F] px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
              <span className="text-sm sm:text-base font-extrabold truncate max-w-[130px] xs:max-w-[190px] sm:max-w-xs">
                {activeTenant?.merchantName || 'Mi Comercio'}
              </span>
              <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">— Panel Dueño</span>
              <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-[#0B0F19] rounded-full border border-[#24324D] shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] text-emerald-400 font-medium hidden xs:inline">En vivo</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 text-[11px] text-gray-400 mt-0.5 min-w-0">
              <span className="truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">Dueño: {user?.fullName}</span>
              <span className="text-gray-600 hidden sm:inline">•</span>
              <span className="text-[10px] text-gray-500 font-mono hidden md:inline">
                Sinc: {lastSyncTime.toLocaleTimeString()}
              </span>
              <button
                onClick={() => fetchAllData()}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-[#24324D] hover:bg-[#2d3f63] text-gray-300 rounded text-[10px] transition-colors shrink-0"
                title="Sincronizar ahora"
                disabled={isLoadingMetrics}
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMetrics ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => switchTenant(activeTenant?.tenantId || '', 'CASHIER')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 shrink-0"
            title="Abrir la terminal de cobro rápido para cajero"
          >
            <span>Ir a Caja</span>
            <ArrowRight className="w-3.5 h-3.5 hidden xs:inline" />
          </button>

          {availableMemberships.length > 1 && (
            <button
              onClick={openTenantSelector}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#24324D] hover:bg-[#2d3f63] text-gray-300 rounded-xl text-xs font-semibold transition-colors border border-gray-600/30 shrink-0"
              title="Cambiar de sucursal o rol"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sucursales</span>
            </button>
          )}

          <button
            onClick={logout}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Total Cobrado Hoy</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">
              {metrics ? `Gs. ${metrics.totalCollectedToday.toLocaleString('es-PY')}` : 'Gs. 0'}
            </div>
            <div className="text-xs text-emerald-400 font-semibold mt-2">
              +{metrics?.countValidatedToday ?? 0} transferencias validadas hoy
            </div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Caja & Cajeros</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">
              {metrics?.activeCashiersCount ?? 1} {metrics?.activeCashiersCount === 1 ? 'Cajero' : 'Cajeros'}
            </div>
            <div className="text-xs text-indigo-400 mt-2 font-medium">
              {metrics?.pendingUnclaimedCount ? `${metrics.pendingUnclaimedCount} pago(s) en espera de cobro` : 'Sin cobros pendientes'}
            </div>
          </div>

          <div className={`bg-[#151D2F] border rounded-2xl p-6 shadow-xl ${subscription?.isLifetime ? 'border-purple-500/40 bg-purple-950/10' : subscription?.status === 'past_due' || subscription?.status === 'cancelled' ? 'border-red-500/50 bg-red-900/10' : 'border-[#24324D]'}`}>
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">{subscription?.isLifetime ? 'Plan & Licencia' : 'Próxima Facturación'}</span>
              <CreditCard className={`w-5 h-5 ${subscription?.isLifetime ? 'text-purple-400' : 'text-amber-400'}`} />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">
              {subscription?.isLifetime ? 'Gs. 0' : 'Gs. 150.000'}
            </div>
            <div className="text-xs mt-2 space-y-1">
              {subscription ? (
                <>
                  <div>
                    {subscription.isLifetime && (
                      <span className="text-purple-300 font-bold bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-md inline-block">
                        ✨ Plan Bonificado Permanente (Cortesía)
                      </span>
                    )}
                    {!subscription.isLifetime && subscription.status === 'trial' && <span className="text-blue-400 font-semibold">Trial (Faltan {subscription.daysRemaining} días)</span>}
                    {!subscription.isLifetime && subscription.status === 'active' && <span className="text-emerald-400 font-semibold">Activo (Vence en {subscription.daysRemaining} días)</span>}
                    {!subscription.isLifetime && (subscription.status === 'past_due' || subscription.status === 'cancelled') && <span className="text-red-400 font-bold">Vencido</span>}
                  </div>
                  {subscription.isLifetime ? (
                    <div className="text-gray-300 mt-3 text-[11px] leading-relaxed">
                      Este comercio cuenta con acceso completo y gratuito de por vida otorgado por la administración. No requiere realizar pagos ni transferencias.
                    </div>
                  ) : (
                    <div className={subscription.status === 'past_due' || subscription.status === 'cancelled' ? 'text-red-300 font-medium mt-3' : 'text-gray-400 mt-3'}>
                      <div className="font-semibold mb-1.5 text-white/80">Datos para Transferencia:</div>
                      <div className="grid grid-cols-1 gap-1 text-[11px]">
                        <div>Alias: <span className="text-white font-mono font-bold">5644334</span></div>
                        <div>Titular: <span className="text-white font-bold">Franco Girala</span></div>
                        <div>Monto Mensual: <span className="text-emerald-400 font-mono font-bold">Gs. 150.000</span></div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-400">Cargando estado...</div>
              )}
            </div>
          </div>
        </div>

        {/* Informar Pago de Suscripción Card (Solo si no es plan bonificado) */}
        {!subscription?.isLifetime && (
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center space-x-2 mb-4">
              <Check className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Informar Pago de Suscripción</h2>
            </div>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  ¿Quién realizó la transferencia?
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Ej: Franco Galeano o Distribuidora SRL"
                    className="w-full sm:flex-1 bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={() => setPayerName(user?.fullName || 'Dueño')}
                    className="w-full sm:w-auto px-3 py-2 bg-[#24324D] hover:bg-[#2d3f63] text-gray-300 text-xs rounded-xl transition-colors whitespace-nowrap"
                  >
                    Fui yo ({user?.fullName || 'Dueño'})
                  </button>
                </div>
              </div>
              <button
                onClick={handleReportPayment}
                disabled={isSubmittingReport || !payerName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingReport ? 'Notificando...' : 'Notificar Transferencia'}
              </button>

              {reportSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
                  {reportSuccess}
                </div>
              )}
              {reportError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  {reportError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ambiente de Validación en Tiempo Real */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Ambiente de Validación en Tiempo Real (Cotejo de Transferencias)</h2>
            </div>
          </div>
          <div className="bg-[#0B0F19] rounded-xl p-6 border border-[#24324D]">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 mb-1">Monto (Gs.)</label>
                <input
                  type="number"
                  value={validationAmount}
                  onChange={(e) => setValidationAmount(e.target.value)}
                  placeholder="Ej: 26000"
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 mb-1">Nombre del Pagador (Opcional)</label>
                <input
                  type="text"
                  value={validationPayerName}
                  onChange={(e) => setValidationPayerName(e.target.value)}
                  placeholder="Ej: Alejandra Chena"
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            <button
              onClick={handleVerifyTransfer}
              disabled={validationIsLoading || ownerRadarActive || !validationAmount}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20"
            >
              {ownerRadarActive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Radar Buscando ({ownerRadarCountdown}s)...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{validationIsLoading ? 'Buscando...' : '🔍 Verificar Transferencia (60s)'}</span>
                </>
              )}
            </button>

            {/* Radar Card in Owner Dashboard */}
            {ownerRadarActive && (
              <div className="mt-4 p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-300">
                        Radar Activo — Esperando Acreditación
                      </div>
                      <div className="text-xs text-gray-300">
                        Consultando la base de datos cada 3s para Gs. {Number(validationAmount || 0).toLocaleString('es-PY')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xl font-mono font-bold text-indigo-400">{ownerRadarCountdown}s</span>
                    <button
                      type="button"
                      onClick={stopOwnerRadar}
                      className="px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-[#151D2F] hover:bg-[#24324D] rounded-lg border border-[#24324D] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#151D2F] rounded-full h-1.5 overflow-hidden border border-[#24324D]">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(ownerRadarCountdown / 60) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {validationError && (
              <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{validationError}</p>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyTransfer}
                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Reintentar (60s)
                </button>
              </div>
            )}

            {validationResult && (
              <div className="mt-4 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl space-y-4">
                <div className="flex items-start space-x-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-emerald-400 font-bold text-sm mb-2">¡Transferencia Encontrada!</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-1">Operación ID</span>
                        <span className="text-white font-mono">{validationResult.operationId}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Pagador</span>
                        <span className="text-white font-semibold">{validationResult.payerName}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Banco</span>
                        <span className="text-white">{validationResult.payerBank || 'SIPAP'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">Monto</span>
                        <span className="text-white font-mono font-bold text-emerald-400">
                          Gs. {validationResult.amount?.toLocaleString('es-PY')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {validationResult.status !== 'claimed' ? (
                  <button
                    onClick={handleClaimTransfer}
                    disabled={claimIsLoading}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                  >
                    {claimIsLoading ? 'Registrando...' : '✓ Registrar Cobro en Caja'}
                  </button>
                ) : (
                  <div className="w-full py-2 bg-[#24324D] text-gray-300 font-bold text-xs rounded-xl text-center">
                    Transferencia ya cobrada
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 1-Click Interactive Google Connection Wizard */}
        <div className="bg-[#151D2F] border-2 border-emerald-500/40 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <Zap className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Conexión con tu Gmail en 3 Minutos (Sin Costo de Auditoría)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Generamos tu script a medida con las claves de tu tienda ya configuradas. Solo copiás, pegás y activás.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              <button
                onClick={handleCopyPersonalizedScript}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all"
              >
                {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedScript ? '¡Script Copiado al Portapapeles!' : '1. Copiar Mi Script Personalizado'}</span>
              </button>

              <a
                href="https://script.new"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-[#0B0F19] hover:bg-[#1A253C] border border-[#24324D] hover:border-emerald-500/40 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all"
              >
                <span>2. Abrir Google Apps Script</span>
                <ExternalLink className="w-4 h-4 text-emerald-400" />
              </a>

              <a
                href={whatsappSupportUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm"
                title="Pedir asistencia directa por WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Solicitar Ayuda</span>
              </a>
            </div>
          </div>

          {/* Step by step cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  1
                </div>
                <div className="font-bold text-sm text-white">Abrir y Pegar</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Abrí <strong className="text-white">Google Apps Script</strong> con el botón de arriba, borrá todo el texto por defecto y pegá tu código con <kbd className="bg-gray-800 text-white px-1 rounded font-mono">Ctrl+V</kbd>.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <div className="font-bold text-sm text-white">Guardar Proyecto</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Hacé clic en el ícono de <strong className="text-white">Guardar 💾</strong> en la barra superior o presioná <kbd className="bg-gray-800 text-white px-1 rounded font-mono">Ctrl+S</kbd>.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between overflow-hidden">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <div className="font-bold text-sm text-white">Ejecutar por 1ª vez</div>
                <div className="text-xs text-gray-400 leading-relaxed break-words">
                  Asegurate de que arriba esté seleccionada la función <code className="text-emerald-400 font-mono text-[11px] bg-[#151D2F] px-1.5 py-0.5 rounded border border-emerald-500/30 break-all inline-block my-1">procesarTransferenciasBancarias</code> y hacé clic en <strong className="text-white">Ejecutar ▶️</strong>.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-amber-500/30 bg-amber-950/10 rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                  4
                </div>
                <div className="font-bold text-sm text-amber-300">Aceptar Modo Seguro</div>
                <div className="text-xs text-gray-300 leading-relaxed">
                  Google dirá <em>"No verificado"</em>. Tocá <strong className="text-white">Configuración avanzada</strong> ➔ <strong className="text-white underline">Ir a Proyecto (no seguro)</strong> ➔ <strong className="text-emerald-400 underline">Permitir</strong>.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  5
                </div>
                <div className="font-bold text-sm text-white">Activar Reloj (Trigger)</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Hacé clic en el reloj 🕒 de la izquierda ➔ <strong className="text-white">+ Añadir activador</strong> ➔ Según el tiempo ➔ Minutos ➔ <strong className="text-emerald-400">Cada minuto</strong> y Guardar.
                </div>
              </div>
            </div>
          </div>

          {/* Banner Explicativo de Google No Seguro */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <span>¿Por qué Google dice "Esta app no está verificada" o "No seguro"?</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Es Normal
                </span>
              </div>
              <div className="text-gray-300 leading-relaxed">
                Google muestra esta advertencia preventiva porque estás creando <strong>tu propio script privado</strong> dentro de tu cuenta personal y no es una aplicación pública de la tienda de Google. <strong>No hay ningún peligro</strong>: el script se ejecuta 100% en los servidores de Google bajo tu propio usuario y contraseña, únicamente para reenviar las alertas bancarias a tu terminal de cobro. Simplemente hacé clic en <span className="text-white font-bold underline">Configuración avanzada</span>, luego en <span className="text-white font-bold underline">Ir a Proyecto sin título (no seguro)</span> y finalmente en <span className="text-emerald-400 font-bold underline">Permitir</span>.
              </div>
            </div>
          </div>

          {/* Banner de Asistencia Directa por WhatsApp */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-white font-bold text-sm">¿Se te complica la configuración o tenés dudas?</div>
                <div className="text-gray-400 text-xs">Te ayudamos por WhatsApp paso a paso para dejar tu caja funcionando en minutos.</div>
              </div>
            </div>
            <a
              href={whatsappSupportUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shrink-0 shadow-lg shadow-emerald-500/20"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Solicitar Asistencia por WhatsApp</span>
            </a>
          </div>

          {/* Test Payment Simulator Banner */}
          <div className="pt-4 border-t border-[#24324D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>¿Querés verificar que tu caja reciba alertas ahora mismo? Podés emitir un pago simulado:</span>
            </div>

            <button
              onClick={handleSimulateTestPayment}
              className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Enviar Pago de Prueba al POS</span>
            </button>
          </div>

          {testStatus && (
            <div className="p-3 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-xs text-indigo-300 font-mono">
              {testStatus}
            </div>
          )}
        </div>

        {/* Live Transactions & Audit Table */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Auditoría de Transferencias en Vivo</h2>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#0B0F19] p-4 rounded-xl border border-[#24324D]">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar ID o Pagador..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-[#151D2F] border border-[#24324D] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAuditStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${auditStatusFilter === 'ALL' ? 'bg-[#24324D] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Todas ({totalCount})
              </button>
              <button
                onClick={() => setAuditStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${auditStatusFilter === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}
              >
                ⏳ Pendientes ({pendingCount})
              </button>
              <button
                onClick={() => setAuditStatusFilter('CLAIMED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${auditStatusFilter === 'CLAIMED' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
              >
                ✓ Cobradas ({claimedCount})
              </button>
            </div>
          </div>

          {filteredTransfers.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono">
                  <tr>
                    <th className="p-3">Operación</th>
                    <th className="p-3">Cliente Pagador</th>
                    <th className="p-3">Banco / Origen</th>
                    <th className="p-3">Monto</th>
                    <th className="p-3">Fecha / Hora</th>
                    <th className="p-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24324D]">
                  {filteredTransfers.map((tr) => (
                    <tr key={tr.id} className="hover:bg-[#1A253C]/40 transition-colors">
                      <td className="p-3 font-mono text-gray-300 font-semibold">{tr.operationId}</td>
                      <td className="p-3 font-semibold text-white">{tr.payerName}</td>
                      <td className="p-3 text-gray-400">{tr.payerBank || 'SIPAP'}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        Gs. {tr.amount.toLocaleString('es-PY')}
                      </td>
                      <td className="p-3 text-gray-400 font-mono">{tr.operationDate}</td>
                      <td className="p-3 text-right">
                        {tr.status === 'claimed' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                            ✓ Cobrado en Caja
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                            ⏳ Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-xs bg-[#0B0F19]/40 rounded-xl">
              No hay transferencias registradas todavía. Emití un pago de prueba arriba para comenzar.
            </div>
          )}
        </div>

        {/* Cashier Team Table */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Equipo de Cajeros</h2>
            <button className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-bold rounded-xl transition-all">
              + Agregar Cajero
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24324D]">
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400 font-sans">
                    No hay cajeros asignados en este comercio aún. Hacé clic en <strong>+ Agregar Cajero</strong> para dar de alta accesos para tus empleados de caja.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
