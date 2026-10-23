import { Card, CardContent } from "@/components/ui/card";

export default function DashboardMetricCard({ icon: Icon, label, value, caption, tone = "default" }) {
  return (
    <Card className={`dashboard-metric dashboard-metric-${tone}`}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
      </CardContent>
    </Card>
  );
}
