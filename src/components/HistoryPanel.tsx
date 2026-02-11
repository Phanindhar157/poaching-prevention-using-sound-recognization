import React from 'react';
import { MapPin, Clock, AlertTriangle, Trash2, Download } from 'lucide-react';

export interface HistoryEntry {
    id: string;
    timestamp: string;
    label: string;
    confidence: number;
    latitude: number | null;
    longitude: number | null;
}

interface HistoryPanelProps {
    history: HistoryEntry[];
    onClear: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear }) => {
    if (history.length === 0) return null;

    const exportCSV = () => {
        const headers = "Timestamp,Label,Confidence,Latitude,Longitude\n";
        const rows = history.map(h =>
            `${h.timestamp},${h.label},${(h.confidence * 100).toFixed(1)}%,${h.latitude || ''},${h.longitude || ''}`
        ).join("\n");

        const blob = new Blob([headers + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `incident_log_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="w-full max-w-3xl mt-8 backdrop-blur-xl bg-white/60 dark:bg-black/40 rounded-[2rem] shadow-xl border border-white/40 dark:border-white/10 p-6 transition-all duration-500">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    Incident History
                    <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full ml-2">
                        {history.length} Events
                    </span>
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={exportCSV}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
                        title="Export CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClear}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full text-red-500 transition-colors"
                        title="Clear History"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {history.map((entry) => (
                    <div
                        key={entry.id}
                        className="group flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 hover:border-indigo-500/30 transition-all hover:translate-x-1"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    {entry.label}
                                    <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-mono">
                                        {(entry.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                    {entry.timestamp}
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            {entry.latitude && entry.longitude ? (
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${entry.latitude},${entry.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md"
                                >
                                    <MapPin className="w-3 h-3" />
                                    Unknown Loc ({entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)})
                                </a>
                            ) : (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Locating...
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
