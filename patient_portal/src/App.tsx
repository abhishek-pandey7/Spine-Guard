import Dashboard from './components/Dashboard';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon" />
          <div>
            <div className="brand-name">SpineGuard AI</div>
            <div className="brand-tagline">Post-Surgical Recovery Intelligence</div>
          </div>
        </div>
        <span className="privacy-badge">On-Device AI · Fully Private</span>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
}