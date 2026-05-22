import { Calendar, DollarSign, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils';

interface MetricasCardProps {
  titulo: string;
  valor: string | number;
  icone: 'calendar' | 'dollar' | 'clock';
  descricao: string;
  tendencia?: 'up' | 'down';
  alerta?: boolean;
}

const icones = {
  calendar: Calendar,
  dollar: DollarSign,
  clock: Clock,
};

export function MetricasCard({ titulo, valor, icone, descricao, tendencia, alerta }: MetricasCardProps) {
  const Icone = icones[icone];

  return (
    <Card className={cn(alerta && 'border-destructive')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        <div className={cn(
          'p-2 rounded-full',
          alerta ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
        )}>
          <Icone className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{valor}</div>
        <div className="flex items-center gap-1 mt-1">
          {tendencia && (
            <TrendingUp 
              className={cn(
                'h-3 w-3',
                tendencia === 'up' ? 'text-emerald-500' : 'text-red-500'
              )} 
              aria-hidden="true" 
            />
          )}
          {alerta && (
            <AlertCircle className="h-3 w-3 text-destructive" aria-hidden="true" />
          )}
          <CardDescription>{descricao}</CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}
