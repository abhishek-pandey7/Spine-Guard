const EXERCISE_MAP = {
  "Muscle Strain":   { 1:["Pelvic Tilt","Cat-Cow","Child's Pose"],            2:["Glute Bridge","Bird Dog","Hip Abduction"],              3:["Dead Bug","Plank","Squat"] },
  "Herniated Disc":  { 1:["Pelvic Tilt","Child's Pose","Hamstring Stretch"],   2:["Glute Bridge","Bird Dog","Nerve Glide"],                3:["Dead Bug","Plank","Squat"] },
  "Sciatica":        { 1:["Pelvic Tilt","Child's Pose","Hamstring Stretch"],   2:["Glute Bridge","Bird Dog","Piriformis Stretch"],         3:["Plank","Lunge"] },
  "Postural Pain":   { 1:["Chin Tuck","Scapular Retraction","McKenzie Press-up"], 2:["Resistance Band Row","Thoracic Extension","Wall Angels"], 3:["Bird Dog","Dead Bug","Plank"] },
  "Chronic LBP":     { 1:["Pelvic Tilt","Glute Bridge","Bird Dog"],            2:["Hip Abduction","Dead Bug","Squat"],                    3:["Plank","Lunge","Walking"] },
  "Facet Joint":     { 1:["Pelvic Tilt","Standing Back Extension"],            2:["Glute Bridge","Bird Dog","Cat-Cow"],                   3:["Plank","Lunge","Squat"] },
  "Spinal Stenosis": { 1:["Pelvic Tilt","Hamstring Stretch","Standing Back Extension"], 2:["Glute Bridge","Piriformis Stretch"],          3:["Plank","Lunge","Walking"] },
};

function IconArrow({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function ExerciseList({ session, onNavigate, onSelectExercise }) {
  const exercises = EXERCISE_MAP[session.condition]?.[session.phase] || [];

  return (
    <div style={{ minHeight:"100dvh", background:"var(--bg-page)", padding:"24px 32px" }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        <button className="btn-secondary" style={{marginBottom:20}} onClick={() => onNavigate("physio")}>Back</button>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:800, letterSpacing:"-0.5px", marginBottom:4 }}>
          Phase {session.phase} Exercises
        </h1>
        <p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:24 }}>
          {session.condition} · {exercises.length} exercises today
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {exercises.map((ex) => (
            <button key={ex}
              onClick={() => { onSelectExercise(ex); onNavigate("physio-session"); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"16px 20px", borderRadius:"var(--radius-lg)", border:"1px solid var(--border-soft)",
                background:"var(--bg-surface)", color:"var(--text-primary)",
                cursor:"pointer", fontSize:15, fontFamily:"inherit", textAlign:"left",
                transition:"all 0.2s ease", fontWeight:500,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent-emerald)"; e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="var(--shadow-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border-soft)"; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}
            >
              <span>{ex}</span>
              <IconArrow style={{width:18,height:18,color:"var(--accent-emerald)",opacity:0.6}} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
