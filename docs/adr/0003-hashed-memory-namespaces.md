# ADR-0003: Salted, hashed Walrus Memory namespaces

- **Status:** Accepted
- **Date:** 2026-10-28

## Context
Memory content is Seal-encrypted, but `memwal_namespace`, `memwal_owner` and `memwal_agent_id` are public plaintext in on-chain blob metadata ([MemWal #315](https://github.com/MystenLabs/MemWal/issues/315)). A namespace like `flat-3b-lekki` would leak group identity to anyone reading the chain. The managed relayer also sees plaintext before encryption.

## Decision
- Group namespace: `ss_g_` + first 16 hex chars of `sha256(groupId + NAMESPACE_SALT)`. App namespace: `ss_app`.
- `NAMESPACE_SALT` is 32 random bytes (hex), server-only, generated once. **It must never change after the first Mainnet write**, because changing it orphans every existing namespace.
- Memory text carries display names only: no emails, phone numbers, Google subject IDs or raw wallet addresses beyond what a settlement receipt needs.

## Consequences
- Back up `NAMESPACE_SALT` with the MemWal private key. Losing it means the app can no longer find its own memories.
- The salt is currently **empty** in the local env (checked Oct 28). Generate it before the first group write: `openssl rand -hex 32`.
- The README states the relayer trust model honestly.
