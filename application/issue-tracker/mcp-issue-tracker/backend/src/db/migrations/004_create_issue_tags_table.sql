-- Migration: 004_create_issue_tags_table.sql
-- Create junction table for many-to-many relationship between issues and tags

CREATE TABLE IF NOT EXISTS issue_tags (
    issue_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (issue_id, tag_id),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Create indexes for faster joins
CREATE INDEX IF NOT EXISTS idx_issue_tags_issue_id ON issue_tags(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_tags_tag_id ON issue_tags(tag_id);
