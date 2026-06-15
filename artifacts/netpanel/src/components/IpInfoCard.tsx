import { useGetIpInfo, getGetIpInfoQueryKey, useCheckConnectivity, getCheckConnectivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, Info, Wifi } from "lucide-react";

export function IpInfoCard() {
  const { data: ipInfo, isLoading: ipLoading } = useGetIpInfo({
    query: {
      queryKey: getGetIpInfoQueryKey()
    }
  });
  const { data: connInfo, isLoading: connLoading } = useCheckConnectivity({
    query: { 
      refetchInterval: 30000,
      queryKey: getCheckConnectivityQueryKey()
    }
  });

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-mono flex items-center">
          <Info className="w-5 h-5 mr-2 text-primary" />
          Network Identity
        </CardTitle>
        <CardDescription>Current connection details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 mt-2">
          {/* Connectivity Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gateway Status</h4>
            {connLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : connInfo ? (
              <div className="flex items-center p-3 rounded-lg bg-background/50 border border-border">
                <div className={`p-2 rounded-full mr-4 ${connInfo.online ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <div className={`font-bold ${connInfo.online ? 'text-success' : 'text-destructive'}`}>
                    {connInfo.online ? 'Connected to Internet' : 'Disconnected'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Response time: {connInfo.responseTime || '--'} ms
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* IP Details */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Public IP Information</h4>
            {ipLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : ipInfo ? (
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="grid grid-cols-3 border-b border-border bg-background/30">
                  <div className="p-2 md:p-3 text-xs text-muted-foreground font-medium">IP Address</div>
                  <div className="col-span-2 p-2 md:p-3 font-mono text-sm border-l border-border text-foreground font-bold">{ipInfo.ip}</div>
                </div>
                <div className="grid grid-cols-3 border-b border-border bg-background/30">
                  <div className="p-2 md:p-3 text-xs text-muted-foreground font-medium">ISP</div>
                  <div className="col-span-2 p-2 md:p-3 text-sm border-l border-border text-foreground">{ipInfo.isp || 'Unknown'}</div>
                </div>
                <div className="grid grid-cols-3 border-b border-border bg-background/30">
                  <div className="p-2 md:p-3 text-xs text-muted-foreground font-medium">Location</div>
                  <div className="col-span-2 p-2 md:p-3 text-sm border-l border-border text-foreground flex items-center">
                    {ipInfo.city ? `${ipInfo.city}, ` : ''}{ipInfo.region ? `${ipInfo.region}, ` : ''}{ipInfo.country || 'Unknown'}
                  </div>
                </div>
                <div className="grid grid-cols-3 bg-background/30">
                  <div className="p-2 md:p-3 text-xs text-muted-foreground font-medium">Timezone</div>
                  <div className="col-span-2 p-2 md:p-3 text-sm border-l border-border text-foreground">{ipInfo.timezone || 'Unknown'}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                Could not retrieve IP info
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}