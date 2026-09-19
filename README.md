# ergo-basics / template

A batteries-included **SvelteKit starter for Ergo dApps**. Clone it, swap in your
logic, and you get a browser app with wallet connection, a component library, a
dark/light theme, and — when you want an agent or a backend to drive it — a clear
path to an **MCP server** and a sealed **Celaut `.service`** microVM exposing the
same surface over HTTP + REST, with a **three-signer** structure (browser / seed /
unsigned).

The bundled example app is a minimal **"Send ERG"** screen, so you can see the
wallet → build-tx → sign → submit loop end to end before replacing it.

---

## Features

- **SvelteKit + Vite + TypeScript**, static-adapter build (deploys to GitHub Pages).
- **Wallet integration** via `wallet-svelte-component` + the injected `ergo` (Nautilus/EIP-12) connector.
- **Fleet SDK** (`@fleet-sdk/core`, `@fleet-sdk/compiler`) for building transactions and compiling **ErgoScript**.
- **shadcn-svelte UI** (bits-ui + Tailwind): dialogs, dropdowns, cards, forms, calendar, carousel, etc.
- **Dark/light theme** — a one-click toggle button with a rotating Sun/Moon icon (`mode-watcher`).
- **Agent-ready**: a documented recipe to expose your library as an MCP server and a Celaut microVM — see [`MCP.md`](./MCP.md).

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build → ./build
npm run preview    # serve the production build locally
npm run deploy     # build + publish ./build to GitHub Pages (gh-pages)
npm run check      # svelte-check (types)
npm run test       # vitest
```

---

## Project structure

```
src/
  app.css                     # Tailwind layers + theme design tokens (:root / .dark)
  routes/
    +layout.svelte            # mounts <ModeWatcher/> (theme) and the app
    +page.svelte / App.svelte # the example "Send ERG" UI
    Theme.svelte              # the dark/light toggle button
  lib/
    common/                   # wallet stores, constants, helpers
    components/               # SettingsModal + the shadcn-svelte ui/ library
    ergo/
      envs.ts                 # network id, explorer + web-explorer URIs
      utils.ts                # ergo helpers
      actions/submit.ts       # example: build + sign + submit an ERG transfer
      contracts/              # (add your ErgoScript .es files here — see below)
static/                       # static assets
```

When you add an agent/backend surface, two more folders appear (recipe in [`MCP.md`](./MCP.md)):

```
mcp/        # stdio MCP server: core.mjs (reads) + lib.mjs (signers) + writes.mjs + tools.mjs + server.mjs
.service/   # Celaut microVM: server-http.mjs (/health, /mcp, /api/*) + Dockerfile + service.json + start.sh
```

---

## Wallet & transactions (browser)

The example action shows the full browser path — it uses the injected `ergo`
connector to gather inputs, then builds with Fleet SDK and asks the wallet to
sign + submit:

```ts
// src/lib/ergo/actions/submit.ts (abridged)
const inputs = await ergo.get_utxos();
const height = await ergo.get_current_height();
const unsigned = new TransactionBuilder(height)
  .from(inputs)
  .to(new OutputBuilder(amount, targetAddress))
  .sendChangeTo(await ergo.get_change_address())
  .payFee(RECOMMENDED_MIN_FEE_VALUE)
  .build();
const signed = await ergo.sign_tx(unsigned.toEIP12Object());
return await ergo.submit_tx(signed);
```

This is the **NautilusSigner** path. To let a Node agent or a backend run the same
operation without a browser, swap the signing strategy — that's the three-signer
structure.

---

## The three-signer structure

Signing is **swappable** so the same operation works in the browser, from an
autonomous Node agent, and in key-less build-only mode:

| Signer | Runs in | Behavior | Key material |
|---|---|---|---|
| **NautilusSigner** | Browser | `ergo.*` connector signs + submits | In the user's extension |
| **SeedSigner** | Node / agent | Derives from a BIP-39 mnemonic, signs **and submits** | A mnemonic in env (never in code) |
| **UnsignedSigner** | Anywhere | Builds the tx, returns the **unsigned EIP-12** for an external wallet | **None** |

Reads need no signer. Writes select one **from the environment**
(`APP_SIGNER_MODE=seed|unsigned`, default `unsigned` so a key-less agent is safe).

> ⚠️ **Derivation gotcha:** `@fleet-sdk/wallet`'s `ErgoHDKey.fromMnemonic` derives
> keys a **non-standard** way — a seed signer built on it signs from a *different
> address* than Nautilus. Derive with `@scure/bip39` + `@scure/bip32` (standard)
> and bridge into `ErgoHDKey`. Reuse the reference `SeedSigner` from
> `reputation-system` rather than re-rolling it.

Full implementation (the `makeSigner()` factory, env table, and `*_with_signer`
wiring) is in **[`MCP.md` §3–§4](./MCP.md)**.

---

## MCP server

Expose your library's read + write surface to any MCP-aware client (Claude, IDEs,
agents). One shared registry (`tools.mjs`) feeds both a local **stdio** server
(`npm run mcp`) and the networked `.service`, so the transports never drift. Each
write returns a submitted `txId` (seed mode) or an unsigned tx (unsigned mode).

→ Step-by-step in **[`MCP.md` §1–§5](./MCP.md)**.

---

## Celaut `.service` folder

The `.service/` folder packages the app as a **sealed Celaut microVM** that nodes
can distribute and run. `server-http.mjs` binds `0.0.0.0:8080` and serves:

- `GET /health` — liveness probe
- `POST /mcp` — the MCP tool surface over Streamable HTTP
- `GET|POST /api/*` — a plain **REST** mirror (reads via GET, writes via POST using the configured signer)

…alongside `Dockerfile`, `service.json` (port, entrypoint, network sealed to the
Explorer host), `start.sh`, and `pack_config.json`.

**Dependency pinning matters:** pin the library to the canonical upstream
(`github:reputation-systems/reputation-system`) or **vendor a built tarball** into
the `.service` — never a fork feature branch (it can be deleted and break installs).

→ Full layout + the pinning rules in **[`MCP.md` §6–§7](./MCP.md)**.

---

## ErgoScript contracts

For anything beyond simple transfers you'll add **ErgoScript** contracts. Put the
sources under `src/lib/ergo/contracts/` as `.es` files, import them as raw strings,
and compile with `@fleet-sdk/compiler` (already a dependency):

```ts
import { compile } from '@fleet-sdk/compiler';
import { blake2b256, hex } from '@fleet-sdk/crypto';
import MY_SCRIPT from './contracts/my_contract.es?raw';

// Compile to an ErgoTree (pin the script version your contract targets).
const tree = compile(MY_SCRIPT, { version: 1 });

const contractAddress  = tree.toAddress().encode();        // P2S address to send funds to
const templateHash     = hex.encode(blake2b256(tree.template)); // for Explorer box search (tree.template is a Uint8Array)
```

Notes:
- Contracts that reference another contract's hash (e.g. a registry pointing at a
  governance script) compile the dependency first, then string-substitute its
  `blake2b256` hash before compiling the parent — see `reputation-system/src/lib/envs.ts`
  for a worked example.
- Keep the compiled **template hash** handy: the Explorer's
  `/boxes/unspent/search` endpoint requires `ergoTreeTemplateHash` to filter your
  contract's boxes.
- Reads in `mcp/core.mjs` use exactly that search — so the contract layer and the
  agent layer share one source of truth.

---

## Theme (dark/light)

`Theme.svelte` is a single toggle button (Sun ↔ Moon, rotate + scale cross-fade)
wired to `mode-watcher`. `<ModeWatcher/>` lives in `+layout.svelte`, Tailwind runs
in `darkMode: ["class"]`, and the palette is defined as HSL design tokens in
`src/app.css` (`:root` for light, `.dark` for dark) — restyle the whole app by
editing those tokens.

---

## Documentation

- **[`MCP.md`](./MCP.md)** — how to add the MCP server + Celaut `.service` with the three-signer structure (the deep dive this README links to).

## License

MIT
