import { useState } from "react";

const CONDITIONS = [
  "Muscle Strain", "Herniated Disc", "Sciatica",
  "Postural Pain", "Chronic LBP", "Facet Joint", "Spinal Stenosis"
];

export default function PhysioCheckin({ onNavigate, onStart }) {
  const [pain, setPain] = useState(5);
  const [condition, setCondition] = useState("");
  const [phase, setPhase] = useState(1);

  const handleStart = () => {
    if (!condition) { alert("Please select your condition"); return; }
    onStart({ condition, phase, pain_before: pain });
    onNavigate("physio-list");
  };

  return (
    <div style={{ minHeight:"100dvh", background:"var(--bg-page)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-xl)", padding:"32px 32px 28px", width:"100%", maxWidth:500, boxShadow:"var(--shadow-card)" }}>
        <button className="btn-secondary" style={{marginBottom:16}} onClick={() => onNavigate("hub")}>Back</button>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:800, letterSpacing:"-0.5px", marginBottom:20 }}>Before We Start</h1>

        <div style={{ marginBottom:20 }}>
          <label className="form-label">Pain level right now: <strong style={{ color:"var(--accent-purple)" }}>{pain} / 10</strong></label>
          <input type="range" min={1} max={10} value={pain}
            onChange={e => setPain(+e.target.value)}
            style={{ width:"100%", marginTop:8, accentColor:"var(--accent-purple)" }} />
        </div>

        <div className="form-group">
          <label className="form-label">Your condition <span className="req">*</span></label>
          <select className="form-select" value={condition} onChange={e => setCondition(e.target.value)}>
            <option value="">Select condition...</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Recovery phase</label>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            {[1,2,3].map(p => (
              <button key={p} type="button" onClick={() => setPhase(p)}
                style={{
                  flex:1, padding:"10px 0", borderRadius:"var(--radius-md)", border:"1.5px solid",
                  borderColor: phase===p ? "var(--accent-purple)" : "var(--border-soft)",
                  background: phase===p ? "var(--glow-purple)" : "transparent",
                  color: phase===p ? "var(--accent-purple)" : "var(--text-muted)",
                  cursor:"pointer", fontSize:14, fontFamily:"inherit", fontWeight: phase===p ? 700 : 500,
                  transition:"all 0.15s ease"
                }}>
                Phase {p}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleStart} style={{ marginTop:16 }}>
          Start Session
        </button>
      </div>
    </div>
  );
}
