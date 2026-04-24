import { useState, useRef, useEffect } from "react";
import "./PatientHub.css";

/* ── Thin-stroke SVG icons ── */
function IconChat({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconSpine({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v2" /><path d="M12 20v2" />
      <rect x="9" y="4" width="6" height="3" rx="1" />
      <rect x="9" y="8.5" width="6" height="3" rx="1" />
      <rect x="9" y="13" width="6" height="3" rx="1" />
      <rect x="9" y="17.5" width="6" height="3" rx="1" />
    </svg>
  );
}

function IconPhysio({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2" />
      <path d="M5 20l4-8 3 3 5-9" />
      <path d="M3 21h4" /><path d="M14 10l3-3" />
    </svg>
  );
}

function IconProgress({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconMilestone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function IconActivity({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconShield({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconArrow({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ── Mouse-follow glow ── */
function useMouseGlow(ref) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e) => {
      const r = el.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("mousemove", handle);
    el.addEventListener("mouseenter", () => setActive(true));
    el.addEventListener("mouseleave", () => setActive(false));
    return () => {
      el.removeEventListener("mousemove", handle);
      el.removeEventListener("mouseenter", () => setActive(true));
      el.removeEventListener("mouseleave", () => setActive(false));
    };
  }, [ref]);

  return { pos, active };
}

/* ── Bento Feature Card ── */
function BentoCard({ icon: Icon, title, subtitle, tags, actionLabel, onClick, accentVar, glowVar }) {
  const ref = useRef(null);
  const { pos, active } = useMouseGlow(ref);

  return (
    <button
      ref={ref}
      className="bento-card"
      onClick={onClick}
      style={{ "--accent": `var(${accentVar})`, "--glow-color": `var(${glowVar})` }}
    >
      <div
        className="bento-card-glow"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(350px circle at ${pos.x}px ${pos.y}px, var(${glowVar}), transparent 70%)`,
        }}
      />
      <div className="bento-card-inner">
        <div className="bento-card-header">
          <div className="bento-card-icon">
            <Icon className="bento-icon-svg" />
          </div>
          <IconArrow className="bento-arrow" />
        </div>
        <h3 className="bento-card-title">{title}</h3>
        <p className="bento-card-subtitle">{subtitle}</p>
        {tags && (
          <div className="bento-card-tags">
            {tags.map((t, i) => (
              <span key={i} className="bento-tag">{t}</span>
            ))}
          </div>
        )}
        <div className="bento-card-action">
          <span>{actionLabel}</span>
          <IconArrow className="bento-action-arrow" />

        </div>
      </div>
    </button>
  );
}

/* ── Progress Ring ── */
function ProgressRing({ value, size = 80, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--accent-blue)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="progress-ring-bar"
      />
    </svg>
  );
}

/* ── Main Component ── */
export default function PatientHub({ profile, onNavigate, onLogout, onOpenSettings }) {
  const recoveryDay = 14;
  const progressPct = 68;
  const nextMilestone = "Week 3: Core Stabilization";
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [profile?.id]);

  async function fetchActivities() {
    if (!profile?.id) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`http://localhost:8001/activities/${profile.id}`);
      if (!res.ok) throw new Error("Failed to load activities");
      const data = await res.json();
      setActivities(data.map(formatActivity));
    } catch {
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }

  function formatActivity(item) {
    const time = formatRelativeTime(item.time);
    return { ...item, time };
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return "Recently";
    const date = new Date(isoString);
    if (isNaN(date)) return "Recently";
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  return (
    <div className="command-center">
      <div className="cc-welcome">
        <h1>Good morning, {profile.full_name.split(" ")[0]}</h1>
        <p>Day {recoveryDay} of recovery · {3} features available</p>
      </div>

      <main className="cc-grid">
        {/* ── LEFT: Patient Stats ── */}
        <aside className="cc-col cc-col-left">
          <div className="cc-stat-card">
            <div className="cc-stat-header">
              <IconProgress className="cc-stat-icon" />
              <span className="cc-stat-label">Daily Progress</span>
            </div>
            <div className="cc-stat-ring-wrap">
              <ProgressRing value={progressPct} />
              <div className="cc-stat-ring-label">
                <span className="cc-stat-pct">{progressPct}%</span>
                <span className="cc-stat-sub">complete</span>
              </div>
            </div>
            <div className="cc-stat-tasks">
              <div className="cc-task"><IconCheck className="cc-task-check" /><span>Morning stretches</span></div>
              <div className="cc-task"><IconCheck className="cc-task-check" /><span>Posture check-in</span></div>
              <div className="cc-task cc-task-pending"><span>Evening physio</span></div>
            </div>
          </div>

          <div className="cc-stat-card cc-milestone-card">
            <div className="cc-stat-header">
              <IconMilestone className="cc-stat-icon" />
              <span className="cc-stat-label">Next Milestone</span>
            </div>
            <p className="cc-milestone-text">{nextMilestone}</p>
            <div className="cc-milestone-bar">
              <div className="cc-milestone-fill" style={{ width: `${(recoveryDay / 21) * 100}%` }} />
            </div>
            <span className="cc-milestone-eta">Week {Math.ceil(recoveryDay / 7)} of 3 · {21 - recoveryDay} days remaining</span>
          </div>

          <div className="cc-stat-card cc-insight-card">
            <div className="cc-stat-header">
              <IconShield className="cc-stat-icon" />
              <span className="cc-stat-label">Recovery Insight</span>
            </div>
            <p className="cc-insight-text">
              Your mobility scores improved <strong>12%</strong> this week. Consistency in evening sessions is your strongest predictor.
            </p>
          </div>
        </aside>

        {/* ── CENTER: Feature Cards ── */}
        <section className="cc-col cc-col-center">
          <BentoCard
            icon={IconChat}
            title="AI Recovery Chat"
            subtitle="Personalised guidance from your AI spine assistant"
            tags={["Pain tracking", "Exercise tips", "Recovery Q&A"]}
            actionLabel="Start conversation"
            onClick={() => onNavigate("chatbot")}
            accentVar="--accent-purple"
            glowVar="--glow-purple"
          />
          <BentoCard
            icon={IconSpine}
            title="Spine Visualizer"
            subtitle="Upload MRI · AI analysis · 3D spine model"
            tags={["MRI upload", "AI diagnostics", "3D model"]}
            actionLabel="Open visualizer"
            onClick={() => onNavigate("spineviz")}
            accentVar="--accent-blue"
            glowVar="--glow-blue"
          />
          <BentoCard
            icon={IconPhysio}
            title="Physiotherapy"
            subtitle="Guided exercise sessions for your recovery phase"
            tags={["Phase 2", "12 exercises", "20 min"]}
            actionLabel="Begin session"
            onClick={() => onNavigate("physio")}
            accentVar="--accent-emerald"
            glowVar="--glow-emerald"
          />
        </section>

        {/* ── RIGHT: Recent Activity ── */}
        <aside className="cc-col cc-col-right">
          <div className="cc-activity-card">
            <div className="cc-activity-header">
              <IconActivity className="cc-activity-icon" />
              <h3 className="cc-activity-title">Recent Activity</h3>
            </div>
            <div className="cc-activity-list">
              {activityLoading ? (
                <div className="cc-activity-loading">
                  <div className="cc-activity-skeleton" />
                  <div className="cc-activity-skeleton" />
                  <div className="cc-activity-skeleton" />
                </div>
              ) : activities.length === 0 ? (
                <p className="cc-activity-empty">No activity yet. Start a session or chat to see updates here.</p>
              ) : (
                activities.map((a, i) => (
                  <div key={i} className={`cc-activity-item cc-activity-${a.type}`}>
                    <div className="cc-activity-dot" />
                    <div className="cc-activity-content">
                      <p className="cc-activity-text">{a.text}</p>
                      <span className="cc-activity-time">{a.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
