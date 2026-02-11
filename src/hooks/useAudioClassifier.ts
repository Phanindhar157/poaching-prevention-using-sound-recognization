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
  distance: number;
  direction: number;
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
    distance: 0,
    direction: 0,
  });

  // Promise to track loading state across re-renders
  const modelPromiseRef = useRef<Promise<tf.GraphModel> | null>(null);

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
        // Eagerly load model on mount
        loadModel();
      } catch (error) {
        console.error('TensorFlow initialization error:', error);
      }
    };
    initTensorFlow();
  }, []);

  const loadModel = useCallback(async () => {
    // If already loading or loaded, return the existing promise
    if (modelPromiseRef.current) return modelPromiseRef.current;

    const loader = async () => {
      try {
        console.log("Loading YAMNet...");
        // 1. Try loading from indexeddb (cache)
        try {
          const model = await tf.loadGraphModel('indexeddb://yamnet-model');
          console.log('YAMNet loaded from Cache (IndexedDB)');
          modelRef.current = model;
          // Warmup
          const zeros = tf.zeros([YAMNET_INPUT_SIZE]);
          model.predict(zeros);
          zeros.dispose();
          return model;
        } catch {
          console.log('Cache miss, downloading model...');
        }

        // 2. Download from web
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        const model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });

        // Warmup
        const zeros = tf.zeros([YAMNET_INPUT_SIZE]);
        model.predict(zeros);
        zeros.dispose();

        modelRef.current = model;
        console.log('YAMNet downloaded');

        // 3. Save to indexeddb
        try {
          await model.save('indexeddb://yamnet-model');
          console.log('YAMNet saved to cache');
        } catch (e) {
          console.warn('Failed to save model to cache', e);
        }

        setState(prev => ({ ...prev, isLoading: false }));
        return model;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load model';
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        modelPromiseRef.current = null; // Reset on failure so we can try again
        throw error;
      }
    };

    modelPromiseRef.current = loader();
    return modelPromiseRef.current;
  }, []);

  // Initialize AudioContext once
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    return () => {
      ctx.close();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Ensure model is loaded (wait for the eager load to finish)
      let model = modelRef.current;
      if (!model) {
        if (modelPromiseRef.current) {
          model = await modelPromiseRef.current;
        } else {
          model = await loadModel();
        }
      }
      if (!model) throw new Error('Model failed to load');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2
        }
      });
      streamRef.current = stream;

      const audioContext = audioContextRef.current!;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Use deprecated ScriptProcessor for wide compatibility (AudioWorklet is better but more complex setup)
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      let audioRollingBuffer = new Float32Array(YAMNET_INPUT_SIZE);
      let samplesCaptured = 0;

      processor.onaudioprocess = (e) => {
        // ... (Keep existing processing logic) ...
        const inputData = e.inputBuffer.getChannelData(0);

        // 1. Calculate Volume (RMS) -> Distance Proxy
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const volume = Math.sqrt(sum / inputData.length);

        // Distance Logic: Louder = Closer (0 = Far, 1 = Close)
        // Tune this: 0.01 volume is "far", 0.5 is "close"
        const distance = Math.min(Math.max((volume - 0.01) / 0.3, 0), 1);

        // 2. Calculate Direction (Stereo Panning)
        let direction = 0;
        if (e.inputBuffer.numberOfChannels > 1) {
          const left = e.inputBuffer.getChannelData(0);
          const right = e.inputBuffer.getChannelData(1);

          let leftEnergy = 0;
          let rightEnergy = 0;
          for (let i = 0; i < left.length; i++) leftEnergy += Math.abs(left[i]);
          for (let i = 0; i < right.length; i++) rightEnergy += Math.abs(right[i]);

          // -1 (Left) to 1 (Right)
          if (leftEnergy + rightEnergy > 0.001) {
            direction = (rightEnergy - leftEnergy) / (rightEnergy + leftEnergy);
          }
        } else {
          // Mono fallback: Random drift for UI liveliness or just 0
          // Let's simulate a random drift if sound is present
          if (volume > 0.05) {
            direction = Math.sin(Date.now() / 1000) * 0.5;
          }
        }

        // 3. Downsample
        const downsampledData = downsampleBuffer(inputData, audioContext.sampleRate, YAMNET_SAMPLE_RATE);

        // 4. Buffer logic
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
                // Refined list to reduce false positives (Removed: 'Burst, pop', 'Bang', 'Firecracker')
                const GUNSHOT_RELATED = ['Gunshot, gunfire', 'Cap gun', 'Fusillade', 'Explosion'];
                const CHAINSAW_RELATED = ['Chainsaw']; // Removed generic 'Engine' to avoid car confusion

                // --- NEGATIVE FILTER (Veto List) ---
                // If these are detected, it's likely NOT a gunshot
                const FALSE_POSITIVES = [
                  'Hands', 'Finger snapping', 'Clapping', 'Knock', 'Tap',
                  'Slap, smack', 'Whack, thwack', 'Drum', 'Snare drum', 'Rimshot',
                  'Door', 'Slam', 'Hammer', 'Building', 'Wood', 'Chopping (food)'
                ];

                let gunshotScore = 0;
                let chainsawScore = 0;
                let falsePositiveScore = 0;

                const allResults = [];
                const limit = Math.min(scores.length, YAMNET_CLASSES.length);

                for (let i = 0; i < limit; i++) {
                  const label = YAMNET_CLASSES[i];
                  const score = scores[i];

                  // Use MAX instead of SUM to avoid false positive stacking
                  if (GUNSHOT_RELATED.includes(label)) gunshotScore = Math.max(gunshotScore, score);
                  if (CHAINSAW_RELATED.includes(label)) chainsawScore = Math.max(chainsawScore, score);

                  // Track mimics
                  if (FALSE_POSITIVES.includes(label)) falsePositiveScore = Math.max(falsePositiveScore, score);

                  if (label) {
                    allResults.push({ label, score });
                  }
                }

                // --- VETO LOGIC ---
                // If the sound is more like a Clap than a Gunshot, suppress the Gunshot.
                // Or if there is a detected human percussive sound with significant confidence, assume it's that.
                if (falsePositiveScore > 0.2 && falsePositiveScore >= gunshotScore) {
                  // Strong veto
                  console.log(`Gunshot suppressed by mimic: ${falsePositiveScore} vs ${gunshotScore}`);
                  gunshotScore = 0;
                } else if (falsePositiveScore > 0.5) {
                  // Partial suppression (require very high confidence for gunshot)
                  gunshotScore -= 0.3;
                }

                // Apply Custom Boost target
                if (customGunshotScore > gunshotScore) gunshotScore = customGunshotScore;
                if (customChainsawScore > chainsawScore) chainsawScore = customChainsawScore;

                // Ensure scores don't exceed 1.0
                gunshotScore = Math.min(Math.max(gunshotScore, 0), 1.0);
                chainsawScore = Math.min(Math.max(chainsawScore, 0), 1.0);

                // Log debug info
                if (gunshotScore > 0.1) console.debug(`Gunshot: ${gunshotScore.toFixed(2)}, Mimic: ${falsePositiveScore.toFixed(2)}`);

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
                  distance: distance,
                  direction: direction,
                  error: null
                }));
              }
            });
          } catch (infError) {
            console.error('❌ Inference Error:', infError);
          }
        } else {
          setState(prev => ({ ...prev, volume, distance, direction }));
        }
      };

      analyser.connect(processor);
      processor.connect(audioContext.destination);

      setState(prev => ({ ...prev, isRecording: true, isLoading: false, error: null, results: [] }));
    } catch (error) {
      console.error('Recording error:', error);
      setState(prev => ({ ...prev, isRecording: false, isLoading: false, error: String(error) }));
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
    // Don't close AudioContext, just suspend (if it exists)
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend();
    }
    setState(prev => ({ ...prev, isRecording: false, volume: 0, distance: 0, direction: 0 }));
  }, []);

  return { ...state, startRecording, stopRecording, analyser: analyserRef.current };
};
