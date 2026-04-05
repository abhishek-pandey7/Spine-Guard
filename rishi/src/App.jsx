import { useState, useEffect } from "react";
import SpineChatbot from "./SpineChatbot";
import DoctorDashboard from "./DoctorDashboard";
import { supabase } from "./supabaseClient";
import "./App.css";
import PatientHub from "./PatientHub";
import PhysioCheckin from "./PhysioCheckin";
import ExerciseList from "./ExerciseList";
import ExerciseSession from "./ExerciseSession";
import PageTransition from "./PageTransition";

const SURGERY_TYPES = ["Lumbar Discectomy","Spinal Fusion (L4-L5)","Spinal Fusion (L5-S1)","Cervical Disc Replacement","Laminectomy","Microdiscectomy","TLIF / PLIF","Scoliosis Correction","Other"];
const RECOVERY_PHASES = ["Phase 1 — Acute (0–2 weeks)","Phase 2 — Early (2–6 weeks)","Phase 3 — Active (6–12 weeks)","Phase 4 — Return to Function (3–6 months)"];
const LANGUAGES = ["English","Spanish","French","German","Hindi","Arabic","Mandarin"];
const RED_FLAG_OPTIONS = ["Weakness in arms or legs","Bladder or bowel trouble","Unexplained weight loss or fever"];

const computeBMI = (h, w) => {
  if (!h || !w) return "";
  const hm = parseFloat(h) / 100;
  const wk = parseFloat(w);
  if (hm <= 0 || wk <= 0) return "";
  return (wk / (hm * hm)).toFixed(1);
};

const bmiLabel = (b) => b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientContext, setPatientContext] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [physioSession, setPhysioSession] = useState({});
  const [hubMode, setHubMode] = useState(null);
  const [settingsForm, setSettingsForm] = useState({});

  // Basic onboarding
  const [onboardingForm, setOnboardingForm] = useState({ role: "user", full_name: "", phone: "" });

  // Doctor extended form
  const [doctorForm, setDoctorForm] = useState({ degree: "", hospital: "", age: "", gender: "" });

  // Patient multi-step intake
  const [intakeStep, setIntakeStep] = useState(0);
  const [intakeForm, setIntakeForm] = useState({
    age: "", gender: "", chief_complaint: "", hopi: "",
    height: "", weight: "", bmi: "", red_flags: [],
    custom_issues: "",
    scans_done: "", treatments_history: "", scan_file: null,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [redFlagAcknowledged, setRedFlagAcknowledged] = useState(false);

  // Doctor selection
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // Patient setup form (unchanged)
  const [setupForm, setSetupForm] = useState({
    surgery_type: SURGERY_TYPES[0], days_post_op: "", recovery_phase: RECOVERY_PHASES[0],
    pain_score: "", language: "English", exercises: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load available doctors when patient reaches doctor-selection stage
  useEffect(() => {
    if (profile?.role === "user" && profile?.chief_complaint && !profile?.assigned_doctor_id) {
      loadDoctors();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.chief_complaint, profile?.assigned_doctor_id]);

  const fetchProfile = async (uid) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (data) setProfile(data);
    } catch { console.log("No profile"); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  // ── Validators ──
  const NAME_RE = /^[A-Za-z\s'-]{2,80}$/;
  const PHONE_RE = /^\+?[0-9\s\-().]{7,20}$/;

  // 1. Basic profile (name, role, phone)
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!NAME_RE.test(onboardingForm.full_name))
      errs.full_name = "Enter a valid name (letters only, 2–80 chars)";
    if (onboardingForm.phone && !PHONE_RE.test(onboardingForm.phone))
      errs.phone = "Enter a valid phone number (e.g. +1 234 567 8900)";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    const { data, error } = await supabase.from("profiles")
      .upsert([{ id: session.user.id, role: onboardingForm.role, full_name: onboardingForm.full_name, phone: onboardingForm.phone }], { onConflict: "id" })
      .select().single();
    if (!error) setProfile(data);
    else alert("Failed to save profile: " + error.message);
    setLoading(false);
  };

  // 2. Doctor extended
  const handleDoctorFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.from("profiles")
      .update({ degree: doctorForm.degree, hospital: doctorForm.hospital, age: doctorForm.age ? parseInt(doctorForm.age) : null, gender: doctorForm.gender })
      .eq("id", session.user.id).select().single();
    if (!error) setProfile(data);
    setLoading(false);
  };

  // 3. Patient intake final submit
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let scan_url = null;
    if (intakeForm.scan_file) {
      const ext = intakeForm.scan_file.name.split(".").pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("patient-scans").upload(path, intakeForm.scan_file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("patient-scans").getPublicUrl(path);
        scan_url = urlData?.publicUrl;
      }
    }
    const { data, error } = await supabase.from("profiles").update({
      age: intakeForm.age ? parseInt(intakeForm.age) : null,
      gender: intakeForm.gender,
      chief_complaint: intakeForm.chief_complaint,
      hopi: intakeForm.hopi,
      height: intakeForm.height ? parseFloat(intakeForm.height) : null,
      weight: intakeForm.weight ? parseFloat(intakeForm.weight) : null,
      bmi: intakeForm.bmi ? parseFloat(intakeForm.bmi) : null,
      red_flags: intakeForm.red_flags,
      custom_issues: intakeForm.custom_issues || null,
      scans_done: intakeForm.scans_done,
      treatments_history: intakeForm.treatments_history,
      ...(scan_url && { scan_url }),
    }).eq("id", session.user.id).select().single();
    if (!error) {
      setProfile(data);
      loadDoctors();
    }
    setLoading(false);
  };

  const loadDoctors = async () => {
    setDoctorsLoading(true);
    const { data } = await supabase.from("profiles").select("id,full_name,degree,hospital,gender,age").eq("role","doctor").not("degree","is",null);
    setDoctors(data || []);
    setDoctorsLoading(false);
  };

  const handleDoctorSelect = async (doctorId) => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").update({ assigned_doctor_id: doctorId }).eq("id", session.user.id).select().single();
    if (!error) setProfile(data);
    setLoading(false);
  };

  const handlePatientSetupSubmit = (e) => {
    e.preventDefault();
    if (!setupForm.days_post_op) return;
    setPatientContext({
      ...setupForm,
      days_post_op: parseInt(setupForm.days_post_op, 10),
      pain_score: setupForm.pain_score ? parseInt(setupForm.pain_score, 10) : null,
      exercises: setupForm.exercises ? setupForm.exercises.split(",").map(s => s.trim()).filter(Boolean) : [],
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPatientContext(null); setSelectedMode(null); setIntakeStep(0);
  };

  const openSettings = () => {
    setSettingsForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      age: profile.age || "",
      gender: profile.gender || "",
      chief_complaint: profile.chief_complaint || "",
      hopi: profile.hopi || "",
      height: profile.height || "",
      weight: profile.weight || "",
      scans_done: profile.scans_done || "",
      treatments_history: profile.treatments_history || "",
      custom_issues: profile.custom_issues || "",
    });
    setShowSettings(true);
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const bmi = settingsForm.height && settingsForm.weight
      ? (parseFloat(settingsForm.weight) / ((parseFloat(settingsForm.height) / 100) ** 2)).toFixed(1)
      : profile.bmi;
    const { data, error } = await supabase.from("profiles").update({
      full_name: settingsForm.full_name,
      phone: settingsForm.phone,
      age: settingsForm.age ? parseInt(settingsForm.age) : null,
      gender: settingsForm.gender,
      chief_complaint: settingsForm.chief_complaint,
      hopi: settingsForm.hopi,
      height: settingsForm.height ? parseFloat(settingsForm.height) : null,
      weight: settingsForm.weight ? parseFloat(settingsForm.weight) : null,
      bmi: bmi ? parseFloat(bmi) : null,
      scans_done: settingsForm.scans_done,
      treatments_history: settingsForm.treatments_history,
      custom_issues: settingsForm.custom_issues,
    }).eq("id", session.user.id).select().single();
    if (!error) setProfile(data);
    setLoading(false);
    setShowSettings(false);
  };

  // ── RENDER ──────────────────────────────────────────────
  if (loading) return <PageTransition transitionKey="loading"><div className="setup-bg"><div className="loader">🦴</div></div></PageTransition>;

  // Settings modal — rendered globally so it works from PatientHub too
  const settingsModal = showSettings && (
    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          <span>Edit Profile &amp; Medical Details</span>
          <button className="settings-close-btn" onClick={() => setShowSettings(false)}>✕</button>
        </div>
        <form className="setup-form settings-form" onSubmit={handleSettingsSave}>
          <div className="settings-section-label">PERSONAL INFO</div>
          <div className="form-row two-col">
            <div><label>Full Name</label><input value={settingsForm.full_name || ""} onChange={e => setSettingsForm(f => ({...f, full_name: e.target.value}))} /></div>
            <div><label>Phone</label><input placeholder="+1 234 567 8900" value={settingsForm.phone || ""} onChange={e => setSettingsForm(f => ({...f, phone: e.target.value}))} /></div>
          </div>
          <div className="form-row two-col">
            <div><label>Age</label><input type="number" min="1" max="120" value={settingsForm.age || ""} onChange={e => setSettingsForm(f => ({...f, age: e.target.value}))} /></div>
            <div><label>Gender</label>
              <select value={settingsForm.gender || ""} onChange={e => setSettingsForm(f => ({...f, gender: e.target.value}))}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="settings-section-label" style={{marginTop:8}}>CLINICAL DETAILS</div>
          <div className="form-row"><label>Chief Complaint / Pain Location</label><input placeholder="e.g. Lower back, radiating to left leg" value={settingsForm.chief_complaint || ""} onChange={e => setSettingsForm(f => ({...f, chief_complaint: e.target.value}))} /></div>
          <div className="form-row"><label>History of Present Illness (HOPI)</label><textarea className="intake-textarea" rows={3} placeholder="Describe symptoms..." value={settingsForm.hopi || ""} onChange={e => setSettingsForm(f => ({...f, hopi: e.target.value}))} /></div>
          <div className="form-row two-col">
            <div><label>Height (cm)</label><input type="number" min="50" max="250" value={settingsForm.height || ""} onChange={e => setSettingsForm(f => ({...f, height: e.target.value}))} /></div>
            <div><label>Weight (kg)</label><input type="number" min="10" max="300" value={settingsForm.weight || ""} onChange={e => setSettingsForm(f => ({...f, weight: e.target.value}))} /></div>
          </div>
          <div className="settings-section-label" style={{marginTop:8}}>MEDICAL HISTORY</div>
          <div className="form-row"><label>Scans Done</label><input value={settingsForm.scans_done || ""} onChange={e => setSettingsForm(f => ({...f, scans_done: e.target.value}))} /></div>
          <div className="form-row"><label>Treatments Tried</label><textarea className="intake-textarea" rows={2} value={settingsForm.treatments_history || ""} onChange={e => setSettingsForm(f => ({...f, treatments_history: e.target.value}))} /></div>
          <div className="form-row"><label>Additional Issues</label><textarea className="intake-textarea" rows={2} value={settingsForm.custom_issues || ""} onChange={e => setSettingsForm(f => ({...f, custom_issues: e.target.value}))} /></div>
          <button type="submit" className="start-btn" style={{marginTop:4}}>Save Changes</button>
        </form>
      </div>
    </div>
  );

  if (!session) return (
    <div className="setup-bg">
      <div className="setup-card auth-card">
        <div className="setup-logo"><img src="/logo.jpeg" alt="SpineGuard" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} /></div>
        <h1 className="setup-title">SpineGuard</h1>
        <p className="setup-subtitle">Sign in to start your recovery journey</p>
        <button className="google-btn" onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="setup-bg">
      <div className="setup-card onboarding-card">
        <div className="setup-logo">👤</div>
        <h1 className="setup-title">Welcome to SpineGuard</h1>
        <p className="setup-subtitle">Let's get you set up in just a moment.</p>
        <form className="setup-form" onSubmit={handleOnboardingSubmit}>
          <div className="form-row">
            <label>I am joining as</label>
            <div className="role-selector">
              <button type="button" className={onboardingForm.role === "user" ? "active" : ""} onClick={() => setOnboardingForm({ ...onboardingForm, role: "user" })}>🧑‍⚕️ Patient</button>
              <button type="button" className={onboardingForm.role === "doctor" ? "active" : ""} onClick={() => setOnboardingForm({ ...onboardingForm, role: "doctor" })}>👨‍⚕️ Doctor</button>
            </div>
          </div>
          <div className="form-row">
            <label>Full Name <span className="req">*</span></label>
            <input placeholder="Your full name" value={onboardingForm.full_name} onChange={e => { setOnboardingForm({ ...onboardingForm, full_name: e.target.value }); setFieldErrors(f => ({...f, full_name: undefined})); }} />
            {fieldErrors.full_name && <span className="field-error">{fieldErrors.full_name}</span>}
          </div>
          <div className="form-row">
            <label>Phone Number</label>
            <input placeholder="+1 234 567 8900" value={onboardingForm.phone} onChange={e => { setOnboardingForm({ ...onboardingForm, phone: e.target.value }); setFieldErrors(f => ({...f, phone: undefined})); }} />
            {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
          </div>
          <button type="submit" className="start-btn">Continue →</button>
        </form>
      </div>
    </div>
  );

  // Doctor extended profile
  if (profile.role === "doctor" && !profile.degree) return (
    <div className="setup-bg">
      <div className="setup-card">
        <div className="setup-logo">🏥</div>
        <h1 className="setup-title">Doctor Profile</h1>
        <p className="setup-subtitle">Help patients find and trust you, <strong>{profile.full_name}</strong>.</p>
        <form className="setup-form" onSubmit={handleDoctorFormSubmit}>
          <div className="form-row"><label>Degree / Qualification *</label><input placeholder="e.g. MD Orthopaedics, MS Surgery" required value={doctorForm.degree} onChange={e => setDoctorForm({ ...doctorForm, degree: e.target.value })} /></div>
          <div className="form-row"><label>Hospital / Clinic *</label><input placeholder="Where do you currently practice?" required value={doctorForm.hospital} onChange={e => setDoctorForm({ ...doctorForm, hospital: e.target.value })} /></div>
          <div className="form-row two-col">
            <div><label>Age</label><input type="number" min="25" max="90" placeholder="Age" value={doctorForm.age} onChange={e => setDoctorForm({ ...doctorForm, age: e.target.value })} /></div>
            <div><label>Gender</label>
              <select value={doctorForm.gender} onChange={e => setDoctorForm({ ...doctorForm, gender: e.target.value })}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
              </select>
            </div>
          </div>
          <button type="submit" className="start-btn">Enter Dashboard →</button>
        </form>
      </div>
    </div>
  );

  // Doctor dashboard — no chatbot, no spine visualizer
  if (profile.role === "doctor") return <DoctorDashboard profile={profile} onLogout={handleLogout} />;

  // Patient intake (multi-step)
  if (profile.role === "user" && !profile.chief_complaint) {
    const TOTAL = 5;
    const pct = (intakeStep / TOTAL) * 100;
    return (
      <div className="setup-bg">
        <div className="setup-card intake-card">
          <div className="intake-progress"><div className="intake-progress-bar" style={{ width: `${pct}%` }} /></div>
          <div className="intake-step-label">Step {intakeStep + 1} of {TOTAL}</div>

          {intakeStep === 0 && (
            <>
              <div className="setup-logo">🧑‍⚕️</div>
              <h1 className="setup-title">Personal Details</h1>
              <p className="setup-subtitle">Hi <strong>{profile.full_name}</strong>! A few quick questions to personalise your care.</p>
              <form className="setup-form" onSubmit={e => {
                e.preventDefault();
                const errs = {};
                if (!intakeForm.age || parseInt(intakeForm.age) < 1 || parseInt(intakeForm.age) > 120)
                  errs.age = "Enter a valid age between 1 and 120";
                if (!intakeForm.gender) errs.gender = "Please select your gender";
                if (Object.keys(errs).length) { setFieldErrors(errs); return; }
                setFieldErrors({}); setIntakeStep(1);
              }}>
                <div className="form-row two-col">
                  <div>
                    <label>Age <span className="req">*</span></label>
                    <input type="number" min="1" max="120" placeholder="e.g. 45" value={intakeForm.age} onChange={e => { setIntakeForm({ ...intakeForm, age: e.target.value }); setFieldErrors(f => ({...f, age: undefined})); }} />
                    {fieldErrors.age && <span className="field-error">{fieldErrors.age}</span>}
                  </div>
                  <div>
                    <label>Gender <span className="req">*</span></label>
                    <select value={intakeForm.gender} onChange={e => { setIntakeForm({ ...intakeForm, gender: e.target.value }); setFieldErrors(f => ({...f, gender: undefined})); }}>
                      <option value="">Select</option>
                      <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
                    </select>
                    {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
                  </div>
                </div>
                <button type="submit" className="start-btn">Next →</button>
              </form>
            </>
          )}

          {intakeStep === 1 && (
            <>
              <div className="setup-logo">🩺</div>
              <h1 className="setup-title">Your Complaint</h1>
              <p className="setup-subtitle">Tell us where it hurts and how it's been affecting you.</p>
              <form className="setup-form" onSubmit={e => {
                e.preventDefault();
                const errs = {};
                if (!intakeForm.chief_complaint.trim() || intakeForm.chief_complaint.trim().length < 5)
                  errs.chief_complaint = "Please describe your pain location (min 5 characters)";
                if (!intakeForm.hopi.trim() || intakeForm.hopi.trim().length < 20)
                  errs.hopi = "Please describe your symptoms in more detail (min 20 characters)";
                if (Object.keys(errs).length) { setFieldErrors(errs); return; }
                setFieldErrors({}); setIntakeStep(2);
              }}>
                <div className="form-row">
                  <label>Location of Pain (Chief Complaint) <span className="req">*</span></label>
                  <input placeholder="e.g. Lower back, radiating to left leg" value={intakeForm.chief_complaint} onChange={e => { setIntakeForm({ ...intakeForm, chief_complaint: e.target.value }); setFieldErrors(f => ({...f, chief_complaint: undefined})); }} />
                  {fieldErrors.chief_complaint && <span className="field-error">{fieldErrors.chief_complaint}</span>}
                </div>
                <div className="form-row">
                  <label>Describe your symptoms in detail (HOPI) <span className="req">*</span></label>
                  <textarea className="intake-textarea" placeholder="When did it start? What makes it worse or better? Any numbness, tingling, or weakness?" rows={4} value={intakeForm.hopi} onChange={e => { setIntakeForm({ ...intakeForm, hopi: e.target.value }); setFieldErrors(f => ({...f, hopi: undefined})); }} />
                  {fieldErrors.hopi && <span className="field-error">{fieldErrors.hopi}</span>}
                </div>
                <div className="btn-row">
                  <button type="button" className="back-btn" onClick={() => setIntakeStep(0)}>← Back</button>
                  <button type="submit" className="start-btn">Next →</button>
                </div>
              </form>
            </>
          )}

          {intakeStep === 2 && (
            <>
              <div className="setup-logo">⚖️</div>
              <h1 className="setup-title">Vitals</h1>
              <p className="setup-subtitle">We'll calculate your BMI automatically.</p>
              <form className="setup-form" onSubmit={e => { e.preventDefault(); setIntakeStep(3); }}>
                <div className="form-row two-col">
                  <div><label>Height (cm)</label><input type="number" min="50" max="250" placeholder="e.g. 170" value={intakeForm.height} onChange={e => { const h=e.target.value; setIntakeForm(f=>({ ...f, height:h, bmi:computeBMI(h,f.weight) })); }} /></div>
                  <div><label>Weight (kg)</label><input type="number" min="10" max="300" placeholder="e.g. 70" value={intakeForm.weight} onChange={e => { const w=e.target.value; setIntakeForm(f=>({ ...f, weight:w, bmi:computeBMI(f.height,w) })); }} /></div>
                </div>
                {intakeForm.bmi && (
                  <div className="bmi-display">
                    <span className="bmi-label">BMI</span>
                    <strong className="bmi-value">{intakeForm.bmi}</strong>
                    <span className="bmi-cat">{bmiLabel(parseFloat(intakeForm.bmi))}</span>
                  </div>
                )}
                <div className="btn-row">
                  <button type="button" className="back-btn" onClick={() => setIntakeStep(1)}>← Back</button>
                  <button type="submit" className="start-btn">Next →</button>
                </div>
              </form>
            </>
          )}

          {intakeStep === 3 && (
            <>
              <div className="setup-logo">🚨</div>
              <h1 className="setup-title">Important Symptoms Check</h1>
              <p className="setup-subtitle">Please tick <strong>any</strong> of the following that apply to you. This step is required.</p>
              <form className="setup-form" onSubmit={e => {
                e.preventDefault();
                if (!redFlagAcknowledged) return;
                setIntakeStep(4);
              }}>
                <div className="red-flags-group">
                  {RED_FLAG_OPTIONS.map(flag => (
                    <label key={flag} className={`red-flag-item ${intakeForm.red_flags.includes(flag) ? "flag-checked" : ""}`}>
                      <input type="checkbox" checked={intakeForm.red_flags.includes(flag)} onChange={e => {
                        const flags = e.target.checked ? [...intakeForm.red_flags.filter(f=>f!=="None"), flag] : intakeForm.red_flags.filter(f=>f!==flag);
                        setIntakeForm({ ...intakeForm, red_flags: flags });
                        if (e.target.checked) setRedFlagAcknowledged(true);
                      }} />
                      <span className="flag-icon">⚠️</span><span>{flag}</span>
                    </label>
                  ))}
                  <label className={`red-flag-item none-item ${intakeForm.red_flags.includes("None") ? "flag-checked" : ""}`}>
                    <input type="checkbox" checked={intakeForm.red_flags.includes("None")} onChange={e => {
                      setIntakeForm({ ...intakeForm, red_flags: e.target.checked ? ["None"] : [] });
                      setRedFlagAcknowledged(e.target.checked);
                    }} />
                    <span className="flag-icon">✅</span><span>None of the above apply to me</span>
                  </label>
                </div>
                {!redFlagAcknowledged && <p className="flag-hint">Please select at least one option to continue.</p>}

                <div className="form-row" style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, color: "#94a3b8" }}>Any other issues you're experiencing? <span className="hint">(optional)</span></label>
                  <textarea
                    className="intake-textarea"
                    rows={3}
                    placeholder="e.g. Difficulty sleeping, anxiety about recovery, stiffness in the morning, difficulty climbing stairs..."
                    value={intakeForm.custom_issues}
                    onChange={e => setIntakeForm({ ...intakeForm, custom_issues: e.target.value })}
                  />
                  <span style={{ fontSize: 11, color: "#4b5563" }}>Describe any additional symptoms, concerns, or difficulties not listed above.</span>
                </div>

                <div className="btn-row">
                  <button type="button" className="back-btn" onClick={() => setIntakeStep(2)}>← Back</button>
                  <button type="submit" className="start-btn" disabled={!redFlagAcknowledged}>Next →</button>
                </div>
              </form>
            </>
          )}

          {intakeStep === 4 && (
            <>
              <div className="setup-logo">📋</div>
              <h1 className="setup-title">Medical History</h1>
              <p className="setup-subtitle">Help your doctor understand what's been tried so far.</p>
              <form className="setup-form" onSubmit={handleIntakeSubmit}>
                <div className="form-row"><label>Scans Done (e.g. MRI, X-Ray, CT)</label><input placeholder="e.g. MRI lumbar spine (2024), X-Ray" value={intakeForm.scans_done} onChange={e => setIntakeForm({ ...intakeForm, scans_done: e.target.value })} /></div>
                <div className="form-row">
                  <label>Treatments Tried</label>
                  <textarea className="intake-textarea" placeholder="e.g. Physiotherapy for 3 months, Pain medications, Injections..." rows={3} value={intakeForm.treatments_history} onChange={e => setIntakeForm({ ...intakeForm, treatments_history: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Upload a Scan / Report (optional)</label>
                  <div className="file-upload-area">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dicom" id="scan-upload" style={{ display:"none" }} onChange={e => setIntakeForm({ ...intakeForm, scan_file: e.target.files[0] || null })} />
                    <label htmlFor="scan-upload" className="file-upload-label">
                      {intakeForm.scan_file ? `📎 ${intakeForm.scan_file.name}` : "📂 Click to upload PDF, image or report"}
                    </label>
                    {intakeForm.scan_file && <button type="button" className="file-remove-btn" onClick={() => setIntakeForm({ ...intakeForm, scan_file: null })}>✕ Remove</button>}
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="back-btn" onClick={() => setIntakeStep(3)}>← Back</button>
                  <button type="submit" className="start-btn">Submit & Choose Doctor →</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // Patient — choose a doctor
  if (profile.role === "user" && !profile.assigned_doctor_id) {
    return (
      <div className="setup-bg">
        <div className="setup-card" style={{ maxWidth:560 }}>
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
          <div className="setup-logo">👨‍⚕️</div>
          <h1 className="setup-title">Choose Your Doctor</h1>
          <p className="setup-subtitle">Select a doctor who will oversee your recovery. You can always reach out to them through SpineGuard.</p>
          {doctorsLoading ? <p style={{ color:"#64748b", textAlign:"center" }}>Loading doctors...</p>
            : doctors.length === 0 ? <p style={{ color:"#64748b", textAlign:"center", fontSize:14 }}>No doctors registered yet. Check back soon.</p>
            : (
              <div className="doctor-list">
                {doctors.map(d => (
                  <button key={d.id} className="doctor-card" onClick={() => handleDoctorSelect(d.id)}>
                    <div className="doctor-card-avatar">{d.full_name?.[0]?.toUpperCase()??"D"}</div>
                    <div className="doctor-card-info">
                      <div className="doctor-card-name">Dr. {d.full_name}</div>
                      <div className="doctor-card-meta">{d.degree}</div>
                      <div className="doctor-card-meta">{d.hospital}{d.gender ? ` · ${d.gender}` : ""}{d.age ? ` · ${d.age}y` : ""}</div>
                    </div>
                    <span className="doctor-card-arrow">→</span>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  }

  // ── Patient Hub + Physio flow ──
  const handleHubNavigate = (screen) => {
    if (screen === "chatbot") { setSelectedMode("chatbot"); setHubMode(null); }
    else if (screen === "spineviz") { setSelectedMode("spine"); setHubMode(null); }
    else setHubMode(screen);
  };

  if (!selectedMode && !hubMode) return (
    <PageTransition transitionKey="hub">
      <>
        {settingsModal}
        <PatientHub
          profile={profile}
          onNavigate={handleHubNavigate}
          onLogout={handleLogout}
          onOpenSettings={openSettings}
        />
      </>
    </PageTransition>
  );

  const goBack = () => {
    setSelectedMode(null);
    setHubMode(null);
    setPatientContext(null);
    window.history.back();
  };

  // Spine Visualizer (MRI + 3D)
  if (selectedMode === "spine") return (
    <PageTransition transitionKey="spine">
      <>
        {settingsModal}
        <button className="float-back-btn" onClick={goBack}>← Back</button>
        <div style={{ width:"100vw", height:"100vh", position:"relative", background:"#ecf8f8" }}>
          <iframe src="http://localhost:5176" style={{ width:"100%", height:"100%", border:"none" }} title="SpineViz AI" />
        </div>
      </>
    </PageTransition>
  );

  if (hubMode === "physio") return (
    <PageTransition transitionKey="physio">
      <>
        {settingsModal}
        <button className="float-back-btn" onClick={goBack}>← Back</button>
        <div style={{ width:"100vw", height:"100vh", position:"relative", background:"#ecf8f8" }}>
        <iframe src="http://localhost:5175" allow="camera; microphone; display-capture" allowFullScreen style={{ width:"100%", height:"100%", border:"none" }} title="Physio Exercise Monitor" />
        </div>
      </>
    </PageTransition>
  );

  if (!selectedMode) return null;

  // SpineChatbot — go directly using profile data, no extra setup form needed
  if (selectedMode === "chatbot") {
    const ctx = patientContext || {
      surgery_type: profile.chief_complaint || "Spinal condition",
      days_post_op: 0,
      recovery_phase: RECOVERY_PHASES[0],
      pain_score: null,
      language: "English",
      exercises: [],
    };
    return (
      <PageTransition transitionKey="chatbot">
        <>
          {settingsModal}
          <button className="float-back-btn" onClick={goBack}>← Back</button>
          <SpineChatbot
            patientContext={{ ...ctx, user: profile }}
            onReset={() => { setSelectedMode(null); setPatientContext(null); }}
          />
        </>
      </PageTransition>
    );
  }

  return null;
}
