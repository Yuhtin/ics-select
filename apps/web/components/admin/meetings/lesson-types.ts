export type NodeGroup =
  | 'foundations'
  | 'url'
  | 'pivot'
  | 'chat'
  | 'synthesis'
  | 'local'
  | 'containers'
  | 'cloud'
  | 'scale'
  | 'devops'
  | 'infra'
  | 'api'
  | 'nestjs';

export type Asker = {
  name: string;
  why: string;
};

export type Pegadinha = {
  gotcha: string;
  note: string;
};

export type Scenario = {
  shape: string;
  redirect: string;
};

export type ResponseScenarios = {
  right: Scenario;
  close: Scenario;
  wayOff: Scenario;
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
  askWho?: Asker[];
  followup: string;
  gotcha: string;
  scenarios?: ResponseScenarios;
  /** Mermaid diagram source — render in Obsidian or any Mermaid-compatible viewer */
  diagram?: string;
  /** URL or /public path to a rendered diagram image (PNG/SVG). Takes precedence over diagram when set. */
  diagramUrl?: string;
  /** Terms introduced in this beat — shown as chips in the section header */
  tags?: string[];
};

export type Lesson = {
  slug: string;
  title: string;
  subtitle: string;
  blurb: string;
  durationMin: number;
  audience: string;
  nodes: LessonNode[];
  /** Path to a static slide deck HTML (relative to /public). Set when /public/slides/{slug}.html exists. */
  slidesUrl?: string;
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
  primaryGroup: NodeGroup;
  slidesUrl?: string;
};
