import React from 'react';
import { Plus, Search, FileText, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center p-8', className)}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
};

// Specific empty state components
export const EmptyIssues: React.FC<{ onCreateIssue?: () => void }> = ({ onCreateIssue }) => (
  <EmptyState
    icon={<FileText className="h-12 w-12" />}
    title="No issues found"
    description="Get started by creating your first issue to track bugs, features, or tasks."
    action={onCreateIssue ? {
      label: 'Create Issue',
      onClick: onCreateIssue,
    } : undefined}
  />
);

export const EmptySearchResults: React.FC = () => (
  <EmptyState
    icon={<Search className="h-12 w-12" />}
    title="No results found"
    description="Try adjusting your search criteria or filters to find what you're looking for."
  />
);

export const EmptyTags: React.FC<{ onCreateTag?: () => void }> = ({ onCreateTag }) => (
  <EmptyState
    icon={<Tag className="h-12 w-12" />}
    title="No tags found"
    description="Tags help organize and categorize your issues. Create your first tag to get started."
    action={onCreateTag ? {
      label: 'Create Tag',
      onClick: onCreateTag,
    } : undefined}
  />
);
