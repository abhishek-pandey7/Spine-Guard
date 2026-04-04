import React, { useState, useCallback } from 'react';
import CoachPanel from './CoachPanel';
import PatientPanel from './PatientPanel';
import PhaseSelector from './PhaseSelector';
import CalibrationScreen from './CalibrationScreen';
import CheckInModal from './CheckInModal';
import ConditionSelector from './ConditionSelector';
import RedFlagSurvey from './RedFlagSurvey';
import ProgressPanel from './ProgressPanel';
import SessionSummary from './SessionSummary';
import { useSessionStore } from '../stores/sessionStore';
import { type Exercise, type BackCondition, getPhasesByCondition } from '../types/exercise';

type AppScreen = 'checkin' | 'condition_select' | 'phase_select' | 'calibration' | 'session' | 'rest' | 'survey' | 'summary';

interface ExerciseResult {
  exerciseId: string;
  exerciseName: string;
  repsCompleted: number;
  elapsedSeconds: number;
}

export default function Dashboard() {
  const [screen, setScreen] = useState<AppScreen>('checkin');
  const [selectedCondition, setSelectedCondition] = useState<BackCondition>('Muscle Strain');
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, unknown> | null>(null);
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const { setPainScore, resetSession } = useSessionStore();
  const phases = getPhasesByCondition(selectedCondition);
  const currentPhaseExercises = phases[selectedPhase - 1]?.exercises ?? [];

  const handleCheckIn = (pain: number) => {
    setPainScore(pain);
    if (pain > 4) setSelectedPhase(1);
    setScreen('condition_select');
  };

  const handleConditionSelect = (condition: BackCondition) => {
    setSelectedCondition(condition);
    setScreen('phase_select');
  };

  const handlePhaseSelect = (phase: 1 | 2 | 3, exercise: Exercise) => {
    setSelectedPhase(phase);
    setExerciseIndex(0);
    setSelectedExercise(exercise);
    setExerciseResults([]);
    setScreen('calibration');
  };

  const handleCalibrated = () => setScreen('session');

  const handleExerciseComplete = useCallback((repCount: number, elapsedSeconds: number) => {
    if (!selectedExercise) return;

    const result: ExerciseResult = {
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      repsCompleted: repCount,
      elapsedSeconds,
    };
    setExerciseResults(prev => [...prev, result]);

    const nextIndex = exerciseIndex + 1;
    const allPhaseExercises = phases[selectedPhase - 1]?.exercises ?? [];

    if (nextIndex < allPhaseExercises.length) {
      // Start rest timer before next exercise
      const restTime = selectedExercise.restSeconds || 15;
      setRestSecondsLeft(restTime);
      setScreen('rest');

      const timer = setInterval(() => {
        setRestSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Advance to next exercise
            const nextExercise = allPhaseExercises[nextIndex];
            setExerciseIndex(nextIndex);
            setSelectedExercise(nextExercise);
            setScreen('calibration');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // All exercises in phase complete
      const totalReps = [...exerciseResults, result].reduce((sum, r) => sum + r.repsCompleted, 0);
      const totalTime = [...exerciseResults, result].reduce((sum, r) => sum + r.elapsedSeconds, 0);
      setSessionData({
        condition: selectedCondition,
        phase: selectedPhase,
        phaseName: phases[selectedPhase - 1].name,
        exerciseResults: [...exerciseResults, result],
        totalReps,
        totalTimeSeconds: totalTime,
        sessionDate: new Date().toISOString(),
      });
      setScreen('survey');
    }
  }, [selectedExercise, exerciseIndex, selectedPhase, phases, exerciseResults, selectedCondition]);

  const handleSessionEnd = useCallback((data: Record<string, unknown>) => {
    setSessionData(data);
    setScreen('survey');
  }, []);

  const handleSurveyComplete = () => setScreen('summary');

  const handleRestart = () => {
    resetSession();
    setSessionData(null);
    setExerciseResults([]);
    setExerciseIndex(0);
    setScreen('checkin');
  };

  return (
    <div className="dashboard-root">
      {screen === 'checkin' && <CheckInModal onConfirm={handleCheckIn} />}
      {screen === 'condition_select' && <ConditionSelector onSelect={handleConditionSelect} />}

      {screen === 'phase_select' && (
        <PhaseSelector defaultPhase={selectedPhase} phases={phases} onSelect={handlePhaseSelect} />
      )}

      {screen === 'calibration' && selectedExercise && (
        <CalibrationScreen exercise={selectedExercise} onComplete={handleCalibrated} />
      )}

      {screen === 'rest' && selectedExercise && (
        <div className="rest-screen">
          <div className="rest-card">
            <div className="rest-icon">✓</div>
            <h2>{exerciseResults[exerciseResults.length - 1]?.exerciseName} Complete!</h2>
            <p className="rest-sub">
              {exerciseResults[exerciseResults.length - 1]?.repsCompleted} reps in {
                Math.floor((exerciseResults[exerciseResults.length - 1]?.elapsedSeconds ?? 0) / 60)
              }m {
                (exerciseResults[exerciseResults.length - 1]?.elapsedSeconds ?? 0) % 60
              }s
            </p>
            <div className="rest-timer">{restSecondsLeft}s</div>
            <p className="rest-next">
              Next: {currentPhaseExercises[exerciseIndex]?.name}
            </p>
          </div>
        </div>
      )}

      {screen === 'session' && selectedExercise && (
        <div className="session-layout">
          <div className="session-header">
            <div className="phase-badge">
              Phase {selectedPhase}: {phases[selectedPhase - 1].name}
            </div>
            <div className="exercise-name">{selectedExercise.name}</div>
            <div className="exercise-progress-text" style={{ fontSize: 12, color: '#94a3b8' }}>
              Exercise {exerciseIndex + 1} of {currentPhaseExercises.length}
            </div>
            <ProgressPanel />
          </div>
          <div className="panels-container">
            <CoachPanel exercise={selectedExercise} phase={selectedPhase} />
            <PatientPanel
              exercise={selectedExercise}
              onExerciseComplete={handleExerciseComplete}
              onSessionEnd={handleSessionEnd}
            />
          </div>
        </div>
      )}

      {screen === 'survey' && <RedFlagSurvey onComplete={handleSurveyComplete} />}

      {screen === 'summary' && sessionData && (
        <SessionSummary data={sessionData} onRestart={handleRestart} />
      )}
    </div>
  );
}
