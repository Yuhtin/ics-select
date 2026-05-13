import type { NodeGroup } from './lesson-types';

type GroupVisual = {
  label: string;
  eyebrow: string;
  accentClass: string;
  ringClass: string;
  stripeClass: string;
  tintClass: string;
};

export const GROUP_META: Record<NodeGroup, GroupVisual> = {
  foundations: {
    label: 'Foundations',
    eyebrow: 'Foundations',
    accentClass: 'text-fg-soft',
    ringClass: 'bg-fg-faint',
    stripeClass: 'bg-fg-faint',
    tintClass: 'bg-bg-subtle',
  },
  url: {
    label: 'URL Shortener',
    eyebrow: 'URL Shortener',
    accentClass: 'text-primary',
    ringClass: 'bg-primary',
    stripeClass: 'bg-primary',
    tintClass: 'bg-primary-soft/40',
  },
  pivot: {
    label: 'Pivot',
    eyebrow: 'Pivot',
    accentClass: 'text-warn',
    ringClass: 'bg-warn',
    stripeClass: 'bg-warn',
    tintClass: 'bg-warn-soft/40',
  },
  chat: {
    label: 'Chat & Messaging',
    eyebrow: 'Chat & Messaging',
    accentClass: 'text-reflect',
    ringClass: 'bg-reflect',
    stripeClass: 'bg-reflect',
    tintClass: 'bg-reflect-soft/40',
  },
  synthesis: {
    label: 'Synthesis',
    eyebrow: 'Synthesis',
    accentClass: 'text-success',
    ringClass: 'bg-success',
    stripeClass: 'bg-success',
    tintClass: 'bg-success-soft/40',
  },
};
