# ADR-0001: Record decisions as ADRs

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
The project has one large plan (`docs/SPEC.md`, previously `docs/DESIGN.md`) that mixes product behaviour, infrastructure and schedule. Judges score "technical quality" partly from how readable the reasoning is. The impeccable design skill also reads any `DESIGN.md` as the visual design system, and it was treating the build plan as one.

## Decision
- Architecture decisions live in `docs/adr/NNNN-title.md`, one per decision, using Status / Date / Context / Decision / Consequences.
- An accepted ADR overrides `docs/SPEC.md` where they disagree. The spec is updated in the same PR when practical.
- The build plan is renamed `docs/SPEC.md`. Root `PRODUCT.md` holds product context for UI work, and root `DESIGN.md` is reserved for the visual design system (tokens, type, components).

## Consequences
- The Cursor rule points at SPEC, ADRs, PRODUCT and DESIGN with a clear precedence order.
- Superseded ADRs stay in place with `Status: Superseded by ADR-XXXX`.
