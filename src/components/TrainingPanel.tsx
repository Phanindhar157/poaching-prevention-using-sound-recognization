import React, { useState, useEffect } from 'react';
import { Upload, X, Fingerprint, Music } from 'lucide-react';
import { useTransferLearning } from '../hooks/useTransferLearning';

interface TrainingPanelProps {
    onClose: () => void;
    onPrototypesEnrolled: (prototypes: { gunshots: number[][], chainsaws: number[][] }) => void;
}

interface Dataset {
    gunshots: File[];
    chainsaws: File[];
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({ onClose, onPrototypesEnrolled }) => {
    const [files, setFiles] = useState<Dataset>({
        gunshots: [],
        chainsaws: []
    });

    const { enrollPrototypes, isEnrolling, progress, error, prototypes } = useTransferLearning();

    useEffect(() => {
        if (prototypes && !isEnrolling) {
            onPrototypesEnrolled(prototypes);
        }
    }, [prototypes, isEnrolling, onPrototypesEnrolled]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, category: keyof Dataset) => {
        if (e.target.files) {
            setFiles(prev => ({
                ...prev,
                [category]: [...prev[category], ...Array.from(e.target.files!)]
            }));
        }
    };

    const removeFile = (category: keyof Dataset, index: number) => {
        setFiles(prev => ({
            ...prev,
            [category]: prev[category].filter((_, i) => i !== index)
        }));
    };

    const startEnrollment = () => {
        enrollPrototypes(files);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative border border-white/20 dark:border-white/10">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="mb-10">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/30">
                            <Fingerprint className="w-8 h-8 text-white" />
                        </div>
                        Enroll Custom Samples
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
                        Teach the AI to recognize specific threats by uploading your own audio clips.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    {/* Gunshot Uploader */}
                    <div className="group bg-red-50/50 dark:bg-red-500/5 p-8 rounded-3xl border-2 border-dashed border-red-200 dark:border-red-500/20 hover:border-red-400 dark:hover:border-red-500/50 transition-all hover:shadow-xl hover:shadow-red-500/5">
                        <h3 className="font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-3 text-xl">
                            <span className="text-2xl">🎯</span> Gunshots
                            <span className="bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm px-3 py-1 rounded-full">{files.gunshots.length}</span>
                        </h3>
                        <p className="text-sm text-red-600/80 dark:text-red-400/70 mb-6">Upload clean recordings of gunshots to improve accuracy.</p>
                        <label className="cursor-pointer bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 font-bold py-3 px-6 rounded-xl shadow-sm border border-red-100 dark:border-red-500/20 flex items-center justify-center gap-3 hover:scale-105 transition-transform">
                            <Upload className="w-5 h-5" />
                            Choose Files
                            <input type="file" multiple accept="audio/*" onChange={(e) => handleFileChange(e, 'gunshots')} className="hidden" />
                        </label>
                    </div>

                    {/* Chainsaw Uploader */}
                    <div className="group bg-orange-50/50 dark:bg-orange-500/5 p-8 rounded-3xl border-2 border-dashed border-orange-200 dark:border-orange-500/20 hover:border-orange-400 dark:hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/5">
                        <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-4 flex items-center gap-3 text-xl">
                            <span className="text-2xl">🪚</span> Chainsaws
                            <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-sm px-3 py-1 rounded-full">{files.chainsaws.length}</span>
                        </h3>
                        <p className="text-sm text-orange-600/80 dark:text-orange-400/70 mb-6 font-medium">(Optional) Add engine sounds.</p>
                        <label className="cursor-pointer bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 font-bold py-3 px-6 rounded-xl shadow-sm border border-orange-100 dark:border-orange-500/20 flex items-center justify-center gap-3 hover:scale-105 transition-transform">
                            <Upload className="w-5 h-5" />
                            Choose Files
                            <input type="file" multiple accept="audio/*" onChange={(e) => handleFileChange(e, 'chainsaws')} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* File Preview */}
                {(files.gunshots.length > 0 || files.chainsaws.length > 0) && (
                    <div className="mb-10 p-6 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                        <h4 className="font-bold text-sm text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Selected Audio Files:</h4>
                        <div className="flex flex-wrap gap-3">
                            {[...files.gunshots].map((f, i) => (
                                <span key={`g-${i}`} className="inline-flex items-center gap-2 bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 font-medium text-sm px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20 shadow-sm">
                                    <Music className="w-3 h-3" /> {f.name}
                                    <button onClick={() => removeFile('gunshots', i)} className="hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md p-0.5 ml-1 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                </span>
                            ))}
                            {[...files.chainsaws].map((f, i) => (
                                <span key={`c-${i}`} className="inline-flex items-center gap-2 bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 font-medium text-sm px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-500/20 shadow-sm">
                                    <Music className="w-3 h-3" /> {f.name}
                                    <button onClick={() => removeFile('chainsaws', i)} className="hover:bg-orange-50 dark:hover:bg-orange-500/20 rounded-md p-0.5 ml-1 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col items-center gap-6">
                    {isEnrolling ? (
                        <div className="w-full max-w-lg">
                            <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                <span>Training Model...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-zinc-700/50 rounded-full h-5 overflow-hidden p-1">
                                <div className="bg-indigo-500 h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }}>
                                    <div className="w-full h-full bg-white/20 animate-[shimmer_1s_infinite]" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <button
                                onClick={startEnrollment}
                                disabled={files.gunshots.length === 0 && files.chainsaws.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:text-slate-500 dark:disabled:text-slate-600 text-white px-16 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:hover:scale-100 disabled:shadow-none"
                            >
                                <Fingerprint className="w-7 h-7" />
                                Start Training
                            </button>
                            {error && <p className="text-red-500 mt-4 font-semibold text-center bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/20">{error}</p>}
                        </div>
                    )}

                    {!isEnrolling && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Privacy Concept: All processing happens locally in your browser.
                        </p>
                    )}
                </div>

            </div>
        </div>
    );
};
