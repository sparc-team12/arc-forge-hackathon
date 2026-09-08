import type { User } from "@/types";

interface UserAvatarProps {
  user: User;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    avatar: "w-6 h-6 text-xs",
    text: "text-xs",
  },
  md: {
    avatar: "w-8 h-8 text-sm",
    text: "text-sm",
  },
  lg: {
    avatar: "w-12 h-12 text-base",
    text: "text-base",
  },
};

export default function UserAvatar({ 
  user, 
  size = "md", 
  showName = false,
  className 
}: UserAvatarProps) {
  const config = sizeConfig[size];
  
  // Get initials from user name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent color based on user ID
  const getAvatarColor = (userId: string) => {
    const colors = [
      "bg-red-500",
      "bg-blue-500", 
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-gray-500",
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div 
        className={`
          ${config.avatar}
          ${getAvatarColor(user.id)}
          rounded-full
          flex
          items-center
          justify-center
          text-white
          font-medium
          flex-shrink-0
        `}
        title={user.name}
      >
        {user.image ? (
          <img 
            src={user.image} 
            alt={user.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          getInitials(user.name)
        )}
      </div>
      
      {showName && (
        <span className={`${config.text} text-foreground truncate`}>
          {user.name}
        </span>
      )}
    </div>
  );
}
