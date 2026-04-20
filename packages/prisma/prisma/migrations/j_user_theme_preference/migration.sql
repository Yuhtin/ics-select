-- ThemePreference: user's chosen appearance. localStorage is the runtime
-- source of truth; this column is written on every change so analytics can
-- chart adoption and (in the future) hydrate on fresh devices.

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "themePreference" "ThemePreference",
ADD COLUMN     "themePreferenceAt" TIMESTAMP(3);
