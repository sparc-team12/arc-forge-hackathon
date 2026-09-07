import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Issue Tracker</CardTitle>
          <CardDescription>
            Manage and track issues for your projects with ease.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Start by viewing your issues or creating a new one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
