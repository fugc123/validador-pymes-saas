import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Wrench,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Palette,
  Clock,
  Tag,
  Image as ImageIcon,
  ShoppingBag,
  Receipt,
  RefreshCw,
  Edit3,
  X,
} from 'lucide-react';
import { CatalogThemePalette } from '../catalog/PublicCatalogView';

interface CatalogItemDto {
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
  isActive: boolean;
  isDiscountActive: boolean;
  effectiveDiscountPercent: number;
  effectivePrice: number;
}

interface SaleRecordDto {
  id: string;
  cashierUserId: string;
  cashierName: string;
  customerName: string | null;
  customerRuc?: string | null;
  customerEmail?: string | null;
  concept: string | null;
  saleMode: 'catalog' | 'quick_amount';
  paymentMethod: 'TRANSFER' | 'CASH' | 'CARD';
  transferId: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    id: string;
    itemName: string;
    itemType: string;
    unitPrice: number;
    appliedDiscountPercent: number;
    finalUnitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
}

interface SalesSummaryDto {
  totalSalesCount: number;
  totalRevenue: number;
  transferSalesCount: number;
  otherSalesCount: number;
}

const PALETTE_OPTIONS: Array<{
  id: CatalogThemePalette;
  label: string;
  swatch: string;
}> = [
  { id: 'emerald', label: 'Esmeralda CajaSegura', swatch: 'bg-emerald-500' },
  { id: 'indigo', label: 'Índigo Real', swatch: 'bg-indigo-500' },
  { id: 'rose', label: 'Rosa Coral', swatch: 'bg-rose-500' },
  { id: 'amber', label: 'Ámbar Dorado', swatch: 'bg-amber-500' },
  { id: 'cyan', label: 'Cian Moderno', swatch: 'bg-cyan-500' },
  { id: 'violet', label: 'Violeta Premium', swatch: 'bg-violet-500' },
];

const WEEKDAYS = [
  { day: '1', label: 'Lun' },
  { day: '2', label: 'Mar' },
  { day: '3', label: 'Mié' },
  { day: '4', label: 'Jue' },
  { day: '5', label: 'Vie' },
  { day: '6', label: 'Sáb' },
  { day: '0', label: 'Dom' },
];

interface OwnerCatalogAndSalesPanelProps {
  token: string | null;
  tenantSlug: string;
  activeSubTab: 'inventory' | 'movements';
}

export const OwnerCatalogAndSalesPanel: React.FC<OwnerCatalogAndSalesPanelProps> = ({
  token,
  tenantSlug,
  activeSubTab,
}) => {
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [theme, setTheme] = useState<CatalogThemePalette>('emerald');
  const [sales, setSales] = useState<SaleRecordDto[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummaryDto>({
    totalSalesCount: 0,
    totalRevenue: 0,
    transferSalesCount: 0,
    otherSalesCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  // Create / Edit item form state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemType, setItemType] = useState<'product' | 'service'>('product');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [imageUrl, setImageUrl] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'hours' | 'days'>('none');
  const [discountPercent, setDiscountPercent] = useState('15');
  const [discountDurationHours, setDiscountDurationHours] = useState('4');
  const [discountDurationDays, setDiscountDurationDays] = useState('7');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const publicCatalogUrl = `${window.location.origin}/catalogo/${tenantSlug}`;

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [catRes, salesRes] = await Promise.all([
        fetch('/api/v1/merchant/catalog', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/merchant/sales', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setItems(catData.items || []);
        if (catData.theme) setTheme(catData.theme);
      }
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSales(salesData.sales || []);
        if (salesData.summary) setSalesSummary(salesData.summary);
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, tenantSlug]);

  const handleCopyCatalogLink = () => {
    navigator.clipboard.writeText(publicCatalogUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSelectTheme = async (newTheme: CatalogThemePalette) => {
    if (!token) return;
    setTheme(newTheme);
    setSavingTheme(true);
    try {
      await fetch('/api/v1/merchant/catalog-theme', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ theme: newTheme }),
      });
    } finally {
      setSavingTheme(false);
    }
  };

  const openCreateModal = () => {
    setEditingItemId(null);
    setItemType('product');
    setName('');
    setDescription('');
    setPrice('');
    setStock('10');
    setImageUrl('');
    setDiscountType('none');
    setDiscountPercent('15');
    setDiscountDurationHours('4');
    setDiscountDurationDays('7');
    setSelectedDays([]);
    setFormError(null);
    setShowItemModal(true);
  };

  const openEditModal = (item: CatalogItemDto) => {
    setEditingItemId(item.id);
    setItemType(item.itemType);
    setName(item.name);
    setDescription(item.description || '');
    setPrice(item.price.toString());
    setStock(item.stock !== null ? item.stock.toString() : '0');
    setImageUrl(item.imageUrl || '');
    setDiscountType(item.discountType || 'none');
    setDiscountPercent((item.discountPercent || 15).toString());
    setDiscountDurationHours('4');
    setDiscountDurationDays('7');
    setSelectedDays(item.discountDays ? item.discountDays.split(',').filter(Boolean) : []);
    setFormError(null);
    setShowItemModal(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleWeekday = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);

    const numericPrice = parseInt(price.replace(/[^0-9]/g, ''), 10);
    if (!name.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    if (isNaN(numericPrice) || numericPrice < 0) {
      setFormError('Ingresá un precio válido en Guaraníes.');
      return;
    }

    setSavingItem(true);
    const payload = {
      itemType,
      name: name.trim(),
      description: description.trim() || null,
      price: numericPrice,
      stock: itemType === 'product' ? Math.max(0, parseInt(stock || '0', 10) || 0) : null,
      imageUrl: imageUrl.trim() || null,
      discountType,
      discountPercent: discountType === 'none' ? 0 : Math.min(99, Math.max(1, parseInt(discountPercent || '0', 10) || 0)),
      discountDurationHours:
        discountType === 'hours' ? Math.max(1, parseInt(discountDurationHours || '1', 10) || 1) : null,
      discountDurationDays:
        discountType === 'days' ? Math.max(1, parseInt(discountDurationDays || '1', 10) || 1) : null,
      discountDays: discountType === 'days' && selectedDays.length > 0 ? selectedDays.join(',') : null,
    };

    try {
      const url = editingItemId
        ? `/api/v1/merchant/catalog/${editingItemId}`
        : '/api/v1/merchant/catalog';
      const method = editingItemId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'No se pudo guardar el ítem.');
      }

      setShowItemModal(false);
      await fetchAll();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleQuickStockChange = async (item: CatalogItemDto, delta: number) => {
    if (!token || item.itemType !== 'product') return;
    const nextStock = Math.max(0, (item.stock ?? 0) + delta);
    try {
      await fetch(`/api/v1/merchant/catalog/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock: nextStock }),
      });
      await fetchAll();
    } catch {
      // ignore
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/v1/merchant/catalog/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAll();
    } catch {
      // ignore
    }
  };

  if (activeSubTab === 'movements') {
    return (
      <div className="space-y-6">
        {/* Summary Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Total Ventas Registradas</span>
            <div className="text-2xl font-mono font-black text-emerald-400 mt-2">
              Gs. {salesSummary.totalRevenue.toLocaleString('es-PY')}
            </div>
            <span className="text-[11px] text-gray-500">Todos los métodos de pago</span>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Cantidad de Operaciones</span>
            <div className="text-2xl font-mono font-black text-white mt-2">
              {salesSummary.totalSalesCount}
            </div>
            <span className="text-[11px] text-gray-500">Compras concretadas en caja</span>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Por Transferencia SIPAP</span>
            <div className="text-2xl font-mono font-black text-teal-400 mt-2">
              {salesSummary.transferSalesCount}
            </div>
            <span className="text-[11px] text-gray-500">Validadas y vinculadas</span>
          </div>

          <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-5">
            <span className="text-xs text-gray-400 font-semibold uppercase">Efectivo / Tarjeta</span>
            <div className="text-2xl font-mono font-black text-indigo-400 mt-2">
              {salesSummary.otherSalesCount}
            </div>
            <span className="text-[11px] text-gray-500">Cobradas en mostrador</span>
          </div>
        </div>

        {/* Movements Table */}
        <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Registro de Movimientos y Ventas por Cajero</span>
              </h2>
              <p className="text-xs text-gray-400">
                Control completo de quién concretó cada venta, qué productos/servicios o conceptos se cobraron y cómo pagó el cliente.
              </p>
            </div>
            <button
              onClick={fetchAll}
              className="px-3.5 py-2 bg-[#0B0F19] hover:bg-slate-800 border border-[#24324D] rounded-xl text-xs font-bold text-gray-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 bg-[#0B0F19]/60 rounded-2xl border border-[#24324D]">
              Todavía no hay ventas registradas en este comercio.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#24324D] text-[11px] font-mono uppercase text-gray-400">
                    <th className="py-3 px-3">Fecha / Hora</th>
                    <th className="py-3 px-3">Cajero</th>
                    <th className="py-3 px-3">Cliente</th>
                    <th className="py-3 px-3">Detalle / Qué pasó</th>
                    <th className="py-3 px-3">Método Pago</th>
                    <th className="py-3 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-xs">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[#0B0F19]/50">
                      <td className="py-3.5 px-3 font-mono text-gray-400 whitespace-nowrap">
                        {new Date(sale.createdAt).toLocaleString('es-PY')}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-white">
                        {sale.cashierName}
                      </td>
                      <td className="py-3.5 px-3 text-gray-300">
                        <div>{sale.customerName || 'Mostrador'}</div>
                        {(sale.customerRuc || sale.customerEmail) && (
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {sale.customerRuc && <span>RUC: {sale.customerRuc}</span>}
                            {sale.customerRuc && sale.customerEmail && <span> · </span>}
                            {sale.customerEmail && <span>{sale.customerEmail}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-gray-200 max-w-md">
                        {sale.saleMode === 'quick_amount' ? (
                          <div>
                            <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded mr-1.5">
                              Monto Libre
                            </span>
                            <span>{sale.concept || 'Cobro rápido'}</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {sale.items.map((it) => (
                              <div key={it.id}>
                                <strong className="text-emerald-400 font-mono">{it.quantity}x</strong> {it.itemName}{' '}
                                <span className="text-gray-500 font-mono">
                                  (Gs. {it.lineTotal.toLocaleString('es-PY')})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                            sale.paymentMethod === 'TRANSFER'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : sale.paymentMethod === 'CASH'
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {sale.paymentMethod === 'TRANSFER'
                            ? 'Transferencia SIPAP'
                            : sale.paymentMethod === 'CASH'
                              ? 'Efectivo'
                              : 'Tarjeta / POS'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-sm text-emerald-400 whitespace-nowrap">
                        Gs. {sale.totalAmount.toLocaleString('es-PY')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Public Storefront Link & Palette Configuration Card */}
      <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#24324D] pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 text-xs text-emerald-400 font-bold uppercase tracking-wider">
              <ShoppingBag className="w-4 h-4" />
              <span>Vidriera y Catálogo Web Propio</span>
            </div>
            <h2 className="text-xl font-black text-white">
              Link Público de Productos y Servicios del Local
            </h2>
            <p className="text-xs text-gray-400">
              Compartí este link en tu bio de Instagram o por WhatsApp. Si el producto tiene foto la muestra; si no tiene foto, muestra una tarjeta limpia con nombre, precio y stock.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-[#0B0F19] border border-[#24324D] rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-400 truncate max-w-xs sm:max-w-md">
              {publicCatalogUrl}
            </div>
            <button
              type="button"
              onClick={handleCopyCatalogLink}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link'}</span>
            </button>
            <a
              href={`/catalogo/${tenantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#0B0F19] hover:bg-slate-800 text-gray-200 border border-[#24324D] font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Ver Catálogo</span>
            </a>
          </div>
        </div>

        {/* Palette Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-gray-300 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>Elegí la Paleta de Colores de tu Catálogo Público</span>
            </label>
            {savingTheme && <span className="text-xs text-emerald-400 font-mono">Guardando paleta...</span>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {PALETTE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectTheme(opt.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  theme === opt.id
                    ? 'bg-[#0B0F19] border-2 border-emerald-400 text-white shadow-lg'
                    : 'bg-[#0B0F19]/60 border-[#24324D] text-gray-400 hover:text-white'
                }`}
              >
                <span className={`w-4 h-4 rounded-full shrink-0 ${opt.swatch}`} />
                <span className="text-xs font-bold truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory & Services Header + List */}
      <div className="bg-[#151D2F] border border-[#24324D] rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Inventario de Productos y Servicios</h2>
            <p className="text-xs text-gray-400">
              Creá productos (con descuento automático de stock al vender) o servicios, y configurá descuentos por horas o por días.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Producto o Servicio</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-[#0B0F19]/60 border border-[#24324D] rounded-2xl p-10 text-center space-y-3">
            <Package className="w-10 h-10 text-gray-500 mx-auto" />
            <p className="text-sm font-bold text-gray-300">Todavía no cargaste productos ni servicios.</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Agregá tu primer producto o servicio para que aparezca en la pantalla de tus cajeros y en tu catálogo web.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-4 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#151D2F] text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                        {item.itemType === 'service' ? (
                          <>
                            <Wrench className="w-3 h-3" /> Servicio
                          </>
                        ) : (
                          <>
                            <Package className="w-3 h-3" /> Producto
                          </>
                        )}
                      </span>
                      {item.isDiscountActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> -{item.effectiveDiscountPercent}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#151D2F]"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-[#151D2F]"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#24324D]"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-white text-base leading-snug">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{item.description}</p>
                      )}
                      {!item.imageUrl && (
                        <span className="inline-block mt-1 text-[10px] font-mono text-gray-500">
                          Vista limpia sin foto
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between gap-2">
                  <div>
                    {item.isDiscountActive ? (
                      <div>
                        <span className="text-xs font-mono text-gray-500 line-through block">
                          Gs. {item.price.toLocaleString('es-PY')}
                        </span>
                        <span className="text-lg font-mono font-black text-emerald-400">
                          Gs. {item.effectivePrice.toLocaleString('es-PY')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-mono font-black text-white">
                        Gs. {item.price.toLocaleString('es-PY')}
                      </span>
                    )}
                  </div>

                  {item.itemType === 'product' ? (
                    <div className="flex items-center gap-1.5 bg-[#151D2F] border border-[#24324D] rounded-xl px-2.5 py-1">
                      <button
                        type="button"
                        onClick={() => handleQuickStockChange(item, -1)}
                        className="text-gray-400 hover:text-white px-1 font-bold"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono font-bold text-white">
                        Stock: {item.stock ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickStockChange(item, 1)}
                        className="text-emerald-400 hover:text-emerald-300 px-1 font-bold"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-400">Servicio Activo</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal to Create / Edit Product or Service */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#151D2F] border-2 border-[#24324D] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#24324D] pb-3">
              <h3 className="text-lg font-black text-white">
                {editingItemId ? 'Editar Producto o Servicio' : 'Nuevo Producto o Servicio'}
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {!editingItemId && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType('product')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 ${
                      itemType === 'product'
                        ? 'bg-emerald-500 text-gray-950 border-emerald-400'
                        : 'bg-[#0B0F19] text-gray-400 border-[#24324D]'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Producto (Con Stock)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType('service')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 ${
                      itemType === 'service'
                        ? 'bg-emerald-500 text-gray-950 border-emerald-400'
                        : 'bg-[#0B0F19] text-gray-400 border-[#24324D]'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Servicio</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-1">
                  Nombre del {itemType === 'service' ? 'Servicio' : 'Producto'} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={itemType === 'service' ? 'Ej: Corte y Lavado / Instalación' : 'Ej: Auriculares Bluetooth'}
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-300 mb-1">
                    Precio Normal (Gs.) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ej: 50000"
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {itemType === 'product' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-300 mb-1">
                      Cantidad en Stock *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">
                  Descripción Breve (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles adicionales..."
                  className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Optional Photo Section */}
              <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-gray-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <span>Foto (Opcional — si se deja vacío solo muestra texto)</span>
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Pegar link de imagen (https://...) o subir archivo abajo"
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500/15 file:text-emerald-400 hover:file:bg-emerald-500/25"
                />
              </div>

              {/* Time-based Discount Configuration */}
              <div className="bg-[#0B0F19] border border-[#24324D] rounded-2xl p-3.5 space-y-3">
                <label className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Descuento Programado por Tiempo (Opcional)</span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('none')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold ${
                      discountType === 'none'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#151D2F] border-[#24324D] text-gray-400'
                    }`}
                  >
                    Sin Descuento
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('hours')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold ${
                      discountType === 'hours'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#151D2F] border-[#24324D] text-gray-400'
                    }`}
                  >
                    Por Horas
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('days')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold ${
                      discountType === 'days'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#151D2F] border-[#24324D] text-gray-400'
                    }`}
                  >
                    Por Días
                  </button>
                </div>

                {discountType !== 'none' && (
                  <div className="space-y-3 pt-2 border-t border-[#24324D]">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1">
                          % de Descuento
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                        />
                      </div>

                      {discountType === 'hours' ? (
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 mb-1">
                            Duración (Horas)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={discountDurationHours}
                            onChange={(e) => setDiscountDurationHours(e.target.value)}
                            className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 mb-1">
                            Vigencia (Días)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={discountDurationDays}
                            onChange={(e) => setDiscountDurationDays(e.target.value)}
                            className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                          />
                        </div>
                      )}
                    </div>

                    {discountType === 'days' && (
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1.5">
                          Días de la semana activos (vacío = todos los días de vigencia)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAYS.map((w) => (
                            <button
                              key={w.day}
                              type="button"
                              onClick={() => toggleWeekday(w.day)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                selectedDays.includes(w.day)
                                  ? 'bg-emerald-500 text-gray-950 border-emerald-400'
                                  : 'bg-[#151D2F] text-gray-400 border-[#24324D]'
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2.5 bg-[#0B0F19] text-gray-300 rounded-xl text-xs font-bold border border-[#24324D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs rounded-xl shadow-lg"
                >
                  {savingItem ? 'Guardando...' : 'Guardar en Inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
