import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { WhatsappKind } from './whatsapp.service.js';

/**
 * Hardcoded fallbacks — used when the DB row for a kind is missing or the
 * template is empty. Mirrors the seed in migration o_whatsapp_templates so
 * the app stays sendable even if an admin nukes the table.
 */
const DEFAULTS: Record<WhatsappKind, { template: string; variables: string[] }> = {
  session_reminder: {
    template: '{summary} começa em {minutesAway} min. bom estudo {firstName}.',
    variables: ['firstName', 'minutesAway', 'summary'],
  },
  plan_published: {
    template: 'teu plano da semana tá no ar, {firstName}. bons estudos.',
    variables: ['firstName'],
  },
  retro_reminder: {
    template: 'Oi {firstName}, seu retrô da semana abriu. 3 perguntas rápidas, leva 5 min.',
    variables: ['firstName'],
  },
  stuck_alert: {
    template: '{firstName}, vi que você travou em {summary}. precisa de ajuda?',
    variables: ['firstName', 'summary'],
  },
  test: {
    template: 'mensagem de teste do ICS Select.',
    variables: [],
  },
};

export type RenderResult = { text: string; enabled: boolean };

@Injectable()
export class WhatsappTemplateService {
  private readonly logger = new Logger(WhatsappTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Render a template by kind, filling {placeholders} from `vars`. Falls back
   * to the hardcoded default if no DB row exists. Returns `{ enabled: false }`
   * when the admin disabled the template — caller should skip sending.
   */
  async render(kind: WhatsappKind, vars: Record<string, string | number>): Promise<RenderResult> {
    const row = await this.prisma.whatsappTemplate.findUnique({ where: { kind } });
    const fallback = DEFAULTS[kind];
    const template = row?.template?.trim() ? row.template : fallback.template;
    const enabled = row ? row.enabled : true;
    return { text: fillTemplate(template, vars), enabled };
  }

  list() {
    return this.prisma.whatsappTemplate.findMany({ orderBy: { kind: 'asc' } });
  }

  async update(
    kind: WhatsappKind,
    input: { template?: string; enabled?: boolean; description?: string | null },
    updatedBy?: string,
  ) {
    const fallback = DEFAULTS[kind];
    if (!fallback) throw new NotFoundException(`unknown kind: ${kind}`);
    return this.prisma.whatsappTemplate.upsert({
      where: { kind },
      create: {
        kind,
        template: input.template ?? fallback.template,
        enabled: input.enabled ?? true,
        description: input.description ?? null,
        variables: fallback.variables,
        updatedBy: updatedBy ?? null,
      },
      update: {
        ...(input.template !== undefined ? { template: input.template } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedBy: updatedBy ?? null,
      },
    });
  }

  /** Variables expected by each kind — used by the admin editor for hints. */
  variablesFor(kind: WhatsappKind): string[] {
    return DEFAULTS[kind]?.variables ?? [];
  }
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}
