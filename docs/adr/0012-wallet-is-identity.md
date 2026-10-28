# ADR-0012: The connected Sui wallet is the user's identity

- **Status:** Accepted (supersedes Google zkLogin via Enoki in SPEC §1, §4 and ADR-0008's build step)
- **Date:** 2026-10-28

## Context
There's no Google OAuth client ID or Enoki key, and no time budget to chase them. The alternatives considered were Neon Auth email login plus a wallet, or the wallet alone. The hard requirements (Walrus Memory on Mainnet, Tatum RPC) don't depend on how users sign in.

## Decision
- A member signs in by connecting a Sui wallet (Slush or any wallet-standard wallet) through `@mysten/dapp-kit-react`. Their Sui address is their identity. A group invite binds a wallet address to a member row (`members.sui_address`).
- Server actions that change a group require a fresh signed personal message (`signPersonalMessage` with a nonce and expiry), verified server-side before the write. No passwords and no email.
- Settlement: the payer's wallet signs `0x2::balance::send_funds<USDC>`. The transaction is built and executed through our `/api/sui/graphql` proxy to Tatum and confirmed with Tatum GraphQL (ADR-0004), so every chain call still goes through Tatum.
- `/demo` needs no wallet.
- Enoki zkLogin stays a drop-in upgrade behind the same `connect` and `sign` interface if the keys turn up later.

## Consequences
- The "no wallet, no seed phrase" pitch is gone. The copy becomes "pay from your Sui wallet", and the video says it plainly.
- The payer may need a little SUI for gas if their wallet doesn't produce a gasless transaction. Test with a 0.01 USDC transfer first.
- `NEXT_PUBLIC_ENOKI_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `ENOKI_PRIVATE_API_KEY` are optional and unused.
