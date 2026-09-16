import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, ArrowLeft, Send } from 'lucide-react';

export const PublicRegisterScreen: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: 'Asunción',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#151D2F] border border-[#24324D] rounded-2xl p-8 shadow-2xl">
        <button
          onClick={onBackToLogin}
          className="text-xs text-gray-400 hover:text-white flex items-center space-x-1 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Login</span>
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">¡Solicitud Recibida!</h2>
            <p className="text-xs text-gray-400 mt-2">
              Un administrador activará tu prueba de 7 días y te enviará las credenciales y el script de conexión por correo.
            </p>
            <button
              onClick={onBackToLogin}
              className="mt-6 w-full py-2.5 bg-emerald-500 text-gray-950 font-bold rounded-xl text-xs"
            >
              Regresar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-extrabold text-white">Solicitar Validador PYME</h1>
              <p className="text-xs text-gray-400 mt-1">7 días de prueba gratis • Luego $15 USD/mes</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Nombre del Comercio</label>
              <input
                type="text"
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Ej. Kiosko San Cayetano"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Nombre del Dueño</label>
              <input
                type="text"
                required
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="dueño@comercio.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Teléfono / WhatsApp</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                placeholder="+595 981 123456"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Ciudad</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Solicitud</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
