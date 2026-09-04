import { Button } from "@/components/ui/button";
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';

interface SignOutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function SignOutButton({ 
  variant = "ghost", 
  size = "default",
  className 
}: SignOutButtonProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/'); // Redirect to home page after sign out
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size}
      className={className}
      onClick={handleSignOut}
    >
      Sign Out
    </Button>
  );
}
