/**
 * SystemStatus — Tiny status indicator in the sidebar footer.
 *
 * Shows human-friendly status:
 *   🟢 Everything Ready
 *   🟢 Updated 5 min ago
 *   🟡 Offline · Last synced 5 min ago
 *   🟡 Reconnecting...
 *
 * Never shows: ECONNREFUSED, Socket Timeout, HTTP 503
 */

import { useEffect } from 'react';
import { useSyncStatus } from '../stores/useSyncStatus';

export default function SystemStatus() {
  const { status, freshnessLabel, init } = useSyncStatus();

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, []);

  const isOnline = status === 'idle' || status === 'syncing';
  const dotColor = isOnline ? '#4ade80' : '#facc15'; // green or yellow

  let label = '';
  if (status === 'syncing') {
    label = 'Syncing...';
  } else if (status === 'offline') {
    label = `Offline · ${freshnessLabel}`;
  } else if (status === 'error') {
    label = `Reconnecting...`;
  } else {
    label = freshnessLabel === 'Never synced' ? 'Connecting...' : `Updated ${freshnessLabel}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: 500,
        letterSpacing: '0.2px',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: `0 0 6px ${dotColor}40`,
          transition: 'background 0.3s',
        }}
      />
      {label}
    </div>
  );
}
