import { TrendingUp, TrendingDown, Calendar, DollarSign, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: 'calendar' | 'dollar-sign' | 'users' | 'check-circle';
  trend?: number;
}

const iconMap = {
  calendar: Calendar,
  'dollar-sign': DollarSign,
  users: Users,
  'check-circle': CheckCircle,
};

export function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  const Icon = iconMap[icon];
  const isPositive = trend && trend > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {trend !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {isPositive ? '+' : ''}{trend}%
          </span>
        )}
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
