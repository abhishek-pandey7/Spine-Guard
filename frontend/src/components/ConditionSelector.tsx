import { useState } from 'react';
import { type BackCondition } from '../types/exercise';
import { ClipboardList, ChevronRight } from 'lucide-react';

interface ConditionSelectorProps {
  onSelect: (condition: BackCondition) => void;
}

const CONDITIONS: { id: BackCondition; name: string; description: string; icon: string }[] = [
  { id: 'Muscle Strain', name: 'Muscle Strain', description: 'Pain after lifting or sudden move', icon: '🏋️' },
  { id: 'Sciatica', name: 'Sciatica', description: 'Pain radiating down the leg', icon: '⚡' },
  { id: 'Herniated Disc', name: 'Herniated Disc', description: 'Nerve compression or disc bulge', icon: '💿' },
  { id: 'Postural', name: 'Postural Pain', description: 'Stiffness from sitting or standing', icon: '💻' },
  { id: 'Chronic', name: 'Chronic Pain', description: 'Pain lasting more than 3 months', icon: '📅' },
  { id: 'Facet Joint', name: 'Facet Joint', description: 'Sharp pain when leaning back', icon: '🦴' },
  { id: 'Stenosis', name: 'Spinal Stenosis', description: 'Numbness or weakness when walking', icon: '🚶' },
];

export default function ConditionSelector({ onSelect }: ConditionSelectorProps) {
  const [selected, setSelected] = useState<BackCondition | null>(null);

  return (
    <div className="checkin-screen">
      <div className="checkin-card condition-card">
        <div className="checkin-header">
          <ClipboardList size={40} className="checkin-icon" />
          <h1>Back Condition</h1>
          <p>Please select the primary concern we are addressing today</p>
        </div>
        
        <div className="condition-grid">
          {CONDITIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`condition-btn ${selected === c.id ? 'selected' : ''}`}
            >
              <span className="condition-icon">{c.icon}</span>
              <div className="condition-info">
                <span className="condition-name">{c.name}</span>
                <span className="condition-desc">{c.description}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="checkin-footer">
          <button
            className="btn-confirm"
            disabled={selected === null}
            onClick={() => selected !== null && onSelect(selected)}
          >
            Update Program <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
