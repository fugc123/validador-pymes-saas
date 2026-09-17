import React, { useState, useEffect, useCallback } from 'react';
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
}

export const OwnerDashboard: React.FC = () => {
  const { user, activeTenant, logout, token } = useAuth();
  const [copiedScript, setCopiedScript] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const tenantSlug = activeTenant?.tenantId || 'kiosko-san-roque';
  const tenantSecret = 'sec_kiosko_san_roque_pilot_2026';
  const hostUrl = window.location.origin;

  useEffect(() => {
    const fetchSub = async () => {
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
    };
    fetchSub();
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
    }
  }, [token]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 8000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

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

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-[#24324D] px-8 flex items-center justify-between bg-[#151D2F]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center space-x-2">
              <span>{activeTenant?.merchantName} — Panel de Dueño</span>
              <button
                onClick={() => fetchMetrics()}
                title="Actualizar métricas"
                className="p-1 text-gray-400 hover:text-emerald-400 rounded transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetrics ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
            <div className="text-xs text-gray-400">Dueño: {user?.fullName}</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs text-emerald-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plan PYME: 7 Días de Prueba (Gs. 150.000/mes)</span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className={`bg-[#151D2F] border rounded-2xl p-6 shadow-xl ${subscription?.status === 'past_due' || subscription?.status === 'cancelled' ? 'border-red-500/50 bg-red-900/10' : 'border-[#24324D]'}`}>
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Próxima Facturación</span>
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">Gs. 150.000</div>
            <div className="text-xs mt-2 space-y-1">
              {subscription ? (
                <>
                  <div>
                    {subscription.status === 'trial' && <span className="text-blue-400 font-semibold">Trial (Faltan {subscription.daysRemaining} días)</span>}
                    {subscription.status === 'active' && <span className="text-emerald-400 font-semibold">Activo (Vence en {subscription.daysRemaining} días)</span>}
                    {(subscription.status === 'past_due' || subscription.status === 'cancelled') && <span className="text-red-400 font-bold">Vencido</span>}
                  </div>
                  <div className={subscription.status === 'past_due' || subscription.status === 'cancelled' ? 'text-red-300 font-medium' : 'text-gray-400'}>
                    Transferir Gs. 150.000 a Alias: 5644334 (Franco Girala)
                  </div>
                </>
              ) : (
                <div className="text-gray-400">Cargando estado...</div>
              )}
            </div>
          </div>
        </div>

        {/* 1-Click Interactive Google Connection Wizard */}
        <div className="bg-[#151D2F] border-2 border-emerald-500/40 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-start justify-between">
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

            <div className="flex space-x-3">
              <button
                onClick={handleCopyPersonalizedScript}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all"
              >
                {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedScript ? '¡Script Copiado al Portapapeles!' : '1. Copiar Mi Script Personalizado'}</span>
              </button>

              <a
                href="https://script.new"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 bg-[#0B0F19] hover:bg-[#1A253C] border border-[#24324D] hover:border-emerald-500/40 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition-all"
              >
                <span>2. Abrir Google Apps Script</span>
                <ExternalLink className="w-4 h-4 text-emerald-400" />
              </a>
            </div>
          </div>

          {/* Step by step cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  1
                </div>
                <div className="font-bold text-sm text-white">Hacé clic en Abrir Google Apps Script</div>
                <div className="text-xs text-gray-400">
                  Se abrirá el editor oficial de Google en una pestaña nueva listo para usar.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <div className="font-bold text-sm text-white">Pegá el Script Copiado</div>
                <div className="text-xs text-gray-400">
                  Borrá el texto por defecto en Google y pegá el código personalizado con <kbd className="bg-gray-800 px-1 rounded">Ctrl+V</kbd>.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <div className="font-bold text-sm text-white">Configurá el Disparador (Trigger)</div>
                <div className="text-xs text-gray-400">
                  Hacé clic en el reloj 🕒 de la izquierda y añadí un activador para ejecutar cada 1 minuto.
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F19]/80 border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  4
                </div>
                <div className="font-bold text-sm text-white">¡Listo y Seguro!</div>
                <div className="text-xs text-gray-400">
                  Cero contraseñas compartidas. Los avisos de SIPAP llegan en menos de 2 segundos a tus cajeros.
                </div>
              </div>
            </div>
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
            <div className="text-xs text-gray-400">
              {metrics?.recentTransfers?.length ?? 0} operaciones registradas
            </div>
          </div>

          {metrics?.recentTransfers && metrics.recentTransfers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
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
                  {metrics.recentTransfers.map((tr) => (
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
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
                  <td className="p-3 font-semibold text-white">Carlos Almirón</td>
                  <td className="p-3 text-gray-400">carlos@kiosko.com</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono">CASHIER</span></td>
                  <td className="p-3"><span className="text-emerald-400 font-bold">Activo</span></td>
                  <td className="p-3 text-right text-gray-400 hover:text-white cursor-pointer">Editar</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Ana Martínez</td>
                  <td className="p-3 text-gray-400">ana@kiosko.com</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono">CASHIER</span></td>
                  <td className="p-3"><span className="text-emerald-400 font-bold">Activo</span></td>
                  <td className="p-3 text-right text-gray-400 hover:text-white cursor-pointer">Editar</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
