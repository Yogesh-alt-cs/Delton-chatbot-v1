import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Conversation } from '@/lib/types';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

interface ChatActivityChartProps {
  conversations: Conversation[];
}

export function ChatActivityChart({ conversations }: ChatActivityChartProps) {
  const chartData = useMemo(() => {
    // Generate last 14 days
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      return {
        date: startOfDay(date),
        label: format(date, 'MMM d'),
        count: 0,
      };
    });

    // Count conversations per day
    conversations.forEach(conv => {
      const convDate = startOfDay(new Date(conv.created_at));
      const dayData = days.find(d => isSameDay(d.date, convDate));
      if (dayData) {
        dayData.count++;
      }
    });

    return days.map(d => ({ label: d.label, count: d.count }));
  }, [conversations]);

  const totalChats = conversations.length;
  const recentChats = chartData.slice(-7).reduce((sum, d) => sum + d.count, 0);

  if (conversations.length === 0) {
    return null;
  }

  return (
    <Card className="mx-4 mb-4 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Chat Activity</span>
          <span className="text-xs text-muted-foreground font-normal">
            {recentChats} this week • {totalChats} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="h-[120px] w-full px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value} chats`, 'Activity']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
