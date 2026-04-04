export default function PatientHub({ profile, onNavigate, onLogout, onOpenSettings }) {
  return (
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth: 600, textAlign: "center" }}>
        <div className="setup-header-row">
          <div className="logged-in-user">
            <span className="user-icon">👤</span>
            <div className="user-info">
              <span className="user-name">{profile.full_name}</span>
              <span className="user-role">Patient</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="settings-icon-btn" onClick={onOpenSettings}>⚙</button>
            <button className="logout-mini-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
        <div className="setup-logo">🦴</div>
        <h1 className="setup-title">SpineIQ</h1>
        <p className="setup-subtitle">Welcome back, <strong>{profile.full_name}</strong>. Choose your experience.</p>
        <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => onNavigate("chatbot")} className="mode-card mode-card-purple">
            <span style={{ fontSize: 36 }}>🤖</span>
            <span className="mode-card-title" style={{ color: "#a78bfa" }}>AI Recovery Chat</span>
            <span className="mode-card-desc">Personalised guidance from your AI spine assistant</span>
          </button>
          <button onClick={() => onNavigate("spineviz")} className="mode-card mode-card-blue">
            <span style={{ fontSize: 36 }}>🩻</span>
            <span className="mode-card-title" style={{ color: "#60a5fa" }}>Spine Visualizer</span>
            <span className="mode-card-desc">Upload MRI · AI analysis · 3D spine model</span>
          </button>
          <button onClick={() => onNavigate("physio")} className="mode-card mode-card-green">
            <span style={{ fontSize: 36 }}>🏃</span>
            <span className="mode-card-title" style={{ color: "#34d399" }}>Physiotherapy</span>
            <span className="mode-card-desc">Guided exercise sessions for your recovery phase</span>
          </button>
        </div>
      </div>
    </div>
  );
}