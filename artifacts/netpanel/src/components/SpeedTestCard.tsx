import { useState } from "react";
import { useRunSpeedTest, getRunSpeedTestQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowDown, ArrowUp, Activity, Play, RefreshCw } from "lucide-react";

export function SpeedTestCard() {
  const { data, isLoading, isFetching, refetch } = useRunSpeedTest({
    query: {
      enabled: false,
      queryKey: getRunSpeedTestQueryKey(),
    }
  });

  const isRunning = isLoading || isFetching;

  const chartData = data ? [
    { name: 'Download', value: data.downloadMbps || 0, color: 'hsl(var(--success))' },
    { name: 'Upload', value: data.uploadMbps || 0, color: 'hsl(var(--primary))' },
  ] : [];

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card border-card-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-mono">Speed Test</CardTitle>
          <CardDescription>Measure bandwidth and latency</CardDescription>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isRunning}
          variant="outline"
          className="border-primary/30 hover:bg-primary/10 text-primary"
        >
          {isRunning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Test
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isRunning ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse"></div>
              <Activity className="h-16 w-16 text-primary animate-bounce relative z-10" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground">Running Diagnostics</h3>
              <p className="text-sm text-muted-foreground">This may take 10-30 seconds...</p>
            </div>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-lg p-4 border border-border/50 flex flex-col items-center justify-center">
                  <div className="flex items-center text-muted-foreground mb-2">
                    <ArrowDown className="h-4 w-4 mr-1 text-success" />
                    <span className="text-sm font-medium">Download</span>
                  </div>
                  <div className="text-3xl font-bold font-mono text-success">
                    {data.downloadMbps?.toFixed(1) || '--'}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">Mbps</span>
                </div>
                <div className="bg-background/50 rounded-lg p-4 border border-border/50 flex flex-col items-center justify-center">
                  <div className="flex items-center text-muted-foreground mb-2">
                    <ArrowUp className="h-4 w-4 mr-1 text-primary" />
                    <span className="text-sm font-medium">Upload</span>
                  </div>
                  <div className="text-3xl font-bold font-mono text-primary">
                    {data.uploadMbps?.toFixed(1) || '--'}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">Mbps</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/50 rounded-lg p-3 border border-border/50 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ping</span>
                  <span className="font-mono font-bold text-foreground">{data.pingMs || '--'} ms</span>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border/50 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Jitter</span>
                  <span className="font-mono font-bold text-foreground">{data.jitterMs || '--'} ms</span>
                </div>
              </div>
              {data.server && (
                <div className="text-xs text-muted-foreground text-center">
                  Server: <span className="text-foreground">{data.server}</span>
                </div>
              )}
            </div>
            
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.2)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }} 
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl mt-4">
            <Activity className="h-12 w-12 mb-4 opacity-50" />
            <p>No recent speed test results.</p>
            <p className="text-sm mt-1">Click "Run Test" to begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}