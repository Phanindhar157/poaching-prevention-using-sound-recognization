import { useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { downsampleBuffer, MODEL_URL, YAMNET_SAMPLE_RATE, YAMNET_INPUT_SIZE } from './useAudioClassifier';

interface Dataset {
    gunshots: File[];
    chainsaws: File[];
}

interface Prototypes {
    gunshots: number[][];
    chainsaws: number[][];
}

export const useTransferLearning = () => {
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [prototypes, setPrototypes] = useState<Prototypes | null>(null);

    // Helper to decode audio file to 16kHz buffer
    const processAudioFile = async (file: File, audioContext: AudioContext): Promise<Float32Array | null> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const inputData = audioBuffer.getChannelData(0); // Mono
            return downsampleBuffer(inputData, audioBuffer.sampleRate, YAMNET_SAMPLE_RATE);
        } catch (e) {
            console.warn(`Failed to process file ${file.name}:`, e);
            return null;
        }
    };

    const enrollPrototypes = useCallback(async (dataset: Dataset) => {
        setIsEnrolling(true);
        setProgress(0);
        setError(null);

        try {
            // 1. Load YAMNet (Optimized: Check Cache First)
            let yamnet: tf.GraphModel;
            try {
                yamnet = await tf.loadGraphModel('indexeddb://yamnet-model');
                console.log('TransferLearning: Loaded from Cache');
            } catch {
                console.log('TransferLearning: Cache miss, downloading...');
                yamnet = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
                // Attempt save for next time
                try { await yamnet.save('indexeddb://yamnet-model'); } catch { }
            }

            // 2. Prepare Data
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const audioContext = new AudioContextClass();
            const gunshotEmbeddings: number[][] = [];
            const chainsawEmbeddings: number[][] = [];

            // Helper to process a category concurrently
            const processCategory = async (files: File[], targetArray: number[][]) => {
                // Process all files in parallel
                const promises = files.map(async (file) => {
                    const waveform = await processAudioFile(file, audioContext);
                    if (!waveform) return;

                    // Extract chunks
                    for (let i = 0; i + YAMNET_INPUT_SIZE <= waveform.length; i += YAMNET_INPUT_SIZE) {
                        const chunk = waveform.subarray(i, i + YAMNET_INPUT_SIZE);

                        tf.tidy(() => {
                            const tensor = tf.tensor1d(chunk, 'float32');
                            const [, embeddings] = yamnet.predict(tensor) as tf.Tensor[];

                            if (embeddings) {
                                const embedData = embeddings.dataSync(); // Float32Array

                                // Shape [N, 1024]
                                const numFrames = embedData.length / 1024;
                                if (numFrames > 1) {
                                    // Average pooling
                                    const avgEmbed = new Float32Array(1024);
                                    for (let f = 0; f < numFrames; f++) {
                                        for (let k = 0; k < 1024; k++) {
                                            avgEmbed[k] += embedData[f * 1024 + k];
                                        }
                                    }
                                    for (let k = 0; k < 1024; k++) avgEmbed[k] /= numFrames;

                                    // L2 Normalize
                                    const norm = Math.sqrt(avgEmbed.reduce((sum, val) => sum + val * val, 0));
                                    if (norm > 0) for (let k = 0; k < 1024; k++) avgEmbed[k] /= norm;

                                    targetArray.push(Array.from(avgEmbed));
                                } else {
                                    const singleEmbed = new Float32Array(embedData);
                                    // L2 Normalize
                                    const norm = Math.sqrt(singleEmbed.reduce((sum, val) => sum + val * val, 0));
                                    if (norm > 0) for (let k = 0; k < 1024; k++) singleEmbed[k] /= norm;

                                    targetArray.push(Array.from(singleEmbed));
                                }
                            }
                        });
                    }
                });

                await Promise.all(promises);
            };

            await processCategory(dataset.gunshots, gunshotEmbeddings);
            setProgress(50);

            await processCategory(dataset.chainsaws, chainsawEmbeddings);
            setProgress(100);

            if (gunshotEmbeddings.length === 0 && chainsawEmbeddings.length === 0) {
                // Even if no features, we shouldn't crash unless NO files were provided.
                // If files provided but no features, maybe silence.
                if (dataset.gunshots.length > 0 || dataset.chainsaws.length > 0) {
                    console.warn("Files provided but no features extracted.");
                }
            }

            const enrolled = {
                gunshots: gunshotEmbeddings,
                chainsaws: chainsawEmbeddings
            };

            yamnet.dispose();
            audioContext.close();

            setPrototypes(enrolled);
            setIsEnrolling(false);
            console.log(`Enrolled ${gunshotEmbeddings.length} gunshots and ${chainsawEmbeddings.length} chainsaws.`);

        } catch (err) {
            console.error(err);
            setError(String(err));
            setIsEnrolling(false);
        }
    }, []);

    return {
        enrollPrototypes,
        isEnrolling,
        progress,
        error,
        prototypes
    };
};
