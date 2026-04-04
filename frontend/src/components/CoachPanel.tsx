import { useRef, useEffect, useState } from 'react';
import { type Exercise } from '../types/exercise';
import { Volume2, VolumeX, Play, Pause, Timer, RotateCcw, Repeat, Clock } from 'lucide-react';
import { useSessionTracker } from '../hooks/useSessionTracker';
import { useMediaPipe } from '../hooks/useMediaPipe';

interface CoachPanelProps {
    exercise: Exercise;
    phase?: 1 | 2 | 3;
}

function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

function buildYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&playsinline=1`;
}

export default function CoachPanel({ exercise, phase }: CoachPanelProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);

    // AI SESSION LOGIC
    const { currentRep, endRep } = useSessionTracker();
    const { landmarks, initMediaPipe } = useMediaPipe(videoRef, endRep);

    const youtubeId = exercise.videoUrl ? getYouTubeId(exercise.videoUrl) : null;
    const isYouTube = !!youtubeId;

    useEffect(() => {
        initMediaPipe();
    }, [initMediaPipe]);

    useEffect(() => {
        if (isYouTube || !videoRef.current) return;
        if (isPlaying) {
            videoRef.current.play().catch(() => setIsPlaying(false));
        } else {
            videoRef.current.pause();
        }
    }, [isPlaying, isYouTube]);

    return (
        <div className="coach-panel" style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{exercise.icon}</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>{exercise.name}</h3>
                        <span style={{ fontSize: '12px', color: '#7c8fab' }}>{exercise.subtitle}</span>
                    </div>
                </div>
            </div>

            {/* VIDEO SECTION */}
            <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
                {isYouTube ? (
                    <iframe
                        key={youtubeId}
                        src={buildYouTubeEmbedUrl(youtubeId!)}
                        title={exercise.name}
                        allow="autoplay; encrypted-media"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                ) : (
                    <video ref={videoRef} src={exercise.videoUrl} loop muted={isMuted} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
            </div>

            {/* LIVE STATS GRID */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                background: 'rgba(255,255,255,0.06)',
            }}>
                {[
                    { icon: <RotateCcw size={16} />, label: 'Sets', value: exercise.sets },
                    { icon: <Repeat size={16} />, label: 'Reps', value: `${currentRep} / ${exercise.repsPerSet}` },
                    { icon: <Timer size={16} />, label: 'Hold', value: `${exercise.holdSeconds}s` },
                    { icon: <Clock size={16} />, label: 'Duration', value: `${exercise.durationSeconds}s` },
                ].map((item) => (
                    <div key={item.label} style={{ padding: '12px 10px', textAlign: 'center', color: '#fff' }}>
                        <div style={{ color: '#818cf8', marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.value}</div>
                        <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>{item.label}</div>
                    </div>
                ))}
            </div>

            {/* COACH CUE */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                    <strong style={{ color: '#818cf8' }}>Coach Tip: </strong>{exercise.coachCue}
                </p>
            </div>
        </div>
    );
}