/**
 * NHAI FaceSync Offline — Sync & Purge Engine
 * Monitors network state via NetInfo. Upon connection restoration,
 * batch-syncs offline verification records to AWS API Gateway endpoints.
 * Implements a "Certified Purge" mechanism that physically wipes data post-sync.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import DatabaseService, { type VerificationLog } from './DatabaseService';
import { MODEL_CONFIGS } from '../config/modelConfig';

class SyncPurgeService {
  private isSyncing = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initializes network monitoring. Automatically runs sync when connectivity is detected.
   */
  public startNetworkMonitoring(): void {
    if (this.unsubscribeNetInfo) return;

    console.log('📡 SyncPurgeService: Monitoring network status...');
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        console.log('📶 Internet connection restored. Initiating auto-sync background job...');
        this.triggerSyncJob().catch(err => {
          console.error('❌ Background sync job failed:', err);
        });
      }
    });
  }

  /**
   * Stops network monitoring.
   */
  public stopNetworkMonitoring(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }

  /**
   * Performs the multi-step Sync & Purge lifecycle.
   */
  public async triggerSyncJob(): Promise<{
    syncedCount: number;
    purged: boolean;
    success: boolean;
  }> {
    if (this.isSyncing) {
      return { syncedCount: 0, purged: false, success: false };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let purged = false;
    let success = false;

    try {
      // Step 1: Read unsynced logs from SQLite (up to batch limits)
      const unsyncedLogs = await DatabaseService.getUnsyncedLogs();
      console.log(`🔄 Found ${unsyncedLogs.length} logs pending sync.`);

      if (unsyncedLogs.length === 0) {
        this.isSyncing = false;
        return { syncedCount: 0, purged: false, success: true };
      }

      // Step 2: Upload batch to AWS API Gateway
      const successIds = await this.uploadBatchToAWS(unsyncedLogs);
      syncedCount = successIds.length;

      if (successIds.length > 0) {
        // Step 3: Update local database synced flags to 1
        const updated = await DatabaseService.markLogsAsSynced(successIds);
        console.log(`✅ SQLite updated for ${successIds.length} records. Status: ${updated}`);

        if (updated) {
          // Step 4: Certified Purge & Database Compaction
          purged = await DatabaseService.purgeSyncedLogs();
          console.log(`♻️ Purged synced rows. Database defragmented (VACUUM): ${purged}`);
        }
      }

      success = syncedCount === unsyncedLogs.length;
    } catch (error) {
      console.error('❌ Exception in Sync & Purge lifecycle:', error);
    } finally {
      this.isSyncing = false;
    }

    return { syncedCount, purged, success };
  }

  /**
   * Uploads offline verification records to AWS backend.
   * Uses exponential backoff / retry policies config-defined.
   */
  private async uploadBatchToAWS(logs: VerificationLog[]): Promise<string[]> {
    const endpoint = MODEL_CONFIGS.sync.apiEndpoint;
    const syncedIds: string[] = [];

    // Payload transformation matching NHAI Datalake v3 ingestion schema
    const payload = {
      syncTimestamp: Date.now(),
      records: logs.map(log => ({
        eventId: log.id,
        employeeId: log.personnelId,
        authTime: log.timestamp,
        location: {
          lat: log.latitude,
          lng: log.longitude,
        },
        metrics: {
          cosineSimilarity: log.faceScore,
          livenessProb: log.livenessScore,
          activeLivenessPassed: log.activeLivenessPassed ? 1 : 0,
        },
      })),
    };

    let retries = 0;
    const maxRetries = MODEL_CONFIGS.sync.maxRetries;

    while (retries < maxRetries) {
      try {
        console.log(`📤 Syncing payload to AWS. Attempt ${retries + 1}/${maxRetries}...`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-NHAI-Gateway-Key': 'Secure-PreShared-Gateway-Key-Token',
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 200 || response.status === 201) {
          const result = await response.json();
          // Assume server returns list of successfully written event IDs
          // Example output: { successIds: ["uuid1", "uuid2", ...] }
          if (result && Array.isArray(result.successIds)) {
            syncedIds.push(...result.successIds);
          } else {
            // Fallback: if server accepts overall request, count all as synced
            syncedIds.push(...logs.map(l => l.id));
          }
          console.log(`🚀 Successfully verified and stored ${syncedIds.length} records in Cloud Datalake.`);
          break; // Exit retry loop on success
        } else {
          console.warn(`⚠️ API responded with status: ${response.status}. Retrying...`);
        }
      } catch (error) {
        console.error(`⚠️ Network error during upload batch attempt ${retries + 1}:`, error);
      }

      retries++;
      if (retries < maxRetries) {
        // Await backoff delay
        await new Promise(resolve => setTimeout(resolve, MODEL_CONFIGS.sync.retryIntervalMs));
      }
    }

    return syncedIds;
  }
}

export default new SyncPurgeService();
