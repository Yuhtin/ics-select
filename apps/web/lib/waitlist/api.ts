import { apiFetch } from '../api/client';
import type { WaitlistCourse } from './course';

export type WaitlistSubmitPayload = {
  name: string;
  email: string;
  course: WaitlistCourse;
  skillLevel: number;
  github?: string;
  linkedin?: string;
  wantsUpdates: boolean;
  website?: string; // honeypot
};

export async function submitWaitlist(payload: WaitlistSubmitPayload): Promise<{ ok: true }> {
  // Public endpoint — call fetch directly, no auth headers.
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${base}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`waitlist_submit_failed_${res.status}`);
  return res.json();
}

export type WaitlistConfig = {
  cycleTarget: string | null;
  startsAt: string | null;
};

export async function getWaitlistConfig(): Promise<WaitlistConfig> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${base}/waitlist/config`);
  if (!res.ok) throw new Error(`waitlist_config_failed_${res.status}`);
  return res.json();
}

export type WaitlistEntry = {
  id: string;
  name: string;
  email: string;
  course: WaitlistCourse;
  skillLevel: number;
  github: string | null;
  linkedin: string | null;
  wantsUpdates: boolean;
  cycleTarget: string;
  createdAt: string;
  updatedAt: string;
};

export type WaitlistListResponse = {
  items: WaitlistEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export type WaitlistFilters = {
  page?: number;
  pageSize?: number;
  course?: WaitlistCourse;
  skillMin?: number;
  skillMax?: number;
  wantsUpdates?: boolean;
  q?: string;
};

export function listWaitlist(filters: WaitlistFilters): Promise<WaitlistListResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  return apiFetch<WaitlistListResponse>(`/admin/waitlist?${params.toString()}`);
}

export type WaitlistStats = {
  total: number;
  last7d: number;
  wantsUpdatesPct: number;
  byCourse: { course: WaitlistCourse; count: number }[];
  bySkill: { skillLevel: number; count: number }[];
};

export function getWaitlistStats(): Promise<WaitlistStats> {
  return apiFetch<WaitlistStats>('/admin/waitlist/stats');
}
