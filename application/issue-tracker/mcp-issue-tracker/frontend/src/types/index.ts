export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  start: string;
  prefix: string;
  userId: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: number;
  title: string;
  description: string;
  status: "not_started" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  created_by_user_id: string;
  assigned_user_id?: string;
  created_at: string;
  updated_at: string;
  created_by_user?: User;
  assigned_user?: User;
  tags?: Tag[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IssueFilters {
  status?: string;
  assigned_user_id?: string;
  tag_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}
