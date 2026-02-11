import { AudioClassifier } from './components/AudioClassifier';
import { useTheme } from './context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

function App() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative min-h-screen bg-ios-bg-light dark:bg-ios-bg-dark text-ios-text-light dark:text-ios-text-dark transition-colors duration-500 overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg hover:scale-110 active:scale-95 transition-all z-50 group"
      >
        <Sun className="w-6 h-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-yellow-500" />
        <Moon className="absolute top-3 left-3 w-6 h-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-white" />
      </button>

      <AudioClassifier />
    </div>
  );
}

export default App;
