-- Migration: 006_update_status_values.sql
-- Update status values to match frontend expectations

-- First, update any existing data to use the new status values
UPDATE issues SET status = 'open' WHERE status = 'not_started';
UPDATE issues SET status = 'resolved' WHERE status = 'done';
-- 'in_progress' remains the same

-- Drop the existing check constraint (this requires recreating the table in SQLite)
-- Create a backup table
CREATE TABLE issues_backup AS SELECT * FROM issues;

-- Drop the original table
DROP TABLE issues;

-- Recreate with updated constraints
CREATE TABLE issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_user_id TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    FOREIGN KEY (assigned_user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Copy data back
INSERT INTO issues SELECT * FROM issues_backup;

-- Drop backup table
DROP TABLE issues_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_user_id ON issues(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_by_user_id ON issues(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);

-- Recreate trigger
CREATE TRIGGER IF NOT EXISTS update_issues_updated_at 
    AFTER UPDATE ON issues
    FOR EACH ROW
    BEGIN
        UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
