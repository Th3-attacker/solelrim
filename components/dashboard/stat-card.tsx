import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StatCard({
  label,
  value,
  badge,
  description,
  subtitle,
}: {
  label: string;
  value: string | number;
  badge?: React.ReactNode;
  description: React.ReactNode;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          {description}
        </div>
        <div className="text-muted-foreground">{subtitle}</div>
      </CardFooter>
    </Card>
  );
}
