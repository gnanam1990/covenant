# Covenant — testnet addresses & lifecycle proof

**Unaudited testnet software — no real funds.**

## Arc Testnet (chain 5042002)

| Resource | Value | Source |
|----------|-------|--------|
| RPC | `https://rpc.testnet.arc.network` | docs.arc.io |
| Explorer | `https://testnet.arcscan.app` | docs |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | docs.arc.io/arc/references/contract-addresses |
| USDC decimals | 6 (verified onchain) | cast call |

## Covenant deployment

Real testnet deploy from this repo is pending a deployer key funded with testnet USDC (Circle faucet: https://faucet.circle.com/, browser-only reCAPTCHA).

### Validated deployment (Anvil fork of Arc testnet, block 53,586,848)

- **Contract**: Covenant
- **Deployed address (fork)**: `0xa5c9020ea95324a05b48491fb3e61ba111e5dd95`
- **Deploy tx (fork)**: `0x48b54ab466983f0cf64a37526cd1ea27ed3c1763fc0d280ee27d524ce047db7f`
- **Tool**: `forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC --broadcast`
- **Run log**: `broadcast/Deploy.s.sol/5042002/run-latest.json`

The three reference configurations from PRD §5 are scripted in `services/configs.ts` (run via `services/demo.ts`) — ready to run against real Arc testnet with a funded key. **The point of this project is that all three run against the SAME deployed address** — see the demo output which prints that address at the end.

## How to run on real Arc testnet

```bash
cp .env.example .env
# fill in PRIVATE_KEY, PAYER_KEY, ORACLE_KEY, ATTESTOR1_KEY, ATTESTOR2_KEY, ATTESTOR3_KEY, USDC_ADDRESS
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC --broadcast
COV_ADDRESS=0x... npm run demo
```

## Summary

| Metric | Value |
|--------|-------|
| Foundry tests | 12 / 12 passing (incl. 512-run generality fuzz) |
| Off-chain unit tests | 2 / 2 passing |
| Invariants encoded | 5 / 5 from PROMPT.md |
| Generality fuzz | randomizes attestor count (1-6) + rule (ALL/ANY/M-of-N) + threshold |
| Real testnet deploy | pending funded key |
| Fork deploy | ✅ validated on Anvil fork of Arc testnet at latest block |
