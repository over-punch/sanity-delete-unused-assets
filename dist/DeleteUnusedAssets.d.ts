/**
 * Delete Unused Assets utility for Sanity Studio
 * Asset cleanup and storage optimization with comprehensive safety features
 */
import React from 'react';
import { SanityClient } from 'sanity';
interface DeleteUnusedAssetsProps {
    client: SanityClient;
    assetTypes?: ('image' | 'file')[];
    olderThan?: Date;
    excludePatterns?: string[];
    onComplete?: (results: {
        deleted: number;
        savedSpace: number;
        errors: string[];
    }) => void;
    onError?: (error: string) => void;
    batchSize?: number;
    dryRun?: boolean;
    maxAssets?: number;
}
/**
 * Delete Unused Assets component for storage optimization
 */
export declare const DeleteUnusedAssets: React.FC<DeleteUnusedAssetsProps>;
export default DeleteUnusedAssets;
