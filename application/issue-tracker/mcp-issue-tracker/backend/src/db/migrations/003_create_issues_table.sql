-- Migration: 003_create_issues_table.sql
-- Create issues table for main work items

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
    assigned_user_id TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_user_id ON issues(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_by_user_id ON issues(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_issues_updated_at 
    AFTER UPDATE ON issues
    FOR EACH ROW
    BEGIN
        UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
