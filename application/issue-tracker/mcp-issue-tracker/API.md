# API Documentation

## Overview

The Issue Tracker API provides RESTful endpoints for managing issues, tags, and user authentication. All API endpoints are prefixed with `/api` except for authentication endpoints which use `/api/auth`.

**Base URL:** `http://localhost:3000` (development) or `https://your-domain.com` (production)

## Authentication

The API uses BetterAuth for session-based authentication. Most endpoints require authentication.

### Authentication Endpoints

#### Sign Up

```http
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (201):**

```json
{
  "user": {
    "id": "user_123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2025-07-12T10:30:00.000Z",
    "updatedAt": "2025-07-12T10:30:00.000Z"
  },
  "session": {
    "id": "session_456",
    "userId": "user_123",
    "expiresAt": "2025-08-12T10:30:00.000Z"
  }
}
```

#### Sign In

```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):** Same as sign up response

#### Get Session

```http
GET /api/auth/get-session
Cookie: better-auth.session_token=<session_token>
```

**Response (200):**

```json
{
  "user": {
    "id": "user_123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2025-07-12T10:30:00.000Z",
    "updatedAt": "2025-07-12T10:30:00.000Z"
  },
  "session": {
    "id": "session_456",
    "userId": "user_123",
    "expiresAt": "2025-08-12T10:30:00.000Z"
  }
}
```

#### Sign Out

```http
POST /api/auth/sign-out
Cookie: better-auth.session_token=<session_token>
```

**Response (200):**

```json
{
  "success": true
}
```

## Issues API

### List Issues

```http
GET /api/issues?status=open&assigned_user_id=user_123&tag_ids=1,2&search=bug&page=1&limit=10&priority=high&created_by_user_id=user_456
```

**Query Parameters:**

- `status` (optional): `not_started`, `in_progress`, `done`
- `assigned_user_id` (optional): Filter by assigned user ID
- `tag_ids` (optional): Comma-separated tag IDs
- `search` (optional): Search in title and description
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `priority` (optional): `low`, `medium`, `high`
- `created_by_user_id` (optional): Filter by creator user ID

**Response (200):**

```json
{
  "issues": [
    {
      "id": 1,
      "title": "Fix login bug",
      "description": "Users can't log in with special characters",
      "status": "not_started",
      "priority": "high",
      "assigned_user_id": "user_123",
      "created_by_user_id": "user_456",
      "created_at": "2025-07-12T10:30:00.000Z",
      "updated_at": "2025-07-12T10:30:00.000Z",
      "assigned_user": {
        "id": "user_123",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "created_by_user": {
        "id": "user_456",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "tags": [
        {
          "id": 1,
          "name": "bug",
          "color": "#ef4444"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Create Issue

```http
POST /api/issues
Content-Type: application/json
Cookie: better-auth.session_token=<session_token>

{
  "title": "Add dark mode",
  "description": "Implement dark mode toggle for better user experience",
  "status": "not_started",
  "priority": "medium",
  "assigned_user_id": "user_123",
  "tag_ids": [1, 2]
}
```

**Response (201):**

```json
{
  "id": 2,
  "title": "Add dark mode",
  "description": "Implement dark mode toggle for better user experience",
  "status": "not_started",
  "priority": "medium",
  "assigned_user_id": "user_123",
  "created_by_user_id": "user_456",
  "created_at": "2025-07-12T10:35:00.000Z",
  "updated_at": "2025-07-12T10:35:00.000Z"
}
```

### Get Issue by ID

```http
GET /api/issues/1
```

**Response (200):**

```json
{
  "id": 1,
  "title": "Fix login bug",
  "description": "Users can't log in with special characters",
  "status": "not_started",
  "priority": "high",
  "assigned_user_id": "user_123",
  "created_by_user_id": "user_456",
  "created_at": "2025-07-12T10:30:00.000Z",
  "updated_at": "2025-07-12T10:30:00.000Z",
  "assigned_user": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "created_by_user": {
    "id": "user_456",
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "tags": [
    {
      "id": 1,
      "name": "bug",
      "color": "#ef4444"
    }
  ]
}
```

### Update Issue

```http
PUT /api/issues/1
Content-Type: application/json
Cookie: better-auth.session_token=<session_token>

{
  "title": "Fix login bug - Updated",
  "status": "in_progress",
  "priority": "high",
  "assigned_user_id": "user_789",
  "tag_ids": [1, 3]
}
```

**Response (200):**

```json
{
  "id": 1,
  "title": "Fix login bug - Updated",
  "description": "Users can't log in with special characters",
  "status": "in_progress",
  "priority": "high",
  "assigned_user_id": "user_789",
  "created_by_user_id": "user_456",
  "created_at": "2025-07-12T10:30:00.000Z",
  "updated_at": "2025-07-12T10:40:00.000Z"
}
```

### Delete Issue

```http
DELETE /api/issues/1
Cookie: better-auth.session_token=<session_token>
```

**Response (200):**

```json
{
  "message": "Issue deleted successfully"
}
```

## Tags API

### List Tags

```http
GET /api/tags
```

**Response (200):**

```json
[
  {
    "id": 1,
    "name": "bug",
    "color": "#ef4444"
  },
  {
    "id": 2,
    "name": "feature",
    "color": "#8b5cf6"
  }
]
```

### Create Tag

```http
POST /api/tags
Content-Type: application/json
Cookie: better-auth.session_token=<session_token>

{
  "name": "enhancement",
  "color": "#f59e0b"
}
```

**Response (201):**

```json
{
  "id": 3,
  "name": "enhancement",
  "color": "#f59e0b"
}
```

### Delete Tag

```http
DELETE /api/tags/3
Cookie: better-auth.session_token=<session_token>
```

**Response (200):**

```json
{
  "message": "Tag deleted successfully"
}
```

**Error if tag is in use (400):**

```json
{
  "error": "Cannot delete tag that is assigned to issues"
}
```

## Users API

### List Users

```http
GET /api/users
Cookie: better-auth.session_token=<session_token>
```

**Response (200):**

```json
[
  {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  {
    "id": "user_456",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
]
```

## Health Check API

### Health Status

```http
GET /health
```

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2025-07-12T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 45.2,
    "total": 512.0,
    "usage": "8.8%"
  },
  "database": {
    "status": "connected",
    "responseTime": 2.5
  }
}
```

### Readiness Probe

```http
GET /health/ready
```

**Response (200):**

```json
{
  "status": "ready"
}
```

### Liveness Probe

```http
GET /health/live
```

**Response (200):**

```json
{
  "status": "alive"
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error, malformed data)
- **401** - Unauthorized (not authenticated)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **409** - Conflict (duplicate data)
- **422** - Unprocessable Entity (validation failed)
- **500** - Internal Server Error

### Common Error Examples

#### Validation Error (400)

```json
{
  "error": "Validation failed",
  "details": "Title is required and must be between 1 and 200 characters"
}
```

#### Authentication Required (401)

```json
{
  "error": "Authentication required"
}
```

#### Resource Not Found (404)

```json
{
  "error": "Issue not found"
}
```

#### Duplicate Resource (409)

```json
{
  "error": "Tag with this name already exists"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting for production use:

- Authentication endpoints: 5 requests/minute per IP
- API endpoints: 100 requests/minute per user
- Health checks: Unlimited

## CORS Configuration

The API supports CORS for frontend applications:

- **Development**: `http://localhost:5173`
- **Production**: Configure `FRONTEND_URL` environment variable

## Data Types

### Issue Status

- `not_started` - Issue has not been started
- `in_progress` - Issue is currently being worked on
- `done` - Issue has been completed

### Issue Priority

- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority

### Tag Colors

Standard color palette for tags:

- `#ef4444` - Red (bugs, urgent)
- `#f59e0b` - Amber (warnings, enhancements)
- `#10b981` - Emerald (backend, success)
- `#3b82f6` - Blue (frontend, info)
- `#8b5cf6` - Violet (features, new)
- `#6b7280` - Gray (documentation, misc)

## SDK/Client Libraries

### JavaScript/TypeScript

```typescript
// Example API client setup
const api = axios.create({
  baseURL: "http://localhost:3000/api",
  withCredentials: true,
});

// Get issues
const issues = await api.get("/issues?status=open");

// Create issue
const newIssue = await api.post("/issues", {
  title: "New issue",
  description: "Issue description",
  status: "not_started",
});
```

### Curl Examples

```bash
# Sign in
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}' \
  -c cookies.txt

# Get issues
curl -X GET http://localhost:3000/api/issues \
  -b cookies.txt

# Create issue
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"New issue","description":"Description","status":"not_started"}'
```
