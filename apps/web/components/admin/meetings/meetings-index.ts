import type { Lesson, MeetingSummary, NodeGroup } from './lesson-types';
import { urlShortener } from './lessons/url-shortener';
import { chatMessaging } from './lessons/chat-messaging';

const LESSONS: Record<string, Lesson> = {
  [urlShortener.slug]: urlShortener,
  [chatMessaging.slug]: chatMessaging,
};

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS[slug];
}

function primaryGroupOf(lesson: Lesson): NodeGroup {
  const firstBeat = lesson.nodes.find((n) => typeof n.beat === 'number');
  return firstBeat?.group ?? 'foundations';
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
    primaryGroup: primaryGroupOf(l),
  }));
}
