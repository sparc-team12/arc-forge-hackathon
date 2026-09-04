import { Badge } from "@/components/ui/badge";
import type { Tag } from "@/types";

interface TagBadgeProps {
  tag: Tag;
  className?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  onRemove?: () => void;
}

export default function TagBadge({ 
  tag, 
  className, 
  variant = "outline",
  onRemove 
}: TagBadgeProps) {
  return (
    <Badge 
      variant={variant}
      className={`${className || ""}`}
      style={{ 
        backgroundColor: variant === "outline" ? "transparent" : tag.color + "20",
        borderColor: tag.color,
        color: tag.color
      }}
    >
      <span>{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-xs hover:text-red-600 transition-colors"
          aria-label={`Remove ${tag.name} tag`}
        >
          ×
        </button>
      )}
    </Badge>
  );
}
