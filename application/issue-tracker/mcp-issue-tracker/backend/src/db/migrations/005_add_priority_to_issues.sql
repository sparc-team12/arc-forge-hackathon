-- Migration: 005_add_priority_to_issues.sql
-- Add priority column to issues table

ALTER TABLE issues ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Create index for priority column for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
