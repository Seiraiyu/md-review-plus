import { useState, useEffect } from 'react';
import { DevModeApp } from './components/DevModeApp';
import { CliModeApp } from './components/CliModeApp';

function App() {
  const [mode, setMode] = useState<'dev' | 'cli' | 'loading'>('loading');

  useEffect(() => {
    const detectMode = async () => {
      try {
        const response = await fetch('/api/files');
        if (response.ok) {
          const data = await response.json();
          setMode(data.mode === 'cli' ? 'cli' : 'dev');
        } else {
          setMode('cli');
        }
      } catch {
        setMode('cli');
      }
    };

    detectMode();
  }, []);

  if (mode === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Initializing...</p>
      </div>
    );
  }

  return mode === 'dev' ? <DevModeApp /> : <CliModeApp />;
}

export default App;
