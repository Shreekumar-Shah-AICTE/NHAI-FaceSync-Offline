/**
 * NHAI FaceSync Offline — App Entry point
 * Initializes secure DB, pre-caches local AI models on launch,
 * and sets up Navigation providers.
 */

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import DatabaseService from './src/services/DatabaseService';
import FaceRecognitionService from './src/services/FaceRecognitionService';
import LivenessDetectionService from './src/services/LivenessDetectionService';
import SafetyGearDetectorService from './src/services/SafetyGearDetectorService';

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Services...');

  useEffect(() => {
    async function prepareApp() {
      try {
        // Step 1: Initialize Database (SQLCipher AES-256 validation)
        setLoadingStatus('Initializing Encrypted Databases...');
        await DatabaseService.initializeDatabase();

        // Step 2: Warm up on-device TFLite models
        setLoadingStatus('Loading MobileFaceNet Engine...');
        await FaceRecognitionService.loadModel();

        setLoadingStatus('Loading MiniFAS Liveness Engine...');
        await LivenessDetectionService.loadModel();

        setLoadingStatus('Loading SafeShield YOLOv8 Engine...');
        await SafetyGearDetectorService.loadModel();

        setAppReady(true);
      } catch (error) {
        console.error('Fatal initialization error:', error);
        setLoadingStatus('Initialization Failed. Contact System Admin.');
      }
    }

    prepareApp();
  }, []);

  if (!appReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#FFB800" />
        <Text style={styles.titleText}>NHAI DATALAKE 3.0</Text>
        <Text style={styles.statusText}>{loadingStatus}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 24,
    letterSpacing: 1.5,
  },
  statusText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
