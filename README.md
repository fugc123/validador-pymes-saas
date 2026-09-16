# 💎 Validador PYME SaaS (Multi-Tenant Commercial Edition)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10+-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)
[![Clean Architecture](https://img.shields.io/badge/Architecture-Clean%20%2F%20Hexagonal-orange.svg)](#-arquitectura)
[![SaaS Pricing](https://img.shields.io/badge/Pricing-%2415%2Fmonth-brightgreen.svg)](#-modelo-de-negocio-saas)

Plataforma SaaS multi-inquilino (*Multi-Tenant*) de alta velocidad para la validación en tiempo real de transferencias bancarias (**SIPAP / QR en Paraguay y LATAM**), diseñada para eliminar las demoras en cajas de comercios, erradicar fraudes de comprobantes duplicados y garantizar privacidad financiera absoluta.

---

## 🚀 Propuesta de Valor Comercial ($15 USD / Mes)

| Dolor Crítico en Comercios | Solución con Validador PYME SaaS |
|---|---|
| ❌ El dueño vive esclavo del celular respondiendo si "acreditó la plata". | ✅ Los cajeros validan el pago en **menos de 2 segundos** desde su pantalla de cobro. |
| ❌ Riesgo de seguridad por compartir contraseñas de correos con empleados. | ✅ **Zero-Knowledge**: Los cajeros solo consultan monto y apellido; jamás ven cuentas ni otros pagos. |
| ❌ Estafa del comprobante bancario reutilizado (capturas viejas). | ✅ **Anti-Replay Guard**: Cada comprobante se bloquea al instante; si lo reusan, suena alerta en **ROJO**. |
| ❌ Gestión caótica para cadenas con múltiples sucursales y cajeros. | ✅ Portal para el dueño con control de operadores, auditoría completa y selección de bancos. |

---

## 🏛️ Arquitectura del Sistema

Construido bajo **Clean Architecture (Puertos y Adaptadores)** con **NestJS** y **React**:

```
validador-pymes-saas/
├── docs/
│   └── adr/                     # Architecture Decision Records (ADR-001 a ADR-007)
├── src/
│   ├── core/
│   │   ├── domain/              # Lógica de Negocio Pura (Entities, Value Objects, Ports)
│   │   └── application/         # Casos de Uso con Scoping por Tenant
│   ├── infrastructure/          # Adaptadores PostgreSQL, Parsers y Pasarelas de Pago
│   │   ├── database/            # Repositorios Drizzle/Prisma con tenant_id
│   │   ├── parsers/             # BankParserFactory (Itaú, GNB, UENO, Familiar, Atlas, Continental)
│   │   └── billing/             # Stripe Adapter & Pasarelas Locales (Pagopar / Bancard)
│   └── presentation/            # Controladores NestJS, Interceptores y Guards
│       ├── controllers/         # Webhooks, Cashier POS, Merchant Portal, SuperAdmin
│       └── guards/              # TenantGuard, RolesGuard, JwtAuthGuard
├── client/                      # Frontend SPA (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── portals/             # Fast-POS (/pos), Merchant (/merchant), SuperAdmin (/superadmin)
│   │   ├── components/          # UI Tokens, Audio Synthesizer, Keyboard Handlers
│   │   └── landing/             # Public Landing Page & Solicitud de Acceso
├── AGENTS.md                    # Engineering Contract & 5-Phase Pipeline
├── pipeline.md                  # Universal 5-Phase Engineering Pipeline
└── ROADMAP.md                   # Plan de Implementación Fase por Fase
```

---

## 👥 Matriz de Roles y Accesos (Tri-Tier RBAC)

1. **SUPER_ADMIN (Vos - Dueño de la Plataforma SaaS)**:
   - Dashboard global de todos los comercios adheridos.
   - Cola de solicitudes de comercios que quieren contratar el sistema (Aprobar / Rechazar con 1 clic).
   - Monitoreo de ingresos recurrentes (MRR), salud de webhooks y métricas globales.
2. **MERCHANT_OWNER (Dueño del Negocio / Kiosko / Farmacia)**:
   - Panel de control de su empresa (`/merchant`).
   - Alta, baja y cambio de contraseñas para sus cajeros.
   - Configuración de bancos activos (Itaú, GNB, UENO, etc.) y URL de webhook única.
   - Historial financiero completo de transferencias y gestión de suscripción ($15/mes).
3. **CASHIER (Operador de Punto de Venta)**:
   - Pantalla de cobro ultra rápida (`/pos`) con botones gigantes y atajos de teclado.
   - Consulta con Zero-Knowledge (monto y apellido) en ventana de 45 minutos.
   - Campana de audio sintetizada (Web Audio API) y bloqueo de cobro en 1 clic.

---

## 🏦 Cobertura Multi-Banco SIPAP

El sistema incluye parsers resilientes para los principales bancos del sistema paraguayo:
- **Banco Itaú Paraguay** (correos directos y reenviados con *"Aviso de transferencia recibida"*, `Debitado de:`, `Monto de la transferencia:`).
- **Banco GNB Paraguay** (comprobantes de 30 dígitos y referencias SIPAP).
- **UENO Bank S.A.** (transacciones de la app ueno y cuentas débito).
- **Banco Familiar S.A.E.C.A.** (operaciones `FAMIPYPAARES...`).
- **Banco Atlas S.A.** (créditos por transferencia SIPAP).
- **Banco Continental S.A.E.C.A.** (acreditaciones interbancarias).

---

## 📑 Registros de Decisiones Arquitectónicas (ADRs)

Todas las decisiones estructurales del SaaS se documentan de forma inmutable en [`docs/adr/`](docs/adr/README.md):
- [ADR-001: Multi-Tenant Architecture & Data Isolation Model](docs/adr/ADR-001-multi-tenant-architecture-and-data-isolation.md)
- [ADR-002: Universal 5-Phase Engineering Pipeline (Gentle AI + Ponytail)](docs/adr/ADR-002-universal-5-phase-engineering-pipeline.md)
- [ADR-003: Tri-Tier RBAC: SuperAdmin, Merchant Owner, and Cashier](docs/adr/ADR-003-tri-tier-rbac-and-governance.md)
- [ADR-004: Multi-Tenant Webhook Ingestion & Anti-Replay Cryptographic Guard](docs/adr/ADR-004-multi-tenant-webhook-ingestion-and-anti-replay.md)
- [ADR-005: Multi-Bank Parsing Strategy (Itaú, GNB, UENO, Familiar, Atlas, Continental)](docs/adr/ADR-005-multi-bank-parsing-strategy.md)
- [ADR-006: Merchant Onboarding, Approval Requests & $15/mo Subscription Billing](docs/adr/ADR-006-merchant-onboarding-and-subscription-billing.md)
- [ADR-007: Premium Fast-POS UX/UI Design System & High-Velocity Operation](docs/adr/ADR-007-premium-fast-pos-design-system.md)

---

## 🗺️ Roadmap de Desarrollo

Consultar el plan de ejecución completo en [ROADMAP.md](ROADMAP.md).
