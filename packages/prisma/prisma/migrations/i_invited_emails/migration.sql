-- InvitedEmail: allowlist for first-login. A row grants a person permission
-- to log in via Google even though they have no User row yet. Once the user
-- is enrolled in any CycleMembership the invite is removed — the
-- User/CycleMembership rows are the permanent record from then on.

CREATE TABLE "InvitedEmail" (
  "id"          TEXT         NOT NULL,
  "email"       TEXT         NOT NULL,
  "role"        "Role"       NOT NULL DEFAULT 'MEMBER',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "InvitedEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvitedEmail_email_key" ON "InvitedEmail"("email");

ALTER TABLE "InvitedEmail"
  ADD CONSTRAINT "InvitedEmail_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
