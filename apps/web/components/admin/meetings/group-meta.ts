import type { NodeGroup } from './lesson-types';

export const GROUP_META: Record<
  NodeGroup,
  { label: string; eyebrow: string; accentClass: string; ringClass: string }
> = {
  foundations: {
    label: 'Foundations',
    eyebrow: 'Foundations',
    accentClass: 'text-fg-soft',
    ringClass: 'bg-fg-faint',
  },
  url: {
    label: 'URL Shortener',
    eyebrow: 'URL Shortener',
    accentClass: 'text-primary',
    ringClass: 'bg-primary',
  },
  pivot: {
    label: 'Pivot',
    eyebrow: 'Pivot',
    accentClass: 'text-warn',
    ringClass: 'bg-warn',
  },
  chat: {
    label: 'Chat & Messaging',
    eyebrow: 'Chat & Messaging',
    accentClass: 'text-reflect',
    ringClass: 'bg-reflect',
  },
  synthesis: {
    label: 'Synthesis',
    eyebrow: 'Synthesis',
    accentClass: 'text-success',
    ringClass: 'bg-success',
  },
};
