/**
 * Delete Unused Assets utility for Sanity Studio
 * Asset cleanup and storage optimization with comprehensive safety features
 */

import React, { useState, useCallback } from 'react'
import {
  Card,
  Stack,
  Text,
  Button,
  Box,
  Flex,
  Badge,
  Dialog,
  Grid,
  Select,
  Checkbox,
  Spinner,
  Progress,
  TextInput
} from '@sanity/ui'
import { TrashIcon, ImageIcon, DocumentIcon, WarningOutlineIcon, RefreshIcon } from '@sanity/icons'
import { SanityClient } from 'sanity'

// Types
interface AssetInfo {
  _id: string
  _type: 'sanity.imageAsset' | 'sanity.fileAsset'
  originalFilename?: string
  url: string
  size: number
  mimeType: string
  _createdAt: string
  _updatedAt: string
  extension?: string
}

interface DeleteUnusedAssetsProps {
  client: SanityClient
  assetTypes?: ('image' | 'file')[]
  olderThan?: Date
  excludePatterns?: string[]
  onComplete?: (results: { deleted: number; savedSpace: number; errors: string[] }) => void
  onError?: (error: string) => void
  batchSize?: number
  dryRun?: boolean
  maxAssets?: number
}

/**
 * Delete Unused Assets component for storage optimization
 */
export const DeleteUnusedAssets: React.FC<DeleteUnusedAssetsProps> = ({
  client,
  assetTypes = ['image', 'file'],
  olderThan,
  excludePatterns = [],
  onComplete,
  onError,
  batchSize = 10,
  dryRun = false,
  maxAssets = 500
}) => {
  // State
  const [unusedAssets, setUnusedAssets] = useState<AssetInfo[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'image' | 'file'>('all')
  const [filterSize, setFilterSize] = useState('')
  const [filterAge, setFilterAge] = useState('')
  const [totalAssets, setTotalAssets] = useState(0)
  const [totalSize, setTotalSize] = useState(0)

  /**
   * Format file size for display
   */
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  /**
   * Check if asset matches exclude patterns
   */
  const isExcluded = useCallback((asset: AssetInfo) => {
    if (excludePatterns.length === 0) return false
    
    const filename = asset.originalFilename || ''
    return excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i')
      return regex.test(filename) || regex.test(asset._id)
    })
  }, [excludePatterns])

  /**
   * Check if asset is older than specified date
   */
  const isOlderThan = useCallback((asset: AssetInfo) => {
    if (!olderThan) return true
    return new Date(asset._createdAt) < olderThan
  }, [olderThan])

  /**
   * Get filtered assets based on current filters
   */
  const getFilteredAssets = useCallback(() => {
    let filtered = unusedAssets

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(asset => 
        filterType === 'image' 
          ? asset._type === 'sanity.imageAsset'
          : asset._type === 'sanity.fileAsset'
      )
    }

    // Size filter
    if (filterSize) {
      const sizeBytes = parseFloat(filterSize) * 1024 * 1024 // Convert MB to bytes
      filtered = filtered.filter(asset => (asset.size || 0) > sizeBytes)
    }

    // Age filter
    if (filterAge) {
      const daysAgo = parseInt(filterAge)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
      filtered = filtered.filter(asset => new Date(asset._createdAt) < cutoffDate)
    }

    return filtered
  }, [unusedAssets, filterType, filterSize, filterAge])

  /**
   * Scan for unused assets
   */
  const scanForUnusedAssets = useCallback(async () => {
    setIsScanning(true)
    setMessage('Scanning for unused assets...')
    setScanProgress(0)
    
    try {
      // Build asset type filter - FIXED SYNTAX ERROR
      const typeFilter = assetTypes.includes('image') && assetTypes.includes('file')
        ? `_type in ["sanity.imageAsset", "sanity.fileAsset"]`
        : assetTypes.includes('image')
        ? `_type == "sanity.imageAsset"`
        : `_type == "sanity.fileAsset"`

      // Get all assets
      setMessage('Fetching all assets...')
      const allAssetsQuery = `*[${typeFilter}][0...${maxAssets}] {
        _id,
        _type,
        originalFilename,
        url,
        size,
        mimeType,
        _createdAt,
        _updatedAt,
        extension
      }`
      
      const allAssets: AssetInfo[] = await client.fetch(allAssetsQuery)
      setTotalAssets(allAssets.length)
      setScanProgress(25)

      // Get all document references to assets
      setMessage('Checking asset references...')
      const referencedAssetsQuery = `*[references(*[${typeFilter}]._id)] {
        "referencedAssets": *[${typeFilter} && _id in ^.*.asset._ref]._id
      }`
      
      const referencedResults = await client.fetch(referencedAssetsQuery)
      const referencedAssetIds = new Set(
        referencedResults.flatMap((doc: any) => doc.referencedAssets || [])
      )
      setScanProgress(50)

      // Also check for assets referenced in rich text, arrays, etc.
      setMessage('Checking complex references...')
      const complexRefsQuery = `*[defined(body) || defined(content) || defined(blocks)] {
        "complexRefs": body[].*.asset._ref,
        "contentRefs": content[].*.asset._ref,
        "blockRefs": blocks[].*.asset._ref
      }`
      
      const complexRefs = await client.fetch(complexRefsQuery)
      complexRefs.forEach((doc: any) => {
        [...(doc.complexRefs || []), ...(doc.contentRefs || []), ...(doc.blockRefs || [])]
          .filter(Boolean)
          .forEach((id: string) => referencedAssetIds.add(id))
      })
      setScanProgress(75)

      // Filter unused assets
      setMessage('Identifying unused assets...')
      const unused = allAssets.filter(asset => {
        // Check if referenced
        if (referencedAssetIds.has(asset._id)) return false
        
        // Check exclude patterns
        if (isExcluded(asset)) return false
        
        // Check age filter
        if (!isOlderThan(asset)) return false
        
        return true
      })

      setUnusedAssets(unused)
      setSelectedAssets(new Set())
      setTotalSize(unused.reduce((sum, asset) => sum + (asset.size || 0), 0))
      setScanProgress(100)
      
      setMessage(`Found ${unused.length} unused assets (${formatFileSize(unused.reduce((sum, asset) => sum + (asset.size || 0), 0))})`)
      
    } catch (error) {
      console.error('Scan error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Scan failed'
      setMessage(`Scan error: ${errorMessage}`)
      onError?.(errorMessage)
    } finally {
      setIsScanning(false)
      setScanProgress(0)
    }
  }, [client, assetTypes, maxAssets, isExcluded, isOlderThan, formatFileSize, onError])

  /**
   * Toggle asset selection
   */
  const toggleAssetSelection = useCallback((id: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedAssets(newSelected)
  }, [selectedAssets])

  /**
   * Select all filtered assets
   */
  const selectAll = useCallback(() => {
    const filtered = getFilteredAssets()
    const allIds = new Set(filtered.map(asset => asset._id))
    setSelectedAssets(allIds)
  }, [getFilteredAssets])

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedAssets(new Set())
  }, [])

  /**
   * Execute deletion
   */
  const handleDelete = useCallback(async () => {
    if (selectedAssets.size === 0) return

    setIsDeleting(true)
    setMessage('')
    
    const assetsToDelete = Array.from(selectedAssets)
    const errors: string[] = []
    let deletedCount = 0
    let savedSpace = 0

    try {
      // Process in batches
      for (let i = 0; i < assetsToDelete.length; i += batchSize) {
        const batch = assetsToDelete.slice(i, i + batchSize)
        
        if (dryRun) {
          console.log('DRY RUN: Would delete assets:', batch)
          const batchAssets = unusedAssets.filter(asset => batch.includes(asset._id))
          deletedCount += batch.length
          savedSpace += batchAssets.reduce((sum, asset) => sum + (asset.size || 0), 0)
        } else {
          // Delete batch
          const transaction = client.transaction()
          batch.forEach(id => transaction.delete(id))
          
          try {
            await transaction.commit()
            const batchAssets = unusedAssets.filter(asset => batch.includes(asset._id))
            deletedCount += batch.length
            savedSpace += batchAssets.reduce((sum, asset) => sum + (asset.size || 0), 0)
            setMessage(`Deleted ${deletedCount}/${assetsToDelete.length} assets...`)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            errors.push(`Batch ${i / batchSize + 1}: ${errorMsg}`)
          }
        }
      }

      // Update results
      const remainingAssets = unusedAssets.filter(asset => !selectedAssets.has(asset._id))
      setUnusedAssets(remainingAssets)
      setSelectedAssets(new Set())
      
      const finalMessage = dryRun 
        ? `DRY RUN: Would delete ${deletedCount} assets (${formatFileSize(savedSpace)} saved)`
        : `Successfully deleted ${deletedCount} assets (${formatFileSize(savedSpace)} saved)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
      
      setMessage(finalMessage)
      onComplete?.({ deleted: deletedCount, savedSpace, errors })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete operation failed'
      setMessage(`Delete error: ${errorMessage}`)
      onError?.(errorMessage)
    } finally {
      setIsDeleting(false)
      setShowConfirmDialog(false)
    }
  }, [selectedAssets, unusedAssets, batchSize, dryRun, client, formatFileSize, onComplete, onError])

  /**
   * Get display name for asset
   */
  const getAssetDisplayName = useCallback((asset: AssetInfo) => {
    return asset.originalFilename || asset._id
  }, [])

  const filteredAssets = getFilteredAssets()
  const selectedSize = unusedAssets
    .filter(asset => selectedAssets.has(asset._id))
    .reduce((sum, asset) => sum + (asset.size || 0), 0)

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        {/* Header */}
        <Flex align="center" gap={3}>
          <TrashIcon />
          <Text size={2} weight="semibold">
            Delete Unused Assets {dryRun && '(DRY RUN)'}
          </Text>
        </Flex>

        {/* Scan Controls */}
        <Stack space={3}>
          <Button
            text="Scan for Unused Assets"
            icon={RefreshIcon}
            onClick={scanForUnusedAssets}
            loading={isScanning}
            tone="primary"
          />
          
          {isScanning && scanProgress > 0 && (
            <Box>
              <Progress value={scanProgress} />
              <Text size={1} muted style={{ marginTop: '8px' }}>
                {message}
              </Text>
            </Box>
          )}
        </Stack>

        {/* Status Message */}
        {message && !isScanning && (
          <Card padding={3} tone={message.includes('error') ? 'critical' : 'positive'}>
            <Text size={1}>{message}</Text>
          </Card>
        )}

        {/* Filters and Results */}
        {unusedAssets.length > 0 && (
          <Stack space={3}>
            {/* Filters */}
            <Grid columns={[1, 3]} gap={3}>
              <Stack space={2}>
                <Text size={1} weight="medium">Asset Type</Text>
                <Select
                  value={filterType}
                  onChange={(event) => setFilterType(event.currentTarget.value as any)}
                >
                  <option value="all">All Types</option>
                  <option value="image">Images Only</option>
                  <option value="file">Files Only</option>
                </Select>
              </Stack>
              
              <Stack space={2}>
                <Text size={1} weight="medium">Min Size (MB)</Text>
                <TextInput
                  placeholder="e.g. 1.5"
                  value={filterSize}
                  onChange={(event) => setFilterSize(event.currentTarget.value)}
                />
              </Stack>
              
              <Stack space={2}>
                <Text size={1} weight="medium">Older than (days)</Text>
                <TextInput
                  placeholder="e.g. 30"
                  value={filterAge}
                  onChange={(event) => setFilterAge(event.currentTarget.value)}
                />
              </Stack>
            </Grid>

            {/* Selection Controls */}
            <Flex justify="space-between" align="center">
              <Text size={1} weight="medium">
                {filteredAssets.length} assets • {selectedAssets.size} selected • {formatFileSize(selectedSize)} to save
              </Text>
              <Flex gap={2}>
                <Button text="Select All" onClick={selectAll} mode="ghost" />
                <Button text="Clear" onClick={clearSelection} mode="ghost" />
                <Button
                  text={dryRun ? 'Preview Delete' : 'Delete Selected'}
                  icon={TrashIcon}
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={selectedAssets.size === 0}
                  tone="critical"
                />
              </Flex>
            </Flex>

            {/* Assets List */}
            <Stack space={2}>
              {filteredAssets.map((asset) => (
                <Card key={asset._id} padding={3} border>
                  <Flex align="center" gap={3}>
                    <Checkbox
                      checked={selectedAssets.has(asset._id)}
                      onChange={() => toggleAssetSelection(asset._id)}
                    />
                    {asset._type === 'sanity.imageAsset' ? <ImageIcon /> : <DocumentIcon />}
                    <Box flex={1}>
                      <Flex align="center" gap={2}>
                        <Text weight="medium">{getAssetDisplayName(asset)}</Text>
                        <Badge tone={asset._type === 'sanity.imageAsset' ? 'primary' : 'default'}>
                          {asset._type === 'sanity.imageAsset' ? 'Image' : 'File'}
                        </Badge>
                        <Badge tone="caution">{formatFileSize(asset.size || 0)}</Badge>
                      </Flex>
                      <Text size={1} muted>
                        {asset.mimeType} • Created: {new Date(asset._createdAt).toLocaleDateString()}
                      </Text>
                    </Box>
                  </Flex>
                </Card>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <Dialog
            header="Confirm Asset Deletion"
            id="delete-assets-confirm"
            onClose={() => setShowConfirmDialog(false)}
            footer={
              <Box padding={3}>
                <Grid columns={2} gap={3}>
                  <Button
                    text="Cancel"
                    onClick={() => setShowConfirmDialog(false)}
                    mode="ghost"
                  />
                  <Button
                    text={dryRun ? 'Preview' : 'Delete Assets'}
                    onClick={handleDelete}
                    tone="critical"
                    loading={isDeleting}
                  />
                </Grid>
              </Box>
            }
          >
            <Box padding={4}>
              <Stack space={3}>
                <Flex align="center" gap={2}>
                  <WarningOutlineIcon style={{ color: 'red' }} />
                  <Text weight="semibold">
                    {dryRun ? 'Preview Asset Deletion' : 'Confirm Asset Deletion'}
                  </Text>
                </Flex>
                <Text>
                  {dryRun 
                    ? `This will preview the deletion of ${selectedAssets.size} unused assets (${formatFileSize(selectedSize)} storage).`
                    : `This will permanently delete ${selectedAssets.size} unused assets and free up ${formatFileSize(selectedSize)} of storage. This action cannot be undone.`
                  }
                </Text>
                {!dryRun && (
                  <Text size={1} style={{ color: 'red' }}>
                    ⚠️ Deleted assets cannot be recovered. Make sure you have backups if needed.
                  </Text>
                )}
              </Stack>
            </Box>
          </Dialog>
        )}
      </Stack>
    </Card>
  )
}

export default DeleteUnusedAssets