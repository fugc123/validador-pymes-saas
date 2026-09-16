# ADR-002: Universal 5-Phase Engineering Pipeline (Gentle AI + Ponytail)

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Engineering Team

---

## Context and Problem Statement

When commercial SaaS systems scale, codebases often degrade due to speculative abstractions, unrequested features, lack of blast-radius analysis, and skipping verification steps. In the sibling production project (`moodsjournal`), an enterprise-grade engineering contract combining **Gentle AI** (structured architectural guidance) and **Ponytail** (ruthless YAGNI and anti-bloat pruning) yielded superior defect elimination and architectural hygiene.

We must formally establish this 5-phase pipeline as an immutable standard for all current and future engineering work in *Validador PYME SaaS*.

---

## Decision Drivers

1. **Elimination of Over-Engineering**: SaaS products often fail by building unneeded enterprise complexity instead of delivering crisp business value.
2. **Deterministic Context Delivery**: Ensure every AI coding assistant and human engineer adheres to identical verification phases.
3. **Zero-Defect Delivery**: Guarantee that code is tested, typed, built, and cryptographically verified prior to commit.

---

## Decision Outcome

**Chosen Policy: Mandatory 5-Phase Pipeline.**

1. **Phase 1: Planning & Topological Blast Radius (SDD)**:
   - 100% read-only exploration.
   - Blast radius analysis covering Domain, Application, and Presentation layers.
   - Written proposal in `implementation_plan.md`.

2. **Phase 2: Manual Approval Gate**:
   - Explicit pause. Implementation proceeds only upon human technical lead authorization.

3. **Phase 3: Execution with Ponytail Pruning**:
   - Clean Architecture layer isolation.
   - Application of Ponytail Decision Ladder:
     1. Does this need to exist? (YAGNI).
     2. Is it already in the codebase?
     3. Does the native platform / stdlib cover it?
     4. Does an installed dependency cover it?
     5. Can it be a clean one-liner?
     6. Write the minimum robust code.

4. **Phase 4: Audit & Multi-Tenant Cybersecurity**:
   - 0 TypeScript errors.
   - Clean production build (`npm run build`).
   - 100% passing tests (`npm test`).
   - Mandatory OWASP Top 10 and multi-tenant boundary checks.

5. **Phase 5: Judgment Day & Knowledge Sync**:
   - Verification evidence in `walkthrough.md`.
   - Recording architectural decisions in `docs/adr/`.
   - Synchronizing persistent memory across sessions.

---

## Consequences

### Positive:
- Total consistency between all AI agents and developers.
- Clean Git history with conventional commits only (no AI tags, no co-authors).
- Zero technical debt accumulation.
