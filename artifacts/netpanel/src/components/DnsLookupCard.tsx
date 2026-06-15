import { useState } from "react";
import { useDnsLookup, getDnsLookupQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe2, AlertCircle } from "lucide-react";

export function DnsLookupCard() {
  const [host, setHost] = useState("");
  const [queryHost, setQueryHost] = useState("");

  const { data, isLoading, isError, refetch } = useDnsLookup(
    { host: queryHost },
    { 
      query: { 
        enabled: false,
        queryKey: getDnsLookupQueryKey({ host: queryHost })
      } 
    }
  );

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim()) return;
    setQueryHost(host.trim());
    setTimeout(() => {
      refetch();
    }, 0);
  };

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-mono flex items-center">
          <Search className="w-5 h-5 mr-2 text-primary" />
          DNS Lookup
        </CardTitle>
        <CardDescription>Resolve hostnames to IP addresses</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLookup} className="flex gap-2 mb-6">
          <Input 
            placeholder="e.g. google.com" 
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="font-mono bg-background/50"
          />
          <Button type="submit" disabled={isLoading || !host.trim()} variant="secondary">
            {isLoading ? "Looking up..." : "Lookup"}
          </Button>
        </form>

        {isLoading ? (
          <div className="flex justify-center p-6 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/20 text-sm">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to resolve hostname.</span>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Globe2 className="h-4 w-4" />
              <span>Results for <strong className="text-foreground">{data.host}</strong>:</span>
            </div>
            
            {data.error ? (
              <div className="text-warning bg-warning/10 p-4 rounded-md border border-warning/20 text-sm font-mono">
                {data.error}
              </div>
            ) : data.addresses && data.addresses.length > 0 ? (
              <div className="bg-background/80 rounded-md border border-border overflow-hidden">
                <ul className="divide-y divide-border">
                  {data.addresses.map((ip, idx) => (
                    <li key={idx} className="p-3 font-mono text-sm text-primary hover:bg-muted/50 flex items-center">
                      <div className="w-2 h-2 rounded-full bg-primary/50 mr-3"></div>
                      {ip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                No records found.
              </div>
            )}
            
            {data.resolvedAt && (
              <div className="text-xs text-muted-foreground text-right">
                Resolved at {new Date(data.resolvedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-8 text-center border border-dashed border-border/50 rounded-lg flex flex-col items-center">
            <Globe2 className="h-8 w-8 mb-2 opacity-20" />
            Enter a hostname to resolve its IP addresses.
          </div>
        )}
      </CardContent>
    </Card>
  );
}