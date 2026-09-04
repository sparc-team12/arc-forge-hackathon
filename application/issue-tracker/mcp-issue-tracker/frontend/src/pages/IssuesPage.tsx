import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function IssuesPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the new issue list page
    navigate("/issues", { replace: true });
  }, [navigate]);

  return null;
}
