export interface ClassificationResult {
  label: string;
  score: number;
}

export interface AudioClassifierState {
  isRecording: boolean;
  isLoading: boolean;
  error: string | null;
  results: ClassificationResult[];
  volume?: number;
}
