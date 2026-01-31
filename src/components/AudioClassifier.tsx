import { Mic, MicOff, Loader, AlertTriangle, Activity, CheckCircle, Fingerprint } from 'lucide-react';
import { useAudioClassifier } from '../hooks/useAudioClassifier';
import { useState, useEffect } from 'react';
import { TrainingPanel } from './TrainingPanel';
import { useAutoEnrollment } from '../hooks/useAutoEnrollment';

interface Prototypes {
  gunshots: number[][];
  chainsaws: number[][];
}

export const AudioClassifier = () => {
  // 1. Auto-Enrollment Hook (Runs on mount)
  const { isAutoEnrolling, autoEnrollProgress, autoEnrollError, autoPrototypes } = useAutoEnrollment();

  // 2. State
  const [prototypes, setPrototypes] = useState<Prototypes | null>(null);
  const { isRecording, isLoading, error, results, startRecording, stopRecording, volume } = useAudioClassifier(prototypes);
  const [sensitivity, setSensitivity] = useState(0.3);
  const [showTraining, setShowTraining] = useState(false);

  // 3. Sync Auto-Enrollment to State
  useEffect(() => {
    if (autoPrototypes) {
      setPrototypes(autoPrototypes);
    }
  }, [autoPrototypes]);

  const threatDetected = results.find(
    r => (r.label.toLowerCase().includes('gunshot') || r.label.toLowerCase().includes('chainsaw')) && r.score > sensitivity
  );

  const handlePrototypesEnrolled = (enrolled: Prototypes) => {
    setPrototypes(enrolled);
    setShowTraining(false);
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 flex items-center justify-center p-6 ${threatDetected ? 'bg-red-50' : 'bg-gradient-to-br from-slate-50 to-slate-100'
      }`}>
      <div className={`w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border-2 transition-all duration-300 ${threatDetected ? 'border-red-500 shadow-red-200' : 'border-transparent'
        }`}>

        {/* THREAT ALERT */}
        {threatDetected && (
          <div className="mb-6 bg-red-600 text-white p-4 rounded-xl flex items-center justify-center gap-3 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
            <div className="text-center">
              <h2 className="text-2xl font-bold uppercase tracking-wider">Threat Detected</h2>
              <p className="font-medium text-red-100">
                {threatDetected.label} ({(threatDetected.score * 100).toFixed(0)}%)
              </p>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            EcoGuard Audio Monitor
          </h1>
          <p className="text-slate-600 flex items-center justify-center gap-2">
            {isAutoEnrolling ? (
              <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-full text-sm animate-pulse">
                <Loader className="w-4 h-4 animate-spin" /> Initializing Custom Model... {autoEnrollProgress}%
              </span>
            ) : prototypes ? (
              <span className="flex items-center gap-1 text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" /> Custom Prototypes Active
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Activity className="w-4 h-4" />
                Powered by YAMNet (521 Audio Classes)
              </span>
            )}
          </p>
          {autoEnrollError && <p className="text-xs text-red-500 mt-1">Auto-load warning: {autoEnrollError}</p>}
        </div>

        {/* CONTROLS */}
        <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-semibold text-slate-700">Detection Sensitivity</label>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{(sensitivity * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Adjust threshold for alerts.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4 flex gap-2">
            <button
              onClick={() => setShowTraining(true)}
              className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Fingerprint className="w-4 h-4" />
              Manage Samples
            </button>
          </div>
        </div>

        {/* RECORD BUTTONS */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={startRecording}
            disabled={isRecording || isLoading || isAutoEnrolling}
            className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white transition-all transform hover:scale-105 ${isRecording || isLoading || isAutoEnrolling
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'
              }`}
          >
            {isLoading || isAutoEnrolling ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {isAutoEnrolling ? 'Enrolling...' : 'Loading AI...'}
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Monitoring
              </>
            )}
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white transition-all transform hover:scale-105 ${!isRecording
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-slate-600 hover:bg-slate-700 shadow-lg hover:shadow-xl'
              }`}
          >
            <MicOff className="w-5 h-5" />
            Stop
          </button>
        </div>

        {/* VISUALIZER */}
        {isRecording && (
          <div className="mb-6 flex flex-col items-center justify-center gap-2 text-indigo-600">
            <div className="flex items-end gap-1 h-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-indigo-500 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.min(100, Math.max(10, (volume || 0) * 500 * (1 + i / 2)))}%`,
                    opacity: 0.5 + ((volume || 0) * 2)
                  }}
                />
              ))}
            </div>
            <span className="font-semibold text-sm">Listening...</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        {/* RESULTS */}
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Live Analysis</span>
            {isRecording && <span className="text-xs font-normal text-slate-500 px-2 py-1 bg-white rounded-md border">16kHz Sample Rate</span>}
          </h2>

          {results.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>Start monitoring to see real-time classification</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => {
                const isThreat = result.label.toLowerCase().includes('gunshot') || result.label.toLowerCase().includes('chainsaw');
                const isHighConfidence = result.score > sensitivity;

                return (
                  <div
                    key={index}
                    className={`rounded-lg p-4 shadow-sm border transition-all ${isThreat
                      ? (isHighConfidence ? 'bg-red-50 border-red-200 ring-2 ring-red-500' : 'bg-red-50 border-red-100 opacity-75')
                      : 'bg-white border-slate-200'
                      }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`font-semibold text-lg ${isThreat ? 'text-red-700' : 'text-slate-800'}`}>
                        {result.label}
                      </span>
                      <span className={`font-bold text-lg ${isThreat ? 'text-red-600' : 'text-indigo-600'}`}>
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isThreat ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                          }`}
                        style={{ width: `${result.score * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            YAMNet Model v1 (TensorFlow.js) | Trained on AudioSet | Sensitivity: {(sensitivity * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {showTraining && <TrainingPanel onClose={() => setShowTraining(false)} onPrototypesEnrolled={handlePrototypesEnrolled} />}
    </div>
  );
};
