# ADR-007: Premium Fast-POS UX/UI Design System & High-Velocity Operation

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect, UI/UX Specialist
- **Consulted**: Retail Cashiers, Product Design

---

## Context and Problem Statement

Retail environments (supermarket express lanes, busy kiosks, pharmacy counters) operate under high sensory and cognitive load. Cashiers cannot navigate complex menus or squint at tiny fonts while a queue of impatient customers waits.

Furthermore, selling a $15/month B2B SaaS requires a **premium, modern aesthetic** that builds immediate trust and credibility with business owners.

---

## Decision Outcome

**Chosen Solution: High-Contrast Fast-POS Interface with Multi-Sensory Feedback and Tri-Portal Separation.**

### 1. Tri-Portal Experience:

```
                                  [Web App Gateway]
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
            [/pos]                   [/merchant]             [/superadmin]
     [Cashier Fast-POS]           [Merchant Portal]     [SuperAdmin Platform]
   - Giant Amount & Name Search - Cashiers CRUD        - Merchant Onboarding Queue
   - 1-Click "Cobrar" Claim     - Active Banks Setup   - Global Store Directory
   - Dual Audio Feedback        - Full Audit Ledger    - MRR & System Health
   - Zero Financial Metrics     - Billing & Invoices   - Webhook Diagnostics
```

### 2. Fast-POS Operator Interface (`/pos`):
- **High-Velocity Ergonomics**:
  - Auto-focused amount field with automatic currency formatting (`45000` -> `Gs. 45.000`).
  - Keyboard shortcuts: `Enter` to search, `Space` or `F2` to confirm & claim, `Esc` to reset.
  - Large touch targets (minimum 54px height) optimized for mobile and touchscreen POS terminals.
- **Multi-Sensory Feedback (Web Audio API Synthesizer)**:
  - *Success Chime*: Ascending dual-tone (523Hz `C5` -> 659Hz `E5` -> 784Hz `G5`) indicating confirmed payment.
  - *Replay Alert*: Low dissonance pulse (180Hz square wave) warning against voucher reuse.
- **Zero-Ambiguity Card Feedback**:
  - Found (Green): Giant amount, client full name, verified bank logo, receipt number.
  - Already Claimed (Red Alert): Timestamp of prior collection and cashier responsible.
  - Not Found (Amber): Clear guidance to wait 30s if customer just transferred.

### 3. Visual System & Typography:
- **Design Tokens**:
  - Background: Deep slate dark mode (`#0B0F19` with subtle glassmorphism `#1E293B/60`).
  - Brand Accent: Electric Indigo / Cyan (`#3B82F6` / `#06B6D4`).
  - Success: Emerald Green (`#10B981`).
  - Error / Alert: Crimson Rose (`#EF4444`).
- **Typography**: Modern geometric sans-serif (Inter / Geist) with high numeric legibility.

---

## Consequences

### Positive:
- Drastic reduction in transaction time at the checkout counter (sub-2 seconds).
- Premium look and feel that justifies the $15/month commercial price point.
- Zero confusion for cashiers regardless of technical skill.
