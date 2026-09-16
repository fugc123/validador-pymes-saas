# 🧭 Specification-Driven Development (SDD) — Framework & Verification Loops

This directory contains the formal **SDD (Spec-Driven Development)** suite for **Validador PYME SaaS**. 

SDD replaces speculative coding and prompt-and-pray development with a deterministic, document-guided lifecycle backed by continuous verification loops.

---

## 🏛️ The 4 Core Artifacts

```
┌─────────────────────────┐
│     CONSTITUTION        │  The Supreme Law: Non-negotiables, security & domain invariants.
│   (constitution.md)     │
└────────────┬────────────┘
             │  Loop 1: Invariant Integrity Check
             ▼
┌─────────────────────────┐
│      SPECIFICATION      │  What the system does: User stories, actors, Given/When/Then, FSMs.
│        (spec.md)        │
└────────────┬────────────┘
             │  Loop 2: Completeness & YAGNI Check
             ▼
┌─────────────────────────┐
│         DESIGN          │  How it is built: Hexagonal layout, PostgreSQL DDL, API contracts.
│       (design.md)       │
└────────────┬────────────┘
             │  Loop 3: Traceability & Testability Check
             ▼
┌─────────────────────────┐
│         TASKS           │  Atomic units of work: Dependency graph, files, and verification tests.
│       (tasks.md)        │
└─────────────────────────┘
```

---

## 🔄 The 4 Closed Verification Loops

### 🔁 Loop 1: Spec ⟷ Constitution (Invariant Integrity Loop)
- **Question**: *Does any user story or scenario in `spec.md` violate an Article of `constitution.md`?*
- **Checkpoints**:
  - Does any scenario allow viewing transfers across tenants? (Violates Article I).
  - Can a voucher be claimed twice under high load? (Violates Article II).
  - Can a cashier list or search all recent unverified transfers? (Violates Article III).
- **Rule**: If a violation is detected, `spec.md` is rejected immediately until aligned with the Constitution.

### 🔁 Loop 2: Design ⟷ Spec (Completeness & YAGNI Loop)
- **Question**: *Does `design.md` cover 100% of functional requirements without introducing speculative bloat?*
- **Checkpoints**:
  - Are all entities, states, and transitions in `spec.md` represented in the PostgreSQL DDL?
  - Are all API endpoints specified in `spec.md` given concrete request/response DTO schemas?
  - **Ponytail Pruning**: Are there unrequested tables, over-engineered message queues, or speculative features? (Strip them).

### 🔁 Loop 3: Tasks ⟷ Design (Traceability & Testability Loop)
- **Question**: *Does every atomic task in `tasks.md` build a verifiable slice of `design.md`?*
- **Checkpoints**:
  - Is every task ordered strictly by its prerequisites (`Depends On`)?
  - Does every task include an automated test assertion (Unit or E2E)?
  - Can each task be proven green with verifiable command-line output?

### 🔁 Loop 4: Execution ⟷ Test (TDD & Pre-Commit Loop)
- **Question**: *Does the implemented code satisfy the task's automated test with zero warnings?*
- **Lifecycle**:
  1. Write failing test (Red).
  2. Implement minimum robust code (Green).
  3. Prune with Ponytail (Refactor).
  4. Compile check: `tsc --noEmit` returns 0 errors.
  5. Commit with conventional commit format.

---

## 📑 Artifact Index

1. **[Constitution (`constitution.md`)](constitution.md)**: Supreme invariants and non-negotiables.
2. **[Specification (`spec.md`)](spec.md)**: Functional requirements, user stories, and state machines.
3. **[Design (`design.md`)](design.md)**: Technical architecture, PostgreSQL schema, and API contracts.
4. **[Tasks (`tasks.md`)](tasks.md)**: Phased implementation backlog with automated tests.
