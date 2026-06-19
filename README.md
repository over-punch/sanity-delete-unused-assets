# Sanity Delete Unused Assets

[![npm version](https://img.shields.io/npm/v/@liiift-studio/sanity-delete-unused-assets.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-delete-unused-assets)
[![license](https://img.shields.io/npm/l/@liiift-studio/sanity-delete-unused-assets.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-delete-unused-assets)
[![Sanity Studio v3+](https://img.shields.io/badge/Sanity%20Studio-v3%20%7C%20v4%20%7C%20v5-f03e2f.svg)](https://www.sanity.io/)

An asset cleanup utility component for Sanity Studio that identifies and permanently removes **unused** assets (images and files no longer referenced by any document) to reclaim storage. It also reports total storage usage and finds duplicate filenames. Built with `@sanity/ui`.

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
- 📱 **Sanity UI** — built with `@sanity/ui`, fits naturally inside a Studio tool or pane

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
| `maxAssets` | `number` | `undefined` | Cap on how many assets a single run will act on |
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

This package declares the following peer dependencies:

| Peer | Supported range |
|------|-----------------|
| `sanity` | `^3 \|\| ^4 \|\| ^5` |
| `@sanity/ui` | `^1 \|\| ^2 \|\| ^3` |
| `@sanity/icons` | `^2 \|\| ^3` |
| `react` | `^18 \|\| ^19` |

## Regenerating the diagram

The data-flow diagram is generated from a committed [Mermaid](https://mermaid.js.org/) source (`assets/data-flow.mmd`):

```bash
npm run capture   # renders assets/data-flow.svg via @mermaid-js/mermaid-cli
```

## License

MIT License. Licensed under the terms declared in [`package.json`](./package.json) (`"license": "MIT"`).

## Contributing

Contributions are welcome. Please open an issue or pull request on the
[repository](https://github.com/Liiift-Studio/sanity-delete-unused-assets) to help improve this utility.
