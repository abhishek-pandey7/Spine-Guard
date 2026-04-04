import { useState, useEffect } from "react";
import SpineChatbot from "./SpineChatbot";
import { supabase } from "./supabaseClient";
import "./App.css";

const SURGERY_TYPES = [
  "Lumbar Discectomy",
  "Spinal Fusion (L4-L5)",
  "Spinal Fusion (L5-S1)",
  "Cervical Disc Replacement",
  "Laminectomy",
  "Microdiscectomy",
  "TLIF / PLIF",
  "Scoliosis Correction",
  "Other",
];

const RECOVERY_PHASES = [
  "Phase 1 — Acute (0–2 weeks)",
  "Phase 2 — Early (2–6 weeks)",
  "Phase 3 — Active (6–12 weeks)",
  "Phase 4 — Return to Function (3–6 months)",
];

const LANGUAGES = ["English", "Spanish", "French", "German", "Hindi", "Arabic", "Mandarin"];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientContext, setPatientContext] = useState(null);

  // Forms
  const [onboardingForm, setOnboardingForm] = useState({
    role: "user",
    full_name: "",
    phone: "",
  });
  const [setupForm, setSetupForm] = useState({
    surgery_type: SURGERY_TYPES[0],
    days_post_op: "",
    recovery_phase: RECOVERY_PHASES[0],
    pain_score: "",
    language: "English",
    exercises: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (data) setProfile(data);
    } catch (err) {
      console.log("No profile found");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!onboardingForm.full_name) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .upsert([{
        id: session.user.id,
        role: onboardingForm.role,
        full_name: onboardingForm.full_name,
        phone: onboardingForm.phone
      }], { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Profile save error:", error);
      alert("Failed to save profile: " + error.message);
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const handlePatientSetupSubmit = (e) => {
    e.preventDefault();
    if (!setupForm.days_post_op) return;
    setPatientContext({
      ...setupForm,
      days_post_op: parseInt(setupForm.days_post_op, 10),
      pain_score: setupForm.pain_score ? parseInt(setupForm.pain_score, 10) : null,
      exercises: setupForm.exercises
        ? setupForm.exercises.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPatientContext(null);
  };

  if (loading) {
    return <div className="setup-bg"><div className="loader">🦴</div></div>;
  }

  // 1. Not Logged In
  if (!session) {
    return (
      <div className="setup-bg">
        <div className="setup-card auth-card">
          <div className="setup-logo">🦴</div>
          <h1 className="setup-title">SpineIQ</h1>
          <p className="setup-subtitle">Sign in to start your recovery journey</p>
          <button className="google-btn" onClick={handleGoogleLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // 2. Logged In but No Profile (New User)
  if (!profile) {
    return (
      <div className="setup-bg">
        <div className="setup-card onboarding-card">
          <div className="setup-logo">👤</div>
          <h1 className="setup-title">Complete Profile</h1>
          <p className="setup-subtitle">Help us personalize your experience</p>

          <form className="setup-form" onSubmit={handleOnboardingSubmit}>
            <div className="form-row">
              <label>Join as</label>
              <div className="role-selector">
                <button
                  type="button"
                  className={onboardingForm.role === "user" ? "active" : ""}
                  onClick={() => setOnboardingForm({ ...onboardingForm, role: "user" })}
                >Patient</button>
                <button
                  type="button"
                  className={onboardingForm.role === "doctor" ? "active" : ""}
                  onClick={() => setOnboardingForm({ ...onboardingForm, role: "doctor" })}
                >Doctor</button>
              </div>
            </div>

            <div className="form-row">
              <label>Full Name</label>
              <input
                placeholder="Name"
                required
                value={onboardingForm.full_name}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, full_name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <label>Phone Number</label>
              <input
                placeholder="+1234567890"
                value={onboardingForm.phone}
                onChange={(e) => setOnboardingForm({ ...onboardingForm, phone: e.target.value })}
              />
            </div>

            <button type="submit" className="start-btn">Complete Setup →</button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Logged In + Profile + Patient Context? -> Open Chat
  if (patientContext) {
    return (
      <SpineChatbot
        patientContext={{ ...patientContext, user: profile }}
        onReset={() => setPatientContext(null)}
      />
    );
  }

  // 4. Logged In + Profile -> Show Patient Setup
  return (
    <div className="setup-bg">
      <div className="setup-card">
        <div className="setup-header-row">
          <div className="logged-in-user">
            <span className="user-icon">👤</span>
            <div className="user-info">
              <span className="user-name">{profile.full_name}</span>
              <span className="user-role">{profile.role}</span>
            </div>
          </div>
          <button className="logout-mini-btn" onClick={handleLogout}>Logout</button>
        </div>

        <h1 className="setup-title">SpineIQ</h1>
        <p className="setup-subtitle">Recovery context for <strong>{profile.full_name}</strong></p>

        <form className="setup-form" onSubmit={handlePatientSetupSubmit}>
          <div className="form-row">
            <label>Surgery Type</label>
            <select
              value={setupForm.surgery_type}
              onChange={(e) => setSetupForm({ ...setupForm, surgery_type: e.target.value })}
            >
              {SURGERY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Days Since Surgery <span className="req">*</span></label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 14"
              value={setupForm.days_post_op}
              required
              onChange={(e) => setSetupForm({ ...setupForm, days_post_op: e.target.value })}
            />
          </div>

          <div className="form-row">
            <label>Recovery Phase</label>
            <select
              value={setupForm.recovery_phase}
              onChange={(e) => setSetupForm({ ...setupForm, recovery_phase: e.target.value })}
            >
              {RECOVERY_PHASES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="form-row two-col">
            <div>
              <label>Pain Score (0–10)</label>
              <input
                type="number"
                min="0" max="10"
                value={setupForm.pain_score}
                onChange={(e) => setSetupForm({ ...setupForm, pain_score: e.target.value })}
              />
            </div>
            <div>
              <label>Language</label>
              <select
                value={setupForm.language}
                onChange={(e) => setSetupForm({ ...setupForm, language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="start-btn">Launch SpineIQ →</button>
        </form>
      </div>
    </div>
  );
}
