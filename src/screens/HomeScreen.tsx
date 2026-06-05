/**
 * NHAI FaceSync Offline — Home Dashboard Screen
 * High-performance industrial control board containing device local storage state,
 * pending sync operations, network latency monitoring, and core routes.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import DatabaseService, { PersonnelRecord } from '../services/DatabaseService';
import SyncPurgeService from '../services/SyncPurgeService';

export const HomeScreen = ({ navigation }: { navigation: any }) => {
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [unsyncedLogs, setUnsyncedLogs] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    // 1. Listen for network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });

    // 2. Load initial DB counts
    loadDatabaseStats();

    // 3. Start background monitoring
    SyncPurgeService.startNetworkMonitoring();

    return () => {
      unsubscribe();
      SyncPurgeService.stopNetworkMonitoring();
    };
  }, []);

  const loadDatabaseStats = async () => {
    try {
      await DatabaseService.initializeDatabase();
      const staff: PersonnelRecord[] = await DatabaseService.getAllPersonnel();
      setTotalEnrolled(staff.length);

      const pending = await DatabaseService.getUnsyncedLogs();
      setUnsyncedLogs(pending.length);
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert(
        'Offline Mode Active',
        'Cannot sync database. Please connect to a cellular or Wi-Fi network.'
      );
      return;
    }

    setSyncInProgress(true);
    try {
      const result = await SyncPurgeService.triggerSyncJob();
      if (result.success) {
        Alert.alert(
          'Database Synced',
          `Successfully synced ${result.syncedCount} records to NHAI Datalake cloud endpoints.`
        );
      } else if (result.syncedCount > 0) {
        Alert.alert(
          'Partial Sync Complete',
          `Synced ${result.syncedCount} records. Some records are still pending retry.`
        );
      } else {
        Alert.alert('Sync Idle', 'No offline logs pending submission.');
      }
      await loadDatabaseStats();
    } catch (e) {
      Alert.alert('Sync Error', 'An unexpected error occurred during cloud communication.');
    } finally {
      setSyncInProgress(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>NHAI DATALAKE 3.0</Text>
            <Text style={styles.subtitle}>FaceSync Offline Engine</Text>
          </View>
          <View style={[styles.networkBadge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
            <View style={[styles.badgeDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.badgeText}>{isOnline ? 'CLOUD ACTIVE' : 'OFFLINE MODE'}</Text>
          </View>
        </View>

        {/* Hero Dashboard Metrics Card */}
        <View style={styles.dashboardCard}>
          <Text style={styles.cardTitle}>Local System Status</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalEnrolled}</Text>
              <Text style={styles.statLabel}>Enrolled Staff</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, unsyncedLogs > 0 ? styles.alertText : null]}>
                {unsyncedLogs}
              </Text>
              <Text style={styles.statLabel}>Unsynced Logs</Text>
            </View>
          </View>

          {unsyncedLogs > 0 && (
            <View style={styles.syncNotice}>
              <Text style={styles.syncNoticeText}>
                ⚠️ {unsyncedLogs} verification logs are cached locally in encrypted storage.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.syncButton, syncInProgress ? styles.syncButtonDisabled : null]}
            onPress={handleManualSync}
            disabled={syncInProgress}
          >
            <Text style={styles.syncButtonText}>
              {syncInProgress ? 'SYNCING...' : 'TRIGGER CLOUD SYNC'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionContainer}>
          <Text style={styles.sectionTitle}>Verification Actions</Text>
          
          <TouchableOpacity
            style={styles.verifyActionBtn}
            onPress={() => navigation.navigate('Verification')}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.iconSymbol}>📸</Text>
            </View>
            <View style={styles.btnTextContent}>
              <Text style={styles.btnMainText}>Verify Identity</Text>
              <Text style={styles.btnSubText}>Run TFLite facial recognition & liveness check</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.enrollActionBtn}
            onPress={() => navigation.navigate('Enrollment')}
          >
            <View style={styles.iconCircleEnroll}>
              <Text style={styles.iconSymbol}>👤</Text>
            </View>
            <View style={styles.btnTextContent}>
              <Text style={styles.btnMainText}>Enroll Personnel</Text>
              <Text style={styles.btnSubText}>Register new identity reference embeddings</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Security Disclosures */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerTitle}>🔒 SECURITY PROTOCOLS ENFORCED</Text>
          <Text style={styles.footerDesc}>
            - Local data encrypted using SQLCipher AES-256.{'\n'}
            - Sync records automatically purge from device memory post-sync.{'\n'}
            - 100% processing happens on-device; no raw image transfers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16', // Dark Slate Blue
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  dashboardCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)', // Glassmorphic translucent slate
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  alertText: {
    color: '#FFB800', // Gold/Amber alert color
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  syncNotice: {
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
    borderColor: 'rgba(255, 184, 0, 0.2)',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  syncNoticeText: {
    fontSize: 11,
    color: '#FFB800',
    textAlign: 'center',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#0284C7', // Deep Sky Blue
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#334155',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  actionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  verifyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)', // Emerald hint
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 14,
  },
  enrollActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconCircleEnroll: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconSymbol: {
    fontSize: 20,
  },
  btnTextContent: {
    flex: 1,
  },
  btnMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  footerInfo: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  footerTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  footerDesc: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 15,
  },
});
