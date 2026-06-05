/**
 * NHAI FaceSync Offline — Facial Recognition Engine
 * Handles TensorFlow Lite quantized model loading and inference for MobileFaceNet.
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { MODEL_CONFIGS } from '../config/modelConfig';
import { calculateCosineSimilarity } from '../utils/faceUtils';
import DatabaseService, { PersonnelRecord } from './DatabaseService';

class FaceRecognitionService {
  private model: TensorflowModel | null = null;
  private isLoaded = false;

  /**
   * Asynchronously loads the MobileFaceNet quantized TFLite model from assets.
   */
  public async loadModel(): Promise<boolean> {
    if (this.isLoaded) return true;

    try {
      console.log(`🤖 Loading Face Recognition Model: ${MODEL_CONFIGS.faceRecognition.modelFile}...`);
      
      // Load model using high-performance Fast TFLite C++ binding
      this.model = await loadTensorflowModel(
        `asset:/models/${MODEL_CONFIGS.faceRecognition.modelFile}`
      );

      this.isLoaded = true;
      console.log('✅ MobileFaceNet Model Loaded Successfully.');
      return true;
    } catch (error) {
      console.error('❌ Failed to load MobileFaceNet TFLite model:', error);
      return false;
    }
  }

  /**
   * Generates a 128-dimensional embedding from a cropped face image frame.
   * @param rgbBuffer Flat Float32Array containing RGB pixels of size 112 * 112 * 3 (normalized to [-1, 1] or [0, 1])
   */
  public async generateEmbedding(rgbBuffer: Float32Array): Promise<number[]> {
    if (!this.isLoaded || !this.model) {
      const loaded = await this.loadModel();
      if (!loaded || !this.model) {
        throw new Error('Face recognition model is not loaded');
      }
    }

    try {
      // Execute fast sync/async inference on TFLite C++ thread
      const output = await this.model.run([rgbBuffer]);
      
      // Extract outputs
      const rawEmbedding = output[0] as Float32Array;
      
      // Convert Float32Array to standard JavaScript number array
      return Array.from(rawEmbedding);
    } catch (error) {
      console.error('❌ Inference error in MobileFaceNet:', error);
      throw error;
    }
  }

  /**
   * Matches an input embedding against all offline enrolled personnel in the SQLite DB.
   * Implements optimized Cosine Similarity matching.
   */
  public async verifyIdentity(
    inputEmbedding: number[]
  ): Promise<{
    matched: boolean;
    confidence: number;
    personnel: PersonnelRecord | null;
    status: 'MATCH' | 'UNCERTAIN' | 'REJECT';
  }> {
    const enrolledList = await DatabaseService.getAllPersonnel();
    if (enrolledList.length === 0) {
      return { matched: false, confidence: 0, personnel: null, status: 'REJECT' };
    }

    let bestMatch: PersonnelRecord | null = null;
    let highestSimilarity = -1;

    // Linearly scan the local cache (very fast for small/medium teams <= 5,000 personnel)
    // For 128-D vectors, 5000 matches take < 5ms in Javascript
    for (const record of enrolledList) {
      const similarity = calculateCosineSimilarity(inputEmbedding, record.faceEmbedding);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = record;
      }
    }

    const configs = MODEL_CONFIGS.faceRecognition;
    let status: 'MATCH' | 'UNCERTAIN' | 'REJECT' = 'REJECT';

    if (highestSimilarity >= configs.similarityThreshold) {
      status = 'MATCH';
    } else if (
      highestSimilarity >= configs.uncertaintyRange.min &&
      highestSimilarity < configs.uncertaintyRange.max
    ) {
      status = 'UNCERTAIN';
    }

    return {
      matched: status === 'MATCH',
      confidence: highestSimilarity,
      personnel: status !== 'REJECT' ? bestMatch : null,
      status,
    };
  }
}

export default new FaceRecognitionService();
