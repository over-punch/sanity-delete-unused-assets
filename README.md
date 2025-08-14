# Sanity Delete Unused Assets

A comprehensive asset cleanup utility for Sanity Studio that identifies and removes unused assets to optimize storage and improve performance. Features advanced scanning, filtering, and safety mechanisms.

## Features

- 🔍 **Smart Asset Scanning**: Automatically detects unused images, videos, and files
- 📊 **Storage Analysis**: Shows file sizes, storage savings, and detailed metrics
- 🎯 **Advanced Filtering**: Filter by file type, size, age, and custom patterns
- 🛡️ **Safety First**: Dry-run mode, confirmation dialogs, and exclude patterns
- 📈 **Progress Tracking**: Real-time scanning progress with detailed feedback
- 🔄 **Batch Processing**: Handles large asset collections efficiently
- 📱 **Responsive UI**: Seamless integration with Sanity Studio

## Installation

```bash
npm install sanity-delete-unused-assets
```

## Quick Start

### Basic Usage

```tsx
import React from 'react'
import { DeleteUnusedAssets } from 'sanity-delete-unused-assets'
import { useClient } from 'sanity'

const AssetCleanup = () => {
  const client = useClient({ apiVersion: '2023-01-01' })

  return (
    <DeleteUnusedAssets
      client={client}
      onComplete={(results) => {
        console.log(`Cleaned up ${results.deleted} assets, saved ${results.spaceSaved} MB`)
      }}
    />
  )
}
```

### As a Sanity Studio Tool

```tsx
// sanity.config.ts
import { defineConfig } from 'sanity'
import { DeleteUnusedAssetsTool } from 'sanity-delete-unused-assets'

export default defineConfig({
  // ... other config
  tools: [
    DeleteUnusedAssetsTool()
  ]
})
```

### With Custom Filters

```tsx
<DeleteUnusedAssets
  client={client}
  fileTypes={['image/jpeg', 'image/png']}
  minFileSize={1024} // 1KB minimum
  maxFileSize={10485760} // 10MB maximum
  olderThanDays={30}
  excludePatterns={['hero-*', 'logo-*']}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `client` | `SanityClient` | **required** | Sanity client instance |
| `fileTypes` | `string[]` | `[]` | Specific MIME types to scan (empty = all types) |
| `minFileSize` | `number` | `0` | Minimum file size in bytes |
| `maxFileSize` | `number` | `Infinity` | Maximum file size in bytes |
| `olderThanDays` | `number` | `0` | Only scan assets older than X days |
| `excludePatterns` | `string[]` | `[]` | Filename patterns to exclude from deletion |
| `onComplete` | `function` | `undefined` | Callback when cleanup completes |
| `onError` | `function` | `undefined` | Error handling callback |
| `batchSize` | `number` | `10` | Number of assets to process per batch |
| `dryRun` | `boolean` | `false` | Preview mode without actual deletion |

## Usage Examples

### 1. Basic Asset Cleanup

```tsx
import { DeleteUnusedAssets } from 'sanity-delete-unused-assets'

const BasicCleanup = () => {
  const client = useClient({ apiVersion: '2023-01-01' })

  return (
    <DeleteUnusedAssets
      client={client}
      onComplete={(results) => {
        console.log(`Cleanup complete:`, {
          deleted: results.deleted,
          spaceSaved: `${results.spaceSaved} MB`,
          errors: results.errors.length
        })
      }}
    />
  )
}
```

### 2. Image-Only Cleanup with Size Limits

```tsx
<DeleteUnusedAssets
  client={client}
  fileTypes={['image/jpeg', 'image/png', 'image/webp']}
  minFileSize={1024} // Skip tiny files
  maxFileSize={5242880} // Skip files larger than 5MB
  onComplete={(results) => {
    console.log(`Cleaned ${results.deleted} images`)
  }}
/>
```

### 3. Safe Mode with Exclusions

```tsx
<DeleteUnusedAssets
  client={client}
  dryRun={true}
  excludePatterns={[
    'hero-*',
    'logo-*', 
    'favicon*',
    '*-backup'
  ]}
  onComplete={(results) => {
    console.log(`Would delete ${results.deleted} assets (${results.spaceSaved} MB)`)
  }}
/>
```

### 4. Old Asset Cleanup

```tsx
<DeleteUnusedAssets
  client={client}
  olderThanDays={90} // Only assets older than 3 months
  onComplete={(results) => {
    console.log(`Cleaned up old assets: ${results.deleted} files`)
  }}
/>
```

## Asset Detection

### How It Works

The utility performs a comprehensive scan to identify unused assets:

1. **Asset Inventory**: Scans all assets in your Sanity dataset
2. **Reference Analysis**: Checks all documents for asset references
3. **Usage Detection**: Identifies assets not referenced by any document
4. **Filter Application**: Applies your specified filters (type, size, age, etc.)
5. **Safe Deletion**: Removes only confirmed unused assets

### Supported Asset Types

- **Images**: JPEG, PNG, WebP, GIF, SVG
- **Videos**: MP4, WebM, MOV
- **Documents**: PDF, DOC, DOCX
- **Audio**: MP3, WAV, OGG
- **Archives**: ZIP, RAR
- **Custom**: Any MIME type

## Safety Features

### Dry Run Mode
```tsx
<DeleteUnusedAssets client={client} dryRun={true} />
```
- Preview what would be deleted without making changes
- Test filters and exclusion patterns safely
- Validate storage savings estimates

### Exclude Patterns
```tsx
excludePatterns={[
  'hero-*',      // Exclude hero images
  'logo-*',      // Exclude logos
  '*-backup',    // Exclude backup files
  'temp/*'       // Exclude temp folder
]}
```

### Confirmation Dialogs
- All delete operations require explicit confirmation
- Clear warnings for destructive actions
- Detailed summary before deletion

### Batch Processing
- Large cleanup operations are processed in batches
- Prevents timeout issues with large asset collections
- Progress feedback during long operations

## Storage Analysis

The component provides detailed storage metrics:

- **Total Assets**: Count of all assets in dataset
- **Unused Assets**: Count of assets not referenced
- **Storage Used**: Total storage consumed by unused assets
- **Potential Savings**: Storage that would be freed
- **File Size Distribution**: Breakdown by file size ranges
- **File Type Analysis**: Usage by MIME type

## Performance Tips

### Large Datasets
- Use `batchSize` to control processing speed
- Apply filters to reduce scan scope
- Run during off-peak hours for large cleanups

### Incremental Cleanup
```tsx
// Clean up assets older than 30 days
<DeleteUnusedAssets
  client={client}
  olderThanDays={30}
  batchSize={5}
/>
```

### Memory Optimization
```tsx
// Process smaller batches for memory efficiency
<DeleteUnusedAssets
  client={client}
  batchSize={3}
  maxFileSize={10485760} // 10MB limit
/>
```

## Requirements

- Sanity Studio v3+
- React 18+
- @sanity/ui v1+
- TypeScript 4.5+ (optional)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to help improve this utility.