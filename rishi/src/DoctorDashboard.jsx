import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/* ── Inject responsive CSS once ──────────────────────────── */
const responsiveCSS = `
  .dd-root { display:flex; height:100vh; background:#08090e; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; overflow:hidden; }

  /* Hamburger button – hidden on desktop */
  .dd-hamburger {
    display: none;
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 1100;
    background: rgba(124,58,237,0.18);
    border: 1px solid rgba(124,58,237,0.35);
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
    background: #a78bfa;
    border-radius: 2px;
    transition: all 0.25s;
  }

  /* Overlay backdrop */
  .dd-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1050;
    backdrop-filter: blur(2px);
  }

  /* Sidebar */
  .dd-sidebar {
    width: 270px;
    min-width: 270px;
    background: #0d0e17;
    border-right: 1px solid rgba(139,92,246,0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    z-index: 1060;
    flex-shrink: 0;
  }

  /* Main content area */
  .dd-main { flex:1; overflow-y:auto; padding:36px; }

  /* Analytics 2-col grid */
  .dd-analytics-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }

  /* Vitals grid */
  .dd-vitals-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }

  /* Patient header */
  .dd-pat-header { display:flex; align-items:center; gap:20px; margin-bottom:32px; }

  /* ── MOBILE ──────────────────────────────── */
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

    /* Make BMI bar chart SVGs fluid */
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

/* ── Shared style tokens ─────────────────────────────────── */
const S = {
  sideHeader: { padding:"24px 20px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  logo: { fontSize:22, marginBottom:6 },
  brand: { fontSize:16, fontWeight:700, background:"linear-gradient(to right,#a78bfa,#818cf8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
  sub: { fontSize:11, color:"#64748b", marginTop:2 },
  docCard: { padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  avatar: (size=36) => ({ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.4, fontWeight:700, color:"#fff", flexShrink:0 }),
  docName: { fontSize:14, fontWeight:600, marginTop:8 },
  docSub: { fontSize:12, color:"#64748b", marginTop:2 },
  sectionLabel: { padding:"14px 20px 6px", fontSize:10, fontWeight:600, letterSpacing:1.5, color:"#334155" },
  list: { flex:1, overflowY:"auto", padding:"4px 8px" },
  pBtn: (active) => ({ width:"100%", textAlign:"left", padding:"10px 12px", borderRadius:10, border:`1px solid ${active?"rgba(124,58,237,0.4)":"transparent"}`, background:active?"rgba(124,58,237,0.14)":"none", color:active?"#fff":"#94a3b8", cursor:"pointer", marginBottom:2, display:"flex", alignItems:"center", gap:10, fontSize:13, fontFamily:"inherit", transition:"all 0.15s" }),
  pName: { fontWeight:500, fontSize:13 },
  pMeta: { fontSize:11, color:"#64748b" },
  logoutBtn: { margin:12, padding:10, background:"rgba(248,113,113,0.04)", border:"1px solid rgba(248,113,113,0.18)", color:"#f87171", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  empty: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12 },
};

const bmiLabel = (b) => !b ? "—" : b<18.5?"Underweight":b<25?"Normal":b<30?"Overweight":"Obese";
const bmiColor = (b) => !b?"#64748b":b<18.5?"#60a5fa":b<25?"#10b981":b<30?"#f59e0b":"#ef4444";

/* ── Shared card wrapper ── */
function Section({ title, children }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:24, marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.8, color:"#a78bfa", marginBottom:18 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, span }) {
  return (
    <div style={{ gridColumn: span ? `1 / -1` : undefined }}>
      <div style={{ fontSize:11, color:"#64748b", marginBottom:5, letterSpacing:0.4 }}>{label}</div>
      <div style={{ fontSize:14, color: value ? "#f1f5f9" : "#374151", lineHeight:1.65 }}>{value || "Not provided"}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CHARTS (pure SVG, zero deps)
══════════════════════════════════════════════════════════ */

/* Horizontal bar chart – BMI categories */
function BmiBarChart({ patients }) {
  const cats = { Underweight:0, Normal:0, Overweight:0, Obese:0 };
  patients.forEach(p => { if (p.bmi) cats[bmiLabel(p.bmi)]++; });
  const colors = { Underweight:"#60a5fa", Normal:"#10b981", Overweight:"#f59e0b", Obese:"#ef4444" };
  const max = Math.max(...Object.values(cats), 1);
  const W = 260, H = 24;
  return (
    <div>
      {Object.entries(cats).map(([cat, count]) => (
        <div key={cat} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }} className="dd-bmi-bar">
          <div style={{ width:90, fontSize:12, color:"#94a3b8", textAlign:"right", flexShrink:0 }}>{cat}</div>
          <svg width={W} height={H} style={{ flex:1, minWidth:0 }}>
            <rect x={0} y={0} width="100%" height={H} rx={5} fill="rgba(255,255,255,0.04)" />
            <rect x={0} y={0} width={Math.max((count/max)*W, count>0?6:0)} height={H} rx={5} fill={colors[cat]} opacity={0.85} style={{ transition:"width 0.6s ease" }} />
          </svg>
          <div style={{ fontSize:12, color:"#64748b", width:18, flexShrink:0 }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

/* Donut chart – gender breakdown */
function GenderDonut({ patients }) {
  const counts = {};
  patients.forEach(p => { if (p.gender) counts[p.gender] = (counts[p.gender]||0)+1; });
  const colors = { Male:"#60a5fa", Female:"#f472b6", "Non-binary":"#a78bfa", "Prefer not to say":"#64748b" };
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
    return { label, n, pct, path:`M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`, color: colors[label] || "#8b5cf6" };
  });
  return (
    <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
      <svg width={140} height={140} style={{ flexShrink:0 }}>
        {slices.length ? slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />) : <circle cx={cx} cy={cy} r={R} fill="rgba(255,255,255,0.05)" />}
        <circle cx={cx} cy={cy} r={r} fill="#08090e" />
        <text x={cx} y={cy+5} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontWeight="700">{patients.length}</text>
        <text x={cx} y={cy+20} textAnchor="middle" fill="#64748b" fontSize={9}>patients</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:100 }}>
        {slices.map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
            <span style={{ color:"#94a3b8", flex:1 }}>{s.label}</span>
            <span style={{ color:"#e2e8f0", fontWeight:600 }}>{s.n}</span>
          </div>
        ))}
        {slices.length === 0 && <span style={{ fontSize:12, color:"#374151" }}>No data yet</span>}
      </div>
    </div>
  );
}

/* Age histogram — buckets of 10 yrs */
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
    ? <div style={{ fontSize:13, color:"#374151" }}>No age data yet</div>
    : (
      <div style={{ overflowX:"auto" }}>
        <svg width={Math.max(totalW, 200)} height={H + 30} style={{ overflow:"visible" }}>
          {sorted.map(([label, n], i) => {
            const bh = (n/max) * H;
            const x = i*(BW+GAP);
            return (
              <g key={label} transform={`translate(${x},0)`}>
                <rect x={0} y={H-bh} width={BW} height={bh} rx={4} fill="url(#barGrad)" opacity={0.9} />
                <text x={BW/2} y={H-bh-4} textAnchor="middle" fill="#a78bfa" fontSize={11} fontWeight="600">{n}</text>
                <text x={BW/2} y={H+14} textAnchor="middle" fill="#64748b" fontSize={10}>{label}</text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
}

/* Red flag presence — horizontal "frequency" bars */
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
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94a3b8", marginBottom:4 }}>
              <span>{flag}</span>
              <span style={{ color:"#f87171", fontWeight:600 }}>{n} <span style={{ color:"#64748b", fontWeight:400 }}>/ {patients.length}</span></span>
            </div>
            <div style={{ height:8, borderRadius:4, background:"rgba(255,255,255,0.05)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:4, background:"linear-gradient(to right,#ef4444,#f87171)", transition:"width 0.5s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Custom issues count */
function CustomIssuesCount({ patients }) {
  const withIssues = patients.filter(p => p.custom_issues && p.custom_issues.trim().length > 0);
  const pct = patients.length ? Math.round((withIssues.length / patients.length) * 100) : 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"#a78bfa" }}>{withIssues.length}</div>
        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>of {patients.length} reported</div>
      </div>
      <div style={{ flex:1, minWidth:120 }}>
        <div style={{ height:10, borderRadius:5, background:"rgba(255,255,255,0.05)", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, borderRadius:5, background:"linear-gradient(to right,#a78bfa,#818cf8)", transition:"width 0.5s ease" }} />
        </div>
        <div style={{ fontSize:12, color:"#64748b", marginTop:6 }}>{pct}% of patients added custom concerns</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Analytics Panel (shows when no patient is selected on ≥1 patient)
══════════════════════════════════════════════════════════ */
function AnalyticsPanel({ patients }) {
  return (
    <div style={{ maxWidth:860 }}>
      <div style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>Patient Analytics</div>
      <div style={{ fontSize:13, color:"#64748b", marginBottom:28 }}>Aggregated overview across {patients.length} patient{patients.length!==1?"s":""}</div>

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
  return (
    <div style={{ maxWidth:860 }}>
      <div className="dd-pat-header">
        <div style={{ ...S.avatar(60), fontSize:24 }}>{p.full_name?.[0]?.toUpperCase()??"P"}</div>
        <div>
          <div style={{ fontSize:26, fontWeight:700 }}>{p.full_name}</div>
          <div style={{ fontSize:14, color:"#64748b", marginTop:4 }}>
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
            <div style={{ fontSize:11, color:"#64748b" }}>BMI</div>
            <div style={{ fontSize:22, fontWeight:700, color: bmiColor(p.bmi) }}>{p.bmi ?? "—"}</div>
            {p.bmi && <span style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"3px 10px", fontSize:12, color: bmiColor(p.bmi) }}>{bmiLabel(p.bmi)}</span>}
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
          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#10b981", fontSize:14 }}>
            <span>✓</span><span>No red flags reported</span>
          </div>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {flags.filter(f=>f!=="None").map(f => (
              <span key={f} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171", borderRadius:8, padding:"6px 14px", fontSize:13 }}>
                ⚠ {f}
              </span>
            ))}
          </div>
        )}
        {p.custom_issues && (
          <div style={{ marginTop:16, padding:"14px 16px", background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, color:"#f59e0b", marginBottom:8 }}>ADDITIONAL PATIENT-REPORTED ISSUES</div>
            <div style={{ fontSize:13, color:"#fcd34d", lineHeight:1.7 }}>{p.custom_issues}</div>
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
                <div style={{ fontSize:11, color:"#64748b", marginBottom:10, letterSpacing:0.4 }}>UPLOADED SCAN / REPORT</div>
                {isImage ? (
                  <div>
                    <img
                      src={p.scan_url}
                      alt="Patient scan"
                      style={{
                        maxWidth:"100%", maxHeight:380, borderRadius:12,
                        border:"1px solid rgba(167,139,250,0.2)",
                        boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
                        display:"block", marginBottom:10, objectFit:"contain",
                        background:"rgba(0,0,0,0.3)"
                      }}
                    />
                    <a href={p.scan_url} target="_blank" rel="noopener noreferrer"
                      style={{ color:"#a78bfa", fontSize:12, display:"inline-flex", alignItems:"center", gap:6, textDecoration:"none", border:"1px solid rgba(167,139,250,0.2)", borderRadius:7, padding:"6px 12px", background:"rgba(167,139,250,0.05)" }}>
                      🔍 Open full size
                    </a>
                  </div>
                ) : (
                  <a href={p.scan_url} target="_blank" rel="noopener noreferrer"
                    style={{ color:"#a78bfa", fontSize:13, display:"inline-flex", alignItems:"center", gap:6, textDecoration:"none", border:"1px solid rgba(167,139,250,0.25)", borderRadius:8, padding:"8px 14px", background:"rgba(167,139,250,0.05)" }}>
                    📎 Open Scan / Report
                  </a>
                )}
              </div>
            );
          })()}
        </div>
      </Section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main DoctorDashboard
══════════════════════════════════════════════════════════ */
export default function DoctorDashboard({ profile, onLogout }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // null = analytics overview
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
      {/* Hamburger toggle (mobile only) */}
      <button
        className="dd-hamburger"
        onClick={() => setSidebarOpen(v => !v)}
        aria-label="Toggle navigation"
      >
        <span style={{ transform: sidebarOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
        <span style={{ opacity: sidebarOpen ? 0 : 1 }} />
        <span style={{ transform: sidebarOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
      </button>

      {/* Overlay backdrop (mobile) */}
      <div
        className={`dd-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`dd-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={S.sideHeader}>
          <div style={S.logo}>🏥</div>
          <div style={S.brand}>SpineIQ</div>
          <div style={S.sub}>Doctor Portal</div>
        </div>
        <div style={S.docCard}>
          <div style={S.avatar(36)}>{profile.full_name?.[0]?.toUpperCase()??"D"}</div>
          <div style={S.docName}>Dr. {profile.full_name}</div>
          <div style={S.docSub}>{profile.degree}{profile.hospital ? ` · ${profile.hospital}` : ""}</div>
        </div>

        {/* Analytics tab */}
        <div style={{ padding:"8px 8px 0" }}>
          <button style={S.pBtn(selected === null)} onClick={() => handleSelect(null)}>
            <span style={{ fontSize:16 }}>📊</span>
            <div>
              <div style={S.pName}>Analytics Overview</div>
              <div style={S.pMeta}>Charts &amp; summaries</div>
            </div>
          </button>
        </div>

        <div style={S.sectionLabel}>PATIENTS ({patients.length})</div>
        <div style={S.list}>
          {loading ? <div style={{ padding:16, color:"#64748b", fontSize:13 }}>Loading...</div>
            : patients.length === 0 ? <div style={{ padding:16, color:"#374151", fontSize:13, textAlign:"center" }}>No patients yet</div>
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
        <button style={S.logoutBtn} onClick={onLogout}>Logout</button>
      </aside>

      {/* Main content */}
      <main className="dd-main">
        {selected === null
          ? (patients.length === 0 && !loading
              ? <div style={S.empty}>
                  <div style={{ fontSize:52, opacity:0.3 }}>🩺</div>
                  <div style={{ fontSize:20, color:"#64748b" }}>No patients yet</div>
                  <div style={{ fontSize:13, color:"#374151" }}>Patients who choose you will appear here</div>
                </div>
              : <AnalyticsPanel patients={patients} />)
          : <PatientDetail p={selected} />}
      </main>
    </div>
  );
}
