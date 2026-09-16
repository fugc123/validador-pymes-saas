import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Store, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';

export const LoginView: React.FC<{ onNavigateToRegister: () => void }> = ({ onNavigateToRegister }) => {
  const { login, isSelectingTenant, availableMemberships, selectTenant } = useAuth();
  const [email, setEmail] = useState('franco@kiosko.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } finally {
      setLoading(false);
    }
  };

  if (isSelectingTenant) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Elegí tu Comercio</h2>
              <p className="text-xs text-gray-400">Tenés acceso a múltiples organizaciones (ADR-008)</p>
            </div>
          </div>

          <div className="space-y-3">
            {availableMemberships.map((m) => (
              <button
                key={m.tenantId}
                onClick={() => selectTenant(m.tenantId)}
                className="w-full text-left p-4 rounded-xl bg-[#0B0F19] hover:bg-[#1A253C] border border-[#24324D] hover:border-emerald-500/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {m.merchantName}
                  </div>
                  <div className="text-xs font-mono text-gray-400">
                    Rol: <span className="text-emerald-400 font-semibold">{m.role}</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0F19]">
      <div className="max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-4 shadow-lg shadow-emerald-500/5">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Validador PYME</h1>
          <p className="text-sm text-gray-400 mt-2">
            Verificación SIPAP en tiempo real & Anti-Replay para Comercios
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="ejemplo@comercio.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-11 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Ingresando...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#24324D] text-center">
            <p className="text-xs text-gray-400">¿Todavía no tenés el Validador en tu local?</p>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center space-x-1"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span>Solicitar prueba gratuita de 7 días ($15/mes)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
