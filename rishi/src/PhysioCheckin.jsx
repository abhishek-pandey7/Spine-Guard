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
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth: 500 }}>
        <button
          style={{ border:"none", background:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:0, marginBottom:8 }}
          onClick={() => onNavigate("hub")}
        >← Back</button>
        <div className="setup-logo">🏃</div>
        <h1 className="setup-title">Before We Start</h1>
        <div className="setup-form">
          <div className="form-row">
            <label>Pain level right now: <strong style={{ color:"#a78bfa" }}>{pain} / 10</strong></label>
            <input type="range" min={1} max={10} value={pain}
              onChange={e => setPain(+e.target.value)}
              style={{ width:"100%", marginTop:8 }} />
          </div>
          <div className="form-row">
            <label>Your condition <span className="req">*</span></label>
            <select value={condition} onChange={e => setCondition(e.target.value)}>
              <option value="">Select condition...</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Recovery phase</label>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              {[1,2,3].map(p => (
                <button key={p} type="button" onClick={() => setPhase(p)}
                  style={{
                    flex:1, padding:"10px 0", borderRadius:8, border:"1px solid",
                    borderColor: phase===p ? "#a78bfa" : "#334155",
                    background: phase===p ? "rgba(167,139,250,0.15)" : "transparent",
                    color: phase===p ? "#a78bfa" : "#64748b",
                    cursor:"pointer", fontSize:14
                  }}>
                  Phase {p}
                </button>
              ))}
            </div>
          </div>
          <button className="start-btn" onClick={handleStart} style={{ marginTop:16 }}>
            Start Session →
          </button>
        </div>
      </div>
    </div>
  );
}