---
name: adr-generator
description: Procedimiento estandarizado para registrar, documentar y actualizar Architecture Decision Records (ADRs) siguiendo el estándar formal MADR y sincronizar automáticamente con la memoria persistente de Engram. Usar siempre que se tome una decisión arquitectónica, de librerías, persistencia, seguridad o diseño de dominio.
metadata:
  origin: MoodsJournal-Architecture
---

# ADR Generator Skill (MADR + Engram Sync)

Esta habilidad formaliza el proceso para capturar, documentar y preservar decisiones estructurales de ingeniería y diseño clínico en MoodsJournal, asegurando el cumplimiento del estándar MADR (Markdown Architectural Decision Records) y la memoria institucional a través de Engram.

---

## Cuándo Activar esta Habilidad

- Al incorporar un nuevo Bounded Context, módulo o aggregate root en NestJS o React.
- Al seleccionar, migrar o descartar librerías externas críticas (p. ej., gestores de paquetes, proveedores de mensajería, motores criptográficos, SDKs de IA).
- Al modificar invariantes de dominio de alto impacto (p. ej., reglas de asignación paciente-terapeuta, restricciones de auto-suspensión, políticas de privacidad y cifrado).
- Al implementar cambios en la infraestructura de despliegue, esquemas de bases de datos o pipelines CI/CD.
- Al concluir la Fase 5 (*Judgment Day & Walkthrough*) del Universal 5-Phase Pipeline.

---

## Procedimiento Paso a Paso

### Paso 1: Determinar el Próximo Número Secuencial
1. Inspeccionar el directorio `docs/adr/` y revisar `docs/adr/README.md`.
2. Identificar el identificador de tres dígitos correspondiente: `ADR-XXX` (p. ej., si el último es `ADR-012`, el siguiente será `ADR-013`).
3. Definir un slug descriptivo en minúsculas separado por guiones: `ADR-XXX-nombre-descriptivo.md`.

### Paso 2: Redactar el ADR siguiendo el Estándar MADR
Utilizar la siguiente plantilla obligatoria con rigor técnico y clínico:

```markdown
# ADR-XXX: [Título Descriptivo en Español]

- **Estado**: Propuesto | Aceptado | Reemplazado por [ADR-YYY] | Deprecado
- **Fecha**: YYYY-MM-DD
- **Bounded Context**: [módulos afectados, ej. patient-journal, identity-access]
- **Autores**: [Nombres o Equipo]

---

## Contexto y Problema
[Descripción exhaustiva del problema que motivó la decisión. Explicar el impacto clínico, técnico y de seguridad. ¿Qué fallaba, qué riesgo existía o qué necesidad insatisfecha se detectó?]

---

## Drivers de Decisión
- [Criterio de evaluación 1: ej. Cero impacto iatrogénico en pacientes]
- [Criterio de evaluación 2: ej. Rendimiento sub-segundo en APIs]
- [Criterio de evaluación 3: ej. Cumplimiento de estándares HIPAA/GDPR]

---

## Alternativas Evaluadas

### Alternativa 1: [Nombre de la Alternativa 1]
- **Descripción**: [Cómo funcionaba]
- **Pros**: [Ventajas identificadas]
- **Contras**: [Por qué no fue seleccionada]

### Alternativa 2: [Nombre de la Alternativa 2]
- **Descripción**: [Cómo funcionaba]
- **Pros**: [Ventajas identificadas]
- **Contras**: [Por qué no fue seleccionada]

### Alternativa 3 (Elegida): [Nombre de la Solución Adoptada]
- **Descripción**: [Resumen de la arquitectura seleccionada]

---

## Decisión de Arquitectura
[Explicación detallada de la solución implementada. Incluir diagramas conceptuales, contratos de interfaces y fragmentos de código TypeScript o esquemas representativos.]

---

## Consecuencias y Tradeoffs

### Positivas
- [Beneficio medible 1]
- [Beneficio medible 2]

### Negativas / Mitigaciones
- [Desventaja o costo de la solución]
- *Mitigación*: [Cómo se mitiga dicho costo]

---

## Archivos Afectados
- `ruta/al/archivo1.ts`
- `ruta/al/archivo2.tsx`
```

### Paso 3: Actualizar el Índice General (`docs/adr/README.md`)
Añadir una fila en la tabla markdown de `docs/adr/README.md` preservando el orden numérico:
```markdown
| [**ADR-XXX**](ADR-XXX-nombre-descriptivo.md) | Título | `Aceptado` | bounded-context | YYYY-MM-DD | Resumen en una o dos oraciones. |
```

### Paso 4: Sincronizar en Memoria Persistente de Engram
Inmediatamente tras escribir el archivo, invocar `mem_save` para preservar la decisión en la memoria entre sesiones:

```json
{
  "title": "Decisión de Arquitectura: ADR-XXX [Título]",
  "type": "decision",
  "scope": "project",
  "topic_key": "architecture/adr-xxx-[slug]",
  "content": "What: [Resumen de la decisión]\nWhy: [Motivación clínica y técnica]\nWhere: [docs/adr/ADR-XXX... y archivos de código]\nLearned: [Gotchas, lecciones y tradeoffs]"
}
```

### Paso 5: Replicar en Repositorios Hermanos (Frontend / Monorepo)
Si el repositorio cuenta con un repositorio cliente espejo (p. ej., `moodsjournal-frontend`), copiar la carpeta `docs/adr/` para mantener la documentación arquitectónica sincronizada de forma bidireccional.

---

## Checklist de Verificación de Calidad

- [ ] ¿El archivo sigue exactamente la nomenclatura `ADR-XXX-slug-descriptivo.md`?
- [ ] ¿Se especificaron al menos dos alternativas reales descartadas con sus pros y contras?
- [ ] ¿Se incluyó contexto clínico real (si afecta a pacientes o psicólogos)?
- [ ] ¿Los tradeoffs negativos cuentan con una estrategia de mitigación explícita?
- [ ] ¿La lista de archivos afectados contiene rutas válidas del repositorio?
- [ ] ¿Se actualizó la tabla de `docs/adr/README.md`?
- [ ] ¿Se persistió la memoria en Engram con el `topic_key` apropiado?
