/**
 * NHAI FaceSync Offline — Camera Preview Component
 * Implements react-native-vision-camera wrapper with custom drawing overlay for face bounds.
 */

import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

interface CameraViewProps {
  isActive: boolean;
  onFrameProcessed?: (frame: any) => void;
  faceBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  statusText?: string;
}

export const CameraView: React.FC<CameraViewProps> = ({
  isActive,
  faceBounds,
  statusText = 'Align your face in the center frame',
}) => {
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'front'); // Always use front camera

  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.errorText}>Accessing Front-Facing Camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        photo={true}
      />

      {/* Guide Ring / Face Frame Target (Visual aid for user alignment) */}
      <View style={styles.overlayFrameContainer}>
        <View style={styles.lensFrameTarget} />
        
        {/* Dynamic green box when a face is actively locked by ML Kit detector */}
        {faceBounds && (
          <View
            style={[
              styles.faceBoundingBox,
              {
                left: faceBounds.x,
                top: faceBounds.y,
                width: faceBounds.width,
                height: faceBounds.height,
              },
            ]}
          />
        )}
      </View>

      {/* Bottom overlay status */}
      <View style={styles.statusPanel}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'System',
  },
  overlayFrameContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lensFrameTarget: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.4)', // Premium Gold tint
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  faceBoundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#10B981', // Emerald Green on tracking lock
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  statusPanel: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
    textAlign: 'center',
  },
});
