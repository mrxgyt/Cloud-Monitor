import { useGetLatency, getGetLatencyQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Clock } from "lucide-react";

export function LatencyCard() {
  const { data, isLoading, isError } = useGetLatency({
    query: {
      refetchInterval: 30000,
      queryKey: getGetLatencyQueryKey()
    }
  });

  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return "text-destructive";
    if (ms < 50) return "text-success";
    if (ms < 150) return "text-warning";
    return "text-destructive";
  };

  const getLatencyBg = (ms: number | null) => {
    if (ms === null) return "bg-destructive/10";
    if (ms < 50) return "bg-success/10";
    if (ms < 150) return "bg-warning/10";
    return "bg-destructive/10";
  };

  return (
    <Card className="bg-card border-card-border flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-mono flex items-center">
          <Server className="w-5 h-5 mr-2 text-primary" />
          Host Latency
        </CardTitle>
        <CardDescription>Real-time ping to key infrastructure</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="text-destructive p-4 bg-destructive/10 rounded-md border border-destructive/20 text-sm">
            Unable to fetch latency data.
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {data.hosts.map((host, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 rounded-md bg-background/50 border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${host.reachable ? 'bg-success' : 'bg-destructive'}`} />
                  <span className="font-mono text-sm font-medium">{host.host}</span>
                </div>
                <div className={`px-2 py-1 rounded font-mono text-xs font-bold ${getLatencyBg(host.latencyMs)} ${getLatencyColor(host.latencyMs)}`}>
                  {host.reachable && host.latencyMs !== null ? `${host.latencyMs} ms` : 'TIMEOUT'}
                </div>
              </div>
            ))}
            {data.measuredAt && (
              <div className="text-xs text-muted-foreground flex items-center justify-end mt-4">
                <Clock className="w-3 h-3 mr-1" />
                Updated {new Date(data.measuredAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}