# NHAI FaceSync Offline — Codebase & System Architecture

This document serves as the structural map of the **NHAI FaceSync Offline** client-side engine and cloud sync protocols. It outlines how the React Native front-end interacts with on-device TFLite models, secure local SQLite storage, and AWS backend components.

---

## 🗺️ Architectural Blueprint

```
NHAI_Proposal/
├── App.tsx                     # App shell, DB initialization, and TFLite model pre-caching
├── package.json                # Project dependencies (Fast TFLite, Quick SQLite, Vision Camera)
├── tsconfig.json               # TypeScript path mapping and compilation parameters
├── .gitignore                  # Git exclude policies
├── README.md                   # Main documentation & developer onboarding board
├── ARCHITECTURE.md             # This structural map and component index
├── src/
│   ├── components/
│   │   └── CameraView.tsx      # Vision Camera frame processor & visual feedback overlay
│   ├── config/
│   │   └── modelConfig.ts      # Biometric thresholds, active liveness triggers, and sync params
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Screen stack routes (Home, Enrollment, Verification)
│   ├── screens/
│   │   ├── HomeScreen.tsx      # Diagnostic board, offline queue status, manual sync trigger
│   │   ├── EnrollmentScreen.tsx# Reference template capture, metadata form, centroid enrollment
│   │   └── VerificationScreen.tsx# Active & Passive liveness state machine orchestrator
│   ├── services/
│   │   ├── DatabaseService.ts  # SQLCipher AES-256 storage, Merkle hash logs, and purge routines
│   │   ├── FaceRecognitionService.ts # Quantized MobileFaceNet ArcFace embedding generation
│   │   ├── LivenessDetectionService.ts # Quantized MiniFASNet v2 & Landmark aspect calculations
│   │   └── SyncPurgeService.ts # NetInfo connection listeners and AWS ingestion batchers
│   └── utils/
│       └── faceUtils.ts        # Cosine similarity math, L2 vector normalizations, EAR calculation
```

---

## ⚡ Core Subsystem Specifications

### 1. The Edge AI Subsystem
* **Execution Engine:** Powered by [`react-native-fast-tflite`](./src/services/FaceRecognitionService.ts), executing models compiled via C++ bindings for near-native CPU processing.
* **Identity Mapping:** Uses a quantized **MobileFaceNet** model (`mobilefacenet_quant.tflite`, ~4.2 MB) to extract 128-D vector embeddings. Comparison uses Cosine Similarity against cached identities in SQLite:
  $$\text{Cosine Similarity} = \frac{A \cdot B}{\|A\|\|B\|}$$
* **Liveness Processing:** Executes in two sequential layers:
  1. *Passive Texture Check:* Runs **MiniFASNet v2** (`minifasnet_v2_quant.tflite`, ~5.5 MB) to output real/fake probabilities.
  2. *Active Challenge Check:* Evaluates Google ML Kit / Apple CoreML face mesh land-marker positions to verify blink ratios (Eye Aspect Ratio $<0.20$) or head turns ($>15^{\circ}$).

### 2. The Cryptographic Persistence Subsystem
* **Technology:** SQLite wrapped in [`react-native-quick-sqlite`](./src/services/DatabaseService.ts) and encrypted at-rest using **SQLCipher (AES-256-CBC)**.
* **Tamper-Evident Ledger:** Implements a hash chain link between consecutive attendance records:
  $$\text{Hash}_n = \text{SHA-256}(\text{RecordData} + \text{Hash}_{n-1})$$
  This makes local log manipulation easily identifiable by the server.
* **Biometric Sanitization:** On successful synchronization, local synced logs are deleted. The database then issues a physical `VACUUM` command to defragment the SQLite file, overwriting the disk blocks and removing forensic traces of biometric events.

### 3. The Cloud Sync Ingestion Subsystem
* **Connectivity Monitor:** Listens for connection state changes via NetInfo in [`SyncPurgeService.ts`](./src/services/SyncPurgeService.ts).
* **Ingestion Protocol:** Batches up to 50 records in a single TLS 1.3 encrypted JSON POST payload to an AWS API Gateway endpoint.
* **AWS Validation Pipeline:**
  1. AWS API Gateway receives the JSON packet and verifies supervisor JWT credentials.
  2. AWS Lambda decrypts variables, traces the Merkle hash chain to confirm log integrity, and formats values.
  3. Records are persisted to Amazon DynamoDB for long-term telemetry.
  4. Server returns a cryptographic acknowledgment signature, which triggers the local purge routine.
