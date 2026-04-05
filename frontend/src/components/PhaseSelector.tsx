import React, { useState } from 'react';
import { type Phase, type Exercise } from '../types/exercise';
import { ChevronRight } from 'lucide-react';

interface PhaseSelectorProps {
  defaultPhase: 1 | 2 | 3;
  phases: Phase[];
  onSelect: (phase: 1 | 2 | 3, exercise: Exercise) => void;
}

const PHASE_COLORS = ['#1e7d8c', '#2a9aad', '#b2967d'];
const PHASE_BG = ['rgba(30,125,140,0.08)', 'rgba(42,154,173,0.08)', 'rgba(178,150,125,0.08)'];

export default function PhaseSelector({ defaultPhase, phases, onSelect }: PhaseSelectorProps) {
  const [activePhase, setActivePhase] = useState<number>(defaultPhase - 1);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const phase = phases[activePhase];
  const color = PHASE_COLORS[activePhase];

  return (
    <div className="phase-selector">
      <div className="ps-header">
        <h1 className="ps-title">Select Your Exercise</h1>
        <p className="ps-subtitle">Your physiotherapist has prescribed the following program</p>
      </div>
      <div className="phase-tabs">
        {phases.map((p, i) => (
          <button key={i} onClick={() => { setActivePhase(i); setActiveExercise(null); }}
            className={`phase-tab ${i === activePhase ? 'active' : ''}`}
            style={i === activePhase ? { borderColor: PHASE_COLORS[i], color: PHASE_COLORS[i] } : {}}>
            <span className="phase-tab-num">Phase {i + 1}</span>
            <span className="phase-tab-name">{p.name}</span>
            <span className="phase-tab-weeks">{p.weeks}</span>
          </button>
        ))}
      </div>
      <div className="phase-description" style={{ borderColor: color }}>
        <p className="phase-focus">{phase.focus}</p>
      </div>
      <div className="exercise-grid">
        {phase.exercises.map((ex) => (
          <div key={ex.id} onClick={() => setActiveExercise(ex)}
            className={`exercise-card ${activeExercise?.id === ex.id ? 'selected' : ''}`}
            style={activeExercise?.id === ex.id ? { borderColor: color, background: PHASE_BG[activePhase] } : {}}>
            <div className="ex-card-header">
              <span className="ex-icon">{ex.icon}</span>
              <h3 className="ex-name">{ex.name}</h3>
            </div>
            <p className="ex-desc">{ex.description}</p>
            <div className="ex-meta">
              <span>{ex.sets} sets</span><span>·</span>
              <span>{ex.repsPerSet} reps</span><span>·</span>
              <span>{ex.holdSeconds}s hold</span>
            </div>
            <div className="ex-guard">
              <span className="guard-label">AI Guard:</span>
              <span className="guard-text">{ex.aiGuardDescription}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="ps-footer">
        <button className="btn-start" disabled={!activeExercise}
          style={activeExercise ? { background: color } : {}}
          onClick={() => { if (activeExercise) onSelect((activePhase + 1) as 1 | 2 | 3, activeExercise); }}>
          Begin Exercise <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}