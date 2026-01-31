import { useState, useEffect } from 'react';
import { useTransferLearning } from './useTransferLearning';

interface Manifest {
    gunshots: string[];
}

export const useAutoEnrollment = () => {
    const { enrollPrototypes, isEnrolling, progress, error, prototypes } = useTransferLearning();
    const [isLoadingManifest, setIsLoadingManifest] = useState(true);
    const [autoLoadError, setAutoLoadError] = useState<string | null>(null);
    const [fetchProgress, setFetchProgress] = useState(0);

    useEffect(() => {
        const loadDataset = async () => {
            try {
                setIsLoadingManifest(true);
                // 1. Fetch Manifest
                const response = await fetch('/dataset/manifest.json');
                if (!response.ok) throw new Error('Failed to load dataset manifest.');

                const manifest: Manifest = await response.json();

                // Robustness: Handle if manifest has the "messy" object structure (fallback) or clean strings
                let fileList: string[] = [];
                if (Array.isArray(manifest.gunshots)) {
                    if (typeof manifest.gunshots[0] === 'string') {
                        fileList = manifest.gunshots as string[];
                    } else if (typeof manifest.gunshots[0] === 'object') {
                        // Fallback for the PowerShell object case (just in case)
                        // Fallback for the PowerShell object case (just in case)
                        fileList = (manifest.gunshots as Array<{ Name?: string; value?: string } | string>).map(f => {
                            if (typeof f === 'string') return f;
                            return f.Name || f.value || String(f);
                        });
                    }
                }

                if (fileList.length === 0) {
                    console.log('No gunshots in manifest. Skipping auto-enrollment.');
                    setIsLoadingManifest(false);
                    return;
                }

                // 2. Fetch all files with Batching (Concurrency control)
                const BATCH_SIZE = 10;
                const loadedFiles: File[] = [];

                for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
                    const chunk = fileList.slice(i, i + BATCH_SIZE);
                    const chunkPromises = chunk.map(async (filename) => {
                        // Clean filename if needed (sometimes path enters)
                        const name = filename.split(/[/\\]/).pop();
                        try {
                            const res = await fetch(`/dataset/gunshots/${filename}`);
                            if (!res.ok) return null;
                            const blob = await res.blob();
                            return new File([blob], name || filename, { type: 'audio/wav' });
                        } catch (e) {
                            console.warn(`Failed to fetch ${filename}`, e);
                            return null;
                        }
                    });

                    const chunkFiles = await Promise.all(chunkPromises);
                    loadedFiles.push(...(chunkFiles.filter(f => f !== null) as File[]));

                    // Update progress (0-50% for fetching, 50-100% is enrollment)
                    const currentProgress = Math.round((i / fileList.length) * 50);
                    setFetchProgress(currentProgress);
                }

                if (loadedFiles.length === 0) throw new Error("Could not load any audio files.");

                setFetchProgress(50);

                // 3. Enroll (Sequential internal processing)
                console.log(`Auto-enrolling ${loadedFiles.length} files...`);
                await enrollPrototypes({
                    gunshots: loadedFiles,
                    chainsaws: []
                });

            } catch (err) {
                console.error("Auto-enrollment error:", err);
                setAutoLoadError(String(err));
            } finally {
                setIsLoadingManifest(false);
            }
        };

        loadDataset();
    }, [enrollPrototypes]);

    // Combined progress: Fetching (0-50) + Enrollment (scaled to 50-100)
    // enrollPrototypes `progress` goes 0->100. We map it to 50->100.
    const totalProgress = isLoadingManifest
        ? fetchProgress
        : (isEnrolling ? 50 + (progress / 2) : 100);

    return {
        isAutoEnrolling: isEnrolling || isLoadingManifest,
        autoEnrollProgress: Math.min(100, Math.round(totalProgress)),
        autoEnrollError: autoLoadError || error,
        autoPrototypes: prototypes
    };
};

