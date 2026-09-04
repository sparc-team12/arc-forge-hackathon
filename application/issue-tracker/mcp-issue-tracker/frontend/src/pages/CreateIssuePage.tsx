import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { IssueForm, type IssueFormData } from "@/components/issues";
import { usersApi, tagsApi, issuesApi } from "@/lib/api";
import type { User, Tag } from "@/types";

export default function CreateIssuePage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, tagsResponse] = await Promise.all([
          usersApi.getUsers(),
          tagsApi.getTags(),
        ]);

        // API wrapper functions already return the correct structure
        setUsers(usersResponse.data || []);
        setTags(tagsResponse.data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load form data. Please try again.");
        setUsers([]);
        setTags([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (data: IssueFormData) => {
    try {
      setSubmitting(true);
      const response = await issuesApi.createIssue(data);
      const newIssue = response.data;
      
      // Navigate to the new issue detail page
      navigate(`/issues/${newIssue.id}`);
    } catch (err) {
      console.error("Failed to create issue:", err);
      throw new Error("Failed to create issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/issues");
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded-md text-center">
            <p className="mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create New Issue</h1>
          <p className="text-muted-foreground">
            Fill in the details below to create a new issue.
          </p>
        </div>

        <IssueForm
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
