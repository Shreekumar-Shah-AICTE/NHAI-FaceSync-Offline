/**
 * NHAI FaceSync Offline — Facial Processing & Mathematical Utilities
 * Implements high-performance linear algebra operations for embeddings and landmark processing.
 */

/**
 * Calculates the cosine similarity between two 128-dimensional embedding vectors.
 * Cosine Similarity = (A • B) / (||A|| * ||B||)
 * Since our embeddings are already L2 normalized by the MobileFaceNet model:
 * Cosine Similarity = A • B
 */
export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector dimensions mismatch: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizes an embedding vector using L2 normalization.
 * Ensures the vector lies on the unit hypersphere.
 */
export function l2Normalize(vector: number[]): number[] {
  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    sumOfSquares += vector[i] * vector[i];
  }

  const magnitude = Math.sqrt(sumOfSquares);
  if (magnitude === 0) return vector;

  return vector.map(val => val / magnitude);
}

/**
 * Calculates the Eye Aspect Ratio (EAR) based on 6 facial landmark points.
 * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
 */
export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export function calculateEyeAspectRatio(
  p1: LandmarkPoint,
  p2: LandmarkPoint,
  p3: LandmarkPoint,
  p4: LandmarkPoint,
  p5: LandmarkPoint,
  p6: LandmarkPoint
): number {
  // Vertical distances
  const dVert1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2));
  const dVert2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2));

  // Horizontal distance
  const dHoriz = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2));

  if (dHoriz === 0) return 0;

  return (dVert1 + dVert2) / (2.0 * dHoriz);
}

/**
 * Computes bounding box expansion factor to crop face correctly for MobileFaceNet
 * (Typically needs wider context around ears and forehead compared to raw detector boxes).
 */
export function expandBoundingBox(
  x: number,
  y: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
  factor = 0.25
) {
  const dx = width * factor;
  const dy = height * factor;

  const newX = Math.max(0, x - dx);
  const newY = Math.max(0, y - dy);
  const newWidth = Math.min(imageWidth - newX, width + 2 * dx);
  const newHeight = Math.min(imageHeight - newY, height + 2 * dy);

  return {
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(newWidth),
    height: Math.round(newHeight),
  };
}
