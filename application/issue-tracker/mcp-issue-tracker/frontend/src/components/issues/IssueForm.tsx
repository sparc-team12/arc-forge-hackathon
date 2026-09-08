import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading";
import TagBadge from "@/components/common/TagBadge";
import UserAvatar from "@/components/common/UserAvatar";
import { useToast } from "@/hooks/useToast";
import type { Issue, User, Tag } from "@/types";

interface IssueFormProps {
  issue?: Issue; // If provided, form is in edit mode
  users?: User[];
  tags?: Tag[];
  onSubmit: (data: IssueFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

export interface IssueFormData {
  title: string;
  description: string;
  priority: Issue["priority"];
  status?: Issue["status"];
  assigned_user_id?: string;
  tag_ids: number[];
}

export default function IssueForm({
  issue,
  users = [],
  tags = [],
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: IssueFormProps) {
  const toast = useToast();
  const [formData, setFormData] = useState<IssueFormData>({
    title: issue?.title || "",
    description: issue?.description || "",
    priority: issue?.priority || "medium",
    status: issue?.status || "not_started",
    assigned_user_id: issue?.assigned_user_id || "unassigned",
    tag_ids: issue?.tags?.map(tag => tag.id) || [],
  });
  
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>(
    issue?.tags || []
  );

  const isEditMode = !!issue;

  // Update selected tags when tag_ids change
  useEffect(() => {
    const newSelectedTags = (tags || []).filter(tag => 
      formData.tag_ids.includes(tag.id)
    );
    setSelectedTags(newSelectedTags);
  }, [formData.tag_ids, tags]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.title.trim()) {
      const errorMsg = "Title is required";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (!formData.description.trim()) {
      const errorMsg = "Description is required";
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      // Clean the form data before submission
      const cleanedFormData = {
        ...formData,
        assigned_user_id: formData.assigned_user_id === "unassigned" ? undefined : formData.assigned_user_id || undefined,
      };
      await onSubmit(cleanedFormData);
      toast.success(issue ? "Issue updated successfully!" : "Issue created successfully!");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save issue";
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleTagToggle = (tag: Tag) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tag.id)
        ? prev.tag_ids.filter(id => id !== tag.id)
        : [...prev.tag_ids, tag.id]
    }));
  };

  const handleTagRemove = (tagId: number) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.filter(id => id !== tagId)
    }));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Edit Issue" : "Create New Issue"}
        </CardTitle>
        <CardDescription>
          {isEditMode 
            ? "Update the issue details below." 
            : "Fill in the details to create a new issue."
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title *
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter issue title"
              required
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the issue in detail"
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              required
              disabled={isLoading}
            />
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={formData.priority}
                onValueChange={(value: Issue["priority"]) => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEditMode && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Issue["status"]) => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Assigned User */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assigned User</label>
            <Select
              value={formData.assigned_user_id}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, assigned_user_id: value }))
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(users || []).map((user) => (
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

          {/* Tags */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Tags</label>
            
            {/* Selected tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    onRemove={() => handleTagRemove(tag.id)}
                  />
                ))}
              </div>
            )}
            
            {/* Available tags */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Available tags:</p>
              <div className="flex flex-wrap gap-2">
                {(tags || []).filter(tag => !formData.tag_ids.includes(tag.id)).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    disabled={isLoading}
                    className="transition-opacity hover:opacity-70"
                  >
                    <TagBadge tag={tag} variant="outline" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isLoading || !formData.title.trim() || !formData.description.trim()}
              className="flex-1"
            >
              {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
              {isLoading 
                ? (isEditMode ? "Updating..." : "Creating...") 
                : (isEditMode ? "Update Issue" : "Create Issue")
              }
            </Button>
            
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
