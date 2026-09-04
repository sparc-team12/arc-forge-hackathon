// Shared API types for better type safety

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
  error?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Issue {
  id: number;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_user_id?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  assigned_user?: User | null;
  created_by_user: User;
  tags: Tag[];
}

export interface IssueFilters {
  status?: string;
  priority?: string;
  assigned_user_id?: string;
  created_by_user_id?: string;
  tag_id?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

export interface CreateIssueRequest {
  title: string;
  description?: string;
  status?: "not_started" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_user_id?: string;
  tag_ids?: number[];
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  status?: "not_started" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_user_id?: string;
  tag_ids?: number[];
}

export interface CreateTagRequest {
  name: string;
  color: string;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: "healthy" | "unhealthy";
      tables: string[];
    };
    memory: {
      status: "healthy" | "unhealthy";
      usage: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
      };
      percentage: number;
    };
  };
}
