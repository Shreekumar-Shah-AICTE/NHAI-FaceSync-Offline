/**
 * NHAI FaceSync Offline — Liveness Detection Service (Anti-Spoofing)
 * Integrates Passive Liveness (MiniFASNet v2 TFLite) with Active Liveness
 * (Google ML Kit / CoreML facial landmark-based challenge sequences).
 */

import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { MODEL_CONFIGS } from '../config/modelConfig';
import { calculateEyeAspectRatio, LandmarkPoint } from '../utils/faceUtils';

export type ActiveLivenessChallenge = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'NOD' | 'NONE';

export interface LivenessStatus {
  passiveScore: number;
  passivePassed: boolean;
  activePassed: boolean;
  currentChallenge: ActiveLivenessChallenge;
  challengeProgress: number; // 0 to 1
}

class LivenessDetectionService {
  private model: TensorflowModel | null = null;
  private isLoaded = false;

  // Active Liveness state tracking
  private blinkFrameCounter = 0;
  private initialYaw: number | null = null;
  private initialPitch: number | null = null;

  /**
   * Loads the MiniFASNet v2 Quantized TFLite Model.
   */
  public async loadModel(): Promise<boolean> {
    if (this.isLoaded) return true;

    try {
      console.log(`🛡️ Loading Passive Liveness Model: ${MODEL_CONFIGS.livenessPassive.modelFile}...`);
      this.model = await loadTensorflowModel(
        `asset:/models/${MODEL_CONFIGS.livenessPassive.modelFile}`
      );
      this.isLoaded = true;
      console.log('✅ MiniFASNet Liveness Model Loaded Successfully.');
      return true;
    } catch (error) {
      console.error('❌ Failed to load MiniFASNet TFLite model:', error);
      return false;
    }
  }

  /**
   * Executes MiniFASNet passive texture liveness checking.
   * @param rgbBuffer Flat Float32Array containing RGB pixels of size 80 * 80 * 3
   */
  public async verifyPassiveLiveness(rgbBuffer: Float32Array): Promise<number> {
    if (!this.isLoaded || !this.model) {
      const loaded = await this.loadModel();
      if (!loaded || !this.model) {
        throw new Error('Passive Liveness model is not loaded');
      }
    }

    try {
      const output = await this.model.run([rgbBuffer]);
      // MiniFASNet outputs 2 classes: [real_prob, fake_prob]
      const results = output[0] as Float32Array;
      const realProbability = results[0];
      return realProbability;
    } catch (error) {
      console.error('❌ Passive liveness inference error:', error);
      return 0.0;
    }
  }

  /**
   * Resets active challenge tracker variables.
   */
  public resetActiveChallengeState(): void {
    this.blinkFrameCounter = 0;
    this.initialYaw = null;
    this.initialPitch = null;
  }

  /**
   * Evaluates face landmarks to verify the active liveness challenge.
   * Returns true if user successfully matches the challenge parameters.
   */
  public evaluateActiveChallenge(
    challenge: ActiveLivenessChallenge,
    landmarks: {
      leftEye: LandmarkPoint[];  // 6 points matching ML Kit index order
      rightEye: LandmarkPoint[]; // 6 points
      yaw: number;               // Euler Y angle (head rotation left/right)
      pitch: number;             // Euler X angle (head rotation up/down)
    }
  ): { passed: boolean; progress: number } {
    const limits = MODEL_CONFIGS.livenessActive;

    switch (challenge) {
      case 'BLINK': {
        // Calculate EAR for both eyes
        const leftEar = calculateEyeAspectRatio(
          landmarks.leftEye[0],
          landmarks.leftEye[1],
          landmarks.leftEye[2],
          landmarks.leftEye[3],
          landmarks.leftEye[4],
          landmarks.leftEye[5]
        );
        const rightEar = calculateEyeAspectRatio(
          landmarks.rightEye[0],
          landmarks.rightEye[1],
          landmarks.rightEye[2],
          landmarks.rightEye[3],
          landmarks.rightEye[4],
          landmarks.rightEye[5]
        );

        const avgEar = (leftEar + rightEar) / 2.0;

        // Verify if eyes are closed
        if (avgEar < limits.blinkEarThreshold) {
          this.blinkFrameCounter++;
        } else {
          // If they blinked and opened eyes, challenge is complete
          if (this.blinkFrameCounter >= limits.blinkConsecutiveFrames) {
            this.blinkFrameCounter = 0;
            return { passed: true, progress: 1.0 };
          }
        }

        const progress = Math.min(this.blinkFrameCounter / limits.blinkConsecutiveFrames, 0.9);
        return { passed: false, progress };
      }

      case 'TURN_LEFT': {
        if (this.initialYaw === null) {
          this.initialYaw = landmarks.yaw;
        }

        const deltaYaw = landmarks.yaw - this.initialYaw;
        // Turn left in ML Kit means positive yaw angle rotation
        const targetYaw = limits.headTurnYawThreshold;
        const progress = Math.min(Math.max(deltaYaw / targetYaw, 0), 1.0);

        if (deltaYaw >= targetYaw) {
          return { passed: true, progress: 1.0 };
        }
        return { passed: false, progress };
      }

      case 'TURN_RIGHT': {
        if (this.initialYaw === null) {
          this.initialYaw = landmarks.yaw;
        }

        const deltaYaw = this.initialYaw - landmarks.yaw;
        // Turn right means negative yaw angle
        const targetYaw = limits.headTurnYawThreshold;
        const progress = Math.min(Math.max(deltaYaw / targetYaw, 0), 1.0);

        if (deltaYaw >= targetYaw) {
          return { passed: true, progress: 1.0 };
        }
        return { passed: false, progress };
      }

      case 'NOD': {
        if (this.initialPitch === null) {
          this.initialPitch = landmarks.pitch;
        }

        const deltaPitch = Math.abs(landmarks.pitch - this.initialPitch);
        const targetPitch = limits.headNodPitchThreshold;
        const progress = Math.min(deltaPitch / targetPitch, 1.0);

        if (deltaPitch >= targetPitch) {
          return { passed: true, progress: 1.0 };
        }
        return { passed: false, progress };
      }

      case 'NONE':
      default:
        return { passed: true, progress: 1.0 };
    }
  }

  /**
   * Utility to pick a random active challenge to prevent bypass scripts.
   */
  public generateRandomChallenge(exclude: ActiveLivenessChallenge = 'NONE'): ActiveLivenessChallenge {
    const list: ActiveLivenessChallenge[] = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT', 'NOD'];
    const filtered = list.filter(item => item !== exclude);
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  }
}

export default new LivenessDetectionService();
