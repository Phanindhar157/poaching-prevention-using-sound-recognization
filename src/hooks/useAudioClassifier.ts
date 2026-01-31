import { useState, useRef, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { YAMNET_CLASSES } from '../data/yamnet_class_map';
import { AudioClassifierState } from '../types/audio';

// Constants for YAMNet
export const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';
export const YAMNET_SAMPLE_RATE = 16000;
export const YAMNET_INPUT_SIZE = 15600; // ~0.975 seconds

interface ExtendedAudioClassifierState extends AudioClassifierState {
  volume: number;
}

// Helper: Cosine Similarity (assuming vectors are normalized, this is just dot product)
const dotProduct = (a: Float32Array | number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

interface Prototypes {
  gunshots: number[][];
  chainsaws: number[][];
}

// Robust Downsampler: Converts any sample rate to 16kHz
export const downsampleBuffer = (
  buffer: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array => {
  if (targetRate === sourceRate) return buffer;

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const index = Math.floor(i * ratio);
    result[i] = buffer[index];
  }
  return result;
};

export const useAudioClassifier = (prototypes?: Prototypes | null) => {
  const [state, setState] = useState<ExtendedAudioClassifierState>({
    isRecording: false,
    isLoading: false,
    error: null,
    results: [],
    volume: 0,
  });

  const modelRef = useRef<tf.GraphModel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const initTensorFlow = async () => {
      try {
        await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
        await tf.ready();
      } catch (error) {
        console.error('TensorFlow initialization error:', error);
      }
    };
    initTensorFlow();
  }, []);

  const loadModel = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });

      const zeros = tf.zeros([YAMNET_INPUT_SIZE]);
      model.predict(zeros);
      zeros.dispose();

      modelRef.current = model;
      console.log('YAMNet loaded');
      setState(prev => ({ ...prev, isLoading: false }));
      return modelRef.current;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load model';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      let model = modelRef.current;
      if (!model) model = await loadModel();
      if (!model) throw new Error('Model failed to load');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      let audioRollingBuffer = new Float32Array(YAMNET_INPUT_SIZE);
      let samplesCaptured = 0;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Calculate Volume
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const volume = Math.sqrt(sum / inputData.length);

        // 2. Downsample
        const downsampledData = downsampleBuffer(inputData, audioContext.sampleRate, YAMNET_SAMPLE_RATE);

        // 3. Buffer logic
        const newBuffer = new Float32Array(YAMNET_INPUT_SIZE);
        const keepLength = YAMNET_INPUT_SIZE - downsampledData.length;

        if (keepLength > 0) {
          newBuffer.set(audioRollingBuffer.subarray(downsampledData.length));
          newBuffer.set(downsampledData, keepLength);
        } else {
          newBuffer.set(downsampledData.subarray(downsampledData.length - YAMNET_INPUT_SIZE));
        }

        audioRollingBuffer = newBuffer;
        samplesCaptured += downsampledData.length;

        const SAMPLES_PER_INFERENCE = 8000;

        if (samplesCaptured >= SAMPLES_PER_INFERENCE) {
          samplesCaptured = 0;

          try {
            tf.tidy(() => {
              const tensor = tf.tensor1d(audioRollingBuffer, 'float32');
              const basePrediction = model!.predict(tensor);

              let scoresTensor: tf.Tensor | null = null;
              let embeddingsTensor: tf.Tensor | null = null;

              if (Array.isArray(basePrediction)) {
                scoresTensor = basePrediction[0] as tf.Tensor;
                embeddingsTensor = basePrediction[1] as tf.Tensor;
              } else if (basePrediction instanceof tf.Tensor) {
                scoresTensor = basePrediction;
              } else {
                const predMap = basePrediction as Record<string, tf.Tensor>;
                scoresTensor = predMap['scores'] || predMap['Identity'];
                embeddingsTensor = predMap['embeddings'] || predMap['GlobalAveragePooling2D'];
              }

              let customGunshotScore = 0;
              let customChainsawScore = 0;

              // --- PROTOTYPE MATCHING (KNN) ---
              if (prototypes && embeddingsTensor) {
                const embedData = embeddingsTensor.dataSync();
                // Normalize live embedding
                const liveEmbed = new Float32Array(1024);

                if (embeddingsTensor.shape[0] > 1) {
                  const numFrames = embeddingsTensor.shape[0];
                  for (let f = 0; f < numFrames; f++) {
                    for (let k = 0; k < 1024; k++) liveEmbed[k] += embedData[f * 1024 + k];
                  }
                  for (let k = 0; k < 1024; k++) liveEmbed[k] /= numFrames;
                } else {
                  liveEmbed.set(embedData);
                }

                const norm = Math.sqrt(liveEmbed.reduce((s, v) => s + v * v, 0));
                if (norm > 0) for (let k = 0; k < 1024; k++) liveEmbed[k] /= norm;

                // 1. Check Gunshots
                if (prototypes.gunshots.length > 0) {
                  let maxSim = -1;
                  for (const proto of prototypes.gunshots) {
                    const sim = dotProduct(liveEmbed, proto);
                    if (sim > maxSim) maxSim = sim;
                  }
                  if (maxSim > 0.75) customGunshotScore = maxSim;
                }

                // 2. Check Chainsaws
                if (prototypes.chainsaws.length > 0) {
                  let maxSim = -1;
                  for (const proto of prototypes.chainsaws) {
                    const sim = dotProduct(liveEmbed, proto);
                    if (sim > maxSim) maxSim = sim;
                  }
                  if (maxSim > 0.75) customChainsawScore = maxSim;
                }
              }

              // --- MERGE WITH YAMNET ---
              if (scoresTensor) {
                const scores = scoresTensor.dataSync();

                // Aggregation logic
                const GUNSHOT_RELATED = ['Gunshot, gunfire', 'Cap gun', 'Fusillade', 'Explosion', 'Fireworks', 'Firecracker', 'Burst, pop', 'Bang'];
                const CHAINSAW_RELATED = ['Chainsaw', 'Sawing', 'Engine', 'Medium engine (mid frequency)'];

                let gunshotScore = 0;
                let chainsawScore = 0;

                const allResults = [];
                const limit = Math.min(scores.length, YAMNET_CLASSES.length);

                for (let i = 0; i < limit; i++) {
                  const label = YAMNET_CLASSES[i];
                  const score = scores[i];

                  if (GUNSHOT_RELATED.includes(label)) gunshotScore += score;
                  if (CHAINSAW_RELATED.includes(label)) chainsawScore += score;

                  if (label) {
                    allResults.push({ label, score });
                  }
                }

                // Apply Custom Boost
                if (customGunshotScore > gunshotScore) gunshotScore = customGunshotScore;
                if (customChainsawScore > chainsawScore) chainsawScore = customChainsawScore;

                // Ensure scores don't exceed 1.0
                gunshotScore = Math.min(gunshotScore, 1.0);
                chainsawScore = Math.min(chainsawScore, 1.0);

                const gunshotIndex = allResults.findIndex(r => r.label === 'Gunshot, gunfire');
                if (gunshotIndex !== -1) {
                  allResults[gunshotIndex].score = gunshotScore;
                  if (customGunshotScore > 0.75) allResults[gunshotIndex].label = "Gunshot (Verified)";
                }

                const chainsawIndex = allResults.findIndex(r => r.label === 'Chainsaw');
                if (chainsawIndex !== -1) {
                  allResults[chainsawIndex].score = chainsawScore;
                  if (customChainsawScore > 0.75) allResults[chainsawIndex].label = "Chainsaw (Verified)";
                }

                allResults.sort((a, b) => b.score - a.score);
                const topResults = allResults.slice(0, 5);

                setState(prev => ({
                  ...prev,
                  results: topResults,
                  volume: volume,
                  error: null
                }));
              }
            });
          } catch (infError) {
            console.error('❌ Inference Error:', infError);
          }
        } else {
          setState(prev => ({ ...prev, volume }));
        }
      };

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      setState(prev => ({ ...prev, isRecording: true, error: null, results: [] }));
    } catch (error) {
      console.error('Recording error:', error);
      setState(prev => ({ ...prev, isRecording: false, error: String(error) }));
    }
  }, [loadModel, prototypes]);

  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setState(prev => ({ ...prev, isRecording: false, volume: 0 }));
  }, []);

  return { ...state, startRecording, stopRecording };
};
