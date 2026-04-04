import React, { useState } from 'react';
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

type AppScreen = 'checkin' | 'condition_select' | 'phase_select' | 'calibration' | 'session' | 'survey' | 'summary';

export default function Dashboard() {
  const [screen, setScreen] = useState<AppScreen>('checkin');
  const [selectedCondition, setSelectedCondition] = useState<BackCondition>('Muscle Strain');
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3>(1);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sessionData, setSessionData] = useState<Record<string, unknown> | null>(null);
  const { setPainScore, resetSession } = useSessionStore();
  const phases = getPhasesByCondition(selectedCondition);

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
    setSelectedExercise(exercise);
    setScreen('calibration');
  };

  const handleCalibrated = () => setScreen('session');

  const handleSessionEnd = (data: Record<string, unknown>) => {
    setSessionData(data);
    setScreen('survey');
  };

  const handleSurveyComplete = () => setScreen('summary');

  const handleRestart = () => {
    resetSession();
    setSessionData(null);
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

      {screen === 'session' && selectedExercise && (
        <div className="session-layout">
          <div className="session-header">
            <div className="phase-badge">
              Phase {selectedPhase}: {phases[selectedPhase - 1].name}
            </div>
            <div className="exercise-name">{selectedExercise.name}</div>
            <ProgressPanel />
          </div>
          <div className="panels-container">
            <CoachPanel exercise={selectedExercise} phase={selectedPhase} />
            <PatientPanel exercise={selectedExercise} onSessionEnd={handleSessionEnd} />
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