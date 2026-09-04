# MCP Server Issue Tracker App - GitHub Copilot Instructions

## Project Overview

Build a simple GitHub-style issue tracker for instructing students on coding. The app should be minimal and focused - no extraneous features.

**Tech Stack:**

- Frontend: React.js with shadcn/ui components
- Backend: Fastify API
- Database: SQLite (committed to Git)
- Authentication: BetterAuth

## Core Primitives

1. **Issues** - Main work items with title, description, status, assignee, and tags
2. **Users** - Authentication and assignment capability
3. **Issue Tags** - Arbitrary string labels (e.g., "frontend", "bug", "feature")

## Data Models

### User

- id (primary key)
- email (unique)
- name
- created_at
- updated_at

### Issue

- id (primary key)
- title (required)
- description (optional)
- status (enum: "not_started", "in_progress", "done")
- assigned_user_id (foreign key, nullable)
- created_by_user_id (foreign key)
- created_at
- updated_at

### Tag

- id (primary key)
- name (unique)
- color (hex color for UI)
- created_at

### IssueTag (junction table)

- issue_id (foreign key)
- tag_id (foreign key)
- Primary key: (issue_id, tag_id)

## Required API Endpoints

### Authentication

- POST /auth/signup
- POST /auth/signin
- POST /auth/signout
- GET /auth/me

### Issues

- GET /api/issues (with query params: assigned_to, status, tag)
- POST /api/issues
- GET /api/issues/:id
- PUT /api/issues/:id
- DELETE /api/issues/:id

### Tags

- GET /api/tags
- POST /api/tags
- DELETE /api/tags/:id

### Users

- GET /api/users (for assignment dropdown)

## Frontend Requirements

- Simple, clean UI using shadcn/ui
- Authentication pages (sign in, sign up)
- Issue list with filtering capabilities
- Issue creation/editing forms
- Tag management
- User assignment functionality
- Status updates (not started → in progress → done)

## Key Features

- Filter issues by assignee, status, or tag
- Create/edit/delete issues
- Assign/unassign users to issues
- Add/remove tags from issues
- Simple status workflow
- Responsive design

Please implement this step by step using the TASKS.md checklist below. Be sure to read ahead in TASKS.md so that you don't duplicate effort.
