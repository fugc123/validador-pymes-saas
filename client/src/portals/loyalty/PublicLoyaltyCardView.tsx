import React, { useEffect, useState } from 'react';
import { Gift, CheckCircle2, Sparkles, Ticket, ExternalLink, AlertCircle, Stamp } from 'lucide-react';
import { CatalogThemePalette } from '../catalog/PublicCatalogView';

interface PublicLoyaltyCoupon {
  id: string;
  code: string;
  rewardTitle: string;
  status: 'available' | 'redeemed';
  issuedAt: string;
  redeemedAt: string | null;
}

interface PublicLoyaltyViewData {
  merchantName: string;
  merchantSlug: string;
  theme: CatalogThemePalette;
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string | null;
  card: {
    customerName: string | null;
    customerPhoneMasked: string;
    stampsCount: number;
    totalVisits: number;
    lastVisitAt: string | null;
    coupons: PublicLoyaltyCoupon[];
  };
}

const ACCENT_MAP: Record<CatalogThemePalette, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500/40', text: 'text-indigo-400' },
  rose: { bg: 'bg-rose-500', border: 'border-rose-500/40', text: 'text-rose-400' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-500/40', text: 'text-amber-400' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500/40', text: 'text-cyan-400' },
  violet: { bg: 'bg-violet-500', border: 'border-violet-500/40', text: 'text-violet-400' },
};

export const PublicLoyaltyCardView: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<PublicLoyaltyViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/public/loyalty/${encodeURIComponent(token)}`);
        if (!res.ok) {
          throw new Error('No encontramos esta tarjeta de fidelidad.');
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Error al cargar la tarjeta.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-gray-400">Cargando tu tarjeta de puntos...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-[#111827] border border-[#24324D] rounded-3xl p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-bold">{error || 'Tarjeta no disponible'}</h1>
          <p className="text-xs text-gray-400">Verificá el link que te envió el comercio.</p>
        </div>
      </div>
    );
  }

  const accent = ACCENT_MAP[data.theme] || ACCENT_MAP.emerald;
  const availableCoupons = data.card.coupons.filter((c) => c.status === 'available');
  const redeemedCoupons = data.card.coupons.filter((c) => c.status === 'redeemed');
  const remaining = Math.max(0, data.stampsRequired - data.card.stampsCount);

  return (
    <div className="min-h-screen bg-[#070A12] text-gray-100 py-8 px-4 flex flex-col items-center">
      <div className="max-w-md w-full space-y-5">
        {/* Header Card */}
        <div className={`bg-[#111827] border ${accent.border} rounded-3xl p-6 shadow-2xl space-y-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${accent.text}`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tarjeta de Fidelidad</span>
              </div>
              <h1 className="text-2xl font-black text-white mt-1">{data.merchantName}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.card.customerName ? `${data.card.customerName} • ` : ''}
                Tel: {data.card.customerPhoneMasked}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-black text-white">
                {data.card.stampsCount}/{data.stampsRequired}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Sellos</div>
            </div>
          </div>

          {/* Stamp Grid */}
          <div className="grid grid-cols-5 gap-2.5 bg-[#0B0F19] border border-[#1E293B] rounded-2xl p-4">
            {Array.from({ length: data.stampsRequired }).map((_, idx) => {
              const filled = idx < data.card.stampsCount;
              return (
                <div
                  key={idx}
                  className={`aspect-square rounded-2xl flex items-center justify-center border transition-all ${
                    filled
                      ? `${accent.bg} border-transparent text-gray-950 shadow-lg`
                      : 'bg-[#151D2F] border-[#24324D] text-gray-600'
                  }`}
                >
                  {filled ? <CheckCircle2 className="w-5 h-5" /> : <Stamp className="w-4 h-4 opacity-50" />}
                </div>
              );
            })}
          </div>

          {/* Reward Goal */}
          <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${accent.bg} text-gray-950 flex items-center justify-center shrink-0`}>
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white">{data.rewardTitle}</div>
              <div className="text-[11px] text-gray-400">
                {remaining === 0
                  ? '¡Completaste tu tarjeta!'
                  : `Te faltan ${remaining} ${remaining === 1 ? 'visita' : 'visitas'} para tu próximo premio`}
              </div>
              {data.rewardDescription && (
                <div className="text-[11px] text-gray-500 mt-0.5">{data.rewardDescription}</div>
              )}
            </div>
          </div>

          {data.merchantSlug && (
            <a
              href={`/catalogo/${data.merchantSlug}`}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#151D2F] border border-[#24324D] text-xs font-bold text-gray-200 flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Catálogo de {data.merchantName}</span>
            </a>
          )}
        </div>

        {/* Available Coupons */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Ticket className={`w-4 h-4 ${accent.text}`} />
              <span>Tus Cupones Disponibles ({availableCoupons.length})</span>
            </h2>
            <span className="text-[11px] font-mono text-gray-400">Visitas totales: {data.card.totalVisits}</span>
          </div>

          {availableCoupons.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">
              Todavía no tenés cupones sin usar. ¡Seguí sumando visitas en caja con tu número de celular!
            </p>
          ) : (
            <div className="space-y-2.5">
              {availableCoupons.map((c) => (
                <div
                  key={c.id}
                  className={`bg-[#0B0F19] border ${accent.border} rounded-2xl p-3.5 flex items-center justify-between gap-3`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{c.rewardTitle}</div>
                    <div className="text-[11px] text-gray-400">Mostrá este código en caja para canjearlo</div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl ${accent.bg} text-gray-950 font-mono font-black text-xs`}>
                    {c.code}
                  </div>
                </div>
              ))}
            </div>
          )}

          {redeemedCoupons.length > 0 && (
            <div className="pt-3 border-t border-[#1E293B] space-y-2">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Canjeados</div>
              {redeemedCoupons.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#0B0F19]/60 border border-[#1E293B] rounded-xl px-3 py-2 flex items-center justify-between text-xs text-gray-500"
                >
                  <span>{c.rewardTitle}</span>
                  <span className="font-mono line-through">{c.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
