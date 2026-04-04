import { useState, useEffect, useRef } from "react";

const TARGET_REPS = 10;

export default function ExerciseSession({ session, profile, onNavigate, onSessionComplete }) {
  const [screen, setScreen] = useState("session"); // session | rest | post
  const [reps, setReps] = useState(0);
  const [restTimer, setRestTimer] = useState(30);
  const [painAfter, setPainAfter] = useState(5);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => {});
    return () => {
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
    };
  }, []);

  const countRep = () => {
    const next = reps + 1;
    setReps(next);
    if (next >= TARGET_REPS) {
      setScreen("rest");
      let t = 30;
      timerRef.current = setInterval(() => {
        t--;
        setRestTimer(t);
        if (t <= 0) { clearInterval(timerRef.current); setScreen("post"); }
      }, 1000);
    }
  };

  const saveSession = async () => {
    setSaving(true);
    try {
      await fetch("http://localhost:8000/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profile.id,
          condition: session.condition,
          phase: session.phase,
          pain_before: session.pain_before,
          pain_after: painAfter,
          exercises: [{ name: session.currentExercise, reps_done: reps, target_reps: TARGET_REPS }],
          notes,
        }),
      });
    } catch (e) { console.error(e); }
    setSaving(false);
    onSessionComplete();
    onNavigate("hub");
  };

  // ── POST SESSION SURVEY ──
  if (screen === "post") return (
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth:480 }}>
        <div className="setup-logo">✅</div>
        <h1 className="setup-title">Session Complete!</h1>
        <div className="setup-form">
          <div className="form-row">
            <label>Pain level now: <strong style={{ color:"#34d399" }}>{painAfter} / 10</strong></label>
            <input type="range" min={1} max={10} value={painAfter}
              onChange={e => setPainAfter(+e.target.value)}
              style={{ width:"100%", marginTop:8 }} />
            <p style={{ fontSize:13, marginTop:6,
              color: painAfter < session.pain_before ? "#34d399" : painAfter > session.pain_before ? "#f87171" : "#94a3b8" }}>
              Before: {session.pain_before}/10 → After: {painAfter}/10
              {painAfter < session.pain_before ? " ▼ Improved" : painAfter > session.pain_before ? " ▲ Increased" : " — No change"}
            </p>
          </div>
          <div className="form-row">
            <label>Any notes? (optional)</label>
            <textarea className="intake-textarea" rows={3}
              placeholder="How did it feel? Any difficulty?"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button className="start-btn" onClick={saveSession} disabled={saving}>
            {saving ? "Saving..." : "Save & Finish →"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── REST TIMER ──
  if (screen === "rest") return (
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth:400, textAlign:"center" }}>
        <div className="setup-logo">⏸️</div>
        <h1 className="setup-title">Rest</h1>
        <p style={{ fontSize:64, fontWeight:700, color:"#a78bfa", margin:"16px 0" }}>{restTimer}s</p>
        <p className="setup-subtitle">Great work! Catch your breath.</p>
      </div>
    </div>
  );

  // ── EXERCISE SESSION ──
  return (
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth:640 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <button
            style={{ border:"none", background:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:0 }}
            onClick={() => onNavigate("physio-list")}>← Exit</button>
          <span style={{ color:"#a78bfa", fontSize:14, fontWeight:600 }}>{session.currentExercise}</span>
          <span style={{ color:"#64748b", fontSize:13 }}>Phase {session.phase}</span>
        </div>

        <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
          {/* Camera feed */}
          <div style={{ flex:1 }}>
            <video ref={videoRef} autoPlay muted playsInline
              style={{ width:"100%", borderRadius:12, background:"#0f172a", minHeight:220 }} />
            <p style={{ textAlign:"center", fontSize:12, color:"#64748b", marginTop:6 }}>
              Live camera · watch your posture
            </p>
          </div>

          {/* Rep counter */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, minWidth:140 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:56, fontWeight:700, color:"#a78bfa", lineHeight:1 }}>{reps}</div>
              <div style={{ fontSize:13, color:"#64748b" }}>/ {TARGET_REPS} reps</div>
            </div>

            <button onClick={countRep}
              style={{
                width:110, height:110, borderRadius:"50%",
                border:"2px solid #a78bfa",
                background:"rgba(167,139,250,0.15)",
                color:"#a78bfa", fontSize:14, cursor:"pointer", fontWeight:600,
                transition:"transform 0.1s"
              }}
              onMouseDown={e => e.currentTarget.style.transform="scale(0.95)"}
              onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
            >
              TAP<br/>each rep
            </button>

            {/* Progress bar */}
            <div style={{ width:"100%", background:"#1e293b", borderRadius:8, height:6 }}>
              <div style={{
                width:`${(reps/TARGET_REPS)*100}%`, height:"100%",
                background:"#a78bfa", borderRadius:8, transition:"width 0.3s"
              }} />
            </div>

            <p style={{ fontSize:11, color:"#64748b", textAlign:"center" }}>
              {TARGET_REPS - reps > 0 ? `${TARGET_REPS - reps} more to go` : "Done!"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}