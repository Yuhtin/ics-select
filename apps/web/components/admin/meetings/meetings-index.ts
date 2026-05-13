import type { Lesson, MeetingSummary } from './lesson-types';
import { urlShortenerVsChat } from './lessons/url-shortener-vs-chat';

const LESSONS: Record<string, Lesson> = {
  [urlShortenerVsChat.slug]: urlShortenerVsChat,
};

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS[slug];
}

export function listMeetings(): MeetingSummary[] {
  return Object.values(LESSONS).map((l) => ({
    slug: l.slug,
    title: l.title,
    subtitle: l.subtitle,
    blurb: l.blurb,
    durationMin: l.durationMin,
    audience: l.audience,
    beatCount: l.nodes.filter((n) => typeof n.beat === 'number').length,
    status: 'ready' as const,
  }));
}
