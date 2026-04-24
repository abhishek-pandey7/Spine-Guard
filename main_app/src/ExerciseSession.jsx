import { useState, useEffect, useRef } from "react";

const TARGET_REPS = 10;

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAlert({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconPause({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function IconCamera({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

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
    <div style={{ minHeight:"100dvh", background:"var(--bg-page)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-xl)", padding:"32px 32px 28px", width:"100%", maxWidth:480, boxShadow:"var(--shadow-card)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--glow-emerald)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconCheck style={{ width:20, height:20, color:"var(--accent-emerald)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:800, letterSpacing:"-0.3px" }}>Session Complete</h1>
            <p style={{ fontSize:13, color:"var(--text-muted)" }}>Great work — let's wrap up</p>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label className="form-label">Pain level now: <strong style={{ color: painAfter < session.pain_before ? "var(--accent-emerald)" : painAfter > session.pain_before ? "var(--accent-red)" : "var(--text-secondary)" }}>{painAfter} / 10</strong></label>
          <input type="range" min={1} max={10} value={painAfter}
            onChange={e => setPainAfter(+e.target.value)}
            style={{ width:"100%", marginTop:8, accentColor:"var(--accent-purple)" }} />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, padding:"10px 14px", borderRadius:"var(--radius-md)", background: painAfter < session.pain_before ? "var(--glow-emerald)" : painAfter > session.pain_before ? "rgba(239,68,68,0.04)" : "var(--bg-elevated)", border:`1px solid ${painAfter < session.pain_before ? "rgba(16,185,129,0.15)" : painAfter > session.pain_before ? "rgba(239,68,68,0.15)" : "var(--border-soft)"}` }}>
            <span style={{ fontSize:13, color: painAfter < session.pain_before ? "var(--accent-emerald)" : painAfter > session.pain_before ? "var(--accent-red)" : "var(--text-muted)", fontWeight:600 }}>
              Before: {session.pain_before}/10 → After: {painAfter}/10
              {painAfter < session.pain_before ? " — Improved" : painAfter > session.pain_before ? " — Increased" : " — No change"}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Any notes? (optional)</label>
          <textarea className="form-textarea" rows={3}
            placeholder="How did it feel? Any difficulty?"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button className="btn-primary" onClick={saveSession} disabled={saving}>
          {saving ? "Saving..." : "Save & Finish"}
        </button>
      </div>
    </div>
  );

  // ── REST TIMER ──
  if (screen === "rest") return (
    <div style={{ minHeight:"100dvh", background:"var(--bg-page)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-xl)", padding:"40px 32px", width:"100%", maxWidth:400, textAlign:"center", boxShadow:"var(--shadow-card)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:24 }}>
          <IconPause style={{ width:20, height:20, color:"var(--accent-purple)" }} />
          <span style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--text-muted)" }}>Rest Period</span>
        </div>
        <div style={{ fontSize:72, fontWeight:800, color:"var(--accent-purple)", fontFamily:"var(--font-display)", lineHeight:1, marginBottom:12 }}>{restTimer}s</div>
        <p style={{ fontSize:15, color:"var(--text-secondary)", lineHeight:1.6 }}>Great work! Catch your breath.</p>
        <div style={{ height:4, background:"var(--bg-elevated)", borderRadius:2, marginTop:24, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${((30-restTimer)/30)*100}%`, background:"var(--accent-purple)", borderRadius:2, transition:"width 1s linear" }} />
        </div>
      </div>
    </div>
  );

  // ── EXERCISE SESSION ──
  const pctComplete = (reps / TARGET_REPS) * 100;

  return (
    <div style={{ minHeight:"100dvh", background:"var(--bg-page)", padding:"24px 32px" }}>
      <div style={{ maxWidth:800, margin:"0 auto" }}>
        {/* Top bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <button className="btn-secondary" onClick={() => onNavigate("physio-list")}>Exit</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{session.currentExercise}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>Phase {session.phase}</div>
          </div>
          <div style={{ width:80 }} />
        </div>

        {/* Form Guidance Alert */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"16px 20px", borderRadius:"var(--radius-lg)", background:"var(--glow-blue)", border:"1px solid rgba(59,130,246,0.15)", marginBottom:24 }}>
          <IconAlert style={{ width:20, height:20, color:"var(--accent-blue)", flexShrink:0, marginTop:1 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--accent-blue)", marginBottom:4 }}>FORM GUIDANCE</div>
            <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, margin:0 }}>
              Keep your core engaged throughout the movement. Move slowly and with control. Stop if you feel sharp pain.
            </p>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 200px", gap:20, alignItems:"start" }}>
          {/* Camera feed */}
          <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-lg)", overflow:"hidden", boxShadow:"var(--shadow-card)" }}>
            <video ref={videoRef} autoPlay muted playsInline
              style={{ width:"100%", display:"block", minHeight:280, background:"#0f172a" }} />
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderTop:"1px solid var(--border-soft)" }}>
              <IconCamera style={{ width:14, height:14, color:"var(--text-muted)" }} />
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>Live camera · watch your posture</span>
            </div>
          </div>

          {/* Rep counter */}
          <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-lg)", padding:24, textAlign:"center", boxShadow:"var(--shadow-card)" }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--text-muted)", marginBottom:12 }}>Reps</div>
            <div style={{ fontSize:56, fontWeight:800, color:"var(--accent-purple)", fontFamily:"var(--font-display)", lineHeight:1 }}>{reps}</div>
            <div style={{ fontSize:14, color:"var(--text-muted)", marginBottom:20 }}>/ {TARGET_REPS}</div>

            <button onClick={countRep}
              style={{
                width:100, height:100, borderRadius:"50%",
                border:"2px solid var(--accent-purple)",
                background:"var(--glow-purple)",
                color:"var(--accent-purple)", fontSize:13, cursor:"pointer", fontWeight:700, fontFamily:"inherit",
                transition:"transform 0.1s ease, background 0.15s ease"
              }}
              onMouseDown={e => e.currentTarget.style.transform="scale(0.95)"}
              onMouseUp={e => e.currentTarget.style.transform="scale(1)"}
            >
              TAP<br/>EACH REP
            </button>

            {/* Progress bar */}
            <div style={{ width:"100%", background:"var(--bg-elevated)", borderRadius:4, height:6, marginTop:20 }}>
              <div style={{
                width:`${pctComplete}%`, height:"100%",
                background: pctComplete >= 100 ? "var(--accent-emerald)" : "var(--accent-purple)",
                borderRadius:4, transition:"width 0.3s ease, background 0.3s ease"
              }} />
            </div>

            <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:10, marginBottom:0 }}>
              {TARGET_REPS - reps > 0 ? `${TARGET_REPS - reps} more to go` : "Done!"}
            </p>

            {/* Status bar */}
            <div style={{ marginTop:16, padding:"8px 12px", borderRadius:"var(--radius-sm)", background: pctComplete >= 100 ? "var(--glow-emerald)" : "var(--bg-elevated)", border:`1px solid ${pctComplete >= 100 ? "rgba(16,185,129,0.15)" : "var(--border-soft)"}` }}>
              <span style={{ fontSize:11, fontWeight:600, color: pctComplete >= 100 ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                {pctComplete >= 100 ? "COMPLETE" : "IN PROGRESS"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
