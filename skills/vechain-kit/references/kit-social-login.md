# VeChain Kit — Social Login & Smart Accounts

## When to use

Use when the user asks about: social login, smart accounts, account abstraction, Privy setup, fee delegation for social login, or DIY social login with dapp-kit.

---

## Smart Accounts

- Social login users get a **Smart Account** (account abstraction) via CREATE2
- Deterministic address (can receive tokens before deployment)
- V3 required for multi-clause and replay protection
- Check: `useUpgradeRequiredForAccount`
- **Factory addresses** (must use the [official factory](https://github.com/vechain/smart-accounts) for ecosystem compatibility):
  - Mainnet: `0xC06Ad8573022e2BE416CA89DA47E8c592971679A`
  - Testnet: `0x713b908Bcf77f3E00EFEf328E50b657a1A23AeaF`

## Privy Setup (Required for Social Login)

There are two options for enabling social login:

**Option A: Use VeChain's shared Privy account (free, no setup)**
VeChain Kit works with social login out of the box — no Privy account needed. If you omit the `privy` prop, VeChain Kit uses VeChain's own Privy credentials via cross-app connect. Use `{ method: 'vechain' }` in `loginMethods` to enable this. This is free and provides all social login methods (email, Google, passkey, etc.) bundled under a single entry point, but the UX is slightly worse: users see VeChain's branding in the Privy modal instead of your app's, and the login flow includes an extra cross-app redirect step.

**You cannot use individual social methods (`email`, `google`, `passkey`, `more`) with the free shared option.** Those methods require your own Privy credentials (Option B). Using them without the `privy` prop will throw a configuration error.

**Option B: Use your own Privy account (better UX)**
Create an app at [privy.io](https://privy.io), retrieve your **App ID** and **Client ID** from the App Settings tab, and pass them to `VeChainKitProvider` (see [setup guide](https://docs.vechainkit.vechain.org/quickstart/setup-privy-optional)):
```tsx
<VeChainKitProvider
  privy={{
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    clientId: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!,
  }}
>
```
This gives your app its own branding in the login modal and a smoother single-step login flow.

The `privy` prop also accepts `appearance`, `embeddedWallets`, and other [Privy SDK options](https://docs.privy.io/) as pass-through configuration.

**Self-hosted Privy pros/cons:**

| Pros | Cons |
|------|------|
| No UI confirmations on user transactions | Cost (Privy pricing) |
| Users can backup keys and manage security in your app | You are responsible for securing the Privy account |
| Targeted social login methods (email, Google, passkey individually) | Users must use ecosystem mode to log into other VeChain apps |

**Security:** If self-hosting Privy, review the [implementation checklist](https://docs.privy.io/guide/security/implementation/) and [CSP guide](https://docs.privy.io/guide/security/implementation/csp).

**Accessing Privy directly:** VeChain Kit re-exports Privy hooks — import from the kit, not from `@privy-io/react-auth`:
```tsx
import { usePrivy } from '@vechain/vechain-kit';

const { user } = usePrivy();
```

## Fee Delegation for Social Login

VeChain Kit v2 auto-enables the **Generic Delegator** by default -- users pay their own gas in VET, VTHO, or B3TR. No `feeDelegation` config is required.

To improve UX, you can optionally sponsor transactions so users pay nothing:
```tsx
<VeChainKitProvider feeDelegation={{ delegatorUrl: 'https://your-delegator.com/delegate' }}>
```

See the **vechain-core** skill (`references/fee-delegation.md`) for Generic Delegator gas estimation, per-transaction sponsorship, and vechain.energy setup.

## Pre-fetch Data Before Transactions

Fetching during `sendTransaction` blocks popups for social login:
```tsx
// GOOD: data ready before transaction
const { data: balance } = useCallClause({ ... });
const handleSend = () => sendTransaction(clauses);

// BAD: fetching inside handler
const handleSend = async () => {
  const balance = await fetchBalance(); // May block popup
  sendTransaction(clauses);
};
```

---

## DIY Social Login with dapp-kit + Privy (Not Recommended)

An alternative to VeChain Kit's built-in social login is using dapp-kit while handling Privy integration, smart account management, and EIP-712 signing yourself. **This adds significant complexity and is not recommended unless you have a specific reason VeChain Kit cannot work for your use case.**

- [Tutorial](https://docs.vechain.org/developer-resources/example-dapps/pwa-with-privy-and-account-abstraction)
- [Example repo](https://github.com/vechain-energy/docs-pwa-privy-account-abstraction-my-pwa-project)
- [Smart accounts factory](https://github.com/vechain/smart-accounts)

### VeChain Kit vs DIY Comparison

| Concern | VeChain Kit (recommended) | DIY with dapp-kit |
|---------|--------------------------|-------------------|
| Smart account contracts | Uses official pre-deployed factory | Must deploy your own OR integrate official factory |
| EIP-712 signing | Automated in `useSendTransaction` | Manual typed data construction |
| Account deployment detection | Built-in (lazy deploy on first tx) | Custom logic required |
| Replay protection | Built-in nonce handling (V3) | Manual nonce management |
| Version upgrades (V1→V3) | `useUpgradeRequiredForAccount` + modal | Must track yourself |
| Batch/multi-clause | Automated via `executeBatchWithAuthorization` | Must build manually |
| iOS/Android signing | Handled (custom domain separator) | Not addressed in tutorial |
| Cross-app compatibility | Supported via `@privy-io/cross-app-connect` | Not supported |
| Provider setup | Single `<VeChainKitProvider>` | Nested `<PrivyProvider>` + custom `<VeChainAccountProvider>` |

### Critical: Use the Official Smart Accounts Factory

If you take the DIY path, you **must** use the [official vechain/smart-accounts factory](https://github.com/vechain/smart-accounts) (`0xC06Ad...` mainnet / `0x713b9...` testnet). Deploying your own factory (as the tutorial does) creates smart accounts that are **not compatible** with VeChain Kit, VeWorld, or other VeChain ecosystem apps. Users would have different addresses across apps.

See [Smart Accounts documentation](https://docs.vechainkit.vechain.org/social-login/smart-accounts) for factory details.

### What You Must Implement Yourself

1. **EIP-712 typed data construction** -- build and sign authorization payloads for `executeWithAuthorization`
2. **Lazy account deployment** -- detect undeployed accounts and inject factory creation clauses on first transaction
3. **Fee delegation integration** -- separate sponsor signature flow
4. **Nonce management** -- for `executeBatchWithAuthorization` replay protection
5. **Version migration** -- the factory has evolved V1→V3 (V2 was skipped); handle upgrades
6. **HTTPS requirement** -- Privy uses `crypto.subtle`, requiring HTTPS even in development (e.g., ngrok)
7. **Ephemeral wallet for submission** -- generate a random wallet as the transaction entry point; actual auth comes from the Privy-signed EIP-712 message

### When DIY Might Be Justified

- You need custom smart account logic beyond what SimpleAccount V3 provides
- You need full control over the signing/submission pipeline
- You are building for a non-React framework where VeChain Kit cannot run
