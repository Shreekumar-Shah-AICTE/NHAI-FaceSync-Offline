/**
 * NHAI FaceSync Offline — Model Configurations & Hyperparameters
 * Dedicated configurations for MobileFaceNet and MiniFASNet v2 running on-device.
 */

export const MODEL_CONFIGS = {
  // MobileFaceNet config
  faceRecognition: {
    modelFile: 'mobilefacenet_quant.tflite',
    inputWidth: 112,
    inputHeight: 112,
    embeddingSize: 128,
    // Cosine similarity threshold for identity verification
    similarityThreshold: 0.72,
    uncertaintyRange: {
      min: 0.60,
      max: 0.72,
    },
  },

  // MiniFASNet v2 config (Passive Liveness)
  livenessPassive: {
    modelFile: 'minifasnet_v2_quant.tflite',
    inputWidth: 80,
    inputHeight: 80,
    // Minimum probability score to classify as "Real/Live" face
    livenessScoreThreshold: 0.82,
  },

  // Active Liveness Challenge (Landmark-based validation)
  livenessActive: {
    // Eye Aspect Ratio threshold for blink detection
    blinkEarThreshold: 0.20,
    blinkConsecutiveFrames: 2,
    // Yaw rotation angle in degrees for head turn detection
    headTurnYawThreshold: 15,
    // Pitch rotation angle in degrees for head nod detection
    headNodPitchThreshold: 12,
    // Maximum seconds allocated for user to pass the active challenge
    challengeTimeoutSeconds: 15,
  },

  // SQLite encrypted storage configs
  database: {
    dbName: 'nhai_facesync_secure.db',
    // Encryption key is fetched dynamically from keystore/keychain
    encryptionKeyAlias: 'nhai_db_aes_key',
  },

  // Sync and Purge configs
  sync: {
    apiEndpoint: 'https://datalake.nhai.gov.in/api/v3/sync/personnel-auth',
    batchSize: 50,
    retryIntervalMs: 5000,
    maxRetries: 3,
  },
};
