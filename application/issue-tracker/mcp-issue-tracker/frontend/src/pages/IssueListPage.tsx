import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading";
import { IssueCard } from "@/components/issues";
import { UserAvatar, TagBadge, EmptyIssues, EmptySearchResults } from "@/components/common";
import { useToast } from "@/hooks/useToast";
import { issuesApi, usersApi, tagsApi } from "@/lib/api";
import type { Issue, User, Tag } from "@/types";

interface IssueFilters {
  search?: string;
  status?: string;
  assignedUserId?: string;
  tagId?: string;
  page?: number;
  limit?: number;
}

export default function IssueListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Get filters from URL params
  const filters: IssueFilters = useMemo(() => ({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    assignedUserId: searchParams.get("assignedUserId") || "",
    tagId: searchParams.get("tagId") || "",
    page: parseInt(searchParams.get("page") || "1"),
    limit: 10,
  }), [searchParams]);

  // Update URL when filters change
  const updateFilters = (newFilters: Partial<IssueFilters>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "") {
        params.set(key, value.toString());
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change (except when changing page)
    if (!("page" in newFilters)) {
      params.delete("page");
      setCurrentPage(1);
    }

    setSearchParams(params);
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Clean filters - remove "all" values and convert "unassigned" to empty string
      const cleanedFilters = {
        ...filters,
        status: filters.status === "all" ? "" : filters.status,
        assignedUserId: filters.assignedUserId === "all" ? "" : 
                       filters.assignedUserId === "unassigned" ? "" : filters.assignedUserId,
        tagId: filters.tagId === "all" ? "" : filters.tagId,
      };

      const [issuesResponse, usersResponse, tagsResponse] = await Promise.all([
        issuesApi.getIssues(cleanedFilters),
        usersApi.getUsers(),
        tagsApi.getTags(),
      ]);

      setIssues(issuesResponse.data || []);
      setTotalPages(issuesResponse.pagination?.totalPages || 1);
      setCurrentPage(issuesResponse.pagination?.page || 1);
      setUsers(usersResponse.data || []);
      setTags(tagsResponse.data || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      const errorMessage = "Failed to load issues. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear all filters
  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // Check if any filters are active
  const hasActiveFilters = filters.search || filters.status || filters.assignedUserId || filters.tagId;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Loading issues..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground">
            Manage and track all project issues
          </p>
        </div>
        <Button asChild>
          <Link to="/issues/new">Create Issue</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <Input
              placeholder="Search issues by title or description..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />
          </div>

          {/* Filter selects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Status filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilters({ status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned user filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned User</label>
              <Select
                value={filters.assignedUserId}
                onValueChange={(value) => updateFilters({ assignedUserId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={user} size="sm" />
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tag filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tag</label>
              <Select
                value={filters.tagId}
                onValueChange={(value) => updateFilters({ tagId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id.toString()}>
                      <TagBadge tag={tag} variant="outline" />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData}
              className="mt-2"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Issues list */}
      <div className="space-y-4">
        {issues.length === 0 ? (
          hasActiveFilters ? (
            <EmptySearchResults />
          ) : (
            <EmptyIssues onCreateIssue={() => navigate('/issues/new')} />
          )
        ) : (
          issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              showActions
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => updateFilters({ page: currentPage - 1 })}
          >
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => updateFilters({ page: currentPage + 1 })}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
