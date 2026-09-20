import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Lock,
  Smartphone,
  ChevronDown,
  Volume2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { AudioSynthesizer } from '../../utils/audio-synthesizer';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToRegister?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGoToLogin, onGoToRegister }) => {
  // Calculator state
  const [transfersPerDay, setTransfersPerDay] = useState(25);
  const [averageTicket, setAverageTicket] = useState(85000);

  // Demo simulator state
  const [demoAmount, setDemoAmount] = useState('65.000');
  const [demoResult, setDemoResult] = useState<'idle' | 'success' | 'replay'>('idle');

  // Lead Form state
  const [leadForm, setLeadForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    city: 'Asunción',
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // ROI estimation: 1.5% fraud rate in fast retail without real-time validation
  const estimatedMonthlyLoss = Math.round(transfersPerDay * 30 * (averageTicket * 0.015));

  const handleTestDemoVerify = () => {
    AudioSynthesizer.playSuccessChime();
    setDemoResult('success');
  };

  const handleTestDemoReplay = () => {
    AudioSynthesizer.playAlertWarning();
    setDemoResult('replay');
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadLoading(true);
    setLeadError(null);

    try {
      const res = await fetch('/api/v1/onboarding/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      });

      if (res.ok) {
        setLeadSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setLeadError(data.message || 'Ocurrió un error al procesar tu registro. Intentalo de nuevo.');
      }
    } catch {
      setLeadError('No se pudo conectar con el servidor. Verificá tu conexión.');
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-gray-100 selection:bg-emerald-500 selection:text-gray-950 font-sans">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#070A12]/80 border-b border-[#1E293B]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-400 text-gray-950 rounded-2xl shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white flex items-center space-x-1.5">
                <span>CajaSegura</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                  SIPAP PY
                </span>
              </div>
              <div className="text-[10px] text-gray-400">Protección Anti-Fraude en Tiempo Real</div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300">
            <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">¿Cómo Funciona?</a>
            <a href="#calculadora" className="hover:text-emerald-400 transition-colors">Calculadora</a>
            <a href="#demo" className="hover:text-emerald-400 transition-colors">Simulador POS</a>
            <a href="#precios" className="hover:text-emerald-400 transition-colors">Precios</a>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onGoToLogin}
              className="text-xs font-bold text-gray-300 hover:text-white px-4 py-2.5 rounded-xl border border-[#24324D] hover:border-gray-500 transition-colors"
            >
              Iniciar Sesión
            </button>
            <a
              href="#registro"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center space-x-1.5"
            >
              <span>Probar 7 Días Gratis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden border-b border-[#1A2333]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10 space-y-8">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full text-xs text-emerald-400 font-bold tracking-wide">
            <Sparkles className="w-4 h-4" />
            <span>Eliminá el peligro de los comprobantes truchos en tu mostrador</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Cobrá por SIPAP sin miedo a{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent underline decoration-emerald-500/40">
              comprobantes falsos
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Tus cajeros validan transferencias acreditadas reales en <strong className="text-emerald-400">menos de 2 segundos</strong>, con chimes de audio y protección anti-repetición. Sin contraseñas de banco y con 0% de comisión por cobro.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#registro"
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] transition-all flex items-center justify-center space-x-2"
            >
              <span>Activar Mi Prueba Gratis de 7 Días</span>
              <ArrowRight className="w-5 h-5" />
            </a>

            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 bg-[#151D2F] hover:bg-[#1C273E] text-white font-bold text-base rounded-2xl border border-[#24324D] hover:border-emerald-500/40 transition-all flex items-center justify-center space-x-2"
            >
              <Volume2 className="w-5 h-5 text-emerald-400" />
              <span>Probar Simulador de Caja</span>
            </a>
          </div>

          {/* Supported Banks Banner */}
          <div className="pt-10 space-y-3">
            <div className="text-xs uppercase font-mono tracking-widest text-gray-500">
              Compatible con todas las cuentas bancarias de Paraguay
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-gray-400">
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-orange-400 font-bold">Banco Itaú</span>
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-teal-400 font-bold">UENO Bank</span>
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-emerald-400 font-bold">Banco Familiar</span>
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-red-400 font-bold">Banco GNB</span>
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-indigo-400 font-bold">Banco Atlas</span>
              <span className="px-3 py-1 bg-[#151D2F] border border-[#24324D] rounded-lg text-amber-400 font-bold">Banco Continental</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive POS Simulator Section */}
      <section id="demo" className="py-20 max-w-4xl mx-auto px-6">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center space-x-2 text-xs text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5" />
            <span>Experiencia de Caja en Tiempo Real</span>
          </div>
          <h2 className="text-3xl font-black text-white">Así de simple opera tu cajero</h2>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            El cliente transfiere, el cajero solo escribe el monto y presiona Enter. Probá la respuesta sonora interactiva:
          </p>
        </div>

        <div className="bg-[#151D2F] border-2 border-emerald-500/30 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#24324D] pb-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-white">Terminal POS de Demostración</span>
            </div>
            <span className="text-xs font-mono text-emerald-400">Sonido Web Audio API Activo 🔊</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                  1. Monto en Pantalla
                </label>
                <div className="text-3xl font-mono font-black text-white bg-[#0B0F19] border-2 border-emerald-500/40 rounded-2xl px-5 py-3">
                  Gs. {demoAmount}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={handleTestDemoVerify}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simular: Transferencia Válida (Chime Verde)</span>
                </button>

                <button
                  onClick={handleTestDemoReplay}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Simular: Comprobante Repetido (Alarma Roja)</span>
                </button>
              </div>
            </div>

            <div className="min-h-[190px] flex items-center justify-center">
              {demoResult === 'idle' && (
                <div className="text-center p-6 bg-[#0B0F19]/60 rounded-2xl border border-[#24324D] text-gray-400 text-xs space-y-2">
                  <Play className="w-8 h-8 text-gray-600 mx-auto" />
                  <p>Hacé clic en alguno de los botones para escuchar y ver la respuesta instantánea del cajero.</p>
                </div>
              )}

              {demoResult === 'success' && (
                <div className="w-full p-6 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-2xl space-y-3 animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>¡TRANSFERENCIA ACREDITADA!</span>
                  </div>
                  <div className="text-xs text-gray-300 font-mono space-y-1">
                    <div>Monto: <strong className="text-white">Gs. {demoAmount}</strong></div>
                    <div>Pagador: <strong className="text-white">MARCELO GÓMEZ</strong></div>
                    <div>Banco: <strong className="text-white">Banco Itaú SIPAP</strong></div>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    ✓ Chime positivo ejecutado. Mercadería liberada.
                  </div>
                </div>
              )}

              {demoResult === 'replay' && (
                <div className="w-full p-6 bg-red-950/50 border-2 border-red-500 rounded-2xl space-y-3 animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center space-x-2 text-red-400 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                    <span>ALERTA: COMPROBANTE YA UTILIZADO</span>
                  </div>
                  <div className="text-xs text-gray-300">
                    Este comprobante ya fue cobrado hace 14 minutos por otro cajero.
                  </div>
                  <div className="text-[11px] font-bold text-red-300 bg-red-500/20 px-3 py-1 rounded-lg">
                    ⛔ Alarma sonora disparada. NO entregar mercadería.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive ROI / Fraud Calculator Section */}
      <section id="calculadora" className="py-20 bg-[#0B0F19] border-y border-[#1E293B]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-3 mb-12">
            <div className="inline-flex items-center space-x-2 text-xs text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Calculadora de Pérdidas Evitadas</span>
            </div>
            <h2 className="text-3xl font-black text-white">¿Cuánto dinero te hace perder el fraude?</h2>
            <p className="text-sm text-gray-400 max-w-xl mx-auto">
              Simulá el volumen de tu negocio y descubrí por qué CajaSegura se paga sola desde el primer día:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#151D2F] border border-[#24324D] rounded-3xl p-8 shadow-2xl">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-gray-300 mb-2">
                  <span>Cobros por transferencia al día:</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">{transfersPerDay} transferencias</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={transfersPerDay}
                  onChange={(e) => setTransfersPerDay(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-300 mb-2">
                  <span>Monto promedio por venta:</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    Gs. {averageTicket.toLocaleString('es-PY')}
                  </span>
                </div>
                <input
                  type="range"
                  min="30000"
                  max="400000"
                  step="10000"
                  value={averageTicket}
                  onChange={(e) => setAverageTicket(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="text-xs text-gray-400 bg-[#0B0F19] p-4 rounded-xl space-y-1">
                <div className="font-bold text-gray-300">¿Por qué ocurren las pérdidas?</div>
                <div>Comprobantes editados en Photoshop, transferencias de terceros canceladas o clientes que muestran la misma captura 2 veces en diferentes turnos.</div>
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between text-center space-y-6">
              <div>
                <div className="text-xs uppercase font-mono font-bold text-gray-400 tracking-wider">
                  Riesgo de Pérdida Mensual Estimado
                </div>
                <div className="text-4xl font-mono font-black text-red-400 mt-2">
                  Gs. {estimatedMonthlyLoss.toLocaleString('es-PY')}
                </div>
                <div className="text-xs text-gray-400 mt-1">en mercadería entregada sin fondos reales</div>
              </div>

              <div className="pt-4 border-t border-[#24324D] space-y-2">
                <div className="text-xs text-gray-400">Costo mensual de CajaSegura:</div>
                <div className="text-2xl font-mono font-black text-emerald-400">
                  Gs. 150.000 <span className="text-xs font-normal text-gray-400">/ mes</span>
                </div>
                <div className="text-xs text-emerald-300 font-bold">
                  ¡Ahorrás hasta Gs. {(estimatedMonthlyLoss - 150000 > 0 ? estimatedMonthlyLoss - 150000 : 0).toLocaleString('es-PY')} netos cada mes!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Reassurance Section (Zero-Knowledge) */}
      <section id="como-funciona" className="py-20 max-w-5xl mx-auto px-6">
        <div className="text-center space-y-3 mb-16">
          <div className="inline-flex items-center space-x-2 text-xs text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            <Lock className="w-3.5 h-3.5" />
            <span>Arquitectura Zero-Knowledge</span>
          </div>
          <h2 className="text-3xl font-black text-white">Tu dinero y tus claves, 100% protegidos</h2>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto">
            A diferencia de otras soluciones, nunca te pedimos tus contraseñas de homebanking ni tenemos acceso a mover tus fondos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xl">
              1
            </div>
            <h3 className="text-lg font-bold text-white">Cero Claves Bancarias</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No compartís credenciales, tokens ni accesos de ningún banco. El sistema funciona únicamente leyendo los correos oficiales que el banco ya te envía.
            </p>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl">
              2
            </div>
            <h3 className="text-lg font-bold text-white">Script Oficial de Google</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              La conexión corre directamente en los servidores de Google con tu propia cuenta mediante Google Apps Script. 100% auditable y transparente.
            </p>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xl">
              3
            </div>
            <h3 className="text-lg font-bold text-white">Cajeros sin acceso a saldos</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Tus cajeros solo pueden validar si el monto exacto de la compra ingresó. Nunca tienen acceso a ver el saldo acumulado de tus cuentas ni extractos.
            </p>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section id="precios" className="py-20 bg-[#0B0F19] border-y border-[#1E293B]">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 text-xs text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Planes Claros Sin Letra Chica</span>
            </div>
            <h2 className="text-3xl font-black text-white">Un precio simple, todo incluido</h2>
            <p className="text-sm text-gray-400">Probá 7 días sin costo ni compromiso. Si te gusta, pagás por mes.</p>
          </div>

          <div className="max-w-md mx-auto bg-[#151D2F] border-2 border-emerald-500 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-gray-950 font-bold text-[10px] px-4 py-1 rounded-bl-xl uppercase font-mono tracking-wider">
              Recomendado PYME
            </div>

            <div className="text-left space-y-2">
              <div className="text-sm font-bold text-gray-400">Plan Comercio Integral</div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-mono font-black text-white">Gs. 150.000</span>
                <span className="text-xs text-gray-400 font-medium">/ mes</span>
              </div>
              <div className="text-xs text-emerald-400 font-semibold">
                7 Días Gratis al Iniciar • Cero comisiones por cobro
              </div>
            </div>

            <div className="pt-6 border-t border-[#24324D] text-left space-y-3 text-xs text-gray-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Cajeros y terminales ilimitadas para tu local</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Compatible con los 6 bancos principales (Itaú, Ueno, GNB, etc.)</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Alertas sonoras y protección anti-repetición en 2 segundos</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Panel de Dueño con métricas de cobros diarios en tiempo real</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Auto-renovación por transferencia SIPAP (sin tarjeta)</span>
              </div>
            </div>

            <a
              href="#registro"
              className="block w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all text-center"
            >
              Comenzar Prueba Gratis (7 Días)
            </a>
          </div>
        </div>
      </section>

      {/* Registration / Free Trial Request Section */}
      <section id="registro" className="py-20 max-w-2xl mx-auto px-6">
        <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Solicitá tu Prueba Gratuita de 7 Días</h2>
            <p className="text-xs text-gray-400">
              Completá los datos de tu comercio. Te contactamos en minutos para dejar tu caja operativa.
            </p>
          </div>

          {leadSubmitted ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              <h3 className="text-xl font-bold text-white">¡Comercio Activado con Éxito!</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Tu período de prueba gratis por 7 días ya está activo. Ya podés ingresar inmediatamente con tu correo y contraseña para probar el validador en tu local.
              </p>
              <button
                onClick={onGoToLogin}
                className="mt-4 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                Ingresar al Sistema Ahora
              </button>
            </div>
          ) : (
            <form onSubmit={handleLeadSubmit} className="space-y-4">
              {leadError && (
                <div className="p-3 bg-red-950/60 border border-red-500 rounded-xl text-xs text-red-300">
                  {leadError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Nombre de tu Comercio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Farmacia San José, Kiosko Lili..."
                  value={leadForm.businessName}
                  onChange={(e) => setLeadForm({ ...leadForm, businessName: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Tu Nombre y Apellido</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Juan Pérez"
                    value={leadForm.ownerName}
                    onChange={(e) => setLeadForm({ ...leadForm, ownerName: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">WhatsApp / Teléfono</label>
                  <input
                    type="tel"
                    required
                    placeholder="0981 123 456"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="dueño@comercio.com"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Contraseña para tu Cuenta</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={leadForm.password}
                    onChange={(e) => setLeadForm({ ...leadForm, password: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Ciudad</label>
                <select
                  value={leadForm.city}
                  onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                  className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                >
                  <option value="Asunción">Asunción</option>
                  <option value="San Lorenzo">San Lorenzo</option>
                  <option value="Luque">Luque</option>
                  <option value="Fernando de la Mora">Fernando de la Mora</option>
                  <option value="Capiatá">Capiatá</option>
                  <option value="Lambaré">Lambaré</option>
                  <option value="Ciudad del Este">Ciudad del Este</option>
                  <option value="Encarnación">Encarnación</option>
                  <option value="Otra">Otra ciudad</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={leadLoading}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 mt-4"
              >
                <span>{leadLoading ? 'Activando tu Prueba Gratis...' : 'Comenzar Prueba Gratuita de 7 Días'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-[11px] text-gray-500 text-center">
                Sin tarjeta de crédito. Tu plan pasa a Gs. 150.000/mes solo si decidís renovar.
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A2333] py-8 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-300 font-bold">CajaSegura PY</span>
            <span>— Sistema Anti-Fraude de Cobros SIPAP</span>
          </div>
          <div>© 2026 CajaSegura. Todos los derechos reservados. Asunción, Paraguay.</div>
        </div>
      </footer>
    </div>
  );
};
