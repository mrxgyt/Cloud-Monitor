import { useGetStatusSummary, getGetStatusSummaryQueryKey } from "@workspace/api-client-react";
import { Activity, Globe, MapPin, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function StatusHeader() {
  const { data, isLoading, isError } = useGetStatusSummary({
    query: {
      refetchInterval: 30000,
      queryKey: getGetStatusSummaryQueryKey()
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-card-border p-4 rounded-lg">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6">
        Failed to load status summary.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-card border border-card-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-muted-foreground text-sm font-medium mb-1">Status</div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${data.online ? 'bg-success' : 'bg-destructive'}`} />
            <span className={`text-xl font-bold font-mono ${data.online ? 'text-success' : 'text-destructive'}`}>
              {data.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
        <Activity className={`h-8 w-8 ${data.online ? 'text-success/50' : 'text-destructive/50'}`} />
      </div>

      <div className="bg-card border border-card-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-muted-foreground text-sm font-medium mb-1">Public IP</div>
          <div className="text-xl font-bold font-mono text-foreground truncate max-w-[150px]">
            {data.publicIp || '--'}
          </div>
        </div>
        <Globe className="h-8 w-8 text-primary/50" />
      </div>

      <div className="bg-card border border-card-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-muted-foreground text-sm font-medium mb-1">Location</div>
          <div className="text-lg font-bold text-foreground">
            {data.country || '--'}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[150px]">{data.isp || 'Unknown ISP'}</div>
        </div>
        <MapPin className="h-8 w-8 text-primary/50" />
      </div>

      <div className="bg-card border border-card-border p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="text-muted-foreground text-sm font-medium mb-1">Last Speed Test</div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-lg font-bold text-success font-mono">{data.lastDownloadMbps?.toFixed(1) || '--'}</span>
              <span className="text-xs text-muted-foreground ml-1">↓</span>
            </div>
            <div>
              <span className="text-lg font-bold text-primary font-mono">{data.lastUploadMbps?.toFixed(1) || '--'}</span>
              <span className="text-xs text-muted-foreground ml-1">↑</span>
            </div>
          </div>
        </div>
        <Zap className="h-8 w-8 text-warning/50" />
      </div>
    </div>
  );
}