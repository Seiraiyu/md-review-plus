import { useEffect, useState } from 'react';
import { DevModeApp } from './components/DevModeApp';
import { CliModeApp } from './components/CliModeApp';
import { RemoteModeApp } from './components/RemoteModeApp';
import { ArtifactModeApp } from './components/ArtifactModeApp';

type Mode =
  | { kind: 'loading' }
  | { kind: 'remote'; id: string; key: string }
  | { kind: 'dev' }
  | { kind: 'cli'; contentKind: 'markdown' | 'html' };

function detectRemoteMode(): { id: string; key: string } | null {
  const m = window.location.pathname.match(/^\/r\/([^/]+)\/?$/);
  if (!m) return null;
  const key = window.location.hash.replace(/^#/, '');
  if (!key) return null;
  return { id: m[1], key };
}

function App() {
  const [mode, setMode] = useState<Mode>(() => {
    const remote = detectRemoteMode();
    return remote ? { kind: 'remote', id: remote.id, key: remote.key } : { kind: 'loading' };
  });

  useEffect(() => {
    if (mode.kind !== 'loading') return;
    const detectMode = async () => {
      try {
        const response = await fetch('/api/files');
        if (response.ok) {
          const data = await response.json();
          if (data.mode === 'dev') {
            setMode({ kind: 'dev' });
          } else {
            setMode({
              kind: 'cli',
              contentKind: data.kind === 'html' ? 'html' : 'markdown',
            });
          }
        } else {
          setMode({ kind: 'cli', contentKind: 'markdown' });
        }
      } catch {
        setMode({ kind: 'cli', contentKind: 'markdown' });
      }
    };
    detectMode();
  }, [mode.kind]);

  if (mode.kind === 'loading') {
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
  if (mode.kind === 'remote') {
    return <RemoteModeApp id={mode.id} keyBase64Url={mode.key} />;
  }
  if (mode.kind === 'dev') return <DevModeApp />;
  if (mode.contentKind === 'html') return <ArtifactModeApp />;
  return <CliModeApp />;
}

export default App;
