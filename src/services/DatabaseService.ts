/**
 * NHAI FaceSync Offline — Secure Local SQLite Service
 * Uses quick-sqlite with SQLCipher AES-256 local database encryption.
 * Implements strict data isolation and certified purge mechanisms.
 */

import { QuickSQLite } from 'react-native-quick-sqlite';
import { MODEL_CONFIGS } from '../config/modelConfig';

export interface PersonnelRecord {
  personnelId: string;
  name: string;
  designation: string;
  department: string;
  faceEmbedding: number[]; // 128-dimensional float array
  enrolledAt: number;
}

export interface VerificationLog {
  id: string; // UUID v4
  personnelId: string;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  faceScore: number;
  livenessScore: number;
  activeLivenessPassed: boolean;
  synced: boolean;
}

class DatabaseService {
  private dbName = MODEL_CONFIGS.database.dbName;
  private isInitialized = false;

  /**
   * Initializes the encrypted SQLite Database.
   * In production, the encryption key is retrieved from Android Keystore / iOS Keychain.
   */
  public async initializeDatabase(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Fetch key from secure storage (mocked fallback here for clean loading)
      const encryptionKey = await this.getOrCreateDatabaseKey();

      // Open database with key (SQLCipher integration in react-native-quick-sqlite)
      QuickSQLite.open(this.dbName);

      // Apply key encryption
      QuickSQLite.execute(this.dbName, `PRAGMA key = '${encryptionKey}';`);
      QuickSQLite.execute(this.dbName, `PRAGMA cipher_compatibility = 4;`);

      // Initialize Tables
      await this.createTables();

      this.isInitialized = true;
      console.log('🔒 Encrypted Database Initialized Successfully with AES-256.');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize encrypted database:', error);
      return false;
    }
  }

  /**
   * Creates essential schemas for personnel records and local logs.
   */
  private async createTables(): Promise<void> {
    // 1. Personnel Table (holds identities and reference facial templates)
    QuickSQLite.execute(
      this.dbName,
      `CREATE TABLE IF NOT EXISTS personnel (
        personnel_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        designation TEXT NOT NULL,
        department TEXT NOT NULL,
        face_embedding TEXT NOT NULL, -- Stored as stringified JSON array
        enrolled_at INTEGER NOT NULL
      );`
    );

    // 2. Attendance/Verification Log Table (holds offline logs pending sync)
    QuickSQLite.execute(
      this.dbName,
      `CREATE TABLE IF NOT EXISTS verification_log (
        id TEXT PRIMARY KEY,
        personnel_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        latitude REAL,
        longitude REAL,
        face_score REAL NOT NULL,
        liveness_score REAL NOT NULL,
        active_liveness INTEGER NOT NULL, -- 0 = Failed, 1 = Passed
        synced INTEGER DEFAULT 0,         -- 0 = Unsynced, 1 = Synced
        FOREIGN KEY(personnel_id) REFERENCES personnel(personnel_id)
      );`
    );

    // Create indexes for fast lookup and sync execution
    QuickSQLite.execute(
      this.dbName,
      `CREATE INDEX IF NOT EXISTS idx_unsynced_logs ON verification_log(synced);`
    );
  }

  /**
   * Enrolls a new personnel member (Offline caching or supervisor initial registration).
   */
  public async enrollPersonnel(record: PersonnelRecord): Promise<boolean> {
    await this.ensureInitialized();
    try {
      const embeddingStr = JSON.stringify(record.faceEmbedding);
      const query = `
        INSERT OR REPLACE INTO personnel (personnel_id, name, designation, department, face_embedding, enrolled_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `;
      const params = [
        record.personnelId,
        record.name,
        record.designation,
        record.department,
        embeddingStr,
        record.enrolledAt,
      ];

      const result = QuickSQLite.execute(this.dbName, query, params);
      return result.rowsAffected > 0;
    } catch (error) {
      console.error(`❌ Enrollment failed for ID ${record.personnelId}:`, error);
      return false;
    }
  }

  /**
   * Fetches all enrolled personnel templates for offline matching.
   */
  public async getAllPersonnel(): Promise<PersonnelRecord[]> {
    await this.ensureInitialized();
    try {
      const result = QuickSQLite.execute(this.dbName, 'SELECT * FROM personnel;');
      const records: PersonnelRecord[] = [];

      if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          const item = result.rows.item(i);
          records.push({
            personnelId: item.personnel_id,
            name: item.name,
            designation: item.designation,
            department: item.department,
            faceEmbedding: JSON.parse(item.face_embedding),
            enrolledAt: item.enrolled_at,
          });
        }
      }
      return records;
    } catch (error) {
      console.error('❌ Failed to fetch personnel database:', error);
      return [];
    }
  }

  /**
   * Saves an authentication attempt to local logs.
   */
  public async logVerification(log: Omit<VerificationLog, 'synced'>): Promise<boolean> {
    await this.ensureInitialized();
    try {
      const query = `
        INSERT INTO verification_log (id, personnel_id, timestamp, latitude, longitude, face_score, liveness_score, active_liveness, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);
      `;
      const params = [
        log.id,
        log.personnelId,
        log.timestamp,
        log.latitude,
        log.longitude,
        log.faceScore,
        log.livenessScore,
        log.activeLivenessPassed ? 1 : 0,
      ];

      const result = QuickSQLite.execute(this.dbName, query, params);
      return result.rowsAffected > 0;
    } catch (error) {
      console.error('❌ Failed to log local verification event:', error);
      return false;
    }
  }

  /**
   * Retrieves all unsynced verification records for cloud sync.
   */
  public async getUnsyncedLogs(): Promise<VerificationLog[]> {
    await this.ensureInitialized();
    try {
      const query = 'SELECT * FROM verification_log WHERE synced = 0 LIMIT ?;';
      const result = QuickSQLite.execute(this.dbName, query, [MODEL_CONFIGS.sync.batchSize]);
      const logs: VerificationLog[] = [];

      if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          const item = result.rows.item(i);
          logs.push({
            id: item.id,
            personnelId: item.personnel_id,
            timestamp: item.timestamp,
            latitude: item.latitude,
            longitude: item.longitude,
            faceScore: item.face_score,
            livenessScore: item.liveness_score,
            activeLivenessPassed: item.active_liveness === 1,
            synced: item.synced === 1,
          });
        }
      }
      return logs;
    } catch (error) {
      console.error('❌ Error reading unsynced logs:', error);
      return [];
    }
  }

  /**
   * Marks batch of logs as successfully synced with the cloud.
   */
  public async markLogsAsSynced(logIds: string[]): Promise<boolean> {
    if (logIds.length === 0) return true;
    await this.ensureInitialized();
    try {
      // SQLite parameter binding for IN clause
      const placeholders = logIds.map(() => '?').join(',');
      const query = `UPDATE verification_log SET synced = 1 WHERE id IN (${placeholders});`;
      const result = QuickSQLite.execute(this.dbName, query, logIds);
      return result.rowsAffected > 0;
    } catch (error) {
      console.error('❌ Failed to update sync status in SQLite:', error);
      return false;
    }
  }

  /**
   * Deletes synced logs from local storage to prevent digital forensics and save memory.
   * Triggers a SQLite VACUUM to physically destroy data from disk storage.
   */
  public async purgeSyncedLogs(): Promise<boolean> {
    await this.ensureInitialized();
    try {
      // Delete synced rows
      QuickSQLite.execute(this.dbName, 'DELETE FROM verification_log WHERE synced = 1;');
      
      // Clean and compact the database physically
      QuickSQLite.execute(this.dbName, 'VACUUM;');
      
      console.log('♻️ Local Database Purged and Compaction (VACUUM) complete.');
      return true;
    } catch (error) {
      console.error('❌ Database purging failed:', error);
      return false;
    }
  }

  /**
   * Helper to fetch database key from secure enclave (Mocked production behavior).
   */
  private async getOrCreateDatabaseKey(): Promise<string> {
    // In actual implementation, we read from react-native-encrypted-storage
    // which binds to Android KeyStore / iOS Keychain
    return 'NHAI-Secure-System-Salt-Hash-928371908273';
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }
  }
}

export default new DatabaseService();
