import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { IssueForm, type IssueFormData } from "@/components/issues";
import { usersApi, tagsApi, issuesApi } from "@/lib/api";
import type { Issue, User, Tag } from "@/types";

export default function EditIssuePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("Invalid issue ID");
        setLoading(false);
        return;
      }

      try {
        const [issueResponse, usersResponse, tagsResponse] = await Promise.all([
          issuesApi.getIssue(parseInt(id)),
          usersApi.getUsers(),
          tagsApi.getTags(),
        ]);

        // API wrapper functions already return the correct structure
        setIssue(issueResponse.data);
        setUsers(usersResponse.data || []);
        setTags(tagsResponse.data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        if (err instanceof Error && err.message.includes("404")) {
          setError("Issue not found");
        } else {
          setError("Failed to load issue data. Please try again.");
        }
        setUsers([]);
        setTags([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (data: IssueFormData) => {
    if (!issue) return;

    try {
      setSubmitting(true);
      const response = await issuesApi.updateIssue(issue.id, data);
      const updatedIssue = response.data;
      
      // Navigate to the updated issue detail page
      navigate(`/issues/${updatedIssue.id}`);
    } catch (err) {
      console.error("Failed to update issue:", err);
      throw new Error("Failed to update issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (issue) {
      navigate(`/issues/${issue.id}`);
    } else {
      navigate("/issues");
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
        <div className="max-w-2xl mx-auto">
          <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded-md text-center">
            <p className="mb-4">{error || "Issue not found"}</p>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => navigate("/issues")}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Back to Issues
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Edit Issue #{issue.id}</h1>
          <p className="text-muted-foreground">
            Update the issue details below.
          </p>
        </div>

        <IssueForm
          issue={issue}
          users={users}
          tags={tags}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </div>
    </div>
  );
}
