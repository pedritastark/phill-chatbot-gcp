-- Migration: Remove Primary Goal Constraint to allow free text
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_primary_goal;
