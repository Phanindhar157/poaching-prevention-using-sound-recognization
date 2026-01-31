import React, { useState, useEffect } from 'react';
import { Upload, X, Fingerprint } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative animate-in fade-in zoom-in-95 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Fingerprint className="w-8 h-8 text-indigo-600" />
                        Enroll Custom Samples
                    </h2>
                    <p className="text-slate-600 mt-2">
                        Upload your specific <strong>Gunshot</strong> sounds. The system will memorize them for high-accuracy detection.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Gunshot Uploader */}
                    <div className="bg-red-50 p-6 rounded-xl border-2 border-dashed border-red-200 hover:border-red-400 transition-colors">
                        <h3 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                            🎯 Gunshots
                            <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{files.gunshots.length}</span>
                        </h3>
                        <p className="text-xs text-red-600 mb-4">Upload clean recordings of YOUR gunshots.</p>
                        <label className="cursor-pointer bg-white text-red-600 font-semibold py-2 px-4 rounded-lg shadow-sm border border-red-200 flex items-center justify-center gap-2 hover:bg-red-50">
                            <Upload className="w-4 h-4" />
                            Add Files
                            <input type="file" multiple accept="audio/*" onChange={(e) => handleFileChange(e, 'gunshots')} className="hidden" />
                        </label>
                    </div>

                    {/* Chainsaw Uploader */}
                    <div className="bg-orange-50 p-6 rounded-xl border-2 border-dashed border-orange-200 hover:border-orange-400 transition-colors opacity-80">
                        <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                            🪚 Chainsaws (Optional)
                            <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">{files.chainsaws.length}</span>
                        </h3>
                        <p className="text-xs text-orange-600 mb-4">Upload engine/sawing sounds if needed.</p>
                        <label className="cursor-pointer bg-white text-orange-600 font-semibold py-2 px-4 rounded-lg shadow-sm border border-orange-200 flex items-center justify-center gap-2 hover:bg-orange-50">
                            <Upload className="w-4 h-4" />
                            Add Files
                            <input type="file" multiple accept="audio/*" onChange={(e) => handleFileChange(e, 'chainsaws')} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* File Preview */}
                {(files.gunshots.length > 0 || files.chainsaws.length > 0) && (
                    <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
                        <h4 className="font-semibold text-sm text-slate-500 mb-2">Selected Files:</h4>
                        <div className="flex flex-wrap gap-2">
                            {[...files.gunshots].map((f, i) => (
                                <span key={`g-${i}`} className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded">
                                    {f.name} <button onClick={() => removeFile('gunshots', i)}><X className="w-3 h-3 hover:text-red-900" /></button>
                                </span>
                            ))}
                            {[...files.chainsaws].map((f, i) => (
                                <span key={`c-${i}`} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">
                                    {f.name} <button onClick={() => removeFile('chainsaws', i)}><X className="w-3 h-3 hover:text-orange-900" /></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col items-center gap-4">
                    {isEnrolling ? (
                        <div className="w-full max-w-md">
                            <div className="flex justify-between text-sm text-slate-600 mb-1">
                                <span>Analyzing Audio Features...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                                <div className="bg-indigo-600 h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <button
                                onClick={startEnrollment}
                                disabled={files.gunshots.length === 0 && files.chainsaws.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-12 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <Fingerprint className="w-6 h-6" />
                                Enroll Samples
                            </button>
                            {error && <p className="text-red-600 mt-2 text-sm font-semibold">Error: {error}</p>}
                        </div>
                    )}

                    {!isEnrolling && (
                        <p className="text-xs text-slate-400">
                            Your samples are processed locally. No data is sent to cloud.
                        </p>
                    )}
                </div>

            </div>
        </div>
    );
};
