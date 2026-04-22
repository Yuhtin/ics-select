-- Add SKIPPED to ItemOutcome enum for foundations skip feature.
-- Members can mark foundations library items as "already known" which counts
-- toward topic completion with zero time/Calendar cost.
ALTER TYPE "ItemOutcome" ADD VALUE 'SKIPPED';
