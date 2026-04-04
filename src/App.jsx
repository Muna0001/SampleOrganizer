import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import SampleList from './components/SampleList';
import InstrumentPanel from './components/InstrumentPanel';
import Player from './components/Player';
import SamplerEngine from './audio/SamplerEngine';

const SAMPLE_DIR = '/Users/natemueller/Music';

function App() {
  const [samples, setSamples] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    types: [],
    genres: [],
    favoritesOnly: false,
    bpmMin: null,
    bpmMax: null,
  });
  const [currentSample, setCurrentSample] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ processed: 0, total: 0 });
  const debounceRef = useRef(null);

  // Instrument state
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [instrumentTab, setInstrumentTab] = useState('keyboard');
  const [keyboardSample, setKeyboardSample] = useState(null);
  const [drumPads, setDrumPads] = useState(Array(9).fill(null));
  const samplerEngineRef = useRef(null);

  // Init sampler engine
  useEffect(() => {
    samplerEngineRef.current = new SamplerEngine();
    return () => samplerEngineRef.current?.dispose();
  }, []);

  // Debounced sample loading when filters change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const result = await window.electronAPI.getSamples(filters);
      setSamples(result);
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [filters]);

  // Load stats on mount
  useEffect(() => {
    window.electronAPI.getStats().then(setStats);
    window.electronAPI.onScanProgress(setScanProgress);
  }, []);

  const handlePlay = (sample) => {
    if (currentSample?.id === sample.id) {
      setCurrentSample(null);
    } else {
      setCurrentSample(sample);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress({ processed: 0, total: 0 });
    await window.electronAPI.scanLibrary(SAMPLE_DIR);
    setIsScanning(false);

    const [result, newStats] = await Promise.all([
      window.electronAPI.getSamples(filters),
      window.electronAPI.getStats(),
    ]);
    setSamples(result);
    setStats(newStats);
  };

  const handleToggleFavorite = async (sample) => {
    const result = await window.electronAPI.toggleFavorite(sample.id);
    // Update the sample in the local list
    setSamples((prev) =>
      prev.map((s) => (s.id === sample.id ? { ...s, favorite: result.favorite } : s))
    );
    // Refresh stats for favorite count
    window.electronAPI.getStats().then(setStats);
  };

  const handleLoadToKeyboard = async (sample) => {
    await samplerEngineRef.current.loadSample(sample.path);
    setKeyboardSample(sample);
    setInstrumentOpen(true);
    setInstrumentTab('keyboard');
  };

  const handleDrumPadClick = async (padIndex) => {
    if (drumPads[padIndex]) {
      samplerEngineRef.current.triggerOneShot(drumPads[padIndex].path);
    } else if (currentSample) {
      await samplerEngineRef.current.loadSample(currentSample.path);
      setDrumPads((prev) => {
        const next = [...prev];
        next[padIndex] = currentSample;
        return next;
      });
    }
  };

  const handleClearPad = (padIndex) => {
    setDrumPads((prev) => {
      const next = [...prev];
      next[padIndex] = null;
      return next;
    });
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Sample Organizer</h1>
        <button className="scan-btn" onClick={handleScan} disabled={isScanning}>
          {isScanning
            ? `Scanning... ${scanProgress.processed} / ${scanProgress.total}`
            : 'Scan Library'}
        </button>
      </div>
      <div className="app-body">
        <Sidebar filters={filters} onFiltersChange={setFilters} stats={stats} />
        <div className="main-content">
          <SampleList
            samples={samples}
            onPlay={handlePlay}
            currentSample={currentSample}
            isPlaying={isPlaying}
            onToggleFavorite={handleToggleFavorite}
            onLoadToKeyboard={handleLoadToKeyboard}
            instrumentOpen={instrumentOpen}
          />
          <InstrumentPanel
            isOpen={instrumentOpen}
            onToggle={() => setInstrumentOpen(!instrumentOpen)}
            activeTab={instrumentTab}
            onTabChange={setInstrumentTab}
            samplerEngine={samplerEngineRef.current}
            keyboardSample={keyboardSample}
            drumPads={drumPads}
            onPadClick={handleDrumPadClick}
            onClearPad={handleClearPad}
          />
        </div>
      </div>
      <Player sample={currentSample} onPlayingChange={setIsPlaying} />
    </div>
  );
}

export default App;
