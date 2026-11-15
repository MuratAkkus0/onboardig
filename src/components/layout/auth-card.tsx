import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Card wrapper shared by the public auth pages. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl leading-none font-semibold">{title}</h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}
