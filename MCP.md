# Adding an MCP server + Celaut `.service` (with the three-signer structure)

This guide turns an app built from this template into something an **agent** can
drive — both locally (an MCP server over stdio) and as a sealed, distributable
**Celaut microVM** that exposes the *same* surface over HTTP MCP **and** a plain
REST API.

It is the recipe proven across `celaut-skills`, `forum-application`, and
`source-application`. Follow it verbatim and your reads + writes work in the
browser (Nautilus), from a Node agent (seed mnemonic), and in build-only mode
(unsigned tx for an external wallet) — from one codebase.

---

## 0. The mental model

This template's browser code signs through the injected global `ergo` connector
(see `src/lib/ergo/actions/submit.ts`). An agent has no browser and no Nautilus,
so the **signing strategy must be swappable**. That is the whole point of the
**three-signer structure**:

| Signer | Where it runs | What it does | Key material |
|---|---|---|---|
| **NautilusSigner** | Browser | Calls the injected `ergo.*` connector to sign + submit | In the user's extension |
| **SeedSigner** | Node / agent | Derives keys from a BIP-39 mnemonic, signs **and submits** autonomously | A mnemonic in env (never in code) |
| **UnsignedSigner** | Anywhere | Builds the tx and returns the **unsigned EIP-12** object for an external wallet to sign | **None** — no key touched |

Reads need no signer at all (they're just Explorer queries). Only writes pick a
signer, and they pick it **from the environment** — so the same `create_*`
function serves all three modes.

> ⚠️ **Derivation gotcha (must-read).** `@fleet-sdk/wallet`'s
> `ErgoHDKey.fromMnemonic` derives keys a **non-standard** way — a SeedSigner
> built on it signs from a **different address than Nautilus** for the same
> mnemonic. Derive with `@scure/bip39` + `@scure/bip32` (standard BIP-39/32) and
> bridge the extended private key into `ErgoHDKey` for the Prover. The reference
> `SeedSigner` in `reputation-system` already does this correctly — **reuse it,
> don't re-roll it.**

---

## 1. File layout

Add an `mcp/` folder (dev/agent surface) and a `.service/` folder (the sealed
microVM). They share the same plain-ESM modules:

```
mcp/
  core.mjs      # READS — framework-agnostic port of src/lib/ergo (NO svelte)
  lib.mjs       # makeSigner() from env + tx-shaping + describeResult() helpers
  writes.mjs    # WRITES — your actions on top of *_with_signer (NO svelte)
  tools.mjs     # SINGLE source of truth: TOOLS + HANDLERS + REST route table
  server.mjs    # stdio MCP (npm run mcp) — a thin wrapper over tools.mjs
  package.json
.service/
  server-http.mjs   # 0.0.0.0:8080 → /health, /mcp (Streamable HTTP), /api/* (REST)
  core.mjs lib.mjs writes.mjs tools.mjs   # copies (the microVM is self-contained)
  Dockerfile service.json start.sh pack_config.json package.json README.md
```

**Why the split:** `tools.mjs` defines the tool list, the handlers, and the REST
routes **once**. Both `server.mjs` (stdio) and `.service/server-http.mjs` (HTTP +
REST) import it, so the three transports can never drift apart.

**Why plain `.mjs`, not the `.ts` library:** the SvelteKit code uses
`$app/environment`, `svelte/store`, and extensionless ESM imports that won't load
under bare Node. Port the *logic* (Explorer fetches, register parsing) into
`core.mjs` with every Svelte dependency stripped. Reads are pure HTTP + parsing —
they port cleanly.

---

## 2. The reads core (`mcp/core.mjs`)

Copy each fetch function out of `src/lib/ergo/**` and strip Svelte. Replace
persisted stores with plain constants / `process.env`. Example shape:

```js
// mcp/core.mjs — framework-agnostic, runs under bare Node
export const EXPLORER_API =
  process.env.APP_EXPLORER_API || 'https://api.ergoplatform.com';

const isHexId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{4,}$/.test(v);

export async function fetchThings(pointer) {
  if (!isHexId(pointer)) return [];          // short-circuit on placeholder ids
  const res = await fetch(`${EXPLORER_API}/api/v1/boxes/unspent/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* ergoTreeTemplateHash, registers, assets */ })
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.items ?? []).map(parseBox);
}
```

Keep ALL placeholder/zero Type-NFT ids exactly as the app has them — the
`isHexId` short-circuit makes those queries return `[]` gracefully instead of
throwing, until the real NFTs are minted.

---

## 3. The signer factory (`mcp/lib.mjs`)

This is the heart of the three-signer structure. Reuse the signer classes from
`reputation-system/node` (or your own lib's Node entry) and select one from env.
Use an **app-specific prefix** for the env vars (e.g. `FORUM_`, `SOURCE_`,
`APP_`) so multiple services can coexist:

```js
// mcp/lib.mjs
import { SeedSigner, UnsignedSigner } from 'reputation-system/node';

export const EXPLORER_API =
  process.env.APP_EXPLORER_API || 'https://api.ergoplatform.com';

/**
 *   APP_SIGNER_MODE=seed      → sign + submit autonomously with a mnemonic
 *     APP_MNEMONIC   (required)   BIP-39 mnemonic of the publishing wallet
 *     APP_MNEMONIC_PASSWORD       optional BIP-39 passphrase
 *     APP_NODE_URI                Ergo node for submission
 *     APP_ADDRESS_INDEX           change-path index (default 0)
 *
 *   APP_SIGNER_MODE=unsigned  → build only; return the unsigned EIP-12 tx (default)
 *     APP_ADDRESS    (required)   P2PK address whose UTXOs fund the tx
 */
export function makeSigner() {
  const mode = (process.env.APP_SIGNER_MODE || 'unsigned').toLowerCase();
  if (mode === 'seed') {
    const mnemonic = process.env.APP_MNEMONIC;
    if (!mnemonic) throw new Error('APP_SIGNER_MODE=seed requires APP_MNEMONIC.');
    return new SeedSigner({
      mnemonic,
      password: process.env.APP_MNEMONIC_PASSWORD,
      addressIndex: process.env.APP_ADDRESS_INDEX ? Number(process.env.APP_ADDRESS_INDEX) : 0,
      explorerUri: EXPLORER_API,
      nodeUri: process.env.APP_NODE_URI
    });
  }
  if (mode === 'unsigned') {
    const address = process.env.APP_ADDRESS;
    if (!address) throw new Error('APP_SIGNER_MODE=unsigned requires APP_ADDRESS.');
    return new UnsignedSigner({ address, explorerUri: EXPLORER_API });
  }
  throw new Error(`Unknown APP_SIGNER_MODE: ${mode} (expected 'seed' or 'unsigned').`);
}

/** Normalize a signer result into an MCP/REST-friendly payload. */
export function describeResult(result) {
  if (result.kind === 'submitted') return { submitted: true, txId: result.txId };
  return {
    submitted: false,
    unsignedTransaction: result.transaction,
    note: 'Transaction built but not signed. Sign + submit with an external wallet.'
  };
}
```

Note: **NautilusSigner is the browser default** and stays in your SvelteKit app —
the MCP/service only ever needs `seed` and `unsigned`. **Default to `unsigned`**
so an agent with no key configured can still build transactions safely.

---

## 4. The writes (`mcp/writes.mjs`)

Port each browser action so it takes a signer instead of the global `ergo`. The
browser version calls `ergo.sign_tx`; the Node version calls the library's
`*_with_signer` builder:

```js
// mcp/writes.mjs
import { create_opinion_with_signer } from 'reputation-system/node';
import { EXPLORER_API, makeSigner, describeResult } from './lib.mjs';

export async function doTheThing(args) {
  const signer = makeSigner();                       // env decides seed vs unsigned
  const result = await create_opinion_with_signer(signer, EXPLORER_API, /* …args */);
  return describeResult(result);                     // {submitted,txId} | {unsignedTransaction}
}
```

The same function now: **submits** under `seed`, or **returns an unsigned tx**
under `unsigned` — no branching in your code.

---

## 5. Shared registry (`mcp/tools.mjs`) + stdio server

`tools.mjs` exports `TOOLS` (MCP schema), `HANDLERS` (name → fn), and a `ROUTES`
table mapping REST verbs/paths to the same handlers. `server.mjs` is then ~15
lines: wire `TOOLS`/`HANDLERS` to a `StdioServerTransport`. (See
`reputation-system/mcp/server.mjs` and `celaut-mcp-service/server-http.mjs` for
the exact, copy-pasteable bootstrap.)

Run locally: `npm run mcp` (`"mcp": "node mcp/server.mjs"` in `package.json`).

---

## 6. The `.service/` microVM (HTTP MCP + REST)

`server-http.mjs` binds `0.0.0.0:8080` and serves three things off the shared
`tools.mjs`:

- `GET /health` — liveness probe
- `POST /mcp` — the MCP tool surface over **Streamable HTTP** (stateless: a fresh
  `Server` + transport per request)
- `GET|POST /api/*` — the **REST** mirror (reads via GET, writes via POST using
  the configured signer)

Supporting files (mirror `celaut-mcp-service/` and `benefaction-platform/.service/`):

- **`service.json`** — `{ "api": [{"port":8080,"protocol":["http"]}], "architecture":"linux/amd64", "init": {"entry_path":["app","start.sh"]}, "network":[{"tags":["api.ergoplatform.com","ipv4","public"]}], … }`. The microVM is **sealed to the Explorer host only**.
- **`Dockerfile`** — `FROM node:20-slim`; copy `package.json`, `npm install --omit=dev`, copy the `.mjs` files + `start.sh`. CMD/ENTRYPOINT/EXPOSE are omitted on purpose — Celaut reads the entrypoint/ports from `service.json`, and only exports the image filesystem.
- **`start.sh`** — `exec node /app/server-http.mjs`
- **`pack_config.json`** — ignore `node_modules/`, `.git/`, `*.md` from the pack.

---

## 7. Dependency pinning — the one that bites

Your MCP/service imports the library's **Node entry** (`reputation-system/node`,
or your own `./node` export). How you pin it matters:

- ✅ **Pin the canonical upstream**, which has the `./node` export + the correct
  `@scure` derivation merged and `dist/` committed:
  `"reputation-system": "github:reputation-systems/reputation-system"`.
- ❌ **Never pin a fork feature branch**
  (`github:<fork>/reputation-system#some-branch`). If that branch is deleted or
  rebased, every install breaks. A fork's `master` is often **stale** and may
  lack the `./node` export entirely — check before trusting it.
- 🥇 **For a sealed `.service`, vendor a built tarball**:
  `npm pack` the library into `.service/reputation-system-0.0.1.tgz`, commit it
  (force-include it past any `*.tgz` gitignore rule), and pin
  `"reputation-system": "file:./reputation-system-0.0.1.tgz"`. This needs no git
  or `svelte-package` at Docker-build time — the sturdiest option for a microVM
  that must build reproducibly and offline.

To confirm a pin is good before shipping:

```sh
node -e "import('reputation-system/node').then(m => \
  console.log(Object.keys(m).filter(k => /Signer|_with_signer/.test(k))))"
# → NautilusSigner, SeedSigner, UnsignedSigner, create_*_with_signer
grep -l 'scure/bip32' node_modules/reputation-system/dist/signer.js  # derivation present
```

---

## 8. Verification checklist (do this, capture output)

- `npm install`; `node --check` every new `.mjs`.
- `npm run mcp` boots the stdio server; an MCP `tools/list` returns **all** tools.
- `.service` HTTP server: `curl localhost:8080/health` → ok; `tools/list` over
  `/mcp` returns the same tools; one REST **read** returns live data (or a clean
  `[]`); one **write in `unsigned` mode** returns an unsigned tx **with no
  mnemonic set** — proving the no-key path.
- **Never** run a seed-mode write or submit a tx during verification, and keep
  mnemonics out of the repo, argv, and logs.

---

### Reference implementations

- `reputation-system/mcp/{server,lib}.mjs` — full-surface MCP + `makeSigner` (the template for §3–§5).
- `celaut-skills/mcp/server.mjs` — read-only stdio MCP.
- `celaut-mcp-service/` — the proven `.service` packaging (the template for §6).
- `forum-application/` & `source-application/` — complete worked examples (reads + writes + REST).
