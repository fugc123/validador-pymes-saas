---
name: sdd
description: Procedimiento canónico de Spec-Driven Development (SDD) de Gentle AI. Rige la generación obligatoria de los 4 artefactos (Constitución, Especificación, Plan y Tareas) y la ejecución de los 3 loops de retroalimentación para cualquier iniciativa de software.
metadata:
  origin: Gentle-AI-SDD-Framework
---

# Gentle AI Spec-Driven Development (SDD) Skill

Esta habilidad formaliza el framework canónico de **Spec-Driven Development (SDD)** dentro del ecosistema de desarrollo guiado por agentes de IA.

SDD sustituye la programación improvisada o apresurada por una cadena de custodia formal donde **El código es simplemente el resultado determinista de una especificación matemática y conductual exhaustiva**.

---

## 🏛 Los 4 Artefactos Canónicos de SDD

Para cualquier funcionalidad no trivial (más de un simple fix mecánico), el agente debe interactuar obligatoriamente con estos 4 artefactos:

| Artefacto | Ubicación | Función | Mutabilidad |
| :--- | :--- | :--- | :---: |
| **1. Constitución** | `docs/constitution.md` | Leyes supremas de ética clínica, privacidad, límites de arquitectura y calidad. | Inmutable / Fundamental |
| **2. Especificación (Spec)** | `docs/specs/SPEC-XXX-nombre.md` | Define el **QUÁ** y el **POR QUÁ**. Casos de uso, actores, requerimientos funcionales, no-goals y Criterios de Aceptación numerados (`[AC-01]`, `[AC-02]`...). | Congelada tras aprobación |
| **3. Plan de Implementación** | `docs/plans/PLAN-XXX-nombre.md` | Define el **CÓMO**. Arquitectura, diseño de Bounded Contexts, contratos de interfaces/DTOs, cambios archivo por archivo (`[NEW]`, `[MODIFY]`) y estrategia de testeo. | Vivo durante diseño |
| **4. Desglose de Tareas (Tasks)** | `docs/tasks/TASKS-XXX-nombre.md` | Micro-tareas atómicas, secuenciales, dependientes y verificables (`Task 1.1`, `Task 1.2`...) con checkboxes. | Actualizado en tiempo real |

---

## �� Los 3 Loops de Retroalimentación Obligatorios

### Loop 1: Human-in-the-Loop Approval (Fase 2)
- Una vez redactados `SPEC-XXX.md` y `LAN-XXX.md`, el agente **DEBE DETENERSE**.
- No se escribe ni una sola línea de código en producción hasta que el desarrollador revise el plan y dé su consentimiento explícito (`Aprobado`, `dale`).
- Si el humano solicita ajustes, se itera en la spec o plan antes de tocar el código.

### Loop 2: TDD & Task Progression Loop (Fase 3)
- El agente lee `TASKS-XXX.md` y toma **una sola micro-tarea atómica a la vez**.
- Aplica el ciclo Red-Green-Refactor:
  1. Escribe la prueba unitaria que falla (`*.spec.ts`).
  2. Escribe la mínima cantidad de código para hacer pasar el test.
  3. Ejecuta `ponytail-review` para eliminar sobreingeniería y abstracciones prematuras.
  4. Marca la casilla `[x]` en `TASKS-XXX.md` antes de pasar a la siguiente.

### Loop 3: Spec-to-Test Reconciliation Loop (Fase 4)
- Antes de dar por finalizada la funcionalidad, se ejecuta la matriz de reconciliación:
  - Cada Criterio de Aceptación `[AC-XX]` de la especificación debe estar cubierto por al menos un test unitario o de integración verificable.
  - Se ejecuta la suite completa de pruebas (`pnpm test`) y compilación (`pnpm build`).
  - 100% verde = Aprobación de entrega.

---

## ⩪�\�T]
�^	��[Y]JB�H�HH\�XH\�[�\��Y��[�X[����p�]X��HHH�\��]���
Z���ܜ�Y�\�[�H��XK\�ܘY��XH�[��Y�]�Y[�H�ۈ�]\�H�p�^��\�JK�H\X�H[
���\�T]
����H[\[Y[�X�p�ۈ\�X�H[�[�HHH�]\�H�p�^���H�\�Y�X�X�p�ۈ[�YYX]H�ۈ�YX�\˂�H���H^Y�HHܙXX�p�ۈH\�Y�X���\�Y��\�H]�]\�\��[\�\�܈[��[\�\�H\�\�X�[�H��[�˂