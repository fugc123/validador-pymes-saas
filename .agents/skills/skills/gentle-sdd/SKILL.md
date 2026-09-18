---
name: gentle-sdd
description: Workflow oficial de Spec-Driven Development (SDD) del ecosistema Gentle-AI para la planificación, diseño, ejecución y verificación rigurosa de características complejas.
---

# 🌹 Gentle-AI™ Spec-Driven Development (SDD)

El flujo **SDD** transforma peticiones complejas en entregables verificados mediante 4 fases estructuradas:

---

## 📐 Fases del Flujo SDD

### 1. Exploración e Investigación (Research)
- Inspeccionar el código existente, arquitecturas y dependencias sin modificar archivos de código.
- Identificar puntos de extensión y posibles impactos de regresión.

### 2. Propuesta e Implementation Plan (`implementation_plan.md`)
- Generar o actualizar la especificación formal del cambio.
- Documentar:
  - Resumen de objetivos.
  - Decisiones de diseño y preguntas abiertas (**User Review Required**).
  - Cambios propuestos desglosados por componentes (`[NEW]`, `[MODIFY]`, `[DELETE]`).
  - Plan de verificación de pruebas automatizadas y manuales.
- Obtener la aprobación explícita del usuario antes de pasar a código.

### 3. Ejecución Disciplinada (Execution)
- Modificar el código siguiendo la Escalera de Decisión YAGNI (concisión, reutilización, librería estándar).
- Respetar los contratos DTO y tipado estricto.

### 4. Verificación y Walkthrough (`walkthrough.md`)
- Ejecutar suites de compilación y pruebas (`npm run build`, `npm run test`).
- Generar el artefacto `walkthrough.md` especificando los cambios realizados, pruebas ejecutadas y resultados de rendimiento/telemetría.
