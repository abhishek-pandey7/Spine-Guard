const EXERCISE_MAP = {
  "Muscle Strain":   { 1:["Pelvic Tilt","Cat-Cow","Child's Pose"],            2:["Glute Bridge","Bird Dog","Hip Abduction"],              3:["Dead Bug","Plank","Squat"] },
  "Herniated Disc":  { 1:["Pelvic Tilt","Child's Pose","Hamstring Stretch"],   2:["Glute Bridge","Bird Dog","Nerve Glide"],                3:["Dead Bug","Plank","Squat"] },
  "Sciatica":        { 1:["Pelvic Tilt","Child's Pose","Hamstring Stretch"],   2:["Glute Bridge","Bird Dog","Piriformis Stretch"],         3:["Plank","Lunge"] },
  "Postural Pain":   { 1:["Chin Tuck","Scapular Retraction","McKenzie Press-up"], 2:["Resistance Band Row","Thoracic Extension","Wall Angels"], 3:["Bird Dog","Dead Bug","Plank"] },
  "Chronic LBP":     { 1:["Pelvic Tilt","Glute Bridge","Bird Dog"],            2:["Hip Abduction","Dead Bug","Squat"],                    3:["Plank","Lunge","Walking"] },
  "Facet Joint":     { 1:["Pelvic Tilt","Standing Back Extension"],            2:["Glute Bridge","Bird Dog","Cat-Cow"],                   3:["Plank","Lunge","Squat"] },
  "Spinal Stenosis": { 1:["Pelvic Tilt","Hamstring Stretch","Standing Back Extension"], 2:["Glute Bridge","Piriformis Stretch"],          3:["Plank","Lunge","Walking"] },
};

export default function ExerciseList({ session, onNavigate, onSelectExercise }) {
  const exercises = EXERCISE_MAP[session.condition]?.[session.phase] || [];

  return (
    <div className="setup-bg">
      <div className="setup-card" style={{ maxWidth:500 }}>
        <button
          style={{ border:"none", background:"none", color:"#64748b", cursor:"pointer", fontSize:13, padding:0, marginBottom:8 }}
          onClick={() => onNavigate("physio")}
        >← Back</button>
        <div className="setup-logo">📋</div>
        <h1 className="setup-title">Phase {session.phase} Exercises</h1>
        <p className="setup-subtitle">{session.condition} · {exercises.length} exercises today</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16 }}>
          {exercises.map((ex) => (
            <button key={ex}
              onClick={() => { onSelectExercise(ex); onNavigate("physio-session"); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 16px", borderRadius:10, border:"1px solid #1e293b",
                background:"rgba(167,139,250,0.05)", color:"#e2e8f0",
                cursor:"pointer", fontSize:15, textAlign:"left"
              }}>
              <span>💪 {ex}</span>
              <span style={{ color:"#a78bfa" }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}