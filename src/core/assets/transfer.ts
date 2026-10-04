import type { StillpointConfig } from '@/core/config/schema';
import type { ExportAssets } from '@/core/config/transfer';
import { StorageKeys, type StorageAdapter } from '@/core/storage/adapter';
import { writeImagePreview } from '@/core/storage/paint-cache';
import { assetIdsIn, loadImageAsset } from './image';

/**
 * The storage half of exporting and importing photographs. `config/transfer.ts`
 * stays pure — it turns text into a config and back — and this does the reading and
 * writing either side of it.
 */

/** Every photograph the config refers to, read for an export. Missing ones are skipped. */
export async function collectAssets(
  adapter: StorageAdapter,
  config: StillpointConfig,
): Promise<ExportAssets> {
  const assets: ExportAssets = {};
  for (const id of assetIdsIn(config)) {
    const asset = await loadImageAsset(adapter, id);
    if (asset) assets[id] = asset;
  }
  return assets;
}

/**
 * Write imported photographs and their previews, before the config that names them —
 * the same order as an upload, for the same reason.
 */
export async function storeAssets(
  adapter: StorageAdapter,
  assets: ExportAssets,
): Promise<void> {
  for (const [id, asset] of Object.entries(assets)) {
    await adapter.set(StorageKeys.asset(id), asset);
    writeImagePreview(id, asset.preview);
  }
}
