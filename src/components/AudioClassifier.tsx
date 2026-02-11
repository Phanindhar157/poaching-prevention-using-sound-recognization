import { Mic, MicOff, Loader, AlertTriangle, Activity, CheckCircle, Fingerprint, Waves } from 'lucide-react';
import { useAudioClassifier } from '../hooks/useAudioClassifier';
import { useState, useEffect, useRef } from 'react';
import { TrainingPanel } from './TrainingPanel';
import { useAutoEnrollment } from '../hooks/useAutoEnrollment';
import { Spectrogram } from './Spectrogram';
import { HistoryPanel, HistoryEntry } from './HistoryPanel';
import { useGeolocation } from '../hooks/useGeolocation';
import { Radar } from './Radar';

interface Prototypes {
  gunshots: number[][];
  chainsaws: number[][];
}

export const AudioClassifier = () => {
  // 1. Auto-Enrollment Hook (Runs on mount)
  const { isAutoEnrolling, autoEnrollProgress, autoEnrollError, autoPrototypes } = useAutoEnrollment();
  const location = useGeolocation();

  // 2. State
  const [prototypes, setPrototypes] = useState<Prototypes | null>(null);
  const { isRecording, isLoading, error, results, startRecording, stopRecording, volume, analyser, distance, direction } = useAudioClassifier(prototypes);

  const [sensitivity, setSensitivity] = useState(0.3);
  const [showTraining, setShowTraining] = useState(false);

  // History State (Persisted)
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('incident_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Debounce Ref
  const lastLogTimeRef = useRef<number>(0);

  // 3. Sync Auto-Enrollment to State
  useEffect(() => {
    if (autoPrototypes) {
      setPrototypes(autoPrototypes);
    }
  }, [autoPrototypes]);

  // Save History to LocalStorage
  useEffect(() => {
    localStorage.setItem('incident_history', JSON.stringify(history));
  }, [history]);

  const threatDetected = results.find(
    r => (r.label.toLowerCase().includes('gunshot') || r.label.toLowerCase().includes('chainsaw')) && r.score > sensitivity
  );

  // Logging Logic
  useEffect(() => {
    if (threatDetected) {
      const now = Date.now();
      // Cooldown: Only log once every 5 seconds to prevent spam
      // User Request: Only log if confidence > 80%
      if (now - lastLogTimeRef.current > 5000 && threatDetected.score > 0.8) {
        lastLogTimeRef.current = now;

        const newEntry: HistoryEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          label: threatDetected.label,
          confidence: threatDetected.score,
          latitude: location.latitude,
          longitude: location.longitude
        };

        setHistory(prev => [newEntry, ...prev]);
      }
    }
  }, [threatDetected, location]);


  const handlePrototypesEnrolled = (enrolled: Prototypes) => {
    setPrototypes(enrolled);
    setShowTraining(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10 pb-20">
      <div className={`w-full max-w-3xl backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 border transition-all duration-500 ${threatDetected
        ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)]'
        : 'bg-white/60 dark:bg-black/40 border-white/40 dark:border-white/10 shadow-xl'
        }`}>

        {/* THREAT ALERT */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${threatDetected ? 'max-h-40 opacity-100 mb-8' : 'max-h-0 opacity-0'}`}>
          <div className="bg-red-500 text-white p-6 rounded-2xl flex items-center justify-center gap-4 animate-pulse shadow-lg shadow-red-500/30">
            <AlertTriangle className="w-10 h-10" />
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-wide">THREAT DETECTED</h2>
              <p className="font-medium text-red-100 text-lg mt-1">
                {threatDetected?.label} ({(threatDetected?.score || 0) * 100}%)
              </p>
            </div>
          </div>
        </div>

        {/* HEADER */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-2xl mb-4">
            <Waves className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
            EcoGuard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-2 text-lg">
            {isAutoEnrolling ? (
              <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full text-sm animate-pulse border border-indigo-200 dark:border-indigo-500/20">
                <Loader className="w-4 h-4 animate-spin" /> Initializing Model... {autoEnrollProgress}%
              </span>
            ) : prototypes ? (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full text-sm font-semibold border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle className="w-4 h-4" /> Custom Prototypes Active
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Powered by YAMNet
              </span>
            )}
            {/* GPS Status Indicator */}
            {location.error ? (
              <span className="text-[10px] text-red-400 ml-2" title={location.error}>GPS OFF</span>
            ) : (
              <span className="text-[10px] text-emerald-500 ml-2 animate-pulse">GPS ON</span>
            )}
          </p>
          {autoEnrollError && <p className="text-xs text-red-500 mt-2">Warning: {autoEnrollError}</p>}
        </div>

        {/* CONTROLS */}
        <div className="mb-8 p-6 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-white/20 flex flex-col gap-6 backdrop-blur-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Sensitivity Threshold</label>
              <span className="text-xs font-bold text-white bg-indigo-500 px-3 py-1 rounded-full shadow-lg shadow-indigo-500/30">
                {(sensitivity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            />
          </div>

          <div className="border-t border-slate-200 dark:border-white/10 pt-4">
            <button
              onClick={() => setShowTraining(true)}
              className="w-full py-3.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group"
            >
              <Fingerprint className="w-5 h-5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              Manage Sound Samples
            </button>
          </div>
        </div>

        {/* RECORD BUTTONS */}
        <div className="flex justify-center gap-6 mb-10">
          <button
            onClick={startRecording}
            disabled={isRecording || isLoading || isAutoEnrolling}
            className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl ${isRecording || isLoading || isAutoEnrolling
              ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-50'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40 dark:shadow-indigo-500/20'
              }`}
          >
            {isLoading || isAutoEnrolling ? (
              <>
                <Loader className="w-6 h-6 animate-spin" />
                {isAutoEnrolling ? 'Enrolling...' : 'Loading AI...'}
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                Start Monitoring
              </>
            )}
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl ${!isRecording
              ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed opacity-50'
              : 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/40'
              }`}
          >
            <MicOff className="w-6 h-6" />
            Stop
          </button>
        </div>

        {/* VISUALIZER - SPECTROGRAM & RADAR */}
        <div className={`transition-all duration-500 overflow-hidden ${isRecording ? 'opacity-100 mb-8' : 'h-0 opacity-0'}`}>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Radar Container */}
            <div className="flex-shrink-0 flex justify-center items-center">
              <Radar
                threats={results.filter(r => r.score > sensitivity && (r.label.toLowerCase().includes('gunshot') || r.label.toLowerCase().includes('chainsaw'))).map(r => ({ ...r, timestamp: Date.now() }))}
                distance={distance}
                direction={direction}
                isRecording={isRecording}
              />
            </div>

            {/* Spectrogram Container */}
            <div className="flex-grow h-64 relative group rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-black/50">
              <Spectrogram analyser={analyser} isRecording={isRecording} />
              <div className="absolute bottom-2 right-2 text-[10px] text-white/50 bg-black/50 px-2 rounded pointer-events-none">
                Real-time FFT Spectrogram
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-600 dark:text-red-400 font-medium text-center">Error: {error}</p>
          </div>
        )}

        {/* RESULTS */}
        <div className="bg-slate-50/50 dark:bg-black/20 rounded-2xl p-6 border border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-5 flex items-center justify-between">
            <span>Live Analysis</span>
            {isRecording && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 px-2 py-1 rounded-md">16kHz ACTIVE</span>}
          </h2>

          {results.length === 0 ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-600">
              <p>Start monitoring to see real-time classification</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => {
                const isThreat = result.label.toLowerCase().includes('gunshot') || result.label.toLowerCase().includes('chainsaw');
                const isHighConfidence = result.score > sensitivity;
                const scorePercent = (result.score * 100);

                return (
                  <div
                    key={index}
                    className={`rounded-xl p-4 border transition-all duration-300 ${isThreat
                      ? (isHighConfidence
                        ? 'bg-red-500/10 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                        : 'bg-red-500/5 border-red-500/10 opacity-70')
                      : 'bg-white/40 dark:bg-white/5 border-white/40 dark:border-white/5'
                      }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className={`font-semibold text-lg tracking-tight ${isThreat ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {result.label}
                      </span>
                      <span className={`font-bold text-xl ${isThreat ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {scorePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 relative ${isThreat
                          ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                          }`}
                        style={{ width: `${scorePercent}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          <p className="tracking-wide uppercase">YAMNet Model v1 • AudioSet • TensorFlow.js</p>
        </div>
      </div>

      <HistoryPanel history={history} onClear={() => setHistory([])} />

      {showTraining && <TrainingPanel onClose={() => setShowTraining(false)} onPrototypesEnrolled={handlePrototypesEnrolled} />}
    </div>
  );
};
