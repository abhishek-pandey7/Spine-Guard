import { useState, useRef, useCallback, useEffect } from 'react';

export interface WSEvaluationResult {
  frame_id: number;
  passed: boolean;
  checks: Record<string, [boolean, number, string]>;
  primary_cue: string;
  joint_points: [number, number, number[], string][];
  rep_complete: boolean;
  rep_count: number;
  primary_angle?: number;
  error?: string;
}

interface UseExerciseWebSocketReturn {
  isConnected: boolean;
  lastResult: WSEvaluationResult | null;
  connect: (exerciseKey: string) => void;
  disconnect: () => void;
  sendLandmarks: (landmarks: Array<{ x: number; y: number; z: number; visibility: number }>, frameId: number) => void;
}

const WS_BASE = 'ws://localhost:8000';

export function useExerciseWebSocket(): UseExerciseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastResult, setLastResult] = useState<WSEvaluationResult | null>(null);

  const connect = useCallback((exerciseKey: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const url = `${WS_BASE}/ws/exercise/${exerciseKey}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log(`[WS] Connected to exercise: ${exerciseKey}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvaluationResult;
        setLastResult(data);
      } catch (e) {
        console.error('[WS] Failed to parse result:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WS] Disconnected');
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendLandmarks = useCallback((
    landmarks: Array<{ x: number; y: number; z: number; visibility: number }>,
    frameId: number
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ landmarks, frame_id: frameId }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { isConnected, lastResult, connect, disconnect, sendLandmarks };
}
