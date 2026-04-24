-- WhatsApp message templates editable via /admin/config. One row per kind;
-- the app falls back to the seed default if a row is missing or disabled.
-- Templates accept {placeholders} that the render layer fills per-call.

CREATE TABLE "WhatsappTemplate" (
    "id"          TEXT        NOT NULL,
    "kind"        TEXT        NOT NULL,
    "template"    TEXT        NOT NULL,
    "enabled"     BOOLEAN     NOT NULL DEFAULT true,
    "description" TEXT,
    "variables"   TEXT[]      DEFAULT ARRAY[]::TEXT[],
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "updatedBy"   TEXT,
    CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappTemplate_kind_key" ON "WhatsappTemplate"("kind");

-- Seed the three currently-used kinds so /admin/config has rows to edit.
INSERT INTO "WhatsappTemplate" ("id", "kind", "template", "description", "variables", "updatedAt")
VALUES
  (
    'seed-session-reminder',
    'session_reminder',
    '{summary} começa em {minutesAway} min. bom estudo {firstName}.',
    'Disparada ~10 min antes de cada bloco de estudo no Google Calendar do membro.',
    ARRAY['firstName', 'minutesAway', 'summary'],
    NOW()
  ),
  (
    'seed-plan-published',
    'plan_published',
    'teu plano da semana tá no ar, {firstName}. bons estudos.',
    'Disparada quando o plano fica disponível pro membro (publicação imediata ou agendada).',
    ARRAY['firstName'],
    NOW()
  ),
  (
    'seed-retro-reminder',
    'retro_reminder',
    'Oi {firstName}, seu retrô da semana abriu. 3 perguntas rápidas, leva 5 min.',
    'Disparada toda sexta às 18h no TZ do membro pra lembrar de submeter o retrô.',
    ARRAY['firstName'],
    NOW()
  );
