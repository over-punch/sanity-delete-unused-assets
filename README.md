# Sanity Delete Unused Assets

[![npm version](https://img.shields.io/npm/v/@liiift-studio/sanity-delete-unused-assets.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-delete-unused-assets)
[![license](https://img.shields.io/npm/l/@liiift-studio/sanity-delete-unused-assets.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-delete-unused-assets)
[![Sanity Studio v3–v6](https://img.shields.io/badge/Sanity%20Studio-v3%20%E2%80%93%20v6-f03e2f.svg)](https://www.sanity.io/)

An asset cleanup utility component for Sanity Studio that identifies and permanently removes **unused** assets (images and files no longer referenced by any document) to reclaim storage. It also reports total storage usage and finds duplicate filenames. Renders with native Sanity UI components (via a compat layer, so it looks native on Studio v3 through v6).

> ⚠️ **This tool deletes data permanently.** Deleting a Sanity asset is **irreversible** from the Studio. Read the [Safety & irreversibility](#safety--irreversibility) section before running it against a real dataset.

## How it works

The component runs a single GROQ query for every image/file asset, counts how many documents reference each one, and treats any asset with **zero references** as unused. With `dryRun` it only reports; otherwise it deletes the unused assets in a transaction.

<p align="center">
  <img
    src="https://raw.githubusercontent.com/Liiift-Studio/sanity-delete-unused-assets/main/assets/data-flow.svg?v=1"
    alt="Data flow: scan every Sanity image/file asset, count references, flag the zero-reference (unused) assets, apply filters, and — only when dryRun is off — permanently delete them via a batched transaction; otherwise report what would be deleted."
    width="420"
  />
</p>

<!-- PNG fallback (some registry renderers don't display SVG):
  https://raw.githubusercontent.com/Liiift-Studio/sanity-delete-unused-assets/main/assets/data-flow.png?v=1 -->

1. **Asset inventory** — scans all `sanity.imageAsset` and `sanity.fileAsset` documents in your dataset.
2. **Reference analysis** — for each asset, counts referencing documents with `count(*[references(^._id)])`.
3. **Usage detection** — any asset with `refs == 0` is flagged as unused.
4. **Filter application** — applies your `assetTypes`, `olderThan`, `excludePatterns`, and `maxAssets` options.
5. **Deletion** — when not in `dryRun`, deletes the flagged assets in a batched transaction and reports what was removed.

## Features

- 🔍 **Asset scanning** — detects unused image and file assets by reference count
- 📊 **Storage analysis** — reports file sizes and total/per-type storage usage
- 🧬 **Duplicate detection** — groups assets that share the same original filename
- 🎯 **Filtering** — narrow the scan by asset type, age, exclude patterns, and a max count
- 🛡️ **Safety controls** — `dryRun` preview, `excludePatterns`, and batch processing
- 📱 **Native Studio look** — renders with Sanity UI components through a compat layer, so one build fits naturally inside a Studio tool or pane on **v3 through v6**

## Installation

```bash
npm install @liiift-studio/sanity-delete-unused-assets
```

## Quick Start

The package's default export is a React component. Render it inside a Studio tool/pane and hand it a Sanity client:

```tsx
import React from 'react'
import { DeleteUnusedAssets } from '@liiift-studio/sanity-delete-unused-assets'
import { useClient } from 'sanity'

const AssetCleanup = () => {
  const client = useClient({ apiVersion: '2023-01-01' })

  return (
    <DeleteUnusedAssets
      client={client}
      dryRun // preview first — strongly recommended
      onComplete={(results) => {
        console.log(`Cleaned up ${results.deleted} assets, freed ${results.savedSpace} bytes`)
      }}
    />
  )
}
```

> The component is also available as the package's **default** export, so
> `import DeleteUnusedAssets from '@liiift-studio/sanity-delete-unused-assets'` works too.

This package ships a component, not a Studio plugin — there is no auto-registering
tool. Mount the component yourself, for example as a custom tool in `sanity.config.ts`:

```tsx
import { defineConfig, useClient } from 'sanity'
import { DeleteUnusedAssets } from '@liiift-studio/sanity-delete-unused-assets'

const AssetCleanupTool = () => {
  const client = useClient({ apiVersion: '2023-01-01' })
  return <DeleteUnusedAssets client={client} dryRun />
}

export default defineConfig({
  // ...
  tools: (prev) => [
    ...prev,
    { name: 'asset-cleanup', title: 'Asset Cleanup', component: AssetCleanupTool },
  ],
})
```

### With filters

```tsx
<DeleteUnusedAssets
  client={client}
  assetTypes={['image']}                 // only image assets
  olderThan={new Date('2024-01-01')}      // only assets created before this date
  excludePatterns={['hero-', 'logo-']}    // skip filenames containing these
  maxAssets={50}                          // never act on more than 50 at once
  dryRun                                  // preview the result without deleting
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `client` | `SanityClient` | **required** | Sanity client instance (must have delete permissions to actually remove assets) |
| `assetTypes` | `('image' \| 'file')[]` | `['image', 'file']` | Which asset kinds to scan |
| `olderThan` | `Date` | `undefined` | Only consider assets created before this date |
| `excludePatterns` | `string[]` | `[]` | Filename substrings to exclude from deletion |
| `maxAssets` | `number` | `500` | Cap on how many assets a single run will act on |
| `batchSize` | `number` | `10` | Number of assets processed per batch |
| `dryRun` | `boolean` | `false` | Preview mode — reports what *would* be deleted without deleting |
| `onComplete` | `(results: { deleted: number; savedSpace: number; errors: string[] }) => void` | `undefined` | Called when a run finishes |
| `onError` | `(error: string) => void` | `undefined` | Called on a top-level failure |

## Safety & irreversibility

**Deleting a Sanity asset is permanent.** There is no Studio-level undo. Treat every non-`dryRun` run as destructive and follow these practices:

- **Always run with `dryRun` first** and review the reported list before deleting for real.
- **Export a dataset backup** before a real deletion: `sanity dataset export <dataset> backup.tar.gz`.
- **`references()` only sees published references.** An asset referenced **only by a draft document** (or via a path/custom resolver that `references()` does not traverse) can be counted as unused. Such assets may be deleted even though a draft still points at them.
- **Freshly uploaded but not-yet-saved assets** have no references and will be flagged as unused — finish your edits before cleaning up.
- **Scope your client.** The `client` you pass controls which dataset is affected and whether deletion is even permitted. A read-only token cannot delete (Sanity returns *Insufficient permissions* — pass a write token, e.g. via `--with-user-token` when scripting).
- Use `excludePatterns` and `maxAssets` to limit blast radius on large or unfamiliar datasets.

### Dry run

```tsx
<DeleteUnusedAssets client={client} dryRun />
```

Preview what would be deleted, validate filters and exclude patterns, and sanity-check storage savings — all without touching your data.

### Exclude patterns

```tsx
excludePatterns={[
  'hero-',   // skip hero images
  'logo-',   // skip logos
  'backup',  // skip anything with "backup" in the filename
]}
```

### Batch processing

Large cleanups are processed in batches (`batchSize`, default `10`) to avoid transaction timeouts on big asset collections.

## Storage analysis

The component surfaces storage metrics alongside cleanup:

- **Total storage** used by image and file assets, with per-type breakdown
- **Asset counts** (total, images, files)
- **Per-asset size** and reference count
- **Duplicate filename groups** for spotting accidental re-uploads

## Performance tips

- Use `batchSize` to control how aggressively a run processes.
- Apply `assetTypes` / `olderThan` / `maxAssets` to reduce scan scope on large datasets.
- Run large cleanups during off-peak hours.

## Requirements

This package declares the following peer dependencies — **one build supports Sanity
Studio v3, v4, v5 and v6**:

| Peer | Declared range | Meaning |
|------|----------------|---------|
| `sanity` | `>=3 <7` | Studio v3 through v6 |
| `@sanity/ui` | `>=2 <5` | v2, v3, v4 — see the note below, `<5` is **not** a mistake |
| `@sanity/icons` | `>=2 <6` | v2 through v5 |
| `react` | `^18.0.0 \|\| ^19.0.0` | React 18 or 19 |

> **`@sanity/ui` is capped below v5 on purpose.** Studio v6 ships **`@sanity/ui` v4**,
> not v5, so `>=2 <5` is the correct range for a v6 Studio. It reads like a bug at a
> glance; it isn't.

### How one build spans four Studio majors

Two upstream breaking changes make naive imports fail across these majors:

- **`@sanity/ui` v4** moved `Tooltip`, `Menu`, `MenuButton`, `MenuItem`, `Code`,
  `Popover`, `Autocomplete`, `Toast` and `useToast` out of the package root and into
  **subpath entries**.
- **`@sanity/icons` v5** removed **every named `*Icon` export**.

The trap is that **both packages still _declare_ the removed names in their `.d.ts`,
typed `never`**. A named import therefore type-checks, compiles, and bundles cleanly —
and then throws at runtime in the Studio. `tsc` and your bundler will both tell you it
is fine.

So this package **imports no `@sanity/ui` or `@sanity/icons` symbol directly**. Every
component and icon routes through
[`@liiift-studio/sanity-ui-compat`](https://www.npmjs.com/package/@liiift-studio/sanity-ui-compat),
which resolves the *installed* namespace at runtime and picks the right root-or-subpath
location per major. That indirection — not a version-matrix build — is what makes a
single artifact work on v3 through v6.

`sanity-ui-compat` is a regular `dependencies` entry and is **bundled into this
package's `dist`**, so there is nothing extra for you to install.

> **`Progress` is supplied by the compat layer, not by `@sanity/ui`.** This component
> renders a scan-progress bar via `Progress`, which **has never been exported by
> `@sanity/ui`** (verified absent from the typings of the installed `@sanity/ui@4.0.5`).
> `sanity-ui-compat` implements it. If you vendor `src/` rather than consuming `dist`,
> keep importing `Progress` from the compat package — importing it from `@sanity/ui`
> will not resolve.

### Verification status

v3–v6 support rests on the declared peer ranges, green builds, and use in **three
in-house Liiift Studio Studios**. It has **not** been exercised broadly in a running
Sanity 6 Studio beyond those. Treat v6 as supported-and-believed-good rather than
extensively field-tested, and please file an issue if you hit a gap.

### TypeScript

The published package **does not declare a `types` field**, so TypeScript consumers get
no bundled declarations and the import resolves as untyped. `src/` ships in the tarball
and `src/DeleteUnusedAssets.tsx` carries the real `DeleteUnusedAssetsProps` interface —
use the [Props](#props) table above as the contract, or declare a local module shim.

## Regenerating the diagram

The data-flow diagram is generated from a committed [Mermaid](https://mermaid.js.org/) source (`assets/data-flow.mmd`):

```bash
npm run capture   # renders assets/data-flow.svg via @mermaid-js/mermaid-cli
```

## Part of the Liiift Sanity Tools suite

One of a family of Sanity Studio utilities by [Liiift Studio](https://liiift.studio), all
sharing the same v3–v6 compat approach:

| Package | Does |
|---|---|
| [`sanity-search-and-delete`](https://www.npmjs.com/package/@liiift-studio/sanity-search-and-delete) | Find documents and bulk-delete them |
| [`sanity-duplicate-and-rename`](https://www.npmjs.com/package/@liiift-studio/sanity-duplicate-and-rename) | Bulk-duplicate documents with templated renaming |
| [`sanity-export-data`](https://www.npmjs.com/package/@liiift-studio/sanity-export-data) | Export document types to CSV or JSON |
| [`sanity-ui-compat`](https://www.npmjs.com/package/@liiift-studio/sanity-ui-compat) | The compat layer these tools import instead of `@sanity/ui` |

## License

MIT License. Licensed under the terms declared in [`package.json`](./package.json)
(`"license": "MIT"`). No standalone `LICENSE` file is checked into the repo yet.

## Contributing

Contributions are welcome. Please open an issue or pull request on the
[repository](https://github.com/Liiift-Studio/sanity-delete-unused-assets) to help improve this utility.
