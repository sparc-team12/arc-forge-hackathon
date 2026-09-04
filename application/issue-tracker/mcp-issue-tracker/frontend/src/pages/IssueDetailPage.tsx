import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TagBadge, UserAvatar } from "@/components/common";
import { issuesApi } from "@/lib/api";
import type { Issue } from "@/types";

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchIssue = async () => {
      if (!id) {
        setError("Invalid issue ID");
        setLoading(false);
        return;
      }

      try {
        const response = await issuesApi.getIssue(parseInt(id));
        setIssue(response.data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch issue:", err);
        setError("Failed to load issue. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchIssue();
  }, [id]);

  const handleDelete = async () => {
    if (!issue || !confirm("Are you sure you want to delete this issue?")) {
      return;
    }

    try {
      setDeleteLoading(true);
      await issuesApi.deleteIssue(issue.id);
      navigate("/issues");
    } catch (err) {
      console.error("Failed to delete issue:", err);
      alert("Failed to delete issue. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Invalid Date";
    
    // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS)
    // Add 'T' to make it ISO format if it's missing
    const isoDateString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T');
    
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority: Issue["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="text-lg">Loading issue...</div>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 text-lg mb-4">
              {error || "Issue not found"}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" asChild>
                <Link to="/issues">Back to Issues</Link>
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/issues">← Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Issue #{issue.id}</h1>
            <p className="text-muted-foreground">
              Created {formatDate(issue.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/issues/${issue.id}/edit`}>Edit</Link>
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      {/* Issue Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{issue.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {issue.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {issue.tags && issue.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {issue.tags.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status and Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="mt-1">
                  <StatusBadge status={issue.status} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Priority
                </label>
                <div className="mt-1">
                  <Badge className={getPriorityColor(issue.priority || 'medium')}>
                    {issue.priority ? 
                      issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1) :
                      'Medium'
                    }
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Assigned User
                </label>
                <div className="mt-1">
                  {issue.assigned_user ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar user={issue.assigned_user} size="sm" />
                      <span className="text-sm">{issue.assigned_user.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <p className="text-sm mt-1">{formatDate(issue.created_at)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </label>
                <p className="text-sm mt-1">{formatDate(issue.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Creator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Created By</CardTitle>
            </CardHeader>
            <CardContent>
              {issue.created_by_user ? (
                <div className="flex items-center gap-2">
                  <UserAvatar user={issue.created_by_user} size="sm" />
                  <span className="text-sm">{issue.created_by_user.name}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unknown user</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
