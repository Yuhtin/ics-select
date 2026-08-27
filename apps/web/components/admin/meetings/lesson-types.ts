export type NodeGroup =
  | 'foundations'
  | 'fundamentos'
  | 'ferramentas'
  | 'avancado'
  | 'fechamento'
  | 'antes'
  | 'executando'
  | 'dado'
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
  | 'nestjs'
  | 'packets'
  | 'tick'
  | 'events'
  | 'money'
  | 'ledger'
  | 'nearest'
  | 'index'
  | 'dispatch'
  | 'stream'
  | 'smooth'
  | 'fanout'
  | 'rpc'
  | 'live'
  | 'panel';

export type Asker = {
  name: string;
  why: string;
};

export type Pegadinha = {
  gotcha: string;
  note: string;
};

/**
 * Visual do pass de deep dive. Existe para o facilitador REDESENHAR no quadro,
 * então `ascii` é o formato principal: monoespaçado, sem cor, copiável a mão.
 * `image` é para a figura canônica que não compensa redesenhar (o layout do
 * IEEE 754, por exemplo). Toda imagem é externa e precisa de `credit`.
 */
export type BoardVisual =
  | {
      kind: 'ascii';
      title: string;
      /** Arte monoespaçada. Máximo ~72 colunas para caber no painel sem scroll. */
      art: string;
      caption?: string;
      /** O que o facilitador diz enquanto desenha isso no quadro. */
      board?: string;
    }
  | {
      kind: 'image';
      title: string;
      src: string;
      alt: string;
      caption?: string;
      /** Fonte da imagem. Obrigatório: nada entra sem crédito. */
      credit: string;
      creditUrl?: string;
      board?: string;
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
  /** Visuais do pass de deep dive, renderizados abaixo da prosa. */
  visuals?: BoardVisual[];
};

export type GlossaryTerm = {
  term: string;
  definition: string;
};

/** Um bloco do glossário da aula. O título agrupa por momento da aula, não por assunto solto. */
export type GlossaryGroup = {
  title: string;
  terms: GlossaryTerm[];
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
  /**
   * Glossário da aula, pra mandar pros alunos depois. Diferente do GLOSSARY
   * global de `glossary.ts`, que é um dicionário compartilhado usado nos
   * popovers do texto: este é por aula, agrupado e feito pra ser copiado.
   */
  glossary?: GlossaryGroup[];
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
