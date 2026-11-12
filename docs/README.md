# Documentation site

The SvelteKit app behind **[astryx.crqch.dev](https://astryx.crqch.dev/)**. Every route is
prerendered (`src/routes/+layout.ts` sets `prerender = true`), so production is a folder of static
files served by Cloudflare Workers static assets. The Cloudflare adapter still emits a small worker
for requests that are not assets; a browser navigation to an unknown path is served the prerendered
`404.html` instead.

## Local development

The docs generator reads the **built** `packages/core/dist` and the pinned `@astryxdesign/*`
packages, so build the workspace before the first dev run and after changing core:

```sh
# repository root
bun install
bun run build
bun run dev
```

`bun run dev` starts this app. The site also needs `packages/core/dist` built after a clean checkout;
`bun run build` does that in dependency order.

## Build

```sh
# repository root
bun run build
```

The Cloudflare adapter writes to `.svelte-kit/cloudflare/`, which is the asset directory named in
[`wrangler.jsonc`](wrangler.jsonc).

## Deploy to Cloudflare Workers

### Prerequisites

- A Cloudflare account with **`crqch.dev` added as an active zone** (the `routes` entry in
  `wrangler.jsonc` uses `custom_domain`, so Wrangler creates the DNS record and certificate on
  deploy). Remove that block to deploy to the generated `*.workers.dev` URL instead.
- Either a local `wrangler login`, or an API token plus account ID for CI.

### First deploy from your machine

```sh
# once
bunx wrangler login

# from the repository root, every deploy
bun run deploy:docs
```

`deploy:docs` builds the docs and its workspace dependencies, then runs `wrangler deploy` from
`docs/`. The first deploy creates the `astryx-svelte-docs` worker and attaches
`astryx.crqch.dev`.

Useful follow-ups:

```sh
cd docs
bun run preview          # local Workers runtime at http://localhost:8787
bunx wrangler tail       # live production logs
bunx wrangler deployments list
```

### Deploy from GitHub Actions

[`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml) deploys on every push
to `main` that touches the docs, the packages they document, or the lockfile. Add these repository
secrets under **Settings → Secrets and variables → Actions**:

| Secret                  | Value                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token with **Workers Scripts: Edit** and **Workers Routes: Edit** (plus **DNS: Edit** if Wrangler manages the custom domain) |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID from the Cloudflare dashboard                                                                                     |

The **Edit Cloudflare Workers** API token template covers the Workers permissions; add DNS edit for
the custom domain.

Optionally add a repository **variable** named `PUBLIC_GA_MEASUREMENT_ID` (e.g. `G-XXXXXXXXXX`) to
enable Google Analytics. Unset, the analytics component renders nothing.

### Deploy with Workers Builds instead

If you would rather let Cloudflare build the repository, connect it under **Workers & Pages →
Create → Workers Builds** and use:

- **Root directory:** repository root
- **Build command:** `bun run build`
- **Deploy command:** `bun run --filter docs deploy`

## Configuration

- `wrangler.jsonc` — worker name, compatibility date, asset directory and custom domain.
- `vite.config.ts` — selects `@sveltejs/adapter-cloudflare`.
- `src/routes/404/+page.svelte` — the styled 404 page, prerendered to `404.html` for Cloudflare's
  `not_found_handling`.
- `.env` — declares `PUBLIC_GA_MEASUREMENT_ID` with an empty default; real values come from the
  build environment or `.env.local`.

The site is fully prerendered, so Cloudflare serves normal page views straight from static assets
without invoking the worker. Browser navigations to an unknown path get the prerendered `404.html`;
non-navigation requests that match no asset reach the worker and get SvelteKit's 404 response.

## Checks

```sh
bun run check
bun run test
bun run lint
```
