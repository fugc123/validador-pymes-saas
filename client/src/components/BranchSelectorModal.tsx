import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, ArrowRight, Check, X } from 'lucide-react';

export const BranchSelectorModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { availableMemberships, activeTenant, switchTenant } = useAuth();

  const handleSelect = async (tenantId: string, role: string) => {
    await switchTenant(tenantId, role);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[#151D2F] border border-[#24324D] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#0B0F19] transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cambiar de Sucursal o Rol</h2>
            <p className="text-xs text-gray-400">Seleccioná a qué terminal u organización querés ingresar</p>
          </div>
        </div>

        <div className="space-y-3">
          {availableMemberships.map((m, idx) => {
            const isActive = m.tenantId === activeTenant?.tenantId && m.role === activeTenant?.role;
            const roleLabel =
              m.role === 'MERCHANT_OWNER'
                ? 'Dueño / Administración'
                : m.role === 'CASHIER'
                ? 'Cajero / Terminal de Cobro'
                : m.role;

            return (
              <button
                key={`${m.tenantId}-${m.role}-${idx}`}
                onClick={() => handleSelect(m.tenantId, m.role)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/50 cursor-default'
                    : 'bg-[#0B0F19] hover:bg-[#1A253C] border-[#24324D] hover:border-emerald-500/50'
                }`}
              >
                <div>
                  <div className={`font-bold transition-colors ${isActive ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'}`}>
                    {m.merchantName}
                  </div>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">
                    Rol: <span className="text-gray-300 font-semibold">{roleLabel}</span>
                  </div>
                </div>

                {isActive ? (
                  <span className="flex items-center space-x-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <Check className="w-3.5 h-3.5" />
                    <span>Activo</span>
                  </span>
                ) : (
                  <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
