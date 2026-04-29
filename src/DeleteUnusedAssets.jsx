// Component for finding and removing unused asset documents from Sanity
import { Stack, Card, Grid, Heading, Text, Button, Select, Badge, Flex, Box } from '@sanity/ui'
import { TrashIcon, LockIcon, UnlockIcon, RefreshIcon } from '@sanity/icons'
import { useState, useEffect } from 'react'
import DangerModeWarning, { shouldShowDangerWarning } from './DangerModeWarning'

/**
 * Delete Unused Assets Component
 * Finds and removes unused asset documents (images/files) from the Sanity dataset
 * @param {Object} props - Component props
 * @param {SanityClient} props.client - Sanity client instance
 */
const DeleteUnusedAssets = (props) => {
	const {client, icon: Icon, displayName, dangerMode, utilityId, onDangerModeChange} = props;
	const [unusedAssets, setUnusedAssets] = useState([]);
	const [unusedAssetsMessage, setUnusedAssetsMessage] = useState('');
	const [showWarningModal, setShowWarningModal] = useState(false);
	const [assetTypeFilter, setAssetTypeFilter] = useState('all');
	const [viewMode, setViewMode] = useState('unused'); // 'unused', 'storage', 'duplicates'
	const [allAssets, setAllAssets] = useState([]);
	const [storageStats, setStorageStats] = useState(null);
	const [duplicateGroups, setDuplicateGroups] = useState([]);

	/**
	 * Handle danger mode toggle with warning modal
	 */
	const handleDangerModeToggle = () => {
		if (!dangerMode && shouldShowDangerWarning()) {
			// Trying to enable danger mode, show warning
			setShowWarningModal(true);
		} else {
			// Either disabling danger mode or warning is suppressed
			onDangerModeChange(utilityId, !dangerMode);
		}
	};

	const handleWarningConfirm = () => {
		setShowWarningModal(false);
		onDangerModeChange(utilityId, true);
	};

	const handleWarningCancel = () => {
		setShowWarningModal(false);
	};

	async function searchForUnusedAssets() {
		const items = await client.fetch(`
			*[ _type in ["sanity.imageAsset", "sanity.fileAsset"] ]
			{_id, _type, url, originalFilename, size, "refs": count(*[ references(^._id) ])}
			[ refs == 0 ]
		`)
		setUnusedAssets(items)
		if (!items.length) {
			setUnusedAssetsMessage('No assets to delete.')
			return true
		} else {
			setUnusedAssetsMessage('')
		}
	}

	async function fetchAllAssets() {
		const items = await client.fetch(`
			*[ _type in ["sanity.imageAsset", "sanity.fileAsset"] ]
			{_id, _type, url, originalFilename, size, "refs": count(*[ references(^._id) ])}
			| order(size desc)
		`)
		setAllAssets(items)

		// Calculate storage stats
		const totalSize = items.reduce((sum, asset) => sum + (asset.size || 0), 0)
		const imageSize = items.filter(a => a._type === 'sanity.imageAsset').reduce((sum, asset) => sum + (asset.size || 0), 0)
		const fileSize = items.filter(a => a._type === 'sanity.fileAsset').reduce((sum, asset) => sum + (asset.size || 0), 0)

		setStorageStats({
			totalSize,
			imageSize,
			fileSize,
			totalCount: items.length,
			imageCount: items.filter(a => a._type === 'sanity.imageAsset').length,
			fileCount: items.filter(a => a._type === 'sanity.fileAsset').length
		})
	}

	async function findDuplicates() {
		const items = await client.fetch(`
			*[ _type in ["sanity.imageAsset", "sanity.fileAsset"] ]
			{_id, _type, url, originalFilename, size, "refs": count(*[ references(^._id) ])}
		`)

		// Group by filename
		const groups = {}
		items.forEach(asset => {
			const filename = asset.originalFilename
			if (!groups[filename]) {
				groups[filename] = []
			}
			groups[filename].push(asset)
		})

		// Filter to only duplicates (2+ assets with same filename)
		const duplicates = Object.entries(groups)
			.filter(([filename, assets]) => assets.length > 1)
			.map(([filename, assets]) => ({
				filename,
				assets,
				count: assets.length,
				totalSize: assets.reduce((sum, a) => sum + (a.size || 0), 0)
			}))
			.sort((a, b) => b.count - a.count)

		setDuplicateGroups(duplicates)
	}

	useEffect(() => {
		if (viewMode === 'unused') {
			searchForUnusedAssets()
		} else if (viewMode === 'storage') {
			fetchAllAssets()
		} else if (viewMode === 'duplicates') {
			findDuplicates()
		}
	}, [viewMode])

	function deleteUnusedAssets(){
		client
			.fetch(`
				*[ _type in ["sanity.imageAsset", "sanity.fileAsset"] ]
				{_id, "refs": count(*[ references(^._id) ])}
				[ refs == 0 ]
				._id
			`)
			.then(items => {
				if (!items.length) {
					console.log('No assets to delete.')
					return true
				}

				console.log(`Deleting ${items.length} assets.`)
				return items
					.reduce((trx, id) => trx.delete(id), client.transaction())
					.commit()
					.then(() => {
						setUnusedAssetsMessage("Deleted!");
						searchForUnusedAssets();
						setTimeout(()=>{
							setUnusedAssetsMessage("");
						}, 2000)
					})
			})
			.catch(err => {
				if (err.message.includes('Insufficient permissions.')) {
					console.error(err.message)
					console.error('Did you forget to pass `--with-user-token`?')
				} else {
					console.error(err.stack)
				}
			})
	}

	// Filter assets based on selected type
	const filteredAssets = unusedAssets.filter(asset => {
		if (assetTypeFilter === 'all') return true;
		if (assetTypeFilter === 'images') return asset._type === 'sanity.imageAsset';
		if (assetTypeFilter === 'files') return asset._type === 'sanity.fileAsset';
		return true;
	});

	return (
		<>
			<DangerModeWarning
				isOpen={showWarningModal}
				onConfirm={handleWarningConfirm}
				onCancel={handleWarningCancel}
				utilityName="Delete Unused Assets"
			/>

			<Stack style={{paddingTop: "4em", paddingBottom: "2em", position: "relative"}}>
				<Heading as="h3" size={3}>{Icon && <Icon style={{display: 'inline-block', marginRight: '0.35em', opacity: 0.5, transform: 'translateY(2px)'}} />}{displayName}</Heading>
				<Text muted size={1} style={{paddingTop: "2em", maxWidth: "calc(100% - 150px)"}}>
					{viewMode === 'unused' && 'Scan for images and files that are no longer referenced by any documents, then remove them to free up storage space.'}
					{viewMode === 'storage' && 'View all assets sorted by file size. Identify large files consuming storage space and see total usage statistics.'}
					{viewMode === 'duplicates' && 'Find assets with identical filenames. Useful for identifying accidentally uploaded duplicates or assets that may need consolidation.'}
				</Text>
				<div style={{position: "absolute", bottom: "1.5em", right: "0"}}>
					<Button
						mode="bleed"
						tone="primary"
						icon={RefreshIcon}
						onClick={() => {
							if (viewMode === 'unused') searchForUnusedAssets()
							else if (viewMode === 'storage') fetchAllAssets()
							else if (viewMode === 'duplicates') findDuplicates()
						}}
						style={{cursor: "pointer", marginLeft: ".5em"}}
					/>
					<Button
						mode={dangerMode?"ghost":"bleed"}
						tone="critical"
						icon={dangerMode?UnlockIcon:LockIcon}
						onClick={handleDangerModeToggle}
						style={{cursor: "pointer", marginLeft: ".5em"}}
					/>
				</div>
			</Stack>

			{/* View Mode Selection */}
			<Stack style={{marginBottom: "10px"}}>
				<Select
					value={viewMode}
					onChange={(e) => setViewMode(e.currentTarget.value)}
					style={{borderRadius: "3px"}}
				>
					<option value="unused">Unused Assets (Delete Mode)</option>
					<option value="storage">Storage Report (Size Analysis)</option>
					<option value="duplicates">Duplicate Detection (Same Filename)</option>
				</Select>
			</Stack>

			{viewMode === 'unused' && unusedAssets.length && dangerMode ? (
				<Stack>
					<Button icon={TrashIcon} text="Delete Items" tone="critical" onClick={() => { deleteUnusedAssets() }}/>
				</Stack>
			): ''}

			{unusedAssetsMessage!="" && (
				<Stack>
					<p style={{padding: ".5em 0em 1em", opacity: "0.75"}} dangerouslySetInnerHTML={{__html: unusedAssetsMessage}}></p>
				</Stack>
			)}

			{/* Storage Report View */}
			{viewMode === 'storage' && storageStats && (
				<>
					<Card padding={4} tone="transparent" border={1} style={{marginBottom: "1em"}}>
						<Heading as="h5" size={1} style={{marginBottom: "1em"}}>Storage Overview</Heading>
						<Grid columns={[3]} gap={3}>
							<Box>
								<Text size={0} muted>Total Storage</Text>
								<Text size={3} weight="bold">{formatBytes(storageStats.totalSize)}</Text>
								<Text size={0} muted>{storageStats.totalCount} assets</Text>
							</Box>
							<Box>
								<Text size={0} muted>Images</Text>
								<Text size={2} weight="semibold">{formatBytes(storageStats.imageSize)}</Text>
								<Text size={0} muted>{storageStats.imageCount} files</Text>
							</Box>
							<Box>
								<Text size={0} muted>Files</Text>
								<Text size={2} weight="semibold">{formatBytes(storageStats.fileSize)}</Text>
								<Text size={0} muted>{storageStats.fileCount} files</Text>
							</Box>
						</Grid>
					</Card>

					{allAssets.length > 0 && (
						<>
							<Stack style={{marginBottom: "10px"}}>
								<Select
									value={assetTypeFilter}
									onChange={(e) => setAssetTypeFilter(e.currentTarget.value)}
									style={{borderRadius: "3px"}}
								>
									<option value="all">All Assets ({allAssets.length})</option>
									<option value="images">Images Only ({allAssets.filter(a => a._type === 'sanity.imageAsset').length})</option>
									<option value="files">Files Only ({allAssets.filter(a => a._type === 'sanity.fileAsset').length})</option>
								</Select>
							</Stack>

							<div
								style={{
									maxHeight: "400px",
									marginTop: "5px",
									border: "1px solid rgba(255,255,255,0.1)",
									overflow: "auto",
									paddingBottom: "1rem",
									borderRadius: "3px",
								}}
							>
								{allAssets.filter(asset => {
									if (assetTypeFilter === 'all') return true;
									if (assetTypeFilter === 'images') return asset._type === 'sanity.imageAsset';
									if (assetTypeFilter === 'files') return asset._type === 'sanity.fileAsset';
									return true;
								}).map((item, index, arr) => (
									<a target="_blank" key={`item-${index}`} className="link" href={`${item.url}`}>
										<div style={{
											display: "flex",
											alignItems: "center",
											gap: "1em",
											padding: "1em",
											borderBottom: index < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
										}}>
											{item._type === 'sanity.imageAsset' && (
												<img
													src={item.url}
													alt={item.originalFilename}
													style={{
														width: "60px",
														height: "60px",
														objectFit: "cover",
														borderRadius: "4px",
														border: "1px solid rgba(255,255,255,0.1)"
													}}
												/>
											)}
											<Stack space={1} style={{flex: 1}}>
												<Text size={1}>{item.originalFilename}</Text>
												<Flex gap={2}>
													<Badge tone="primary">{formatBytes(item.size || 0)}</Badge>
													<Badge tone={item.refs > 0 ? 'positive' : 'caution'}>
														{item.refs} reference{item.refs !== 1 ? 's' : ''}
													</Badge>
												</Flex>
											</Stack>
										</div>
									</a>
								))}
							</div>
						</>
					)}
				</>
			)}

			{/* Duplicates View */}
			{viewMode === 'duplicates' && (
				<>
					{duplicateGroups.length > 0 ? (
						<>
							<Card padding={3} tone="caution" border={1} style={{marginBottom: "1em"}}>
								<Text size={1}>
									Found <strong>{duplicateGroups.length}</strong> filename{duplicateGroups.length !== 1 ? 's' : ''} with duplicates
									({duplicateGroups.reduce((sum, g) => sum + g.count, 0)} total assets)
								</Text>
							</Card>

							<div
								style={{
									maxHeight: "500px",
									marginTop: "5px",
									border: "1px solid rgba(255,255,255,0.1)",
									overflow: "auto",
									paddingBottom: "1rem",
									borderRadius: "3px",
								}}
							>
								{duplicateGroups.map((group, groupIndex) => (
									<div key={`group-${groupIndex}`} style={{
										padding: "1em",
										borderBottom: groupIndex < duplicateGroups.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none"
									}}>
										<Flex align="center" gap={2} style={{marginBottom: "0.5em"}}>
											<Text size={1} weight="bold">{group.filename}</Text>
											<Badge tone="caution">{group.count} copies</Badge>
											<Badge tone="default">{formatBytes(group.totalSize)}</Badge>
										</Flex>
										<Stack space={2} style={{paddingLeft: "1em"}}>
											{group.assets.map((asset, assetIndex) => (
												<a target="_blank" key={`asset-${assetIndex}`} className="link" href={`${asset.url}`}>
													<Flex align="center" gap={2}>
														{asset._type === 'sanity.imageAsset' && (
															<img
																src={asset.url}
																alt={asset.originalFilename}
																style={{
																	width: "40px",
																	height: "40px",
																	objectFit: "cover",
																	borderRadius: "4px",
																	border: "1px solid rgba(255,255,255,0.1)"
																}}
															/>
														)}
														<Stack space={1}>
															<Text size={0} muted>{formatBytes(asset.size || 0)}</Text>
															<Text size={0} muted>{asset.refs} ref{asset.refs !== 1 ? 's' : ''}</Text>
														</Stack>
													</Flex>
												</a>
											))}
										</Stack>
									</div>
								))}
							</div>
						</>
					) : (
						<Card padding={4} tone="positive" border={1}>
							<Text align="center">No duplicate filenames found! All assets have unique names.</Text>
						</Card>
					)}
				</>
			)}

			{/* Unused Assets View */}
			{viewMode === 'unused' && unusedAssets.length > 0 && (
				<>
					<Stack style={{marginBottom: "10px"}}>
						<Select
							value={assetTypeFilter}
							onChange={(e) => setAssetTypeFilter(e.currentTarget.value)}
							style={{borderRadius: "3px"}}
						>
							<option value="all">All Assets ({unusedAssets.length})</option>
							<option value="images">Images Only ({unusedAssets.filter(a => a._type === 'sanity.imageAsset').length})</option>
							<option value="files">Files Only ({unusedAssets.filter(a => a._type === 'sanity.fileAsset').length})</option>
						</Select>
					</Stack>

					<div
						style={{
							maxHeight: "400px",
							marginTop: "5px",
							border: "1px solid rgba(255,255,255,0.1)",
							overflow: "auto",
							paddingBottom: "1rem",
							borderRadius: "3px",
						}}
					>
						{filteredAssets.map((item, index) => (
							<a target="_blank" key={`item-${index}`} className="link" href={`${item.url}`}>
								<div style={{
									display: "flex",
									alignItems: "center",
									gap: "1em",
									padding: "1em",
									borderBottom: index < filteredAssets.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none"
								}}>
									{item._type === 'sanity.imageAsset' && (
										<img
											src={item.url}
											alt={item.originalFilename}
											style={{
												width: "60px",
												height: "60px",
												objectFit: "cover",
												borderRadius: "4px",
												border: "1px solid rgba(255,255,255,0.1)"
											}}
										/>
									)}
									<Stack space={1} style={{flex: 1}}>
										<Text size={1}>
											{item.originalFilename}
										</Text>
										<Flex gap={2}>
											<Text muted size={0}>
												{item._type === 'sanity.imageAsset' ? 'Image' : 'File'}
											</Text>
											{item.size && (
												<Text muted size={0}>
													{formatBytes(item.size)}
												</Text>
											)}
										</Flex>
									</Stack>
								</div>
							</a>
						))}
					</div>
					<div style={{pointerEvents: "none", textAlign: "right", top: "-30px", paddingRight: "10px", position: "relative", height: "30px"}}>
						{filteredAssets.length} items {assetTypeFilter !== 'all' ? `(filtered from ${unusedAssets.length} total)` : ''}
					</div>
				</>
			)}
		</>
	)
}

/** Format bytes to human-readable string */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default DeleteUnusedAssets
