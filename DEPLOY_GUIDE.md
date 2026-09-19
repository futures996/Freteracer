# Svelte Setup for GitHub Pages + Reusable Library

This document defines a reusable setup for Svelte projects that need to support both:

- a static GitHub Pages deployment
- a distributable Svelte library for reuse in other projects
- optional `.es` contract files that must work during development and after packaging

The approach described here matches the structure used in this repository and can be copied into future Svelte projects.

## Goals

Use one repository for two outputs:

- `build/`: static website output for GitHub Pages
- `dist/`: packaged library output for external consumption

This pattern is useful when a project includes:

- a demo or documentation site
- reusable Svelte components or TypeScript helpers
- raw contract files such as `.es`

## Recommended Project Structure

```text
src/
  lib/
    components/
    contracts/
    index.ts
  routes/
scripts/
  inline-contracts.js
static/
package.json
svelte.config.js
vite.config.ts
LIBRARY.md
```

Recommended conventions:

- put reusable exports under `src/lib/`
- put contract sources under `src/lib/contracts/`
- export all public library APIs from `src/lib/index.ts`
- keep app pages under `src/routes/`
- keep packaging helper scripts under `scripts/`

## 1. GitHub Pages Configuration

For GitHub Pages, use `@sveltejs/adapter-static` and configure a dynamic base path so the site works when published under:

```text
https://<org>.github.io/<repo>/
```

Example `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

const base = process.env.BASE_PATH ?? (process.env.NODE_ENV === 'production'
	? `/${(process.env.GITHUB_REPOSITORY ?? '').split('/')[1] ?? ''}`.replace(/\/$/, '')
	: '');

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html'
		}),
		paths: {
			base
		}
	}
};

export default config;
```

Why this matters:

- in local development, `base` stays empty
- in production, `base` automatically becomes `/<repo-name>`
- `fallback: 'index.html'` helps for SPA-style routing on GitHub Pages

If the app is fully client-side, also enable prerendering and disable SSR in `src/routes/+layout.ts`:

```ts
export const ssr = false;
export const prerender = true;
```

## 2. Package Metadata

The package must describe both the website location and the library entry points.

Example `package.json` fields:

```json
{
  "homepage": "https://your-org.github.io/your-repo/",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "package": "svelte-package",
    "postpackage": "node scripts/inline-contracts.js",
    "prepare": "npm run package"
  },
  "files": [
    "dist",
    "LIBRARY.md"
  ],
  "svelte": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "svelte": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

Key rules:

- `homepage` should point to the GitHub Pages URL
- `build` should generate the static site
- `package` should generate the reusable library
- `prepare` is useful when installing directly from GitHub
- `files` should include only what consumers need
- `exports`, `svelte`, and `types` should point to the packaged output

## 3. Library Export Pattern

Use `src/lib/index.ts` as the single public entry point.

Recommended export groups:

- framework-agnostic functions
- public TypeScript types
- optional Svelte components
- raw contract helpers or precompiled constants

Example from `src/lib/index.ts`:

```ts
export { someHelper } from './some-helper';
export type { SomeEntity } from './types';
export { default as ExampleWidget } from './components/ExampleWidget.svelte';
export { default as main_contract } from './contracts/main.es';
export { default as auxiliary_contract } from './contracts/auxiliary.es';
```

This keeps app code and library code separate while allowing one repository to serve both.

## 4. Vite Support for `.es` Contracts

If the project includes raw `.es` contracts, Vite must load them as text during development.

Example `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

function esRawPlugin() {
	return {
		name: 'es-raw',
		enforce: 'pre',
		load(id) {
			if (!id.endsWith('.es')) return null;
			const source = readFileSync(id, 'utf-8');
			return `export default ${JSON.stringify(source)};`;
		}
	};
}

export default defineConfig({
	plugins: [esRawPlugin(), sveltekit()],
	optimizeDeps: {
		esbuildOptions: {
			loader: {
				'.es': 'text'
			}
		}
	}
});
```

This allows imports like:

```ts
import MAIN_CONTRACT from './contracts/main.es';
```

## 5. Packaging `.es` Contracts for Consumers

Raw `.es` imports can work inside the repo but break after packaging if the consuming project does not know how to load them. To avoid that, add a post-processing step after `svelte-package`.

In this repository, `scripts/inline-contracts.js` does three things:

- scans `dist/contracts/*.es`
- creates `*.es.js` modules that export the contract text as strings
- rewrites packaged imports from `.es` to `.es.js`

This makes the published library self-contained and safer for downstream apps.

Recommended script flow in `package.json`:

```json
{
  "scripts": {
    "package": "svelte-package",
    "postpackage": "node scripts/inline-contracts.js"
  }
}
```

Use this pattern whenever:

- consumers may install directly from GitHub
- consumers may not have custom Vite loaders for `.es`
- contracts must be exported as plain strings

## 6. Direct GitHub Consumption

If you want other projects to consume the library without publishing to npm, support GitHub installs:

```bash
npm install github:your-org/your-repo
```

Versioned install:

```bash
npm install github:your-org/your-repo#v0.0.1
```

For this to work reliably:

- keep `prepare` enabled so packaging runs on install
- avoid requiring unpublished build-time assumptions in the consumer
- ensure contract assets are already normalized during packaging

## 7. Recommended Build Commands

Use the following command responsibilities:

- `npm run dev`: local development
- `npm run build`: static GitHub Pages build into `build/`
- `npm run package`: library packaging into `dist/`
- `npm run check`: type and Svelte validation
- `npm test`: unit tests

This separation avoids mixing deployment artifacts with library artifacts.

## 8. Reusable Checklist

When creating a new Svelte repository with this pattern, copy this checklist:

1. Install `@sveltejs/adapter-static` and `@sveltejs/package`.
2. Configure `adapter-static` to write the site into `build/`.
3. Add dynamic `kit.paths.base` based on `GITHUB_REPOSITORY`.
4. Export public library APIs from `src/lib/index.ts`.
5. Add `package`, `postpackage`, and `prepare` scripts.
6. Set `svelte`, `types`, and `exports` to `dist/index.*`.
7. If using `.es` contracts, add a Vite text loader and a post-package inlining step.
8. Keep `LIBRARY.md` or equivalent documentation inside published files.

## 9. Recommended Defaults for Future Projects

For future Svelte projects in this ecosystem, the baseline should be:

- SvelteKit app for demo/docs
- static deployment through GitHub Pages
- reusable library packaged with `svelte-package`
- raw contract support through Vite during development
- contract inlining after packaging for compatibility

If a project contains `.es` contracts, treat them as source assets during development but publish them as normal JavaScript string modules for consumers.

## 10. Summary

This setup gives one repository two stable outputs:

- a deployable static website for GitHub Pages
- a reusable Svelte library that can be installed from GitHub or published later

The important compatibility detail is contract handling:

- inside the repo, `.es` files can be imported directly through Vite
- outside the repo, packaged consumers should receive plain JS modules instead of relying on custom loaders

That combination makes the setup practical for Svelte applications, UI libraries, and projects that embed `.es` contract files.
