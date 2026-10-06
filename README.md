# 💎 Validador PYME SaaS (Multi-Tenant Commercial Edition)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10+-red.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Play%20CDN-38bdf8.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)
[![Clean Architecture](https://img.shields.io/badge/Architecture-Clean%20%2F%20Hexagonal-orange.svg)](#-arquitectura)
[![SaaS Pricing](https://img.shields.io/badge/Pricing-Gs.%20150.000%2Fmes-brightgreen.svg)](#-propuesta-de-valor-comercial-gs-150000--mes)

Plataforma SaaS multi-inquilino (*Multi-Tenant*) de alta velocidad para la validación en tiempo real de transferencias bancarias (**SIPAP / QR en Paraguay y LATAM**), diseñada para eliminar las demoras en cajas de comercios, erradicar fraudes de comprobantes duplicados y garantizar privacidad financiera absoluta.

---

## 🚀 Propuesta de Valor Comercial (Gs. 150.000 / mes)

| Dolor Crítico en Comercios | Solución con Validador PYME SaaS |
|---|---|
| ❌ El dueño vive esclavo del celular respondiendo si "acreditó la plata". | ✅ Los cajeros validan el pago en **menos de 2 segundos** desde su pantalla de cobro. |
| ❌ Riesgo de seguridad por compartir contraseñas de correos con empleados. | ✅ **Zero-Knowledge**: Los cajeros solo consultan monto y apellido; jamás ven cuentas ni otros pagos. |
| ❌ Estafa del comprobante bancario reutilizado (capturas viejas). | ✅ **Anti-Replay Guard**: Cada comprobante se bloquea al instante; si lo reusan, suena alerta en **ROJO**. |
| ❌ Gestión caótica para cadenas con múltiples sucursales y cajeros. | ✅ Portal para el dueño con control de operadores, auditoría completa e integración multi-banco (Itaú, GNB, UENO, Familiar, Atlas, Continental). |

---

## 🏛️ Arquitectura del Sistema

Construido bajo **Clean Architecture (Puertos y Adaptadores)** con **NestJS** y **React**:

```
validador-pymes-saas/
├── docs/
│   └── adr/                     # Architecture Decision Records (ADR-001 a ADR-009)
├── src/
│   ├── core/
│   │   ├── domain/              # Lógica de Negocio Pura (Entities, Value Objects, Ports)
│   │   └── application/         # Casos de Uso con Scoping por Tenant
│   ├── infrastructure/          # Adaptadores PostgreSQL (pg) y parsers multi-banco
│   │   ├── database/            # DatabaseService, esquema DDL y seeds (SQL parametrizado, tenant_id)
│   │   ├── parsers/             # BankParserFactory (Itaú, GNB, UENO, Familiar, Atlas, Continental)
│   │   └── repositories/        # Adaptadores por puerto (SQL con pg en modo BD; memoria solo en dev sin BD)
│   └── presentation/            # Controladores NestJS, Interceptores y Guards
│       ├── controllers/         # Webhooks, Cashier POS, Merchant Portal, SuperAdmin
│       ├── middlewares/         # AuthMiddleware (JWT verification en request)
│       └── guards/              # RolesGuard, TenantGuard (no existe JwtAuthGuard)
├── client/                      # Frontend SPA (React + Vite; Tailwind CSS vía Play CDN, sin dependencia de build)
│   ├── src/
│   │   ├── portals/             # auth, landing, onboarding, owner, pos, superadmin (sin router: la vista la elige el estado de sesión)
│   │   ├── components/          # BranchSelectorModal (selector multi-sucursal)
│   │   ├── context/             # AuthContext (sesión, tenant activo, membresías) y helpers de peticiones
│   │   └── utils/               # Sintetizador de audio (Web Audio API)
├── google-apps-script/          # Ingestor de Gmail (secreto vía Propiedades del Script)
├── AGENTS.md                    # Engineering Contract & 5-Phase Pipeline
├── pipeline.md                  # Universal 5-Phase Engineering Pipeline
└── ROADMAP.md                   # Plan de Implementación Fase por Fase
```

---

## 👥 Matriz de Roles y Accesos (Tri-Tier RBAC)

1. **SUPER_ADMIN (Vos - Dueño de la Plataforma SaaS)**:
   - Dashboard global de todos los comercios adheridos.
   - Cola de solicitudes de comercios que quieren contratar el sistema (aprobar con 1 clic; el rechazo de solicitudes **no está implementado**).
   - Visión global de comercios adheridos y de MRR proyectado; validación manual de los pagos de suscripción reportados.
2. **MERCHANT_OWNER (Dueño del Negocio / Kiosko / Farmacia)**:
   - Panel de control de su empresa (portal *Owner*, sin ruta propia: la vista la selecciona el rol de la sesión).
   - Alta y baja de cajeros (la credencial se define al crearla; no hay flujo de cambio de contraseña).
   - URL de webhook única por comercio; los avisos de los 6 bancos soportados se clasifican automáticamente en el backend.
   - Historial financiero completo de transferencias y gestión de la suscripción (Gs. 150.000/mes): facturación **manual** (el dueño informa la transferencia y el administrador la valida), sin pasarela de pago.
3. **CASHIER (Operador de Punto de Venta)**:
   - Pantalla de cobro ultra rápida (portal *Fast-POS*) con botones gigantes y atajos de teclado.
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

Todas las decisiones estructurales del SaaS se documentan de forma inmutable en [`docs/adr/`](docs/adr/README.md) (ADR-001 a ADR-009):
- [ADR-001: Multi-Tenant Architecture & Data Isolation Model](docs/adr/ADR-001-multi-tenant-architecture-and-data-isolation.md)
- [ADR-002: Universal 5-Phase Engineering Pipeline (Gentle AI + Ponytail)](docs/adr/ADR-002-universal-5-phase-engineering-pipeline.md)
- [ADR-003: Tri-Tier RBAC: SuperAdmin, Merchant Owner, and Cashier](docs/adr/ADR-003-tri-tier-rbac-and-governance.md)
- [ADR-004: Multi-Tenant Webhook Ingestion & Anti-Replay Cryptographic Guard](docs/adr/ADR-004-multi-tenant-webhook-ingestion-and-anti-replay.md)
- [ADR-005: Multi-Bank Parsing Strategy (Itaú, GNB, UENO, Familiar, Atlas, Continental)](docs/adr/ADR-005-multi-bank-parsing-strategy.md)
- [ADR-006: Merchant Onboarding, Approval Requests & Subscription Billing (propuesta histórica de precios)](docs/adr/ADR-006-merchant-onboarding-and-subscription-billing.md)
- [ADR-007: Premium Fast-POS UX/UI Design System & High-Velocity Operation](docs/adr/ADR-007-premium-fast-pos-design-system.md)
- [ADR-008: Multi-Tenant Organization Memberships & Tenant Switching](docs/adr/ADR-008-multi-tenant-memberships-and-tenant-switching.md)
- [ADR-009: Implementation & Verification Status (E2E, Persistence, Billing, Edge Controls)](docs/adr/ADR-009-implementation-verification-status.md)

---

## 🧪 Comandos y Verificación

| Acción | Comando |
|---|---|
| Suite de pruebas unitarias | `npm test` (o `npm test -- --runInBand`) |
| Prueba focalizada | `npm test -- --runInBand --runTestsByPath <archivo>` |
| Chequeo de tipos (backend) | `npx tsc --noEmit` |
| Build backend (NestJS) | `npm run build` |
| Build frontend (Vite) | `npm --prefix client run build` |
| Seed inicial | `npm run seed:pilot` (requiere `DATABASE_URL` y `SUPERADMIN_PASSWORD`) |

- **No hay setup de E2E**: el repositorio no incluye harness ni configuración de end-to-end, y el script `test:e2e` fue eliminado porque apuntaba a un archivo inexistente. La verificación se limita a las suites unitarias de Jest más los builds de backend y frontend.
- **Controles en el borde**: el rate limiting (`limit_req`) y los headers de seguridad viven en Nginx (`client/nginx.conf`), no en NestJS. `nginx -t` sigue siendo una validación del operador: no se ejecutó en este entorno (Nginx no está instalado).
- **Producción**: `docker-compose.prod.yml` exige `DB_PASSWORD` y `JWT_SECRET` explícitos, no publica el puerto del backend (el tráfico entra por Nginx) y el seed exige `DATABASE_URL` + `SUPERADMIN_PASSWORD`.
- El seed solo aprovisiona el superadmin del sistema y su tenant. Las credenciales provienen exclusivamente del entorno, nunca se imprimen ni se publican en documentación.
- La validación del webhook del Google Apps Script lee `WEBHOOK_SECRET` desde las Propiedades del Script; ver [google-apps-script/README.md](google-apps-script/README.md).

---

## 🗺️ Roadmap de Desarrollo

Consultar el plan de ejecución completo en [ROADMAP.md](ROADMAP.md).
