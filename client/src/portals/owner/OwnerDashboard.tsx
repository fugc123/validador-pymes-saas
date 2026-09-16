import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  Users,
  Copy,
  Check,
  CreditCard,
  Building2,
  Calendar,
  LogOut,
  Sparkles,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { user, activeTenant, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const webhookUrl = `https://validador.saas/api/v1/webhook/${activeTenant?.tenantId || 'kiosko-san-roque'}`;
  const webhookSecret = 'sec_crypto_32byte_token_for_gas';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <span>Suscripción: Plan PYME $15/mes (Activo)</span>
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
            <div className="text-xs text-emerald-400 font-semibold mt-2">+18 transferencias SIPAP</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Cajeros Activos</span>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">3 Cajeros</div>
            <div className="text-xs text-gray-400 mt-2">Operando en simultáneo</div>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between text-gray-400 mb-3">
              <span className="text-xs uppercase font-extrabold tracking-wider">Próxima Facturación</span>
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">$15 USD</div>
            <div className="text-xs text-gray-400 mt-2">Vence: 16 de Octubre, 2026</div>
          </div>
        </div>

        {/* Webhook & Ingestion Integration Box */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-2">Conexión con Google Apps Script (Bancos)</h2>
          <p className="text-xs text-gray-400 mb-4">
            Pegá esta URL y el Secret en el script de Gmail de tu comercio para recibir transferencias de Itaú, GNB, UENO, Familiar, Atlas y Continental.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Tu Webhook URL dedicado:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-xs font-mono text-emerald-400"
                />
                <button
                  onClick={handleCopyWebhook}
                  className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">X-Merchant-Webhook-Secret:</label>
              <input
                type="password"
                readOnly
                value={webhookSecret}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-xs font-mono text-gray-300"
              />
            </div>
          </div>
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
