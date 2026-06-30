export interface FoodAnalysisResult {
  barcode?: string;
  notice?: string;
  productName: string;
  detectedFromImage: 'barcode' | 'label' | 'manual' | 'camera';
  healthScore: number; // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  summary: string;
  positives: string[];
  negatives: string[];
  nutritionFacts: {
    calories?: string;
    totalFat?: string;
    saturatedFat?: string;
    sugar?: string;
    sodium?: string;
    protein?: string;
    fiber?: string;
  };
  isHealthy: 'healthy' | 'moderate' | 'unhealthy';
  alternatives: Array<{
    name: string;
    reason: string;
  }>;
  ingredients: string;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  result: FoodAnalysisResult;
}

// Global declaration for experimental BarcodeDetector API in browsers
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInstance;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

export interface BarcodeDetectorInstance {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
}
