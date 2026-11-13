import React, { useEffect, useState, useMemo } from 'react';
import {
  ShoppingBag,
  Sparkles,
  Search,
  Clock,
  Tag,
  Package,
  Wrench,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  Phone,
  User,
} from 'lucide-react';

export type CatalogThemePalette = 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan' | 'violet';

export interface PublicCatalogItem {
  id: string;
  itemType: 'product' | 'service';
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  imageUrl: string | null;
  discountPercent: number;
  discountType: 'none' | 'hours' | 'days';
  discountEndsAt: string | null;
  discountDays: string | null;
  isDiscountActive: boolean;
  effectiveDiscountPercent: number;
  effectivePrice: number;
  bookingEnabled?: boolean;
  bookingMode?: 'hours' | 'days';
  bookingDaysOfWeek?: string;
  bookingTimeSlots?: string | null;
  bookingMaxConcurrent?: number;
}

interface BookingSlotCount {
  date: string;
  timeSlot: string | null;
  bookedCount: number;
}

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PublicCatalogData {
  merchantId: string;
  merchantName: string;
  slug: string;
  theme: CatalogThemePalette;
  items: PublicCatalogItem[];
}

const THEME_STYLES: Record<
  CatalogThemePalette,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    accentText: string;
    buttonBg: string;
    cardBorderHover: string;
    headerGlow: string;
    priceColor: string;
  }
> = {
  emerald: {
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/40',
    accentText: 'text-emerald-400',
    buttonBg: 'bg-emerald-500 text-gray-950',
    cardBorderHover: 'hover:border-emerald-500/50',
    headerGlow: 'from-emerald-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-emerald-400',
  },
  indigo: {
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/40',
    accentText: 'text-indigo-400',
    buttonBg: 'bg-indigo-500 text-white',
    cardBorderHover: 'hover:border-indigo-500/50',
    headerGlow: 'from-indigo-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-indigo-400',
  },
  rose: {
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/40',
    accentText: 'text-rose-400',
    buttonBg: 'bg-rose-500 text-white',
    cardBorderHover: 'hover:border-rose-500/50',
    headerGlow: 'from-rose-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-rose-400',
  },
  amber: {
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/40',
    accentText: 'text-amber-400',
    buttonBg: 'bg-amber-500 text-gray-950',
    cardBorderHover: 'hover:border-amber-500/50',
    headerGlow: 'from-amber-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-amber-400',
  },
  cyan: {
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/40',
    accentText: 'text-cyan-400',
    buttonBg: 'bg-cyan-500 text-gray-950',
    cardBorderHover: 'hover:border-cyan-500/50',
    headerGlow: 'from-cyan-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-cyan-400',
  },
  violet: {
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-500/40',
    accentText: 'text-violet-400',
    buttonBg: 'bg-violet-500 text-white',
    cardBorderHover: 'hover:border-violet-500/50',
    headerGlow: 'from-violet-900/30 via-[#0B0F19] to-[#070A12]',
    priceColor: 'text-violet-400',
  },
};

interface PublicCatalogViewProps {
  slug: string;
  onBackHome?: () => void;
}

export const PublicCatalogView: React.FC<PublicCatalogViewProps> = ({ slug, onBackHome }) => {
  const [data, setData] = useState<PublicCatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'product' | 'service' | 'bookings'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking modal state
  const [bookingItem, setBookingItem] = useState<PublicCatalogItem | null>(null);
  const [bookingStartDate, setBookingStartDate] = useState<string>(() => toLocalIsoDate(new Date()));
  const [bookingEndDate, setBookingEndDate] = useState<string>(() => addDaysToIso(toLocalIsoDate(new Date()), 1));
  const [bookingTimeSlot, setBookingTimeSlot] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [availabilityCounts, setAvailabilityCounts] = useState<BookingSlotCount[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccessId, setBookingSuccessId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/public/catalog/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          throw new Error('No se encontró el catálogo de este local.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el catálogo.');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [slug]);

  useEffect(() => {
    if (!bookingItem) return;
    const fromDate = bookingStartDate || toLocalIsoDate(new Date());
    const toDate = bookingItem.bookingMode === 'days' ? bookingEndDate || fromDate : fromDate;
    if (toDate < fromDate) return;

    let cancelled = false;
    const loadAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const url = `/api/v1/public/catalog/${encodeURIComponent(slug)}/availability?itemId=${encodeURIComponent(bookingItem.id)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
        const res = await fetch(url);
        if (res.ok && !cancelled) {
          setAvailabilityCounts(await res.json());
        }
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setLoadingAvailability(false);
      }
    };
    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [bookingItem, bookingStartDate, bookingEndDate, slug]);

  const theme = THEME_STYLES[data?.theme || 'emerald'] || THEME_STYLES.emerald;

  const productCount = useMemo(() => (data?.items || []).filter((i) => i.itemType === 'product').length, [data]);
  const serviceCount = useMemo(() => (data?.items || []).filter((i) => i.itemType === 'service').length, [data]);
  const bookableCount = useMemo(
    () => (data?.items || []).filter((i) => i.itemType === 'service' && i.bookingEnabled).length,
    [data],
  );

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (filterType === 'bookings') {
        if (!(item.itemType === 'service' && item.bookingEnabled)) return false;
      } else if (filterType !== 'all' && item.itemType !== filterType) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [data, filterType, searchQuery]);

  const openBookingModal = (item: PublicCatalogItem) => {
    const today = toLocalIsoDate(new Date());
    setBookingItem(item);
    setBookingStartDate(today);
    setBookingEndDate(addDaysToIso(today, 1));
    setBookingTimeSlot('');
    setBookingNotes('');
    setBookingError(null);
    setBookingSuccessId(null);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingItem) return;
    setBookingError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setBookingError('Por favor ingresá tu nombre y número de teléfono.');
      return;
    }
    if (bookingItem.bookingMode !== 'days' && !bookingTimeSlot) {
      setBookingError('Seleccioná un horario disponible.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await fetch(`/api/v1/public/catalog/${encodeURIComponent(slug)}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: bookingItem.id,
          startDate: bookingStartDate,
          endDate: bookingItem.bookingMode === 'days' ? bookingEndDate : bookingStartDate,
          timeSlot: bookingItem.bookingMode === 'days' ? null : bookingTimeSlot,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: bookingNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'No se pudo registrar la reserva.');
      }
      setBookingSuccessId(json.id);
    } catch (err: any) {
      setBookingError(err.message || 'No se pudo completar la reserva.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 font-mono">Cargando catálogo del local...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#151D2F] border border-[#24324D] rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold">{error || 'Catálogo no disponible'}</h1>
          <p className="text-xs text-gray-400">
            Verificá que el link del comercio sea correcto.
          </p>
          {onBackHome && (
            <button
              onClick={onBackHome}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ir al inicio de CajaSegura</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-gray-100 font-sans pb-16">
      {/* Header Banner */}
      <header className={`bg-gradient-to-b ${theme.headerGlow} border-b border-[#1E293B] pt-10 pb-8 px-4 sm:px-6`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Catálogo Oficial • Precios en Vivo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {data.merchantName}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Consultá nuestros productos disponibles, servicios y promociones activas en tienda.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="px-3.5 py-2 bg-[#151D2F] border border-[#24324D] rounded-2xl text-xs text-gray-300 flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${theme.accentText}`} />
              <span>Aceptamos Transferencias SIPAP</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#111827] border border-[#1E293B] p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {(productCount > 0 && serviceCount > 0) || (productCount === 0 && serviceCount === 0) ? (
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filterType === 'all' ? theme.buttonBg : 'text-gray-400 hover:text-white bg-[#151D2F]'
                }`}
              >
                Todos ({data.items.length})
              </button>
            ) : null}
            {productCount > 0 && (
              <button
                onClick={() => setFilterType('product')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === 'product' ? theme.buttonBg : 'text-gray-400 hover:text-white bg-[#151D2F]'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Productos ({productCount})</span>
              </button>
            )}
            {serviceCount > 0 && (
              <button
                onClick={() => setFilterType('service')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === 'service' ? theme.buttonBg : 'text-gray-400 hover:text-white bg-[#151D2F]'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Servicios ({serviceCount})</span>
              </button>
            )}
            {bookableCount > 0 && (
              <button
                onClick={() => setFilterType('bookings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterType === 'bookings' ? theme.buttonBg : 'text-gray-400 hover:text-white bg-[#151D2F]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Reservas ({bookableCount})</span>
              </button>
            )}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o servicio..."
              className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-[#111827] border border-[#1E293B] rounded-3xl p-12 text-center space-y-2">
            <p className="text-sm font-bold text-gray-300">No hay ítems para mostrar en esta categoría.</p>
            <p className="text-xs text-gray-500">Probá cambiando el filtro o buscando con otra palabra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const hasPhoto = Boolean(item.imageUrl && item.imageUrl.trim().length > 0);
              const outOfStock = item.itemType === 'product' && item.stock !== null && item.stock <= 0;

              return (
                <div
                  key={item.id}
                  className={`bg-[#151D2F] border border-[#24324D] ${theme.cardBorderHover} rounded-2xl overflow-hidden flex flex-col justify-between transition-all shadow-lg`}
                >
                  {/* Conditional Image Header ONLY if item has photo */}
                  {hasPhoto && (
                    <div className="relative h-48 w-full bg-[#0B0F19] overflow-hidden border-b border-[#24324D]">
                      <img
                        src={item.imageUrl!}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {item.isDiscountActive && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 bg-rose-500 text-white text-xs font-extrabold rounded-full shadow-lg flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          <span>-{item.effectiveDiscountPercent}% OFF</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Content (Clean typographic layout when no photo, or caption below photo) */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-mono uppercase px-2.5 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}>
                          {item.itemType === 'service' ? 'Servicio' : 'Producto'}
                        </span>

                        {!hasPhoto && item.isDiscountActive && (
                          <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-extrabold rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            -{item.effectiveDiscountPercent}% PROMO
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-extrabold text-white leading-snug">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#24324D] flex items-end justify-between gap-2">
                      <div>
                        {item.isDiscountActive ? (
                          <div className="space-y-0.5">
                            <span className="text-xs text-gray-500 line-through font-mono block">
                              Gs. {item.price.toLocaleString('es-PY')}
                            </span>
                            <span className={`text-2xl font-mono font-black ${theme.priceColor}`}>
                              Gs. {item.effectivePrice.toLocaleString('es-PY')}
                            </span>
                          </div>
                        ) : (
                          <span className={`text-2xl font-mono font-black ${theme.priceColor}`}>
                            Gs. {item.price.toLocaleString('es-PY')}
                          </span>
                        )}

                        {item.isDiscountActive && (
                          <div className="flex items-center gap-1 text-xs text-amber-300 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {item.discountType === 'hours'
                                ? 'Descuento por tiempo limitado'
                                : 'Promoción del día activa'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Stock or Service Availability / Booking Button */}
                      <div className="text-right">
                        {item.itemType === 'product' && item.stock !== null ? (
                          outOfStock ? (
                            <span className="px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold">
                              Sin Stock
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-[#0B0F19] border border-[#24324D] text-gray-300 rounded-lg text-xs font-mono font-bold block">
                              Disponibles: {item.stock}
                            </span>
                          )
                        ) : item.itemType === 'service' && item.bookingEnabled ? (
                          <button
                            type="button"
                            onClick={() => openBookingModal(item)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all ${theme.buttonBg}`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Reservar</span>
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 bg-[#0B0F19] border border-[#24324D] text-gray-300 rounded-lg text-xs font-mono">
                            Disponible
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#24324D] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                  {bookingItem.bookingMode === 'days' ? 'Reserva por Días / Estadía' : 'Reserva por Horario'}
                </div>
                <h2 className="text-lg font-extrabold text-white mt-0.5">{bookingItem.name}</h2>
                <div className={`text-sm font-mono font-bold ${theme.priceColor}`}>
                  Gs. {bookingItem.effectivePrice.toLocaleString('es-PY')}
                  {bookingItem.bookingMode === 'days' ? ' / día' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingItem(null)}
                className="p-2 rounded-xl bg-[#151D2F] text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bookingSuccessId ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <div className="text-base font-bold text-white">¡Reserva registrada!</div>
                <p className="text-xs text-gray-300">
                  Tu solicitud quedó guardada en el sistema de <strong>{data.merchantName}</strong>.
                  Te contactarán al <strong>{customerPhone}</strong> para confirmar.
                </p>
                <div className="text-[11px] font-mono text-emerald-300 bg-[#0B0F19] py-1.5 px-3 rounded-lg inline-block">
                  Código: {bookingSuccessId}
                </div>
                <button
                  type="button"
                  onClick={() => setBookingItem(null)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold ${theme.buttonBg}`}
                >
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBooking} className="space-y-4">
                <div className="text-[11px] text-gray-400 bg-[#0B0F19] border border-[#1E293B] rounded-xl px-3 py-2">
                  Días disponibles:{' '}
                  <span className="text-gray-200 font-semibold">
                    {(bookingItem.bookingDaysOfWeek || '1,2,3,4,5,6')
                      .split(',')
                      .map((d) => WEEKDAY_LABELS[Number(d.trim())])
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>

                {bookingItem.bookingMode === 'days' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1">Entrada / Inicio</label>
                      <input
                        type="date"
                        required
                        min={toLocalIsoDate(new Date())}
                        value={bookingStartDate}
                        onChange={(e) => {
                          setBookingStartDate(e.target.value);
                          if (bookingEndDate <= e.target.value) {
                            setBookingEndDate(addDaysToIso(e.target.value, 1));
                          }
                        }}
                        className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1">Salida / Fin</label>
                      <input
                        type="date"
                        required
                        min={bookingStartDate}
                        value={bookingEndDate}
                        onChange={(e) => setBookingEndDate(e.target.value)}
                        className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1">Fecha</label>
                      <input
                        type="date"
                        required
                        min={toLocalIsoDate(new Date())}
                        value={bookingStartDate}
                        onChange={(e) => {
                          setBookingStartDate(e.target.value);
                          setBookingTimeSlot('');
                        }}
                        className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                        Horario disponible {loadingAvailability ? '(verificando...)' : ''}
                      </label>
                      {(() => {
                        const allowedDays = (bookingItem.bookingDaysOfWeek || '1,2,3,4,5,6')
                          .split(',')
                          .map((d) => Number(d.trim()));
                        const selectedDay = new Date(`${bookingStartDate}T12:00:00.000Z`).getUTCDay();
                        if (!allowedDays.includes(selectedDay)) {
                          return (
                            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                              No hay atención este día de la semana. Elegí otro día.
                            </div>
                          );
                        }
                        const slots = (bookingItem.bookingTimeSlots || '09:00,10:00,11:00,14:00,15:00,16:00,17:00')
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const maxConcurrent = bookingItem.bookingMaxConcurrent || 1;
                        return (
                          <div className="grid grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const booked =
                                availabilityCounts.find(
                                  (a) => a.date === bookingStartDate && a.timeSlot === slot,
                                )?.bookedCount || 0;
                              const full = booked >= maxConcurrent;
                              const selected = bookingTimeSlot === slot;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={full}
                                  onClick={() => setBookingTimeSlot(slot)}
                                  className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                                    full
                                      ? 'bg-[#0B0F19] border-[#1E293B] text-gray-600 line-through cursor-not-allowed'
                                      : selected
                                        ? `${theme.buttonBg} border-transparent`
                                        : 'bg-[#151D2F] border-[#24324D] text-gray-200 hover:border-gray-400'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-[#1E293B]">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">
                      Tu Nombre *
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">
                      Número de Teléfono / WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej: 0981 123 456"
                        className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Nota (opcional)</label>
                    <input
                      type="text"
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Detalles adicionales..."
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                {bookingError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                    {bookingError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingBooking}
                  className={`w-full py-3 rounded-xl text-xs font-extrabold transition-all ${theme.buttonBg} disabled:opacity-50`}
                >
                  {submittingBooking ? 'Guardando reserva...' : 'Confirmar Reserva'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
