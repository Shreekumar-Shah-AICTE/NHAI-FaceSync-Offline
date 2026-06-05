/**
 * NHAI FaceSync Offline — Personnel Enrollment Screen
 * Enrolls new staff by gathering metadata and generating reference facial templates.
 * Persists record securely to encrypted local database.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DatabaseService from '../services/DatabaseService';
import FaceRecognitionService from '../services/FaceRecognitionService';

export const EnrollmentScreen = ({ navigation }: { navigation: any }) => {
  const [personnelId, setPersonnelId] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEnroll = async () => {
    if (!personnelId.trim() || !name.trim() || !designation.trim() || !department.trim()) {
      Alert.alert('Incomplete Fields', 'Please fill in all personnel details.');
      return;
    }

    setIsCapturing(true);
    // Simulate camera snapshot and frame processing delay
    setTimeout(async () => {
      setIsCapturing(false);
      setIsProcessing(true);

      try {
        // Generate mock 128-D embedding vector representing MobileFaceNet output
        // In real execution, a frame processor feeds actual pixel buffer to FaceRecognitionService
        const mockEmbedding = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
        
        // Normalize vector to maintain L2 sphere constraints
        let sum = mockEmbedding.reduce((acc, val) => acc + val * val, 0);
        const norm = Math.sqrt(sum);
        const normalizedEmbedding = mockEmbedding.map(v => v / norm);

        const success = await DatabaseService.enrollPersonnel({
          personnelId: personnelId.trim(),
          name: name.trim(),
          designation: designation.trim(),
          department: department.trim(),
          faceEmbedding: normalizedEmbedding,
          enrolledAt: Date.now(),
        });

        setIsProcessing(false);

        if (success) {
          Alert.alert(
            'Enrollment Successful',
            `Personnel ${name} has been enrolled successfully. Reference template cached.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          Alert.alert('Database Error', 'Failed to save reference credentials to local storage.');
        }
      } catch (error) {
        setIsProcessing(false);
        Alert.alert('Recognition Error', 'Failed to compute facial vector from camera feed.');
      }
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backIcon}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Enrollment</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Personnel ID (NHAI-XXX)</Text>
            <TextInput
              style={styles.input}
              value={personnelId}
              onChangeText={setPersonnelId}
              placeholder="e.g., NHAI-2948"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              keyboardType="default"
            />

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Ramesh Kumar"
              placeholderTextColor="#475569"
            />

            <Text style={styles.inputLabel}>Designation</Text>
            <TextInput
              style={styles.input}
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g., Project Site Engineer"
              placeholderTextColor="#475569"
            />

            <Text style={styles.inputLabel}>Department</Text>
            <TextInput
              style={styles.input}
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g., Quality Assurance / Construction"
              placeholderTextColor="#475569"
            />
          </View>

          {/* Camera Frame Preview Mock */}
          <View style={styles.cameraFrameMock}>
            <View style={styles.cameraGlassCircle}>
              {isCapturing ? (
                <View style={styles.statusBox}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.cameraStatusText}>Aligning face...</Text>
                </View>
              ) : isProcessing ? (
                <View style={styles.statusBox}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.cameraStatusText}>Compiling 128-D vector...</Text>
                </View>
              ) : (
                <Text style={styles.cameraPlaceholderSymbol}>👤</Text>
              )}
            </View>
            <Text style={styles.cameraNotice}>
              Camera system activates automatically upon initiation
            </Text>
          </View>

          {/* Action Trigger */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isCapturing || isProcessing ? styles.buttonDisabled : null,
            ]}
            onPress={handleEnroll}
            disabled={isCapturing || isProcessing}
          >
            <Text style={styles.submitButtonText}>
              {isCapturing
                ? 'CAPTURING...'
                : isProcessing
                ? 'GENERATING TEMPLATE...'
                : 'INITIATE FACE ENROLLMENT'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backIcon: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 40,
  },
  formCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  cameraFrameMock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cameraGlassCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.25)', // Gold theme border
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cameraPlaceholderSymbol: {
    fontSize: 64,
    opacity: 0.45,
  },
  cameraStatusText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  statusBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraNotice: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#FFB800', // Gold/Amber Accent color
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#334155',
  },
  submitButtonText: {
    color: '#090D16', // Dark background contrast
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
