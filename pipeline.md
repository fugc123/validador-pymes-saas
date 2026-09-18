# 🏛 Universal 5-Phase Engineering Pipeline (Gentle AI 3.1.0 + Full SDD Suite + RDD + ADR)

Cualquier cambio, desarrollo o refactor en este proyecto DEBE ejecutarse bajo este pipeline inmutable de 5 fases, garantizando trazabilidad clínica, calidad de código y cero alucinaciones mediante **Spec-Driven Development (SDD)**, la suite **Ponytail** y **Receipt-Driven Development (RDD)**.

---

## 🏛 Gobernanza Inmutable — Constitución
Antes de iniciar cualquier fase, todo agente debe verificar la alineación con la **Constitución de MoodsJournal** (`docs/constitution.md`). Cualquier cambio que viole la ética clínica, la privacidad de datos (PII/cifrado AES-256-GCM) o el aislamiento de Bounded Contexts es inválido por definición.

---

## 📋 FASE 1 — Especificación Formal, Arquitectura y Tareas (Full SDD Suite)
- **Orquestador Principal**: `skills/gentle-sdd`
- **Sub-agentes y Skills Activas**:
  - `skills/sdd-init`: Inicialización del contexto, detección de herramientas y enlace con memoria persistente.
  - `skills/sdd-explore`: Exploración topológica y cognitiva en modo **read-only estricto** (0 escrituras en código).
  - `skills/sdd-research`: Investigación técnica con fuentes primarias y evaluación de tradeoffs.
  - `skills/sdd-propose`: Formulación de la propuesta de cambio, capacidades agregadas y justificación de arquitectura.
  - `skills/sdd-spec`: Especificación formal delta con criterios numerados `[AC-XX]` y escenarios Gherkin (`Given/When/Then`).
  - `skills/sdd-design`: Contratos de interfaces/DTOs, esquemas DDL de base de datos y diagramas de secuencia.
  - `skills/sdd-tasks`: Desglose en micro-tareas atómicas secuenciales con sus pruebas de fallo y límites de rollback.
  - `skills/systemic-issue-triage`: Clasificación por clase raíz ante bugs, asegurando que el diseño achique la complejidad del sistema.
  - `skills/cognitive-doc-design`: Documentación estructurada para minimizar la carga cognitiva del revisor humano.
- **Límite de Presupuesto (400 líneas)**: Si la proyección de diff supera las 400 líneas, se planifica división en *Chained PRs* (`skills/chained-pr`).

---

## 🛑 FASE 2 — Aprobación Manual (Loop 1: Human-in-the-Loop)
- **Detención Estricta**: El agente DEBE DETENERSE y esperar la revisión y aprobación manual explícita del usuario (`Aprobado`, `dale`) antes de escribir una sola línea de código en producción.
- **Validación del Alcance**: Si el usuario solicita ajustes a los contratos o al alcance, se itera en la Fase 1 sin tocar código fuente.

---

## 🔨 FASE 3 — Ejecución TDD, Work-Units y Simplificación Ponytail (Loop 2: Task Progression)
- **Sub-agente Ejecutor**: `skills/sdd-apply`
- **Skills de Calidad y Simplicidad**:
  - `skills/ponytail`: Impone la solución más simple y perezosa que funcione (KISS/YAGNI). Prefiere APIs estándar y nativas antes que dependencias externas.
  - `skills/ponytail-review`: Audita cada diff para decapitar abstracciones prematuras y sobreingeniería.
  - `skills/ponytail-debt`: Registra atajos técnicos conscientes bajo la etiqueta `// ponytail:` en el ledger del proyecto.
  - `skills/work-unit-commits`: Cada micro-tarea cerrada concluye con un **Work-Unit Commit** atómico que contiene código + tests unitarios + docs juntos, bajo Conventional Commits, sin superar el presupuesto de 400 líneas.
  - `skills/chained-pr`: Si el trabajo crece, se apilan ramas rebaseables (*Stacked PRs*) independientes.

---

## 🛡️ FASE 4 — Auditoría, Ciberseguridad y Reconciliación (Loop 3: Spec-to-Test)
- **Sub-agente de Verificación**: `skills/sdd-verify`
- **Skills de Auditoría y Compliance**:
  - `skills/rdd-defect-workflow`: Verificación de invariantes causales de rollback y reproducción en limpio.
  - `skills/security-review`: Cifrado en reposo (AES-256-GCM), sanitización de PII y seguridad en APIs y tokens.
  - `skills/security-scan`: Escaneo de dependencias CVE (`pnpm audit`) y análisis estático.
  - `skills/ecc-compliance`: Estándares enterprise (NestJS/React) y cumplimiento clínico estricto (HIPAA/GDPR).
  - `skills/gentle-code-review`: Auditoría asistida por Gentleman Guardian Angel (GGA) para política de 0 bugs.
- **Garantías de Calidad**:
  - 100% de suites de tests pasando (`pnpm test`).
  - 0 errores de compilación o tipado (`pnpm build`).
  - Cada Criterio de Aceptación `[AC-XX]` con prueba unitaria o de integración verificada en vivo.

---

## ⚖️ FASE 5 — Judgment Day, Recibos RDD, Walkthrough y Sincronización de Memoria
- **Receipt-Driven Development (RDD)**:
  - Evaluación de riesgo del candidato (`gentle-ai review assess`).
  - Generación de recibos inmutables de revisión (`gentle-ai review start / capture`). La entrega requiere recibo verificado.
- **Auditoría Adversarial**: `skills/judgment-day` ejecuta revisión ciega (Red Team vs Blue Team) en cambios de autenticación, datos clínicos o arquitectura multi-módulo.
- **Cierre y Memoria**:
  - `skills/adr-generator`: Generación formal de ADR en `docs/adr/ADR-XXX-nombre.md` (formato MADR 3.0).
  - `engram_memory`: Persistencia de decisiones en memoria de largo plazo (`record_decision`).
  - `skills/sdd-archive`: Archivado formal de la especificación e integración a la baseline del sistema.
  - `walkthrough.md`: Evidencia comprobable en vivo de todas las pruebas y flujos ejecutados.

---

## 🛠️ Herramientas Meta y de Soporte
- `skills/issue-creation` & `skills/branch-pr`: Gestión de ramas e issues trazables.
- `skills/comment-writer`: Comunicación empática, técnica y directa en PRs y revisiones.
- `skills/skill-creator` & `skills/skill-improver`: Creación y refinamiento de nuevas skills LLM-first.
- `skills/skill-registry`: Catálogo y sincronización continua en `.atl/skill-registry.md`.
