import { useEffect, useState } from 'react';

// Safe access — falls back gracefully in browser dev mode
const winAPI = (window as any).electronAPI?.window;

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!winAPI) return;

    // Get initial state
    winAPI.isMaximized().then(setIsMaximized);

    // Listen for changes from main process
    const cleanup = winAPI.onMaximizeChange(setIsMaximized);
    return cleanup;
  }, []);

  const handleMinimize = () => winAPI?.minimize();
  const handleMaximize = () => {
    winAPI?.maximize();
    // Optimistically toggle — main will correct via event if needed
    setIsMaximized(v => !v);
  };
  const handleClose = () => winAPI?.close();

  return (
    <div className="titlebar" id="titlebar">
      {/* Drag region — left side (empty to keep minimal and not overlap sidebar brand) */}
      <div className="titlebar-drag"></div>

      {/* Window controls — right side, no drag */}
      <div className="titlebar-controls">
        {/* Minimize */}
        <button
          className="titlebar-btn titlebar-btn--minimize"
          onClick={handleMinimize}
          title="Minimize"
          id="titlebar-minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          className="titlebar-btn titlebar-btn--maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          id="titlebar-maximize"
        >
          {isMaximized ? (
            /* Restore icon — two overlapping squares */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                d="M2 0h8v8H8V2H0v2H2V0zM0 4h6v6H0V4z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          ) : (
            /* Maximize icon — single square outline */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0" y="0" width="10" height="10" fill="none"
                stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          className="titlebar-btn titlebar-btn--close"
          onClick={handleClose}
          title="Close"
          id="titlebar-close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
