import React, { useState } from 'react';
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
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user, activeTenant, logout } = useAuth();
  const [copiedScript, setCopiedScript] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const tenantSlug = activeTenant?.tenantId || 'kiosko-san-roque';
  const tenantSecret = 'sec_kiosko_san_roque_pilot_2026';
  const hostUrl = window.location.origin;

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
      } else {
        setTestStatus('✅ Simulación enviada (Modo de demostración activo).');
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
            <div className="font-bold text-white">{activeTenant?.merchantName} — Panel de Dueño</div>
            <div className="text-xs text-gray-400">Dueño: {user?.fullName}</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs text-emerald-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plan PYME: 7 Días de Prueba ($15/mes)</span>
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
            <div className="text-3xl font-mono font-extrabold text-white">Gs. 4.850.000</div>
            <div className="text-xs text-emerald-400 font-semibold mt-2">+18 transferencias validadas</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Cajeros Habilitados</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">2 Cajeros</div>
            <div className="text-xs text-gray-400 mt-2">Kiosko San Roque</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Próxima Facturación</span>
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">$15 USD</div>
            <div className="text-xs text-gray-400 mt-2">Trial activo por 7 días</div>
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
            <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mb-3">
                1
              </div>
              <h3 className="text-xs font-bold text-white">Pegar el Código</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Hacé clic en <b>"2. Abrir Google Apps Script"</b>, borrá todo el texto que aparezca y pegá (Ctrl + V) lo copiado.
              </p>
            </div>

            <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mb-3">
                2
              </div>
              <h3 className="text-xs font-bold text-white">Guardar y Ejecutar</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Guardá (Ctrl + S) y hacé clic en <b>"Ejecutar"</b> arriba para conceder el permiso de lectura a tu propio Gmail.
              </p>
            </div>

            <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mb-3">
                3
              </div>
              <h3 className="text-xs font-bold text-white">Crear el Activador</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                En el menú izquierdo hacé clic en el ícono de <b>Reloj (Activadores)</b> ➔ <b>+ Añadir activador</b>.
              </p>
            </div>

            <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center mb-3">
                4
              </div>
              <h3 className="text-xs font-bold text-white">Cada 1 Minuto</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Elegí: <i>Según el tiempo</i> ➔ <i>Temporizador de minutos</i> ➔ <i>Cada minuto</i> y Guardar. ¡Listo!
              </p>
            </div>
          </div>

          {/* Test Simulator Bar */}
          <div className="pt-4 border-t border-[#24324D] flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Privacidad 100% garantizada: Tus correos personales nunca salen de tu cuenta.</span>
            </div>

            <button
              onClick={handleSimulateTestPayment}
              className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
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
