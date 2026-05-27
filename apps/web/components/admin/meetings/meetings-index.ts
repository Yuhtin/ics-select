import type { Lesson, MeetingSummary, NodeGroup } from './lesson-types';
import { urlShortener } from './lessons/url-shortener';
import { chatMessaging } from './lessons/chat-messaging';
import { deployJourney } from './lessons/deploy-journey';
import { backendFundamentos } from './lessons/backend-fundamentos';
import { minecraftEventDriven } from './lessons/minecraft-event-driven';

const LESSONS: Record<string, Lesson> = {
  [urlShortener.slug]: urlShortener,
  [chatMessaging.slug]: chatMessaging,
  [deployJourney.slug]: deployJourney,
  [backendFundamentos.slug]: backendFundamentos,
  [minecraftEventDriven.slug]: minecraftEventDriven,
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
    slidesUrl: l.slidesUrl,
  }));
}
