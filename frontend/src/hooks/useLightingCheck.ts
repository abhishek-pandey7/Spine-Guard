import { useCallback, useRef, useState } from 'react';

export type LightingStatus = 'good' | 'too_dark' | 'too_bright' | 'unknown';

interface UseLightingCheckReturn {
  lightingStatus: LightingStatus;
  getLightingMessage: () => string | null;
  checkLighting: (video: HTMLVideoElement | null) => void;
}

export function useLightingCheck(): UseLightingCheckReturn {
  const [lightingStatus, setLightingStatus] = useState<LightingStatus>('unknown');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const checkLighting = useCallback((video: HTMLVideoElement | null) => {
    if (!video || video.readyState < 2) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 64, 48);
    const imageData = ctx.getImageData(0, 0, 64, 48);
    const data = imageData.data;

    let totalBrightness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const avgBrightness = totalBrightness / pixelCount;

    if (avgBrightness < 40) {
      setLightingStatus('too_dark');
    } else if (avgBrightness > 220) {
      setLightingStatus('too_bright');
    } else {
      setLightingStatus('good');
    }
  }, []);

  const getLightingMessage = useCallback((): string | null => {
    switch (lightingStatus) {
      case 'too_dark':
        return 'Too dark — turn on a light or face a window for better AI tracking.';
      case 'too_bright':
        return 'Too bright — avoid direct sunlight or bright lights behind you.';
      default:
        return null;
    }
  }, [lightingStatus]);

  return { lightingStatus, getLightingMessage, checkLighting };
}