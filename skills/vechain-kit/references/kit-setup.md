# VeChain Kit — Setup & Configuration

## When to use

Use when the user asks about: installing VeChain Kit, provider setup, CSS framework choice, Tailwind compatibility, environment variables, login methods, legal documents, ecosystem apps, or common setup issues.

---

## Installation

**Important:** VeChain Kit requires `--legacy-peer-deps` due to peer dependency conflicts.

**Before installing**, check the existing project:

- **React Query (`@tanstack/react-query`)**: VeChain Kit hooks depend on it. If the project doesn't have it yet, ask the developer if they want to add it (they almost certainly do — it's required for `useCallClause` and all data-fetching hooks). If the project uses a different data-fetching library (SWR, etc.), flag the potential conflict.
- **CSS framework**: See [CSS Framework Choice](#css-framework-choice) below — ask whether to keep Tailwind or switch to Chakra UI.

```bash
yarn add --legacy-peer-deps @vechain/vechain-kit

# Required peer dependencies
yarn add --legacy-peer-deps @chakra-ui/react@^2.8.2 \
  @emotion/react@^11.14.0 \
  @emotion/styled@^11.14.0 \
  @tanstack/react-query@^5.64.2 \
  @vechain/dapp-kit-react@2.1.0-rc.1 \
  framer-motion@^11.15.0

# Recommended: pre-built ABIs for VeChain ecosystem contracts
yarn add @vechain/vechain-contract-types
```

For npm, use `npm install --legacy-peer-deps` instead.

**Why `@vechain/vechain-contract-types`?** It provides TypeChain-generated ABIs and factories for all major VeChain ecosystem contracts (B3TR, VOT3, StarGate, VET domains, smart accounts, etc.). Use these with `useCallClause` instead of hand-writing ABIs. See the **smart-contract-development** skill (`references/abi-codegen.md`) for the full list.

**If the project doesn't have React Query yet**, also set up the `QueryClientProvider`:

```tsx
// app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* VeChainKitProvider goes here */}
      {children}
    </QueryClientProvider>
  );
}
```

## CSS Framework Choice

VeChain Kit uses **Chakra UI v2** internally for all its modal and UI components. When setting up a new project, **ask the developer** which approach they prefer:

| Option | Pros | Cons |
|--------|------|------|
| **Use Chakra UI for the whole app** (recommended) | Full visual consistency with VeChain Kit modals, no CSS conflicts, access to Chakra's component library | Must learn Chakra if unfamiliar |
| **Keep Tailwind CSS** | Developer stays in familiar framework | Requires preflight fix (see below), possible style inconsistencies between app UI and VeChain Kit modals |

**If the developer chooses Chakra UI:** no extra CSS configuration needed — Chakra's `ChakraProvider` and VeChain Kit share the same styling engine. Use Chakra components (`Box`, `Button`, `Text`, `Flex`, etc.) throughout the app.

**If the developer keeps Tailwind CSS (especially v4):** apply the preflight fix below.

### Tailwind CSS v4 Compatibility

Tailwind CSS v4's preflight (CSS reset) **conflicts with Chakra UI's styles** inside VeChain Kit modals — buttons collapse, inputs lose height, spacing breaks.

**Fix: disable Tailwind's preflight.** Replace the default Tailwind import with individual imports that skip `preflight.css`:

```css
/* app/globals.css — BEFORE (broken with VeChain Kit) */
@import "tailwindcss";

/* app/globals.css — AFTER (compatible with VeChain Kit) */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
/* Omit: @import "tailwindcss/preflight.css" layer(base); */
@import "tailwindcss/utilities.css" layer(utilities);
```

This removes Tailwind's CSS reset while keeping all utilities and theme variables. Chakra UI applies its own reset inside VeChain Kit components, so they render correctly.

## Provider Setup (Next.js App Router)

VeChain Kit must be dynamically imported to prevent SSR issues.

**Without own Privy credentials (free shared Privy):**

Use `vechain` for social login — it bundles all social methods (email, Google, passkey, etc.) through VeChain's shared Privy. You **cannot** use `email`, `google`, `passkey`, or `more` individually without your own Privy credentials — doing so will throw a configuration error.

```tsx
// app/providers.tsx
'use client';
import dynamic from 'next/dynamic';

const VeChainKitProvider = dynamic(
  () => import('@vechain/vechain-kit').then(mod => mod.VeChainKitProvider),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <VeChainKitProvider
      network={{ type: 'test' }}   // 'main' | 'test' | 'solo'
      darkMode={true}
      language="en"
      loginModalUI={{
        logo: '/logo.png',
        description: 'My VeChain dApp',
      }}
      loginMethods={[
        { method: 'vechain', gridColumn: 4 },  // all social login via VeChain's Privy
        { method: 'dappkit', gridColumn: 4 },
      ]}
      feeDelegation={{
        delegatorUrl: process.env.NEXT_PUBLIC_DELEGATOR_URL,
      }}
      dappKit={{
        allowedWallets: ['veworld', 'wallet-connect'],
        walletConnectOptions: {
          projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '',
          metadata: {
            name: 'My dApp',
            description: 'A VeChain dApp',
            url: typeof window !== 'undefined' ? window.location.origin : '',
            icons: [],
          },
        },
      }}
      // No privy prop needed — uses VeChain's shared credentials
    >
      {children}
    </VeChainKitProvider>
  );
}
```

**With own Privy credentials (better UX, pick individual methods):**

```tsx
<VeChainKitProvider
  // ...same config as above, but with individual login methods and privy prop:
  loginMethods={[
    { method: 'email', gridColumn: 2 },
    { method: 'google', gridColumn: 2 },
    { method: 'passkey', gridColumn: 2 },
    { method: 'more', gridColumn: 2 },
    { method: 'dappkit', gridColumn: 4 },
  ]}
  privy={{
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
    clientId: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? '',
  }}
>
```

Then wrap `app/layout.tsx` with `<Providers>`.

## Environment Variables

Create `.env.local` with the required variables:

```bash
# Required for WalletConnect (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Optional: fee delegation (omit to use Generic Delegator — users pay own gas)
NEXT_PUBLIC_DELEGATOR_URL=https://your-delegator.com/delegate

# Optional: own Privy credentials (only if using individual social methods)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_PRIVY_CLIENT_ID=your_privy_client_id
```

## Common Setup Pitfalls

1. **SSR errors**: VeChain Kit must be dynamically imported with `{ ssr: false }` (shown above). Without this, Next.js will crash during server rendering.
2. **Missing `--legacy-peer-deps`**: Installation fails without this flag due to Chakra UI v2 peer dependency conflicts. Required with React 19 / Next.js 15+.
3. **Tailwind v4 breaks modal**: See [Tailwind CSS v4 Compatibility](#tailwind-css-v4-compatibility) above.
4. **Using `email`/`google`/`passkey` without Privy credentials**: Throws _"Login methods require Privy configuration"_. Use `{ method: 'vechain' }` instead for free social login.
5. **Missing WalletConnect project ID**: Wallet connection will fail silently. Always provide `NEXT_PUBLIC_WC_PROJECT_ID`.
6. **tsconfig target too low**: VeChain SDK uses BigInt literals (`0n`). Set `"target": "ES2020"` or higher in `tsconfig.json`.
7. **BigInt serialization error** ("Do not know how to serialize a BigInt"): Set wagmi's `hashFn` as default `queryKeyHashFn`:

    ```tsx
    import { hashFn } from 'wagmi/query';
    const queryClient = new QueryClient({
      defaultOptions: { queries: { queryKeyHashFn: hashFn } },
    });
    ```

8. **Restricting wallets**: Use `dappKit: { allowedWallets: ['veworld'] }` to show only VeWorld (omit `'wallet-connect'` if you don't need WalletConnect and don't have a project ID).
9. **Privy popup blocking**: Browsers block popups that open after an async call. Pre-fetch all data before triggering `sendTransaction` so the Privy signing popup opens synchronously.
10. **Missing `ColorModeScript`**: If VeChain Kit modals render with wrong colors, add `<ColorModeScript initialColorMode="dark" />` inside your `ChakraProvider`.
11. **CSS conflicts with Bootstrap or custom CSS**: Use CSS layers — `@layer vechain-kit, host-app;` — and wrap your framework styles in `@layer host-app { ... }`.

## Testing (mocking VeChain Kit hooks)

```tsx
jest.mock('@vechain/vechain-kit', () => ({
  useWallet: () => ({ account: { address: '0x123...' }, isConnected: true }),
  useCallClause: () => ({ data: [BigInt('1000000000000000000')], isLoading: false, error: null }),
}));
```

## Sub-path Exports

VeChain Kit exposes additional exports via sub-paths:

```tsx
// Contract factories (re-exports from @vechain/vechain-contract-types)
import { IB3TR__factory } from '@vechain/vechain-kit/contracts';

// Utility functions
import { humanAddress } from '@vechain/vechain-kit/utils';

// Network config (contract addresses, chain IDs)
import { getConfig } from '@vechain/vechain-kit';
const b3trAddress = getConfig('main').b3trContractAddress;
```

## Login Methods

| Method | Description | Requires own Privy credentials |
|--------|-------------|-------------------------------|
| `vechain` | All social login via VeChain's shared Privy (free, slightly worse UX — VeChain branding, extra redirect) | No |
| `dappkit` | VeWorld, WalletConnect | No |
| `ecosystem` | Cross-app ecosystem login | No |
| `email` | Email-based login | **Yes** — must pass `privy` prop |
| `passkey` | Biometric/passkey login | **Yes** — must pass `privy` prop |
| `google` | Google OAuth | **Yes** — must pass `privy` prop |
| `more` | Additional OAuth providers | **Yes** — must pass `privy` prop |

**Important:** Using `email`, `google`, `passkey`, or `more` without the `privy` prop will throw: _"Login methods require Privy configuration. Please either remove these methods or configure the privy prop."_ Use `vechain` instead for free social login, or provide your own Privy credentials.

**Grid layout:** `gridColumn` controls the width of each login button in a 4-column grid. Use `4` for full width, `2` for half width.

## Ecosystem Apps

Filter which ecosystem apps appear when using `{ method: 'ecosystem' }`:

```tsx
<VeChainKitProvider
  loginMethods={[
    { method: 'ecosystem', gridColumn: 4 },
  ]}
  ecosystemApps={{
    allowedApps: ['app-id-1', 'app-id-2'], // App IDs from the Privy dashboard
  }}
>
```

## Legal Documents (Optional)

Prompt users to accept Terms & Conditions, Privacy Policy, or Cookie Policy on wallet connect. Agreements are stored in local storage per wallet address + document type + version + URL. Incrementing `version` re-prompts users.

```tsx
<VeChainKitProvider
  legalDocuments={{
    allowAnalytics: true, // Optional: prompt for VeChainKit tracking consent
    termsAndConditions: [
      {
        displayName: 'MyApp T&C',
        url: 'https://myapp.com/terms',
        version: 1,
        required: true, // Must accept to proceed
      },
    ],
    privacyPolicy: [
      {
        url: 'https://myapp.com/privacy',
        version: 1,
        required: false, // Optional: user can skip
      },
    ],
    cookiePolicy: [
      {
        url: 'https://myapp.com/cookies',
        version: 1,
        required: false,
      },
    ],
  }}
>
```

Each document entry supports: `displayName` (optional label), `url`, `version`, `required` (boolean).
