-- Per-account exception (superadmin-granted) letting one specific
-- BOUTIQUE_ADMIN manage their boutique's appearance settings (theme/color,
-- color mode, hero/card layout) — everyone else stays superadmin-only.
ALTER TABLE "AdminUser" ADD COLUMN "canManageAppearance" BOOLEAN NOT NULL DEFAULT false;
