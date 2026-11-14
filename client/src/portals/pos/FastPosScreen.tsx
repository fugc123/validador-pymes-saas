import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Radio,
  Loader2,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowLeft,
  Package,
  Wrench,
  History,
  Tag,
} from 'lucide-react';

interface TransferResult {
  id: string;
  operationId: string;
  payerName: string;
  amount: number;
  payerBank?: string;
  operationDate: string;
  status: string;
  receiptNumber?: string;
  concept?: string;
}

interface SubscriptionStatus {
  status: string;
  daysRemaining: number;
  isLifetime?: boolean;
}

interface PosCatalogItem {
  id: string;
  itemType: 'product' | 'service';
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  imageUrl: string | null;
  isDiscountActive: boolean;
  effectiveDiscountPercent: number;
  effectivePrice: number;
}

interface CartLine {
  item: PosCatalogItem;
  quantity: number;
}

interface CashierSaleRecord {
  id: string;
  cashierName: string;
  customerName: string | null;
  customerRuc?: string | null;
  customerEmail?: string | null;
  concept: string | null;
  saleMode: 'catalog' | 'quick_amount';
  paymentMethod: 'TRANSFER' | 'CASH' | 'CARD';
  transferId: string | null;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    id: string;
    itemName: string;
    quantity: number;
    lineTotal: number;
  }>;
}

export const FastPosScreen: React.FC = () => {
  const { user, activeTenant, logout, switchTenant, availableMemberships, token, openTenantSelector } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  // Pre-screen & Checkout state
  const [activeTab, setActiveTab] = useState<'catalog' | 'quick_amount' | 'history'>('catalog');
  const [step, setStep] = useState<'checkout' | 'transfer_verify'>('checkout');
  const [catalogItems, setCatalogItems] = useState<PosCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  // Quick amount ("Monto Libre + Qué pasó") state
  const [quickAmount, setQuickAmount] = useState('');
  const [quickConcept, setQuickConcept] = useState('');

  // Shared checkout fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRuc, setCustomerRuc] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] =  useState<'TRANSFER' | 'CASH' | 'CARD'>('TRANSFER');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completedSaleBanner, setCompletedSaleBanner] = useState<{
    total: number;
    method: string;
    summary: string;
    sifenCdc?: string;
    sifenNumero?: string;
    loyaltyMessage?: string;
    loyaltyWhatsAppUrl?: string;
  } | null>(null);

  // SIFEN Electronic Invoicing state (only enabled for Free/Lifetime own merchants)
  const [sifenEnabled, setSifenEnabled] = useState(false);
  const [sifenEmitInvoice, setSifenEmitInvoice] = useState(true);
  const [sifenReceptorRuc, setSifenReceptorRuc] = useState('');

  // Recent sales history
  const [recentSales, setRecentSales] = useState<CashierSaleRecord[]>([]);

  // Transfer Radar verification state
  const [amount, setAmount] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [radarActive, setRadarActive] = useState(false);
  const [radarCountdown, setRadarCountdown] = useState(60);
  const [match, setMatch] = useState<TransferResult | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<TransferResult[]>([]);
  const [replayAlert, setReplayAlert] = useState<{ claimedAt: string; message: string } | null>(null);
  const [claimedSuccess, setClaimedSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const radarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortRef = useRef(false);

  const stopRadar = useCallback(() => {
    searchAbortRef.current = true;
    if (radarTimerRef.current) {
      clearInterval(radarTimerRef.current);
      radarTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setRadarActive(false);
    setSearching(false);
  }, []);

  useEffect(() => {
    return () => {
      stopRadar();
    };
  }, [stopRadar]);

  const fetchCashierData = useCallback(async () => {
    if (!token) return;
    setLoadingCatalog(true);
    try {
      const [catRes, salesRes, subRes] = await Promise.all([
        fetch('/api/v1/cashier/catalog', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/cashier/sales', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/subscription/status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCatalogItems(catData.items || []);
      }
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setRecentSales(salesData.sales || []);
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
      const sifenRes = await fetch('/api/v1/sifen/cashier/status', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (sifenRes && sifenRes.ok) {
        const sifenJson = await sifenRes.json();
        setSifenEnabled(Boolean(sifenJson?.data?.isFreeMerchant && sifenJson?.data?.enabled));
      } else {
        setSifenEnabled(false);
      }
    } catch {
      // ignore network error on initial load
    } finally {
      setLoadingCatalog(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCashierData();
  }, [fetchCashierData, activeTenant?.tenantId]);

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return catalogItems;
    const q = catalogSearch.toLowerCase();
    return catalogItems.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q),
    );
  }, [catalogItems, catalogSearch]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + line.item.effectivePrice * line.quantity, 0);
  }, [cart]);

  const parsedQuickAmount = useMemo(() => {
    const clean = parseInt(quickAmount.replace(/[^0-9]/g, ''), 10);
    return isNaN(clean) ? 0 : clean;
  }, [quickAmount]);

  const effectiveCheckoutTotal = activeTab === 'quick_amount' ? parsedQuickAmount : cartTotal;

  const addToCart = (item: PosCatalogItem) => {
    setSaleError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      const hasStockLimit = item.itemType === 'product' && item.stock !== null;
      const maxStock = hasStockLimit ? (item.stock as number) : 9999;
      if (existing) {
        if (existing.quantity >= maxStock) {
          setSaleError(`Stock máximo alcanzado para "${item.name}" (${maxStock} disponibles).`);
          return prev;
        }
        return prev.map((l) => (l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      if (hasStockLimit && maxStock <= 0) {
        setSaleError(`"${item.name}" no tiene stock disponible.`);
        return prev;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setSaleError(null);
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.item.id !== itemId) return l;
          const nextQty = l.quantity + delta;
          if (nextQty <= 0) return null;
          if (l.item.itemType === 'product' && l.item.stock !== null && nextQty > l.item.stock) {
            setSaleError(`Solo quedan ${l.item.stock} unidades de "${l.item.name}".`);
            return l;
          }
          return { ...l, quantity: nextQty };
        })
        .filter(Boolean) as CartLine[],
    );
  };

  const resetCheckoutForm = () => {
    stopRadar();
    setCart([]);
    setQuickAmount('');
    setQuickConcept('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerRuc('');
    setSifenReceptorRuc('');
    setCustomerEmail('');
    setMatch(null);
    setReplayAlert(null);
    setNotFound(false);
    setClaimedSuccess(false);
    setAmount('');
    setPayerName('');
    setSaleError(null);
    setStep('checkout');
  };

  const submitSaleToBackend = async (linkedTransferId?: string) => {
    if (!token) return;
    setSubmittingSale(true);
    setSaleError(null);

    const isQuick = activeTab === 'quick_amount';
    const payload = {
      customerName: customerName.trim() || match?.payerName || null,
      customerPhone: customerPhone.trim() || null,
      customerRuc: customerRuc.trim() || null,
      customerEmail: customerEmail.trim() || null,
      concept: isQuick ? quickConcept.trim() || 'Cobro rápido en caja' : null,
      cashierName: user?.fullName || 'Cajero',
      saleMode: isQuick ? 'quick_amount' : 'catalog',
      paymentMethod,
      transferId: linkedTransferId || null,
      quickAmount: isQuick ? parsedQuickAmount : undefined,
      items: isQuick
        ? undefined
        : cart.map((l) => ({
            itemId: l.item.id,
            quantity: l.quantity,
          })),
    };

    try {
      const res = await fetch('/api/v1/cashier/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo registrar la venta.');
      }

      AudioSynthesizer.playSuccessChime();
      const summaryText = isQuick
        ? payload.concept || 'Cobro rápido'
        : `${cart.reduce((s, c) => s + c.quantity, 0)} ítem(s) vendidos`;

      let emittedCdc: string | undefined;
      let emittedNum: string | undefined;
      if (sifenEnabled && sifenEmitInvoice) {
        try {
          const sifenEmitRes = await fetch('/api/v1/sifen/cashier/emit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              saleId: data.sale?.id || data.id || null,
              receptorRuc: customerRuc.trim() || sifenReceptorRuc.trim() || '44444401',
              receptorNombre: customerName.trim() || match?.payerName || 'CONSUMIDOR FINAL',
              receptorEmail: customerEmail.trim() || undefined,
              totalAmount: data.sale?.totalAmount || data.totalAmount || effectiveCheckoutTotal,
              items: isQuick
                ? [
                    {
                      codigo: 'POS-QUICK',
                      descripcion: payload.concept || 'Cobro rápido en caja',
                      cantidad: 1,
                      precioUnitario: parsedQuickAmount,
                      ivaTasa: 10,
                    },
                  ]
                : cart.map((l) => ({
                    codigo: l.item.id,
                    descripcion: l.item.name,
                    cantidad: l.quantity,
                    precioUnitario: l.item.effectivePrice,
                    ivaTasa: 10,
                  })),
            }),
          });
          if (sifenEmitRes.ok) {
            const sifenEmitJson = await sifenEmitRes.json();
            emittedCdc = sifenEmitJson?.data?.cdc;
            emittedNum = sifenEmitJson?.data?.numeroDocumento;
          }
        } catch {
          // Non-blocking if SIFEN emit fails
        }
      }

      const loyalty = data?.loyaltyUpdate;
      const loyaltyMessage =
        loyalty?.programEnabled && loyalty?.card
          ? loyalty.couponEarned
            ? `🎉 ¡Completó tarjeta! Cupón generado: ${loyalty.couponEarned.code} (${loyalty.couponEarned.rewardTitle})`
            : `⭐ Visita sumada: ${loyalty.card.stampsCount}/${loyalty.stampsRequired} sellos`
          : undefined;
      let loyaltyWhatsAppUrl: string | undefined;
      if (loyalty?.programEnabled && loyalty?.card?.cardToken && loyalty?.card?.customerPhone) {
        const rawDigits = String(loyalty.card.customerPhone).replace(/\D/g, '');
        const waPhone = rawDigits.startsWith('0') ? `595${rawDigits.slice(1)}` : rawDigits;
        const cardUrl = `${window.location.origin}/fidelidad/${loyalty.card.cardToken}`;
        const msg = `¡Gracias por tu compra! Acá podés ver tus sellos (${loyalty.card.stampsCount}/${loyalty.stampsRequired}) y cupones: ${cardUrl}`;
        loyaltyWhatsAppUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
      }

      setCompletedSaleBanner({
        total: data.totalAmount || effectiveCheckoutTotal,
        method:
          paymentMethod === 'TRANSFER'
            ? 'Transferencia SIPAP'
            : paymentMethod === 'CASH'
              ? 'Efectivo'
              : 'Tarjeta / POS',
        summary: summaryText,
        sifenCdc: emittedCdc,
        sifenNumero: emittedNum,
        loyaltyMessage,
        loyaltyWhatsAppUrl,
      });

      resetCheckoutForm();
      await fetchCashierData();
      setTimeout(() => setCompletedSaleBanner(null), 5000);
    } catch (err: any) {
      setSaleError(err.message || 'Error al concretar la venta.');
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleProceedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);

    if (activeTab === 'catalog' && cart.length === 0) {
      setSaleError('Agregá al menos un producto o servicio al carrito, o usá la pestaña "Cobro Rápido".');
      return;
    }

    if (activeTab === 'quick_amount') {
      if (parsedQuickAmount <= 0) {
        setSaleError('Ingresá un monto válido mayor a Gs. 0.');
        return;
      }
      if (!quickConcept.trim()) {
        setSaleError('Escribí brevemente qué pasó o el concepto del cobro.');
        return;
      }
    }

    if (paymentMethod === 'TRANSFER') {
      // Move to SIPAP transfer verification screen with the exact sale total locked
      setAmount(effectiveCheckoutTotal.toString());
      setPayerName(customerName.trim());
      setMatch(null);
      setReplayAlert(null);
      setNotFound(false);
      setClaimedSuccess(false);
      setStep('transfer_verify');
      return;
    }

    // Direct completion for CASH or CARD
    await submitSaleToBackend();
  };

  const selectCandidate = (candidate: TransferResult) => {
    setMatch(candidate);
    setMatchCandidates([]);
  };

  const checkTransfer = async (cleanAmount: number, payerFilter?: string): Promise<'match' | 'claimed' | 'not_found'> => {
    try {
      const res = await fetch('/api/v1/cashier/transfers/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: cleanAmount,
          payerFilter: payerFilter || undefined,
        }),
      });

      if (res && res.ok) {
        const data = await res.json();
        if (data.found && data.transfers && data.transfers.length > 0) {
          const item = data.transfers[0];
          AudioSynthesizer.playSuccessChime();
          setMatch({
            id: item.id,
            operationId: item.operationId,
            payerName: item.payerName,
            payerBank: item.payerBank || 'SIPAP',
            amount: item.amount,
            operationDate: item.operationDate,
            status: 'pending',
          });
          return 'match';
        } else if (data.status === 'already_claimed') {
          AudioSynthesizer.playAlertWarning();
          setReplayAlert({
            claimedAt: data.claimedAt ? new Date(data.claimedAt).toLocaleTimeString() : 'Hace instantes',
            message: data.message || '⛔ NO entregar mercadería. Comprobante ya cobrado previamente.',
          });
          return 'claimed';
        }
      }
      return 'not_found';
    } catch {
      return 'not_found';
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!cleanAmount || isNaN(cleanAmount)) return;

    stopRadar();
    setSearching(true);
    setMatch(null);
    setReplayAlert(null);
    setNotFound(false);
    setClaimedSuccess(false);

    const payerFilter = payerName.trim() || undefined;
    const initialStatus = await checkTransfer(cleanAmount, payerFilter);
    setSearching(false);

    if (initialStatus === 'match' || initialStatus === 'claimed') {
      return;
    }

    setRadarActive(true);
    setRadarCountdown(60);
    searchAbortRef.current = false;

    let secondsLeft = 60;
    countdownTimerRef.current = setInterval(() => {
      secondsLeft -= 1;
      setRadarCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        stopRadar();
        AudioSynthesizer.playAlertWarning();
        setNotFound(true);
      }
    }, 1000);

    radarTimerRef.current = setInterval(async () => {
      if (searchAbortRef.current) return;
      const pollStatus = await checkTransfer(cleanAmount, payerFilter);
      if (pollStatus === 'match' || pollStatus === 'claimed') {
        stopRadar();
      }
    }, 3000);
  };

  const handleClaimAndCompleteSale = async () => {
    if (!match) return;
    stopRadar();
    setClaimedSuccess(true);
    await submitSaleToBackend(match.id);
  };

  const isSubBlocked = subscription?.status === 'cancelled' || subscription?.status === 'past_due';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-[#24324D] bg-[#151D2F] px-3 sm:px-6 py-2.5 h-14 sm:h-16 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-1.5 min-w-0">
              <span className="text-sm sm:text-base truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[260px]">
                {activeTenant?.merchantName || 'Mi Comercio'}
              </span>
              <span className="shrink-0 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                CAJA POS
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
              Cajero: {user?.fullName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {availableMemberships.some((m) => m.tenantId === activeTenant?.tenantId && m.role === 'MERCHANT_OWNER') && (
            <button
              onClick={() => switchTenant(activeTenant?.tenantId || '', 'MERCHANT_OWNER')}
              className="text-xs text-emerald-400 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/10 flex items-center gap-1.5 transition-colors font-semibold shadow-sm"
              title="Volver al panel administrativo de dueño"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Panel de Dueño</span>
            </button>
          )}

          {availableMemberships.length > 1 && (
            <button
              onClick={openTenantSelector}
              className="text-xs text-gray-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#24324D] hover:border-gray-500 bg-[#0B0F19]/60 flex items-center gap-1.5 transition-colors"
              title="Cambiar de sucursal o rol"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sucursales</span>
            </button>
          )}

          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#0B0F19] transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Subscription Alert Banner */}
      {subscription && (() => {
        if (subscription.isLifetime || subscription.daysRemaining > 365) {
          return null;
        }
        const { status, daysRemaining } = subscription;
        if (status === 'cancelled' || status === 'past_due') {
          return (
            <div className="mx-4 mt-2 px-4 py-3 rounded-xl text-sm font-mono bg-red-500/10 border border-red-500/30 text-red-300 text-center">
              ⚠️ La suscripción de este comercio está vencida. Avisale al dueño o administrador para reactivar el servicio.
            </div>
          );
        }
        if (daysRemaining <= 5 && (status === 'trial' || status === 'active')) {
          return (
            <div className="mx-4 mt-2 px-4 py-3 rounded-xl text-sm font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center">
              ⏳ La suscripción de este comercio vence en {daysRemaining} días. Avisale al dueño o administrador.
            </div>
          );
        }
        return null;
      })()}

      {/* Completed Sale Notification Toast */}
      {completedSaleBanner && (
        <div className="max-w-5xl mx-auto w-full px-4 mt-4">
          <div className="bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 text-gray-950 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase text-emerald-400">
                  ¡Venta Concretada y Registrada!
                </div>
                <div className="text-sm text-white font-bold">
                  Gs. {completedSaleBanner.total.toLocaleString('es-PY')} • {completedSaleBanner.method} ({completedSaleBanner.summary})
                </div>
                {completedSaleBanner.sifenCdc && (
                  <div className="text-[11px] font-mono text-purple-300 mt-1">
                    🧾 Factura SIFEN N° {completedSaleBanner.sifenNumero} • CDC: {completedSaleBanner.sifenCdc}
                  </div>
                )}
                {completedSaleBanner.loyaltyMessage && (
                  <div className="text-[11px] font-bold text-amber-300 mt-1 flex flex-wrap items-center gap-2">
                    <span>{completedSaleBanner.loyaltyMessage}</span>
                    {completedSaleBanner.loyaltyWhatsAppUrl && (
                      <a
                        href={completedSaleBanner.loyaltyWhatsAppUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 bg-emerald-500 text-gray-950 rounded-md text-[10px] font-extrabold hover:bg-emerald-400"
                      >
                        Enviar por WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setCompletedSaleBanner(null)}
              className="text-xs text-gray-300 hover:text-white px-3 py-1 rounded-lg bg-[#0B0F19]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6">
        {step === 'checkout' ? (
          <div className="space-y-5">
            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-[#151D2F] border border-[#24324D] p-2 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('catalog');
                  setSaleError(null);
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'catalog'
                    ? 'bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-500/20'
                    : 'text-gray-300 hover:text-white bg-[#0B0F19]/60'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>1. Catálogo / Inventario</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('quick_amount');
                  setSaleError(null);
                }}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'quick_amount'
                    ? 'bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-500/20'
                    : 'text-gray-300 hover:text-white bg-[#0B0F19]/60'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>2. Cobro Rápido (Monto Libre)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white bg-[#0B0F19]/60'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Mis Ventas ({recentSales.length})</span>
              </button>
            </div>

            {activeTab === 'history' ? (
              <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-white">Últimas Ventas Registradas en Caja</h2>
                  <button
                    onClick={fetchCashierData}
                    className="text-xs text-emerald-400 hover:underline font-semibold"
                  >
                    Actualizar
                  </button>
                </div>

                {recentSales.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">
                    Todavía no se registraron ventas en este turno.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentSales.map((s) => (
                      <div
                        key={s.id}
                        className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {s.paymentMethod === 'TRANSFER'
                                ? 'Transferencia SIPAP'
                                : s.paymentMethod === 'CASH'
                                  ? 'Efectivo'
                                  : 'Tarjeta'}
                            </span>
                            <span className="text-xs text-gray-400">
                              Cajero: <strong className="text-gray-200">{s.cashierName}</strong>
                            </span>
                            {s.customerName && (
                              <span className="text-xs text-gray-400">
                                • Cliente: <strong className="text-gray-200">{s.customerName}</strong>
                              </span>
                            )}
                            {s.customerRuc && (
                              <span className="text-xs text-gray-400 font-mono">
                                • RUC: <strong className="text-gray-300">{s.customerRuc}</strong>
                              </span>
                            )}
                            {s.customerEmail && (
                              <span className="text-xs text-gray-400">
                                • Email: <span className="text-gray-300">{s.customerEmail}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-300">
                            {s.saleMode === 'quick_amount'
                              ? `Cobro rápido: ${s.concept || 'Monto libre'}`
                              : s.items.map((i) => `${i.quantity}x ${i.itemName}`).join(', ')}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-mono font-black text-emerald-400">
                            Gs. {s.totalAmount.toLocaleString('es-PY')}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            {new Date(s.createdAt).toLocaleString('es-PY')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Product/Service Selector OR Quick Amount Form */}
                <div className="lg:col-span-7 bg-[#151D2F] border border-[#24324D] rounded-3xl p-5 sm:p-6 space-y-5">
                  {activeTab === 'catalog' ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-black text-white">Seleccionar Productos o Servicios</h2>
                          <p className="text-xs text-gray-400">
                            Tocá un ítem para sumarlo a la compra. El stock se descuenta automáticamente al concretar.
                          </p>
                        </div>
                        <div className="relative w-full sm:w-56">
                          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                            placeholder="Buscar ítem..."
                            className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {loadingCatalog ? (
                        <div className="py-12 text-center text-xs text-gray-400">Cargando catálogo...</div>
                      ) : filteredCatalog.length === 0 ? (
                        <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-8 text-center space-y-3">
                          <Package className="w-8 h-8 text-gray-500 mx-auto" />
                          <p className="text-sm font-bold text-gray-300">
                            No hay productos o servicios cargados todavía.
                          </p>
                          <p className="text-xs text-gray-400">
                            El administrador puede crear productos y servicios desde el Panel de Dueño, o podés usar la pestaña <strong>"Cobro Rápido (Monto Libre)"</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('quick_amount')}
                            className="px-4 py-2 bg-emerald-500 text-gray-950 font-bold text-xs rounded-xl"
                          >
                            Ir a Cobro Rápido
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                          {filteredCatalog.map((item) => {
                            const outOfStock = item.itemType === 'product' && item.stock !== null && item.stock <= 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={outOfStock}
                                onClick={() => addToCart(item)}
                                className={`text-left bg-[#0B0F19] border rounded-2xl p-3.5 transition-all flex items-start gap-3 ${
                                  outOfStock
                                    ? 'border-[#1E293B] opacity-50 cursor-not-allowed'
                                    : 'border-[#24324D] hover:border-emerald-500/60 hover:bg-[#101726]'
                                }`}
                              >
                                {item.imageUrl && (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#24324D]"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#151D2F] text-gray-300 border border-[#24324D]">
                                      {item.itemType === 'service' ? 'Servicio' : item.stock === null ? 'Disponible' : `Stock: ${item.stock}`}
                                    </span>
                                    {item.isDiscountActive && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                                        <Tag className="w-2.5 h-2.5" />-{item.effectiveDiscountPercent}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-bold text-sm text-white truncate mt-1.5">
                                    {item.name}
                                  </div>
                                  <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-base font-mono font-black text-emerald-400">
                                      Gs. {item.effectivePrice.toLocaleString('es-PY')}
                                    </span>
                                    {item.isDiscountActive && (
                                      <span className="text-xs font-mono text-gray-500 line-through">
                                        Gs. {item.price.toLocaleString('es-PY')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-lg font-black text-white">Cobro Rápido — Monto Libre</h2>
                        <p className="text-xs text-gray-400">
                          Ingresá el monto a cobrar y describí brevemente qué se vendió o qué servicio se realizó.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-2">
                          1. Monto a Cobrar (Guaraníes)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-2xl font-mono font-bold text-gray-500">
                            Gs.
                          </span>
                          <input
                            type="text"
                            value={quickAmount}
                            onChange={(e) => setQuickAmount(e.target.value)}
                            placeholder="Ej: 45.000"
                            className="w-full bg-[#0B0F19] border-2 border-[#24324D] focus:border-emerald-500 rounded-2xl pl-16 pr-5 py-3 text-2xl sm:text-3xl font-mono font-extrabold text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-300 mb-2">
                          2. ¿Qué pasó? / Concepto de la Venta
                        </label>
                        <input
                          type="text"
                          value={quickConcept}
                          onChange={(e) => setQuickConcept(e.target.value)}
                          placeholder="Ej: Impresión color 30 hojas + carpeta, servicio técnico..."
                          className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Order Summary, Payment Method & Action */}
                <form
                  onSubmit={handleProceedCheckout}
                  className="lg:col-span-5 bg-[#151D2F] border border-[#24324D] rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[#24324D] pb-3">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                      <span>Resumen de la Venta</span>
                    </h3>
                    {activeTab === 'catalog' && cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-xs text-red-400 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Vaciar</span>
                      </button>
                    )}
                  </div>

                  {/* Cart Items List (when in catalog mode) */}
                  {activeTab === 'catalog' && (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto">
                      {cart.length === 0 ? (
                        <div className="text-xs text-gray-500 text-center py-6 bg-[#0B0F19]/60 rounded-2xl border border-[#24324D]">
                          Seleccioná productos o servicios de la izquierda para armar la compra.
                        </div>
                      ) : (
                        cart.map((line) => (
                          <div
                            key={line.item.id}
                            className="bg-[#0B0F19] border border-[#24324D] rounded-xl p-3 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">{line.item.name}</div>
                              <div className="text-[11px] font-mono text-emerald-400">
                                Gs. {line.item.effectivePrice.toLocaleString('es-PY')} c/u
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateCartQty(line.item.id, -1)}
                                className="p-1.5 rounded-lg bg-[#151D2F] hover:bg-slate-700 text-gray-300"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-mono font-bold text-white">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(line.item.id, 1)}
                                className="p-1.5 rounded-lg bg-[#151D2F] hover:bg-slate-700 text-gray-300"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-xs font-mono font-bold text-white text-right min-w-[75px]">
                              Gs. {(line.item.effectivePrice * line.quantity).toLocaleString('es-PY')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Datos del Cliente (Opcionales) */}
                  <div className="space-y-3 p-4 bg-[#0B0F19]/60 border border-[#24324D] rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                        Datos del Cliente (Opcional)
                      </label>
                      <span className="text-[10px] font-mono text-gray-500">Consumidor Final si vacío</span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Nombre o Razón Social del cliente..."
                          className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Celular del cliente (ej: 0981 123 456) — suma visita de fidelidad..."
                          className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <input
                            type="text"
                            value={customerRuc}
                            onChange={(e) => {
                              setCustomerRuc(e.target.value);
                              setSifenReceptorRuc(e.target.value);
                            }}
                            placeholder="RUC o Cédula (Ej: 80012345-6)..."
                            className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="Email (Ej: cliente@gmail.com)..."
                            className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {sifenEnabled && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-purple-300">
                          🧾 Emitir Factura Electrónica SIFEN
                        </span>
                        <input
                          type="checkbox"
                          checked={sifenEmitInvoice}
                          onChange={(e) => setSifenEmitInvoice(e.target.checked)}
                          className="rounded border-purple-500 text-purple-600 focus:ring-purple-500"
                        />
                      </label>
                      {sifenEmitInvoice && (
                        <div className="text-[11px] text-purple-300/80 font-mono space-y-0.5">
                          <div>• Receptor: <strong>{customerName.trim() || match?.payerName || 'CONSUMIDOR FINAL'}</strong></div>
                          <div>• RUC: <strong>{customerRuc.trim() || sifenReceptorRuc.trim() || '44444401 (Sin Nombre)'}</strong></div>
                          {customerEmail.trim() && <div>• Correo: <strong>{customerEmail.trim()}</strong></div>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('TRANSFER')}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === 'TRANSFER'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-[#0B0F19] border-[#24324D] text-gray-400 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Transferencia</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CASH')}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === 'CASH'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-[#0B0F19] border-[#24324D] text-gray-400 hover:text-white'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Efectivo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('CARD')}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          paymentMethod === 'CARD'
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-md'
                            : 'bg-[#0B0F19] border-[#24324D] text-gray-400 hover:text-white'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Tarjeta / QR</span>
                      </button>
                    </div>
                  </div>

                  {/* Total Box */}
                  <div className="bg-[#0B0F19] border-2 border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-gray-400">Total a Cobrar</span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                      Gs. {effectiveCheckoutTotal.toLocaleString('es-PY')}
                    </span>
                  </div>

                  {saleError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                      {saleError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingSale || isSubBlocked}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {paymentMethod === 'TRANSFER' ? (
                      <>
                        <Search className="w-5 h-5" />
                        <span>Pasar a Validar Transferencia SIPAP</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>{submittingSale ? 'Registrando Venta...' : 'Concretar Venta Ahora'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: TRANSFER VERIFICATION SCREEN (WHEN PAYMENT METHOD === TRANSFER) */
          <div className="max-w-xl mx-auto space-y-5">
            <button
              type="button"
              onClick={() => {
                stopRadar();
                setStep('checkout');
              }}
              className="inline-flex items-center space-x-2 text-xs font-bold text-gray-300 hover:text-white bg-[#151D2F] border border-[#24324D] px-4 py-2 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Carrito / Cambiar Método de Pago</span>
            </button>

            <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl">
              <div className="mb-4 pb-3 border-b border-[#24324D] flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Validación de Transferencia para Concretar Venta
                </span>
                <span className="text-xs font-mono text-gray-400">
                  Cajero: {user?.fullName}
                </span>
              </div>

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
                      readOnly={effectiveCheckoutTotal > 0}
                      value={amount}
                      onChange={(e) => {
                        if (effectiveCheckoutTotal <= 0) setAmount(e.target.value);
                      }}
                      className="w-full bg-[#0B0F19] border-2 border-[#24324D] focus:border-emerald-500 rounded-2xl pl-16 pr-6 py-3.5 text-2xl sm:text-4xl font-mono font-extrabold text-white tracking-wide focus:outline-none transition-colors"
                      placeholder="26.000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                    2. Nombre del Pagador o Referencia (Opcional)
                  </label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#24324D] focus:border-emerald-500 rounded-xl px-5 py-3 text-base text-white focus:outline-none transition-colors"
                    placeholder="Ej. Chena, Duarte, Giménez o Nro. de comprobante..."
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="submit"
                    disabled={searching || radarActive || isSubBlocked}
                    className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-base sm:text-lg font-extrabold rounded-2xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {radarActive ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Radar Buscando ({radarCountdown}s)...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        <span>Verificar Transferencia</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopRadar();
                      setMatch(null);
                      setReplayAlert(null);
                      setNotFound(false);
                    }}
                    className="px-5 py-4 bg-[#0B0F19] hover:bg-[#1A253C] text-gray-400 hover:text-white border border-[#24324D] rounded-2xl transition-colors"
                    title="Reiniciar búsqueda"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>

            {saleError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-xs text-red-300">
                {saleError}
              </div>
            )}

            {/* State Display: Radar Searching Card */}
            {radarActive && (
              <div className="bg-emerald-950/30 border-2 border-emerald-500/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-emerald-500/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Radio className="w-6 h-6 animate-pulse text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                        Radar Activo — Esperando Acreditación
                      </div>
                      <div className="text-sm text-gray-200 mt-0.5">
                        Buscando{' '}
                        <strong className="text-white font-mono">
                          Gs. {parseInt(amount.replace(/[^0-9]/g, '') || '0').toLocaleString('es-PY')}
                        </strong>{' '}
                        en vivo...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-400">
                      {radarCountdown}s
                    </span>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Restante</span>
                  </div>
                </div>

                <div className="w-full bg-[#0B0F19] rounded-full h-2.5 overflow-hidden border border-[#24324D] mb-4">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(radarCountdown / 60) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span className="flex items-center space-x-1.5 text-gray-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>En cuanto el banco procese la transferencia, sonará la campana.</span>
                  </span>
                  <button
                    type="button"
                    onClick={stopRadar}
                    className="px-3.5 py-1.5 bg-[#0B0F19] hover:bg-[#1A253C] text-gray-300 hover:text-white rounded-xl border border-[#24324D] transition-colors font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* State Display: Selectable Match List (amount-only searches) */}
            {matchCandidates.length > 0 && (
              <div className="bg-[#151D2F] border-2 border-emerald-500/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-fade-in space-y-4">
                <div>
                  <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                    Múltiples transferencias con el mismo monto
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    Seleccioná la transferencia correcta antes de cobrar:
                  </p>
                </div>
                <div className="space-y-3">
                  {matchCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => selectCandidate(candidate)}
                      className="w-full text-left bg-[#0B0F19] border border-[#24324D] hover:border-emerald-500 rounded-xl p-4 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-white truncate">{candidate.payerName}</span>
                        <span className="font-mono font-bold text-emerald-400 shrink-0">
                          Gs. {candidate.amount.toLocaleString('es-PY')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        {candidate.payerBank} · Op. {candidate.operationId}
                        {candidate.receiptNumber ? ` · Nro. Comprobante ${candidate.receiptNumber}` : ''} · {candidate.operationDate}
                      </div>
                      {candidate.concept && (
                        <div className="text-xs text-gray-400 mt-1 truncate">
                          Concepto: {candidate.concept}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* State Display: Match Success Card */}
            {match && (
              <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-emerald-500/10">
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
                    <span className="text-emerald-400 font-bold">Lista para Concretar Venta</span>
                  </div>
                </div>

                <button
                  onClick={handleClaimAndCompleteSale}
                  disabled={claimedSuccess || submittingSale}
                  className={`mt-6 w-full py-4 text-lg font-extrabold rounded-2xl transition-all flex items-center justify-center space-x-2 ${
                    claimedSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-400 hover:bg-emerald-300 text-gray-950 shadow-lg shadow-emerald-400/20'
                  }`}
                >
                  <Check className="w-6 h-6" />
                  <span>
                    {claimedSuccess || submittingSale
                      ? '¡Concretando Venta y Descontando Stock!...'
                      : 'Confirmar Pago y Concretar Venta'}
                  </span>
                </button>
              </div>
            )}

            {/* State Display: Replay Attack Warning */}
            {replayAlert && (
              <div className="bg-red-950/60 border-2 border-red-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-red-500/20">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-red-500 text-white rounded-2xl animate-pulse">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-xs uppercase font-extrabold tracking-wider text-red-400">
                      ALERTA DE SEGURIDAD — COMPROBANTE YA UTILIZADO
                    </div>
                    <div className="text-xl font-bold text-white mt-1">{replayAlert.message}</div>
                    <div className="text-sm text-gray-300 mt-2 font-mono">
                      Horario de cobro anterior: <span className="text-red-300 font-bold">{replayAlert.claimedAt}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* State Display: Not Found */}
            {notFound && (
              <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                <p className="font-semibold text-white">No se detectó la transferencia tras 60 segundos</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Verificá con el cliente que el débito se haya completado en su app bancaria o que el monto sea exacto.
                </p>
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  className="mt-4 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-xs font-bold transition-all inline-flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Volver a Buscar (60s)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
