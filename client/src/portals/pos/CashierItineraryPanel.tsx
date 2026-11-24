import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Plus,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';

export interface PosBookingRecord {
  id: string;
  tenantId: string;
  itemId: string;
  itemName: string;
  bookingMode: 'hours' | 'days';
  startDate: string;
  endDate: string;
  timeSlot: string | null;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

export interface BookableServiceItem {
  id: string;
  name: string;
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

interface CashierItineraryPanelProps {
  token: string | null;
  bookings: PosBookingRecord[];
  bookableItems: BookableServiceItem[];
  onRefresh: () => Promise<void> | void;
  onLoadToCheckout: (booking: PosBookingRecord) => void;
}

const ITINERARY_PAGE_SIZE = 6;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function getParaguayNowStrings(now: Date = new Date()): {
  todayIso: string;
  currentHhMm: string;
} {
  const pyIso = new Date(now.getTime() - 3 * 3600 * 1000).toISOString();
  return { todayIso: pyIso.slice(0, 10), currentHhMm: pyIso.slice(11, 16) };
}

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T12:00:00.000Z`);
  const dayLabel = WEEKDAY_SHORT[d.getUTCDay()] || '';
  const [, m, day] = iso.split('-');
  return `${dayLabel} ${day}/${m}`;
}

export const CashierItineraryPanel: React.FC<CashierItineraryPanelProps> = ({
  token,
  bookings,
  bookableItems,
  onRefresh,
  onLoadToCheckout,
}) => {
  const { todayIso } = useMemo(() => getParaguayNowStrings(), []);
  const tomorrowIso = useMemo(() => addDaysToIso(todayIso, 1), [todayIso]);
  const dayAfterIso = useMemo(() => addDaysToIso(todayIso, 2), [todayIso]);

  const [viewMode, setViewMode] = useState<'by_day' | 'upcoming'>('by_day');
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [page, setPage] = useState(1);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [itineraryFeedback, setItineraryFeedback] = useState<string | null>(null);

  // New counter booking modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newStartDate, setNewStartDate] = useState(todayIso);
  const [newEndDate, setNewEndDate] = useState(tomorrowIso);
  const [newTimeSlot, setNewTimeSlot] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [availabilityCounts, setAvailabilityCounts] = useState<BookingSlotCount[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newBookingError, setNewBookingError] = useState<string | null>(null);

  const selectedService = useMemo(
    () => bookableItems.find((i) => i.id === selectedItemId) || bookableItems[0] || null,
    [bookableItems, selectedItemId],
  );

  useEffect(() => {
    setPage(1);
  }, [viewMode, selectedDate, includeCancelled]);

  useEffect(() => {
    if (!showNewModal || !selectedService || !token) return;
    const fromDate = newStartDate || todayIso;
    const toDate = selectedService.bookingMode === 'days' ? newEndDate || fromDate : fromDate;
    if (toDate < fromDate) return;

    let cancelled = false;
    const loadAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const res = await fetch(
          `/api/v1/cashier/bookings/availability?itemId=${encodeURIComponent(selectedService.id)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
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
  }, [showNewModal, selectedService, newStartDate, newEndDate, token, todayIso]);

  const computeInitialOpenDate = (svc: BookableServiceItem): string => {
    const { todayIso: curToday, currentHhMm: nowHhMm } = getParaguayNowStrings();
    if (svc.bookingMode === 'days') return curToday;

    const allowedDays = (svc.bookingDaysOfWeek || '1,2,3,4,5,6')
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((n) => !Number.isNaN(n));
    const slots = (svc.bookingTimeSlots || '09:00,10:00,11:00,14:00,15:00,16:00,17:00')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (let d = 0; d <= 7; d++) {
      const candidate = addDaysToIso(curToday, d);
      const weekday = new Date(`${candidate}T12:00:00.000Z`).getUTCDay();
      if (!allowedDays.includes(weekday)) continue;
      if (candidate === curToday && !slots.some((s) => s > nowHhMm)) continue;
      return candidate;
    }
    return curToday;
  };

  const openNewBookingModal = () => {
    const defaultSvc = bookableItems[0];
    if (!defaultSvc) return;
    const initDate =
      selectedDate >= todayIso && viewMode === 'by_day'
        ? selectedDate
        : computeInitialOpenDate(defaultSvc);
    setSelectedItemId(defaultSvc.id);
    setNewStartDate(initDate);
    setNewEndDate(addDaysToIso(initDate, 1));
    setNewTimeSlot('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewNotes('');
    setNewBookingError(null);
    setShowNewModal(true);
  };

  const handleUpdateStatus = async (
    bookingId: string,
    status: 'confirmed' | 'completed' | 'cancelled',
  ) => {
    if (!token) return;
    setUpdatingBookingId(bookingId);
    setItineraryFeedback(null);
    try {
      const res = await fetch(
        `/api/v1/cashier/bookings/${encodeURIComponent(bookingId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'No se pudo actualizar la reserva.');
      }
      await onRefresh();
    } catch (err: any) {
      setItineraryFeedback(err.message || 'Error al actualizar el estado.');
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleCreateCounterBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedService) return;
    setNewBookingError(null);

    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      setNewBookingError('Ingresá el nombre y teléfono del cliente.');
      return;
    }
    if (selectedService.bookingMode !== 'days' && !newTimeSlot) {
      setNewBookingError('Seleccioná un horario disponible.');
      return;
    }

    const { todayIso: freshToday, currentHhMm: freshHhMm } = getParaguayNowStrings();
    if (
      selectedService.bookingMode !== 'days' &&
      (newStartDate < freshToday || (newStartDate === freshToday && newTimeSlot <= freshHhMm))
    ) {
      setNewTimeSlot('');
      setNewBookingError('Ese horario ya pasó hoy. Elegí un turno posterior o una fecha futura.');
      return;
    }

    setSubmittingNew(true);
    try {
      const res = await fetch('/api/v1/cashier/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: selectedService.id,
          startDate: newStartDate,
          endDate: selectedService.bookingMode === 'days' ? newEndDate : newStartDate,
          timeSlot: selectedService.bookingMode === 'days' ? null : newTimeSlot,
          customerName: newCustomerName.trim(),
          customerPhone: newCustomerPhone.trim(),
          notes: newNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || 'No se pudo registrar la reserva.');
      }

      setViewMode('by_day');
      setSelectedDate(newStartDate);
      setShowNewModal(false);
      setItineraryFeedback(
        `✓ Reserva agendada para ${formatDisplayDate(newStartDate)}${newTimeSlot ? ` a las ${newTimeSlot}` : ''}.`,
      );
      await onRefresh();
    } catch (err: any) {
      setNewBookingError(err.message || 'Error al guardar la reserva.');
    } finally {
      setSubmittingNew(false);
    }
  };

  const filteredBookings = useMemo(() => {
    const base = includeCancelled
      ? bookings
      : bookings.filter((b) => b.status !== 'cancelled');

    if (viewMode === 'by_day') {
      return base
        .filter((b) =>
          b.bookingMode === 'days' && b.startDate !== b.endDate
            ? b.startDate <= selectedDate && selectedDate < b.endDate
            : b.startDate === selectedDate,
        )
        .sort((a, b) => (a.timeSlot || '00:00').localeCompare(b.timeSlot || '00:00'));
    }

    return base
      .filter((b) =>
        b.bookingMode === 'days' && b.startDate !== b.endDate
          ? b.endDate > todayIso
          : b.startDate > todayIso,
      )
      .sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) ||
          (a.timeSlot || '00:00').localeCompare(b.timeSlot || '00:00'),
      );
  }, [bookings, includeCancelled, viewMode, selectedDate, todayIso]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / ITINERARY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice(
    (safePage - 1) * ITINERARY_PAGE_SIZE,
    safePage * ITINERARY_PAGE_SIZE,
  );

  const { currentHhMm } = getParaguayNowStrings();

  return (
    <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>Itinerario de Turnos y Reservas</span>
          </h2>
          <p className="text-xs text-gray-400">
            Consultá la agenda del día o próximos días y agendá al instante si un cliente consulta en mostrador.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewBookingModal}
          disabled={bookableItems.length === 0}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-950 font-extrabold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Reserva</span>
        </button>
      </div>

      {bookableItems.length === 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
          Todavía no hay servicios con reservas habilitadas. El dueño debe activar <strong>Reservas</strong> en un servicio desde el Panel de Dueño.
        </div>
      )}

      {itineraryFeedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center justify-between">
          <span>{itineraryFeedback}</span>
          <button
            type="button"
            onClick={() => setItineraryFeedback(null)}
            className="text-gray-400 hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Controls: View Mode + Day Stepper / Filter */}
      <div className="space-y-3 bg-[#0B0F19]/70 border border-[#24324D] rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('by_day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'by_day'
                  ? 'bg-emerald-500 text-gray-950'
                  : 'bg-[#151D2F] text-gray-300 hover:text-white'
              }`}
            >
              Agenda por Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode('upcoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'upcoming'
                  ? 'bg-emerald-500 text-gray-950'
                  : 'bg-[#151D2F] text-gray-300 hover:text-white'
              }`}
            >
              Próximos Días
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIncludeCancelled((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
              includeCancelled
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-[#151D2F] text-gray-400 border-[#24324D]'
            }`}
          >
            {includeCancelled ? 'Mostrando canceladas' : 'Ocultar canceladas'}
          </button>
        </div>

        {viewMode === 'by_day' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1E293B]">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Hoy', date: todayIso },
                { label: 'Mañana', date: tomorrowIso },
                { label: 'Pasado Mañana', date: dayAfterIso },
              ].map((preset) => (
                <button
                  key={preset.date}
                  type="button"
                  onClick={() => setSelectedDate(preset.date)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    selectedDate === preset.date
                      ? 'bg-indigo-500 text-white'
                      : 'bg-[#151D2F] text-gray-300 hover:text-white border border-[#24324D]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDate(addDaysToIso(selectedDate, -1))}
                className="p-2 rounded-lg bg-[#151D2F] border border-[#24324D] text-gray-300 hover:text-white"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-[#151D2F] border border-[#24324D] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(addDaysToIso(selectedDate, 1))}
                className="p-2 rounded-lg bg-[#151D2F] border border-[#24324D] text-gray-300 hover:text-white"
                title="Día siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bookings List */}
      {paginatedBookings.length === 0 ? (
        <div className="bg-[#0B0F19]/60 border border-[#24324D] rounded-2xl p-8 text-center space-y-2">
          <Clock className="w-8 h-8 text-gray-500 mx-auto" />
          <p className="text-sm font-bold text-gray-300">
            {viewMode === 'by_day'
              ? `Sin reservas para ${formatDisplayDate(selectedDate)}.`
              : 'No hay reservas agendadas para los próximos días.'}
          </p>
          <p className="text-xs text-gray-500">
            Tocá <strong>+ Nueva Reserva</strong> si un cliente quiere agendar un turno ahora mismo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedBookings.map((b) => (
            <div
              key={b.id}
              className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-bold">
                    {b.bookingMode === 'days'
                      ? `${formatDisplayDate(b.startDate)} → ${formatDisplayDate(b.endDate)}`
                      : `${formatDisplayDate(b.startDate)} • ${b.timeSlot || '-'}`}
                  </span>
                  <span className="text-sm font-bold text-white">{b.itemName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      b.status === 'confirmed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : b.status === 'completed'
                          ? 'bg-blue-500/15 text-blue-300'
                          : b.status === 'cancelled'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {b.status === 'pending'
                      ? 'Pendiente'
                      : b.status === 'confirmed'
                        ? 'Confirmada'
                        : b.status === 'completed'
                          ? 'Completada'
                          : 'Cancelada'}
                  </span>
                </div>

                <div className="text-xs text-gray-300 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    {b.customerName}
                  </span>
                  <a
                    href={`tel:${b.customerPhone}`}
                    className="inline-flex items-center gap-1 text-emerald-400 font-mono hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    {b.customerPhone}
                  </a>
                  {b.notes && <span className="italic text-gray-400">"{b.notes}"</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {b.status === 'pending' && (
                  <button
                    type="button"
                    disabled={updatingBookingId === b.id}
                    onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                    className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar</span>
                  </button>
                )}
                {(b.status === 'pending' || b.status === 'confirmed') && (
                  <>
                    <button
                      type="button"
                      onClick={() => onLoadToCheckout(b)}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-xl text-xs font-extrabold inline-flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Cobrar</span>
                    </button>
                    <button
                      type="button"
                      disabled={updatingBookingId === b.id}
                      onClick={() => handleUpdateStatus(b.id, 'completed')}
                      className="px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completar</span>
                    </button>
                    <button
                      type="button"
                      disabled={updatingBookingId === b.id}
                      onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                      className="px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#24324D]">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-2 rounded-xl bg-[#0B0F19] border border-[#24324D] text-xs font-bold text-gray-200 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>
          <span className="text-xs font-mono text-gray-400">
            Pág. <strong className="text-white">{safePage}</strong> de {totalPages} ({filteredBookings.length})
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-2 rounded-xl bg-[#0B0F19] border border-[#24324D] text-xs font-bold text-gray-200 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Counter Booking Modal */}
      {showNewModal && selectedService && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#24324D] rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Agendar Nueva Reserva en Caja</h3>
                <p className="text-[11px] text-gray-400">
                  Verificá disponibilidad y reservá turno para hoy, mañana o cualquier fecha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-xl bg-[#151D2F] text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCounterBooking} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Servicio *</label>
                <select
                  value={selectedService.id}
                  onChange={(e) => {
                    const nextSvc = bookableItems.find((i) => i.id === e.target.value);
                    setSelectedItemId(e.target.value);
                    setNewTimeSlot('');
                    if (nextSvc) {
                      const suggested = computeInitialOpenDate(nextSvc);
                      setNewStartDate(suggested);
                      setNewEndDate(addDaysToIso(suggested, 1));
                    }
                  }}
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-bold text-white"
                >
                  {bookableItems.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} — Gs. {svc.effectivePrice.toLocaleString('es-PY')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Date Shortcuts */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">Atajo de fecha</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Hoy', date: todayIso },
                    { label: 'Mañana', date: tomorrowIso },
                    { label: 'Pasado Mañana', date: dayAfterIso },
                  ].map((p) => (
                    <button
                      key={p.date}
                      type="button"
                      onClick={() => {
                        setNewStartDate(p.date);
                        if (newEndDate <= p.date) setNewEndDate(addDaysToIso(p.date, 1));
                        setNewTimeSlot('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        newStartDate === p.date
                          ? 'bg-emerald-500 text-gray-950'
                          : 'bg-[#0B0F19] border border-[#24324D] text-gray-300 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedService.bookingMode === 'days' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Entrada</label>
                    <input
                      type="date"
                      required
                      min={todayIso}
                      value={newStartDate}
                      onChange={(e) => {
                        setNewStartDate(e.target.value);
                        if (newEndDate <= e.target.value) setNewEndDate(addDaysToIso(e.target.value, 1));
                      }}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Salida</label>
                    <input
                      type="date"
                      required
                      min={newStartDate}
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Fecha *</label>
                    <input
                      type="date"
                      required
                      min={todayIso}
                      value={newStartDate}
                      onChange={(e) => {
                        setNewStartDate(e.target.value);
                        setNewTimeSlot('');
                      }}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                      Horarios disponibles {loadingAvailability ? '(consultando...)' : ''}
                    </label>
                    {(() => {
                      const allowedDays = (selectedService.bookingDaysOfWeek || '1,2,3,4,5,6')
                        .split(',')
                        .map((d) => Number(d.trim()));
                      const weekday = new Date(`${newStartDate}T12:00:00.000Z`).getUTCDay();
                      if (!allowedDays.includes(weekday)) {
                        return (
                          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                            El local no atiende este día. Elegí otra fecha.
                          </div>
                        );
                      }
                      const slots = (
                        selectedService.bookingTimeSlots || '09:00,10:00,11:00,14:00,15:00,16:00,17:00'
                      )
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const maxConcurrent = selectedService.bookingMaxConcurrent || 1;
                      const allPassed =
                        slots.length > 0 &&
                        slots.every(
                          (slot) =>
                            newStartDate < todayIso || (newStartDate === todayIso && slot <= currentHhMm),
                        );
                      if (allPassed) {
                        return (
                          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                            Ya pasaron todos los horarios por hoy. Probá con Mañana o Pasado Mañana.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-4 gap-2">
                          {slots.map((slot) => {
                            const booked =
                              availabilityCounts.find(
                                (a) => a.date === newStartDate && a.timeSlot === slot,
                              )?.bookedCount || 0;
                            const full = booked >= maxConcurrent;
                            const isPast =
                              newStartDate < todayIso ||
                              (newStartDate === todayIso && slot <= currentHhMm);
                            const disabled = full || isPast;
                            const selected = !disabled && newTimeSlot === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={disabled}
                                onClick={() => setNewTimeSlot(slot)}
                                className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                                  disabled
                                    ? 'bg-[#0B0F19] border-[#1E293B] text-gray-600 line-through cursor-not-allowed'
                                    : selected
                                      ? 'bg-emerald-500 text-gray-950 border-transparent'
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

              <div className="space-y-2.5 pt-2 border-t border-[#1E293B]">
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Nombre del cliente *"
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <input
                  type="tel"
                  required
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp (ej: 0981 123 456) *"
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3.5 py-2 text-xs font-mono text-white"
                />
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Nota opcional..."
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              {newBookingError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  {newBookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingNew}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs rounded-xl disabled:opacity-50"
              >
                {submittingNew ? 'Guardando reserva...' : 'Confirmar Reserva en Agenda'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
