import type { SessionLog, ProgressEntry } from '../types/session';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  logSession: (log: SessionLog) =>
    request<{ id: string; message: string }>('/session/log', {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  getProgress: (patientId: string) =>
    request<ProgressEntry[]>(`/session/progress/${patientId}`),

  getExercises: () =>
    request<{ exercises: Array<{ id: string; name: string; phase: number }> }>('/exercises'),

  healthCheck: () => request<{ status: string }>('/health'),
};

// Named export used by useSessionTracker / useCalibration
export const logSession = (payload: unknown) =>
  request<{ id: string }>('/session/log', {
    method: 'POST',
    body: JSON.stringify(payload),
  });