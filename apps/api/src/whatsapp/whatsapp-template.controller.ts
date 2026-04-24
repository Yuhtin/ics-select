import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { WhatsappTemplateService } from './whatsapp-template.service.js';
import type { WhatsappKind } from './whatsapp.service.js';

const KINDS: WhatsappKind[] = [
  'session_reminder',
  'plan_published',
  'retro_reminder',
  'stuck_alert',
  'test',
];

const KindSchema = z.enum(KINDS as [WhatsappKind, ...WhatsappKind[]]);

const UpdateSchema = z.object({
  template: z.string().min(1).max(2000).optional(),
  enabled: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
});

@Roles('ADMIN')
@Controller('admin/whatsapp/templates')
export class WhatsappTemplateController {
  constructor(private readonly templates: WhatsappTemplateService) {}

  @Get()
  async list() {
    const rows = await this.templates.list();
    const byKind = new Map(rows.map((r) => [r.kind as WhatsappKind, r] as const));
    // Always return a row per known kind so the editor renders even for kinds
    // that haven't been customized yet — falls back to defaults from the
    // service.
    return KINDS.map((kind) => {
      const row = byKind.get(kind);
      const variables = this.templates.variablesFor(kind);
      return {
        kind,
        template: row?.template ?? '',
        enabled: row?.enabled ?? true,
        description: row?.description ?? null,
        variables,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    });
  }

  @Patch(':kind')
  async update(
    @Param('kind') kindParam: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const kind = KindSchema.parse(kindParam);
    const input = UpdateSchema.parse(body);
    const updated = await this.templates.update(kind, input, user.sub);
    return {
      kind: updated.kind,
      template: updated.template,
      enabled: updated.enabled,
      description: updated.description,
      variables: this.templates.variablesFor(kind),
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: updated.updatedBy,
    };
  }
}
