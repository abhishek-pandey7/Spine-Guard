import React from 'react';
import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🦴</span>
          <div>
            <div className="brand-name">SpineGuard AI</div>
            <div className="brand-tagline">Post-Surgical Recovery</div>
          </div>
        </div>
        <span className="privacy-badge">🔒 On-Device AI</span>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
}