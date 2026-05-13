export type NodeGroup = 'foundations' | 'url' | 'pivot' | 'chat' | 'synthesis';

export type Asker = {
  name: string;
  why: string;
};

export type Pegadinha = {
  gotcha: string;
  note: string;
};

export type LessonNode = {
  id: string;
  label: string;
  group: NodeGroup;
  beat?: number;
  teachFromZero?: boolean;
  oneLine: string;
  pass1: string;
  pass2: string;
  pass3: Pegadinha[];
  anchor: string;
  askWho: Asker[];
  followup: string;
  gotcha: string;
};

export type Lesson = {
  slug: string;
  title: string;
  subtitle: string;
  blurb: string;
  durationMin: number;
  audience: string;
  nodes: LessonNode[];
};

export type MeetingSummary = {
  slug: string;
  title: string;
  subtitle: string;
  blurb: string;
  durationMin: number;
  audience: string;
  beatCount: number;
  status: 'ready' | 'draft';
};
