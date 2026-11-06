import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  FileCode,
  FileKey,
  Play,
  Save,
  Sparkles,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';

interface SifenConfigFormState {
  enabled: boolean;
  environment: 'test' | 'prod';
  ruc: string;
  dv: string;
  razonSocial: string;
  nombreFantasia: string;
  tipoContribuyente: 1 | 2;
  tipoRegimen: number;
  timbrado: string;
  fechaInicioTimbrado: string;
  establecimiento: string;
  puntoExpedicion: string;
  direccion: string;
  numeroCasa: string;
  departamento: number;
  departamentoDesc: string;
  distrito: number;
  distritoDesc: string;
  ciudad: number;
  ciudadDesc: string;
  telefono: string;
  email: string;
  actividadEconomicaCodigo: string;
  actividadEconomicaDesc: string;
  cscId: string;
  csc: string;
  certificadoBase64?: string | null;
  certificadoPassword?: string | null;
}

interface SifenInvoiceRecord {
  id: string;
  cdc: string;
  numeroDocumento: string;
  timbrado: string;
  environment: 'test' | 'prod';
  receptorRuc: string;
  receptorDv: string | null;
  receptorNombre: string;
  totalAmount: number;
  iva10Amount: number;
  xmlPayload: string;
  qrUrl: string;
  status: string;
  responseMessage: string;
  createdAt: string;
}

interface Props {
  tenantId: string;
  merchantName: string;
  token: string;
  onClose: () => void;
  onSaved?: () => void;
}

function calculateParaguayDvClient(numericStr: string, baseMax = 11): string {
  const digits = (numericStr || '').replace(/\D/g, '');
  if (!digits) return '0';
  let factor = 2;
  let total = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    total += Number(digits[i]) * factor;
    factor++;
    if (factor > baseMax) factor = 2;
  }
  const remainder = total % 11;
  const dv = remainder > 1 ? 11 - remainder : 0;
  return String(dv);
}

const DEFAULT_FORM: SifenConfigFormState = {
  enabled: true,
  environment: 'test',
  ruc: '80012345',
  dv: calculateParaguayDvClient('80012345'),
  razonSocial: '',
  nombreFantasia: '',
  tipoContribuyente: 2,
  tipoRegimen: 8,
  timbrado: '12560102',
  fechaInicioTimbrado: '2025-01-01',
  establecimiento: '001',
  puntoExpedicion: '001',
  direccion: 'Av. Mariscal López esq. República Argentina',
  numeroCasa: '1450',
  departamento: 1,
  departamentoDesc: 'CAPITAL',
  distrito: 1,
  distritoDesc: 'ASUNCION (DISTRITO)',
  ciudad: 1,
  ciudadDesc: 'ASUNCION (DISTRITO)',
  telefono: '021600100',
  email: 'facturacion@cajasegura.com.py',
  actividadEconomicaCodigo: '47190',
  actividadEconomicaDesc: 'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
  cscId: '0001',
  csc: 'ABCD0000000000000000000000000000',
  certificadoBase64: undefined,
  certificadoPassword: '',
};

export const SifenFreeMerchantModal: React.FC<Props> = ({
  tenantId,
  merchantName,
  token,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<SifenConfigFormState>(DEFAULT_FORM);
  const [serverTemplate, setServerTemplate] = useState<Partial<SifenConfigFormState> | null>(null);
  const [hasExistingCert, setHasExistingCert] = useState(false);
  const [uploadedCertFileName, setUploadedCertFileName] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<SifenInvoiceRecord[]>([]);
  const [selectedXmlInvoice, setSelectedXmlInvoice] = useState<SifenInvoiceRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Test invoice emission parameters
  const [testReceptorRuc, setTestReceptorRuc] = useState('44444401');
  const [testReceptorNombre, setTestReceptorNombre] = useState('CLIENTE PRUEBA HOMOLOGACION SIFEN');
  const [testTotalAmount, setTestTotalAmount] = useState('110000');

  const fetchConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/sifen/superadmin/config/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: json.message || 'No se pudo cargar la configuración SIFEN de este comercio.',
        });
        return;
      }

      const data = json.data;
      if (data.autocompleteTemplate) {
        setServerTemplate(data.autocompleteTemplate);
      }
      if (data.invoices) {
        setInvoices(data.invoices);
      }

      if (data.config) {
        setHasExistingCert(Boolean(data.config.hasCertificate));
        setForm({
          enabled: Boolean(data.config.enabled),
          environment: data.config.environment === 'prod' ? 'prod' : 'test',
          ruc: data.config.ruc || '80012345',
          dv: data.config.dv || calculateParaguayDvClient(data.config.ruc || '80012345'),
          razonSocial: data.config.razonSocial || `${merchantName.toUpperCase()} E.A.S.`,
          nombreFantasia: data.config.nombreFantasia || merchantName,
          tipoContribuyente: data.config.tipoContribuyente === 1 ? 1 : 2,
          tipoRegimen: Number(data.config.tipoRegimen || 8),
          timbrado: data.config.timbrado || '12560102',
          fechaInicioTimbrado: data.config.fechaInicioTimbrado || '2025-01-01',
          establecimiento: data.config.establecimiento || '001',
          puntoExpedicion: data.config.puntoExpedicion || '001',
          direccion: data.config.direccion || 'Av. Mariscal López',
          numeroCasa: data.config.numeroCasa || '1450',
          departamento: Number(data.config.departamento || 1),
          departamentoDesc: data.config.departamentoDesc || 'CAPITAL',
          distrito: Number(data.config.distrito || 1),
          distritoDesc: data.config.distritoDesc || 'ASUNCION (DISTRITO)',
          ciudad: Number(data.config.ciudad || 1),
          ciudadDesc: data.config.ciudadDesc || 'ASUNCION (DISTRITO)',
          telefono: data.config.telefono || '021600100',
          email: data.config.email || `facturacion@${tenantId}.com.py`,
          actividadEconomicaCodigo: data.config.actividadEconomicaCodigo || '47190',
          actividadEconomicaDesc:
            data.config.actividadEconomicaDesc ||
            'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
          cscId: data.config.cscId || '0001',
          csc: data.config.csc || 'ABCD0000000000000000000000000000',
          certificadoBase64: undefined,
          certificadoPassword: '',
        });
      } else if (data.autocompleteTemplate) {
        const tpl = data.autocompleteTemplate;
        setForm({
          ...DEFAULT_FORM,
          ...tpl,
          dv: tpl.dv || calculateParaguayDvClient(tpl.ruc || '80012345'),
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error de red cargando SIFEN' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [tenantId]);

  const handleRucChange = (newRuc: string) => {
    const clean = newRuc.replace(/\D/g, '');
    setForm((prev) => ({
      ...prev,
      ruc: clean,
      dv: calculateParaguayDvClient(clean),
    }));
  };

  const handleAutocompleteAsuncion = () => {
    const rucBase = form.ruc && form.ruc.length >= 6 ? form.ruc : '80098765';
    const tpl = serverTemplate || {};
    setForm((prev) => ({
      ...prev,
      enabled: true,
      environment: 'test',
      ruc: rucBase,
      dv: calculateParaguayDvClient(rucBase),
      razonSocial: tpl.razonSocial || `${merchantName.toUpperCase()} E.A.S.`,
      nombreFantasia: tpl.nombreFantasia || merchantName,
      tipoContribuyente: 2,
      tipoRegimen: 8,
      timbrado: '12560102',
      fechaInicioTimbrado: '2025-01-01',
      establecimiento: '001',
      puntoExpedicion: '001',
      direccion: 'Av. Mariscal López esq. República Argentina',
      numeroCasa: '1450',
      departamento: 1,
      departamentoDesc: 'CAPITAL',
      distrito: 1,
      distritoDesc: 'ASUNCION (DISTRITO)',
      ciudad: 1,
      ciudadDesc: 'ASUNCION (DISTRITO)',
      telefono: '021600100',
      email: tpl.email || `facturacion@${tenantId}.com.py`,
      actividadEconomicaCodigo: '47190',
      actividadEconomicaDesc: 'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
      cscId: '0001',
      csc: 'ABCD0000000000000000000000000000',
    }));
    setFeedback({
      type: 'success',
      text: `✨ Formulario autocompletado con los datos fiscales base para "${merchantName}" (Asunción / Capital). Solo ajustá el RUC o Timbrado si tenés los definitivos de la SET/DNIT.`,
    });
  };

  const handleAutocompleteCde = () => {
    const rucBase = form.ruc && form.ruc.length >= 6 ? form.ruc : '80112233';
    setForm((prev) => ({
      ...prev,
      enabled: true,
      environment: 'test',
      ruc: rucBase,
      dv: calculateParaguayDvClient(rucBase),
      razonSocial: `${merchantName.toUpperCase()} S.A.`,
      nombreFantasia: merchantName,
      tipoContribuyente: 2,
      tipoRegimen: 8,
      timbrado: '12560102',
      fechaInicioTimbrado: '2025-01-01',
      establecimiento: '001',
      puntoExpedicion: '001',
      direccion: 'Av. San Blas Microcentro',
      numeroCasa: '520',
      departamento: 11,
      departamentoDesc: 'ALTO PARANA',
      distrito: 143,
      distritoDesc: 'CIUDAD DEL ESTE',
      ciudad: 3432,
      ciudadDesc: 'CIUDAD DEL ESTE',
      telefono: '061500200',
      email: `facturacion@${tenantId}.com.py`,
      actividadEconomicaCodigo: '47190',
      actividadEconomicaDesc: 'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
      cscId: '0001',
      csc: 'ABCD0000000000000000000000000000',
    }));
    setFeedback({
      type: 'success',
      text: `✨ Formulario autocompletado con plantilla Ciudad del Este / Alto Paraná para "${merchantName}".`,
    });
  };

  const handleP12Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Clean = result.includes(',') ? result.split(',')[1] : result;
      setForm((prev) => ({ ...prev, certificadoBase64: base64Clean }));
      setUploadedCertFileName(file.name);
      setHasExistingCert(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload: any = { ...form };
      if (!payload.certificadoBase64) delete payload.certificadoBase64;
      if (!payload.certificadoPassword) delete payload.certificadoPassword;

      const res = await fetch(`/api/v1/sifen/superadmin/config/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: json.message || 'Error al guardar SIFEN' });
        return;
      }

      setFeedback({
        type: 'success',
        text: '✅ Configuración SIFEN guardada en PostgreSQL para este comercio propio.',
      });
      if (onSaved) onSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunTestEmission = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      // Save current form first so test uses the latest fields
      const savePayload: any = { ...form };
      if (!savePayload.certificadoBase64) delete savePayload.certificadoBase64;
      if (!savePayload.certificadoPassword) delete savePayload.certificadoPassword;

      await fetch(`/api/v1/sifen/superadmin/config/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(savePayload),
      });

      const res = await fetch(`/api/v1/sifen/superadmin/test-emission/${tenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receptorRuc: testReceptorRuc,
          receptorNombre: testReceptorNombre,
          totalAmount: Number(testTotalAmount || 110000),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: json.message || 'Error ejecutando prueba SIFEN' });
        return;
      }

      const emitted: SifenInvoiceRecord = json.data.invoice;
      setInvoices((prev) => [emitted, ...prev]);
      setSelectedXmlInvoice(emitted);
      setFeedback({
        type: 'success',
        text: `🧪 ¡Prueba SIFEN exitosa! CDC 44 dígitos generado: ${emitted.cdc}`,
      });
      if (onSaved) onSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error ejecutando prueba SIFEN' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#151D2F] border border-purple-500/40 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative my-8 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#0B0F19] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#24324D]">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-500/15 text-purple-300 rounded-2xl border border-purple-500/30">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">
                  Configuración SIFEN — {merchantName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Exclusivo Comercio Propio / Gratis
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Formulario administrativo para cargar o autocompletar los datos SET / DNIT (
                <code className="text-purple-300">consultame-sdk</code>) por cuenta de la empresa y
                ejecutar pruebas de homologación.
              </p>
            </div>
          </div>

          {/* 1-Click Autocomplete Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAutocompleteAsuncion}
              className="px-3 py-2 bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Autocompletar Plantilla Asunción</span>
            </button>
            <button
              type="button"
              onClick={handleAutocompleteCde}
              className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Plantilla CDE / Alto Paraná</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center space-x-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Cargando datos fiscales SIFEN del comercio...
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-6">
            {/* Row 1: Estado & Ambiente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#0B0F19] p-4 rounded-2xl border border-[#24324D]">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Estado en Caja POS
                </label>
                <label className="flex items-center space-x-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="rounded border-gray-600 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-white">
                    {form.enabled ? 'Habilitado para Cajeros' : 'Pausado / Solo Pruebas'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Ambiente SIFEN (DNIT)
                </label>
                <select
                  value={form.environment}
                  onChange={(e) =>
                    setForm({ ...form, environment: e.target.value as 'test' | 'prod' })
                  }
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="test">🧪 TEST / Homologación (ekuatia.set.gov.py/consultas-test)</option>
                  <option value="prod">🚀 PRODUCCIÓN (ekuatia.set.gov.py)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                  Tipo Contribuyente
                </label>
                <select
                  value={form.tipoContribuyente}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipoContribuyente: Number(e.target.value) === 1 ? 1 : 2,
                    })
                  }
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value={2}>2 — Persona Jurídica (E.A.S. / S.A. / S.R.L.)</option>
                  <option value={1}>1 — Persona Física (Unipersonal)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Datos del Contribuyente Emisor */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                1. Datos del Contribuyente Emisor (Empresa)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">RUC Emisor (sin DV) *</label>
                  <input
                    type="text"
                    required
                    value={form.ruc}
                    onChange={(e) => handleRucChange(e.target.value)}
                    placeholder="80012345"
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    DV (Módulo 11 Auto) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={1}
                    value={form.dv}
                    onChange={(e) => setForm({ ...form, dv: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={form.razonSocial}
                    onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                    placeholder="CAJASEGURA E.A.S."
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Nombre de Fantasía</label>
                  <input
                    type="text"
                    value={form.nombreFantasia}
                    onChange={(e) => setForm({ ...form, nombreFantasia: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Código Act. Económica</label>
                  <input
                    type="text"
                    value={form.actividadEconomicaCodigo}
                    onChange={(e) =>
                      setForm({ ...form, actividadEconomicaCodigo: e.target.value })
                    }
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Descripción Actividad</label>
                  <input
                    type="text"
                    value={form.actividadEconomicaDesc}
                    onChange={(e) =>
                      setForm({ ...form, actividadEconomicaDesc: e.target.value })
                    }
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Timbrado, Establecimiento y Ubicación */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                2. Timbrado Electrónico, Establecimiento y Dirección
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    N° Timbrado (8 dígitos) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={form.timbrado}
                    onChange={(e) =>
                      setForm({ ...form, timbrado: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="12560102"
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Fecha Inicio Timbrado</label>
                  <input
                    type="date"
                    value={form.fechaInicioTimbrado}
                    onChange={(e) => setForm({ ...form, fechaInicioTimbrado: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Establecimiento</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.establecimiento}
                    onChange={(e) => setForm({ ...form, establecimiento: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Punto Expedición</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.puntoExpedicion}
                    onChange={(e) => setForm({ ...form, puntoExpedicion: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Dirección Local</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudadDesc}
                    onChange={(e) => setForm({ ...form, ciudadDesc: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Teléfono / Email</label>
                  <input
                    type="text"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Credenciales CSC & Certificado Digital .p12 */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                3. Código de Seguridad del Contribuyente (CSC) y Firma Digital (.p12)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#0B0F19] p-4 rounded-2xl border border-[#24324D]">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">CSC ID (SET)</label>
                  <input
                    type="text"
                    value={form.cscId}
                    onChange={(e) => setForm({ ...form, cscId: e.target.value })}
                    placeholder="0001"
                    className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-400 mb-1">
                    Token CSC (32 caracteres provisto por Marangatu / e-Kuatia)
                  </label>
                  <input
                    type="text"
                    value={form.csc}
                    onChange={(e) => setForm({ ...form, csc: e.target.value })}
                    placeholder="ABCD0000000000000000000000000000"
                    className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-emerald-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">
                    Certificado Digital (.p12 / .pfx)
                  </label>
                  <label className="flex items-center justify-between px-3 py-2 bg-[#151D2F] border border-dashed border-purple-500/40 rounded-xl cursor-pointer hover:bg-purple-500/10 transition-colors">
                    <div className="flex items-center space-x-2 text-xs text-gray-300 truncate">
                      <Upload className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">
                        {uploadedCertFileName
                          ? `Cargado: ${uploadedCertFileName}`
                          : hasExistingCert
                            ? '✅ Certificado .p12 guardado (Subir otro para reemplazar)'
                            : 'Subir archivo .p12 / .pfx de la empresa'}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      onChange={handleP12Upload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">
                    Contraseña del Certificado .p12
                  </label>
                  <div className="relative">
                    <FileKey className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={form.certificadoPassword || ''}
                      onChange={(e) =>
                        setForm({ ...form, certificadoPassword: e.target.value })
                      }
                      placeholder={
                        hasExistingCert
                          ? '•••••••• (Dejar vacío para mantener actual)'
                          : 'Clave privada del certificado .p12'
                      }
                      className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow-lg shadow-purple-600/30 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Configuración SIFEN'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Homologation Test & Recent Emitted Invoices Section */}
        <div className="mt-8 pt-6 border-t border-[#24324D] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Banco de Pruebas de Homologación SIFEN (`consultame-sdk`)</span>
              </h4>
              <p className="text-xs text-gray-400">
                Simulá y generá un Documento Electrónico (`rDE` XML + CDC de 44 dígitos + QR SET)
                con los datos de esta empresa.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#0B0F19] p-4 rounded-2xl border border-[#24324D]">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">RUC Receptor Prueba</label>
              <input
                type="text"
                value={testReceptorRuc}
                onChange={(e) => setTestReceptorRuc(e.target.value)}
                className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-400 mb-1">
                Razón Social / Cliente Receptor
              </label>
              <input
                type="text"
                value={testReceptorNombre}
                onChange={(e) => setTestReceptorNombre(e.target.value)}
                className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Monto Total (Gs.)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={testTotalAmount}
                  onChange={(e) => setTestTotalAmount(e.target.value)}
                  className="w-full bg-[#151D2F] border border-[#24324D] rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={handleRunTestEmission}
                  disabled={testing}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl whitespace-nowrap flex items-center space-x-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{testing ? 'Emitiendo...' : 'Probar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* XML / CDC Inspector */}
          {selectedXmlInvoice && (
            <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400">
                  ✅ Documento Electrónico Generado — Factura N° {selectedXmlInvoice.numeroDocumento}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedXmlInvoice(null)}
                  className="text-gray-400 hover:text-white text-[11px]"
                >
                  Ocultar XML
                </button>
              </div>
              <div className="font-mono text-[11px] text-gray-300 break-all">
                <span className="text-gray-500">CDC (44 dígitos):</span>{' '}
                <span className="text-purple-300 font-bold">{selectedXmlInvoice.cdc}</span>
              </div>
              <div className="font-mono text-[11px] text-gray-300">
                <span className="text-gray-500">Total:</span> Gs.{' '}
                {selectedXmlInvoice.totalAmount.toLocaleString('es-PY')} |{' '}
                <span className="text-gray-500">IVA 10%:</span> Gs.{' '}
                {selectedXmlInvoice.iva10Amount.toLocaleString('es-PY')}
              </div>
              <pre className="mt-2 p-3 bg-[#151D2F] rounded-xl text-[10px] font-mono text-emerald-200 overflow-x-auto max-h-48">
                {selectedXmlInvoice.xmlPayload}
              </pre>
            </div>
          )}

          {/* Recent SIFEN Invoices Table */}
          {invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B0F19] text-gray-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-2.5">N° Factura</th>
                    <th className="p-2.5">CDC (44 dígitos)</th>
                    <th className="p-2.5">Receptor</th>
                    <th className="p-2.5">Total / IVA 10%</th>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5 text-right">XML</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24324D]">
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#1A253C]/40">
                      <td className="p-2.5 font-mono text-white">{inv.numeroDocumento}</td>
                      <td className="p-2.5 font-mono text-[10px] text-purple-300">
                        {inv.cdc.slice(0, 16)}...{inv.cdc.slice(-8)}
                      </td>
                      <td className="p-2.5 text-gray-300">
                        {inv.receptorNombre} ({inv.receptorRuc})
                      </td>
                      <td className="p-2.5 font-mono text-emerald-300">
                        Gs. {inv.totalAmount.toLocaleString('es-PY')}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedXmlInvoice(inv)}
                          className="text-purple-300 hover:text-purple-200 underline text-[11px]"
                        >
                          Ver DE / XML
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
