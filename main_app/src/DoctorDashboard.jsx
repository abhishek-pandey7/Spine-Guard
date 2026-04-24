import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* ── Inject responsive CSS once ──────────────────────────── */
const responsiveCSS = `
  .dd-root { display:flex; height:100vh; background:var(--bg-page); color:var(--text-primary); font-family:var(--font-body); overflow:hidden; }

  .dd-hamburger {
    display: none;
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 1100;
    background: var(--bg-surface);
    border: 1px solid var(--border-soft);
    border-radius: 10px;
    width: 42px;
    height: 42px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 5px;
    padding: 0;
  }
  .dd-hamburger span {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-secondary);
    border-radius: 2px;
    transition: all 0.25s;
  }

  .dd-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 1050;
    backdrop-filter: blur(2px);
  }

  .dd-sidebar {
    width: 270px;
    min-width: 270px;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-soft);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    z-index: 1060;
    flex-shrink: 0;
  }

  .dd-main { flex:1; overflow-y:auto; padding:36px; }

  .dd-analytics-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }

  .dd-vitals-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }

  .dd-pat-header { display:flex; align-items:center; gap:20px; margin-bottom:32px; }

  @media (max-width: 768px) {
    .dd-hamburger { display: flex; }
    .dd-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      transform: translateX(-100%);
    }
    .dd-sidebar.open { transform: translateX(0); }
    .dd-overlay.open { display: block; }
    .dd-main {
      padding: 70px 16px 24px;
      width: 100%;
    }
    .dd-analytics-grid { grid-template-columns: 1fr; }
    .dd-vitals-grid { grid-template-columns: repeat(2,1fr); }
    .dd-pat-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    .dd-bmi-bar svg { width: 100% !important; min-width: unset !important; }
  }

  @media (max-width: 420px) {
    .dd-vitals-grid { grid-template-columns: 1fr; }
    .dd-main { padding: 64px 12px 20px; }
  }
`;

function useInjectCSS(css) {
  useEffect(() => {
    const id = "dd-responsive-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = css;
      document.head.appendChild(el);
    }
    return () => { /* keep alive for session */ };
  }, []);
}

/* ── SVG Icons ── */
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

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconLogout({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const bmiLabel = (b) => !b ? "—" : b<18.5?"Underweight":b<25?"Normal":b<30?"Overweight":"Obese";
const bmiColor = (b) => !b?"var(--text-muted)":b<18.5?"var(--accent-blue)":b<25?"var(--accent-emerald)":b<30?"var(--accent-amber)":"var(--accent-red)";

/* ── Shared style tokens ── */
const S = {
  sideHeader: { padding:"20px 20px 16px", borderBottom:"1px solid var(--border-soft)" },
  brand: { fontSize:16, fontWeight:800, color:"var(--text-primary)", fontFamily:"var(--font-display)", letterSpacing:"-0.3px" },
  sub: { fontSize:10, color:"var(--text-muted)", marginTop:2, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px" },
  docCard: { padding:"14px 20px", borderBottom:"1px solid var(--border-soft)" },
  avatar: (size=36) => ({ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent-blue),var(--accent-emerald))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, color:"#fff", flexShrink:0 }),
  docName: { fontSize:14, fontWeight:600, marginTop:8, color:"var(--text-primary)" },
  docSub: { fontSize:12, color:"var(--text-secondary)", marginTop:2 },
  sectionLabel: { padding:"12px 20px 6px", fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)" },
  list: { flex:1, overflowY:"auto", padding:"4px 8px" },
  pBtn: (active) => ({ width:"100%", textAlign:"left", padding:"10px 12px", borderRadius:"var(--radius-md)", border:`1px solid ${active?"var(--accent-blue)":"transparent"}`, background:active?"var(--glow-blue)":"none", color:active?"var(--accent-blue)":"var(--text-secondary)", cursor:"pointer", marginBottom:2, display:"flex", alignItems:"center", gap:10, fontSize:13, fontFamily:"inherit", transition:"all 0.15s" }),
  pName: { fontWeight:600, fontSize:13 },
  pMeta: { fontSize:11, color:"var(--text-muted)" },
  logoutBtn: { margin:12, padding:10, background:"none", border:"1px solid rgba(239,68,68,0.15)", color:"var(--accent-red)", borderRadius:"var(--radius-md)", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.15s" },
  empty: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12 },
};

function Section({ title, children }) {
  return (
    <div style={{ background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.8, color:"var(--accent-blue)", marginBottom:18 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div style={{ gridColumn: span ? `1 / -1` : undefined }}>
      <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:5, letterSpacing:0.4 }}>{label}</div>
      <div style={{ fontSize:14, color: value ? "var(--text-primary)" : "var(--text-muted)", lineHeight:1.65 }}>{value || "Not provided"}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CHARTS (pure SVG, zero deps)
══════════════════════════════════════════════════════════ */

function BmiBarChart({ patients }) {
  const cats = { Underweight:0, Normal:0, Overweight:0, Obese:0 };
  patients.forEach(p => { if (p.bmi) cats[bmiLabel(p.bmi)]++; });
  const colors = { Underweight:"var(--accent-blue)", Normal:"var(--accent-emerald)", Overweight:"var(--accent-amber)", Obese:"var(--accent-red)" };
  const max = Math.max(...Object.values(cats), 1);
  const W = 260, H = 24;
  return (
    <div>
      {Object.entries(cats).map(([cat, count]) => (
        <div key={cat} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }} className="dd-bmi-bar">
          <div style={{ width:90, fontSize:12, color:"var(--text-muted)", textAlign:"right", flexShrink:0 }}>{cat}</div>
          <svg width={W} height={H} style={{ flex:1, minWidth:0 }}>
                <rect x={0} y={0} width="100%" height={H} rx={5} fill="var(--bg-elevated)" />
                <rect x={0} y={0} width={Math.max((count/max)*W, count>0?6:0)} height={H} rx={5} fill={colors[cat]} opacity={0.85} style={{ transition:"width 0.6s ease" }} />
          </svg>
          <div style={{ fontSize:12, color:"var(--text-secondary)", width:18, flexShrink:0 }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

function GenderDonut({ patients }) {
  const counts = {};
  patients.forEach(p => { if (p.gender) counts[p.gender] = (counts[p.gender]||0)+1; });
  const colors = { Male:"var(--accent-blue)", Female:"var(--accent-emerald)", "Non-binary":"var(--accent-amber)", "Prefer not to say":"var(--text-muted)" };
  const total = patients.length || 1;
  const R = 52, r = 30, cx = 70, cy = 70;
  let angle = -Math.PI / 2;
  const slices = Object.entries(counts).map(([label, n]) => {
    const pct = n / total;
    const a1 = angle, a2 = angle + pct * 2 * Math.PI;
    angle = a2;
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    const large = pct > 0.5 ? 1 : 0;
    return { label, n, pct, path:`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`, color: colors[label] || "var(--accent-purple)" };
  });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
      <svg width={140} height={140} style={{ flexShrink:0 }}>
        {slices.length ? slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />) : <circle cx={cx} cy={cy} r={R} fill="var(--bg-elevated)" />}
        <circle cx={cx} cy={cy} r={r} fill="var(--bg-surface)" />
        <text x={cx} y={cy+5} textAnchor="middle" fill="var(--text-primary)" fontSize={14} fontWeight="700">{patients.length}</text>
        <text x={cx} y={cy+20} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>patients</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:100 }}>
        {slices.map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
            <span style={{ color:"var(--text-secondary)", flex:1 }}>{s.label}</span>
            <span style={{ color:"var(--text-primary)", fontWeight:600 }}>{s.n}</span>
          </div>
        ))}
        {slices.length === 0 && <span style={{ fontSize:12, color:"var(--text-muted)" }}>No data yet</span>}
      </div>
    </div>
  );
}

function AgeHistogram({ patients }) {
  const buckets = {};
  patients.forEach(p => {
    if (!p.age) return;
    const b = `${Math.floor(p.age/10)*10}s`;
    buckets[b] = (buckets[b]||0)+1;
  });
  const sorted = Object.entries(buckets).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
  const max = Math.max(...sorted.map(([,n])=>n), 1);
  const BW = 32, GAP = 8, H = 80;
  const totalW = sorted.length * (BW + GAP);
  return sorted.length === 0
    ? <div style={{ fontSize:13, color:"var(--text-muted)" }}>No age data yet</div>
    : (
      <div style={{ overflowX:"auto" }}>
        <svg width={Math.max(totalW, 200)} height={H + 30} style={{ overflow:"visible" }}>
          {sorted.map(([label, n], i) => {
            const bh = (n/max) * H;
            const x = i*(BW+GAP);
            return (
              <g key={label} transform={`translate(${x},0)`}>
                <rect x={0} y={H-bh} width={BW} height={bh} rx={4} fill="var(--accent-blue)" opacity={0.85} />
                <text x={BW/2} y={H-bh-4} textAnchor="middle" fill="var(--accent-blue)" fontSize={11} fontWeight="600">{n}</text>
                <text x={BW/2} y={H+14} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>{label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
}

function RedFlagChart({ patients }) {
  const RED_FLAGS = ["Weakness in arms or legs", "Bladder or bowel trouble", "Unexplained weight loss or fever"];
  const counts = {};
  RED_FLAGS.forEach(f => { counts[f] = 0; });
  patients.forEach(p => {
    if (!Array.isArray(p.red_flags)) return;
    p.red_flags.filter(f => f !== "None").forEach(f => { counts[f] = (counts[f]||0)+1; });
  });
  const total = patients.length || 1;
  return (
    <div>
      {RED_FLAGS.map(flag => {
        const n = counts[flag] || 0;
        const pct = n / total;
        return (
          <div key={flag} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>
              <span>{flag}</span>
              <span style={{ color:"var(--accent-red)", fontWeight:600 }}>{n} <span style={{ color:"var(--text-muted)", fontWeight:400 }}>/ {patients.length}</span></span>
            </div>
            <div style={{ height:8, borderRadius:4, background:"var(--bg-elevated)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:4, background:"var(--accent-red)", transition:"width 0.5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomIssuesCount({ patients }) {
  const withIssues = patients.filter(p => p.custom_issues && p.custom_issues.trim().length > 0);
  const pct = patients.length ? Math.round((withIssues.length / patients.length) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"var(--accent-blue)" }}>{withIssues.length}</div>
        <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>of {patients.length} reported</div>
      </div>
      <div style={{ flex:1, minWidth:120 }}>
        <div style={{ height:10, borderRadius:5, background:"var(--bg-elevated)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, borderRadius:5, background:"var(--accent-blue)", transition:"width 0.5s ease" }} />
        </div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:6 }}>{pct}% of patients added custom concerns</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Analytics Panel
══════════════════════════════════════════════════════════ */
function AnalyticsPanel({ patients }) {
  return (
    <div style={{ maxWidth:860 }}>
      <div style={{ fontSize:22, fontWeight:800, marginBottom:6, color:"var(--text-primary)", fontFamily:"var(--font-display)", letterSpacing:"-0.5px" }}>Patient Analytics</div>
      <div style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:28 }}>Aggregated overview across {patients.length} patient{patients.length!==1?"s":""}</div>

      <div className="dd-analytics-grid">
        <Section title="GENDER BREAKDOWN">
          <GenderDonut patients={patients} />
        </Section>
        <Section title="AGE DISTRIBUTION">
          <AgeHistogram patients={patients} />
        </Section>
      </div>

      <Section title="BMI CATEGORIES">
        <BmiBarChart patients={patients} />
      </Section>

      <Section title="RED FLAG PREVALENCE">
        <RedFlagChart patients={patients} />
      </Section>

      <Section title="CUSTOM ISSUES REPORTING">
        <CustomIssuesCount patients={patients} />
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Patient Detail
══════════════════════════════════════════════════════════ */
function PatientDetail({ p }) {
  const flags = Array.isArray(p.red_flags) ? p.red_flags : [];
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:8001/sessions/${p.id}`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [p.id]);
  return (
    <div style={{ maxWidth:860 }}>
      <div className="dd-pat-header">
        <div style={{ ...S.avatar(60), fontSize:24 }}>{p.full_name?.[0]?.toUpperCase()??"P"}</div>
        <div>
          <div style={{ fontSize:26, fontWeight:800, fontFamily:"var(--font-display)", letterSpacing:"-0.5px" }}>{p.full_name}</div>
          <div style={{ fontSize:14, color:"var(--text-secondary)", marginTop:4 }}>
            {[p.age&&`${p.age} yrs`, p.gender, p.phone].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <Section title="VITALS">
        <div className="dd-vitals-grid">
          <Field label="Age" value={p.age ? `${p.age} years` : null} />
          <Field label="Gender" value={p.gender} />
          <Field label="Height" value={p.height ? `${p.height} cm` : null} />
          <Field label="Weight" value={p.weight ? `${p.weight} kg` : null} />
          <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>BMI</div>
            <div style={{ fontSize:22, fontWeight:700, color: bmiColor(p.bmi) }}>{p.bmi ?? "—"}</div>
            {p.bmi && <span style={{ background:"var(--bg-elevated)", border:"1px solid var(--border-soft)", borderRadius:6, padding:"3px 10px", fontSize:12, color: bmiColor(p.bmi), fontWeight:600 }}>{bmiLabel(p.bmi)}</span>}
          </div>
        </div>
      </Section>

      <Section title="CLINICAL PRESENTATION">
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:20 }}>
          <Field label="Chief Complaint / Location" value={p.chief_complaint} />
          <Field label="History of Present Illness (HOPI)" value={p.hopi} span />
        </div>
      </Section>

      <Section title="RED FLAGS">
        {flags.length === 0 || flags[0] === "None" ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, color:"var(--accent-emerald)", fontSize:14 }}>
            <IconCheck style={{ width:18, height:18 }} /><span>No red flags reported</span>
          </div>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {flags.filter(f=>f!=="None").map(f => (
              <span key={f} style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.15)", color:"var(--accent-red)", borderRadius:8, padding:"6px 14px", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
                <IconAlert style={{ width:14, height:14 }} />{f}
              </span>
            ))}
          </div>
        )}
        {p.custom_issues && (
          <div style={{ marginTop:16, padding:"14px 16px", background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:10 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, color:"var(--accent-amber)", marginBottom:8 }}>ADDITIONAL PATIENT-REPORTED ISSUES</div>
            <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.7 }}>{p.custom_issues}</div>
          </div>
        )}
      </Section>

      <Section title="MEDICAL HISTORY">
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:20 }}>
          <Field label="Scans / Investigations Done" value={p.scans_done} span />
          <Field label="Treatments Tried" value={p.treatments_history} span />
          {p.scan_url && (() => {
            const isImage = /\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i.test(p.scan_url);
            return (
              <div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:10, letterSpacing:0.4 }}>UPLOADED SCAN / REPORT</div>
                {isImage ? (
                  <div>
                    <img
                      src={p.scan_url}
                      alt="Patient scan"
                      style={{
                        maxWidth:"100%", maxHeight:380, borderRadius:12,
                        border:"1px solid var(--border-soft)",
                        boxShadow:"var(--shadow-card)",
                        display:"block", marginBottom:10, objectFit:"contain",
                        background:"var(--bg-elevated)"
                      }}
                    />
                    <a href={p.scan_url} target="_blank" rel="noopener noreferrer"
                      style={{ color:"var(--accent-blue)", fontSize:12, display:"inline-flex", alignItems:"center", gap:6, textDecoration:"none", border:"1px solid var(--border-soft)", borderRadius:7, padding:"6px 12px", background:"var(--bg-elevated)" }}>
                      Open full size
                    </a>
                  </div>
                ) : (
                  <a href={p.scan_url} target="_blank" rel="noopener noreferrer"
                    style={{ color:"var(--accent-blue)", fontSize:13, display:"inline-flex", alignItems:"center", gap:6, textDecoration:"none", border:"1px solid var(--border-soft)", borderRadius:8, padding:"8px 14px", background:"var(--bg-elevated)" }}>
                    Open Scan / Report
                  </a>
                )}
              </div>
            );
          })()}
        </div>
      </Section>
      <Section title="PHYSIOTHERAPY PROGRESS">
        {sessions.length === 0 ? (
          <div style={{ color:"var(--text-muted)", fontSize:13 }}>No sessions recorded yet.</div>
        ) : (
          <>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", letterSpacing:1, marginBottom:10 }}>PAIN SCORE TREND</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
                {sessions.slice().reverse().map((s, i) => {
                  const maxPain = 10;
                  const beforeH = Math.round((s.pain_before / maxPain) * 70);
                  const afterH = Math.round((s.pain_after / maxPain) * 70);
                  return (
                    <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flex:1, minWidth:28 }}>
                      <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:70 }}>
                        <div title={`Before: ${s.pain_before}`} style={{ width:10, height:beforeH, background:"rgba(239,68,68,0.5)", borderRadius:"3px 3px 0 0" }} />
                        <div title={`After: ${s.pain_after}`} style={{ width:10, height:afterH, background:"var(--accent-emerald)", opacity:0.7, borderRadius:"3px 3px 0 0" }} />
                      </div>
                      <div style={{ fontSize:9, color:"var(--text-muted)" }}>S{i+1}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:16, marginTop:8 }}>
                <span style={{ fontSize:11, color:"var(--accent-red)" }}>■ Before</span>
                <span style={{ fontSize:11, color:"var(--accent-emerald)" }}>■ After</span>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {sessions.map((s, i) => (
                <div key={i} style={{ padding:"14px 16px", background:"var(--bg-surface)", border:"1px solid var(--border-soft)", borderRadius:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{s.condition} · Phase {s.phase}</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:13, color:"var(--text-secondary)", flexWrap:"wrap", marginBottom:6 }}>
                    <span>Pain: <strong style={{ color: s.pain_after < s.pain_before ? "var(--accent-emerald)" : "var(--accent-red)" }}>{s.pain_before} → {s.pain_after}</strong></span>
                    {s.total_reps > 0 && <span>Reps: <strong>{s.total_reps}</strong></span>}
                    {s.compliance_score > 0 && <span>Compliance: <strong>{s.compliance_score}%</strong></span>}
                    {s.grade && <span>Grade: <strong style={{ color:"var(--accent-emerald)" }}>{s.grade}</strong></span>}
                    {s.difficulty && <span>Difficulty: <strong>{s.difficulty}</strong></span>}

                  </div>
                  {s.notes && (
                    <div style={{ fontSize:12, color:"#8a9e9f", fontStyle:"italic", marginTop:4 }}>
                      "{s.notes}"
                    </div>
                  )}
                  {s.red_flags && Object.values(s.red_flags).some(Boolean) && (
                    <div style={{ marginTop:6, padding:"6px 10px", background:"rgba(192,57,43,0.08)", borderRadius:6, fontSize:12, color:"#c0392b" }}>
                      ⚠ Red flags reported
                    </div>
                  )}
                  {Array.isArray(s.exercises) && s.exercises.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
                      {s.exercises.map((ex, j) => (
                        <span key={j} style={{ fontSize:11, padding:"3px 8px", background:"rgba(30,125,140,0.08)", borderRadius:12, color:"#1e7d8c" }}>
                          {ex.name}: {ex.reps_done} reps
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      </div>
  );
}

export default function DoctorDashboard({ profile, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useInjectCSS(responsiveCSS);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("assigned_doctor_id", profile.id).eq("role", "user")
      .then(({ data }) => { setPatients(data || []); setLoading(false); });
  }, [profile.id]);

  const closeSidebar = () => setSidebarOpen(false);
  const handleSelect = (val) => { setSelected(val); closeSidebar(); };

  return (
    <div className="dd-root">
      <button
        className="dd-hamburger"
        onClick={() => setSidebarOpen(v => !v)}
        aria-label="Toggle navigation"
      >
        <span style={{ transform: sidebarOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
        <span style={{ opacity: sidebarOpen ? 0 : 1 }} />
        <span style={{ transform: sidebarOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
      </button>

      <div className={`dd-overlay ${sidebarOpen ? "open" : ""}`} onClick={closeSidebar} />

      <aside className={`dd-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={S.sideHeader}>
          <div style={S.brand}>SpineIQ</div>
          <div style={S.sub}>Doctor Portal</div>
        </div>
        <div style={S.docCard}>
          <div style={S.avatar(36)}>{profile.full_name?.[0]?.toUpperCase()??"D"}</div>
          <div style={S.docName}>Dr. {profile.full_name}</div>
          <div style={S.docSub}>{profile.degree}{profile.hospital ? ` · ${profile.hospital}` : ""}</div>
        </div>

        <div style={{ padding:"8px 8px 0" }}>
          <button style={S.pBtn(selected === null)} onClick={() => handleSelect(null)}>
            <IconChart style={{ width:16, height:16, flexShrink:0 }} />
            <div>
              <div style={S.pName}>Analytics Overview</div>
              <div style={S.pMeta}>Charts & summaries</div>
            </div>
          </button>
        </div>

        <div style={S.sectionLabel}>PATIENTS ({patients.length})</div>
        <div style={S.list}>
          {loading ? <div style={{ padding:16, color:"var(--text-muted)", fontSize:13 }}>Loading...</div>
            : patients.length === 0 ? <div style={{ padding:16, color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>No patients yet</div>
            : patients.map(p => (
              <button key={p.id} style={S.pBtn(selected?.id === p.id)} onClick={() => handleSelect(p)}>
                <div style={S.avatar(28)}>{p.full_name?.[0]?.toUpperCase()??"P"}</div>
                <div>
                  <div style={S.pName}>{p.full_name}</div>
                  <div style={S.pMeta}>{[p.age&&`${p.age}y`, p.gender].filter(Boolean).join(" · ") || "—"}</div>
                </div>
              </button>
            ))
          }
        </div>
        <button style={S.logoutBtn} onClick={onLogout}>
          <IconLogout style={{ width:14, height:14 }} />
          Logout
        </button>
      </aside>

      <main className="dd-main">
        {selected === null
          ? (patients.length === 0 && !loading
              ? <div style={S.empty}>
                  <IconUsers style={{ width:48, height:48, color:"var(--text-muted)", opacity:0.3 }} />
                  <div style={{ fontSize:20, color:"var(--text-secondary)" }}>No patients yet</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)" }}>Patients who choose you will appear here</div>
                </div>
              : <AnalyticsPanel patients={patients} />)
          : <PatientDetail p={selected} />}
      </main>
    </div>
  );
}
