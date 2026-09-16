import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AudioSynthesizer } from '../../utils/audio-synthesizer';
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  RotateCcw,
  Zap,
  Clock,
  LogOut,
  Building2,
  ChevronDown,
} from 'lucide-react';

interface TransferResult {
  id: string;
  operationId: string;
  payerName: string;
  amount: number;
  payerBank?: string;
  operationDate: string;
  status: string;
}

export const FastPosScreen: React.FC = () => {
  const { user, activeTenant, logout, switchTenant, availableMemberships } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<TransferResult | null>(null);
  const [replayAlert, setReplayAlert] = useState<{ claimedAt: string; message: string } | null>(null);
  const [claimedSuccess, setClaimedSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!cleanAmount || isNaN(cleanAmount)) return;

    setSearching(true);
    setMatch(null);
    setReplayAlert(null);
    setNotFound(false);
    setClaimedSuccess(false);

    // Mock/Real verify call
    setTimeout(() => {
      setSearching(false);
      // Simulate replay attack detection test
      if (cleanAmount === 45601 || payerName.toLowerCase().includes('repetido')) {
        AudioSynthesizer.playAlertWarning();
        setReplayAlert({
          claimedAt: '14:32:10 (Hace 12 min)',
          message: '⛔ NO entregar mercadería. Comprobante ya cobrado por Carlos.',
        });
        return;
      }

      // Simulate match found
      if (cleanAmount > 0) {
        AudioSynthesizer.playSuccessChime();
        setMatch({
          id: 'trans-' + Date.now(),
          operationId: 'OP-' + Math.floor(100000 + Math.random() * 900000),
          payerName: payerName.trim() ? payerName.toUpperCase() : 'ALEJANDRA CHENA',
          payerBank: 'Banco Itaú SIPAP',
          amount: cleanAmount,
          operationDate: 'Hoy ' + new Date().toLocaleTimeString().slice(0, 5),
          status: 'pending',
        });
      } else {
        setNotFound(true);
      }
    }, 200);
  };

  const handleClaim = () => {
    if (!match) return;
    setClaimedSuccess(true);
    AudioSynthesizer.playSuccessChime();

    setTimeout(() => {
      // Fast Reset
      setMatch(null);
      setClaimedSuccess(false);
      setAmount('');
      setPayerName('');
      amountInputRef.current?.focus();
    }, 1200);
  };

  const handleReset = () => {
    setMatch(null);
    setReplayAlert(null);
    setNotFound(false);
    setClaimedSuccess(false);
    setAmount('');
    setPayerName('');
    amountInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-[#24324D] px-6 flex items-center justify-between bg-[#151D2F]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center space-x-2">
              <span>{activeTenant?.merchantName || 'Mi Comercio'}</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                POS ACTIVO
              </span>
            </div>
            <div className="text-xs text-gray-400">Cajero: {user?.fullName}</div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {availableMemberships.length > 1 && (
            <button
              onClick={() => switchTenant(availableMemberships[1].tenantId)}
              className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-[#24324D] hover:border-gray-500 flex items-center space-x-1.5 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cambiar Sucursal</span>
            </button>
          )}

          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main POS Workspace */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col justify-center">
        {/* Verification Form */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-2">
                1. Monto Exacto en Guaraníes (Enter)
              </label>
              <div className="relative">
                <span className="absolute left-5 top-3.5 text-2xl font-mono font-bold text-gray-500">Gs.</span>
                <input
                  ref={amountInputRef}
                  type="text"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#0B0F19] border-2 border-[#24324D] focus:border-emerald-500 rounded-2xl pl-16 pr-6 py-3.5 text-3xl font-mono font-extrabold text-white tracking-wide focus:outline-none transition-colors"
                  placeholder="26.000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                2. Apellido del Pagador (Opcional)
              </label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-5 py-3 text-base text-white focus:outline-none transition-colors"
                placeholder="Ej. Chena, Duarte, Giménez..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={searching}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-lg font-extrabold rounded-2xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Search className="w-5 h-5" />
                <span>Verificar Transferencia</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-4 bg-[#0B0F19] hover:bg-[#1A253C] text-gray-400 hover:text-white border border-[#24324D] rounded-2xl transition-colors"
                title="Limpiar pantalla"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* State Display: Match Success Card */}
        {match && (
          <div className="mt-6 bg-emerald-950/40 border-2 border-emerald-500 rounded-3xl p-8 shadow-2xl shadow-emerald-500/10 animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-emerald-500 text-gray-950 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                    TRANSFERENCIA VERIFICADA Y DISPONIBLE
                  </div>
                  <div className="text-3xl font-mono font-extrabold text-white mt-1">
                    Gs. {match.amount.toLocaleString('es-PY')}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-gray-400 bg-[#0B0F19] px-3 py-1.5 rounded-xl border border-[#24324D]">
                {match.operationDate}
              </span>
            </div>

            <div className="mt-6 pt-6 border-t border-emerald-500/30 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400 text-xs block">Cliente Pagador:</span>
                <span className="font-bold text-white text-base">{match.payerName}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Entidad SIPAP:</span>
                <span className="font-bold text-gray-200">{match.payerBank}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Nro. Operación:</span>
                <span className="font-mono text-gray-300 text-xs">{match.operationId}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Estado:</span>
                <span className="text-emerald-400 font-bold">Pendiente de Cobro</span>
              </div>
            </div>

            <button
              onClick={handleClaim}
              disabled={claimedSuccess}
              className={`mt-6 w-full py-4 text-lg font-extrabold rounded-2xl transition-all flex items-center justify-center space-x-2 ${
                claimedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-gray-950 shadow-lg shadow-emerald-400/20'
              }`}
            >
              <Check className="w-6 h-6" />
              <span>{claimedSuccess ? '¡Cobro Confirmado! Registrando...' : 'Confirmar y Cobrar (Espacio)'}</span>
            </button>
          </div>
        )}

        {/* State Display: Replay Attack Warning */}
        {replayAlert && (
          <div className="mt-6 bg-red-950/60 border-2 border-red-500 rounded-3xl p-8 shadow-2xl shadow-red-500/20 animate-shake">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-500 text-white rounded-2xl animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <div className="text-xs uppercase font-extrabold tracking-wider text-red-400">
                  ALERTA DE SEGURIDAD — COMPROBANTE YA UTILIZADO
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {replayAlert.message}
                </div>
                <div className="text-sm text-gray-300 mt-2 font-mono">
                  Horario de cobro anterior: <span className="text-red-300 font-bold">{replayAlert.claimedAt}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State Display: Not Found */}
        {notFound && (
          <div className="mt-6 bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 text-center text-gray-400">
            <Clock className="w-8 h-8 mx-auto text-gray-500 mb-2" />
            <p className="font-semibold text-white">No se encontró ninguna transferencia pendiente</p>
            <p className="text-xs text-gray-400 mt-1">
              Verificá el monto ingresado o pedile al cliente que confirme el envío desde su app bancaria.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
