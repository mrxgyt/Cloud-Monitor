import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

interface VpnConnectionData {
  connectionString: string;
  uuid: string;
  host: string;
  port: number;
  path: string;
  protocol: string;
  network: string;
  security: string;
}

interface VpnStatusData {
  status: "up" | "down";
  port: number;
  lastChecked: string;
  error?: string;
}

export function VpnCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: connectionData, isLoading: loadingConnection } =
    useQuery<VpnConnectionData>({
      queryKey: ["vpn-connection"],
      queryFn: async () => {
        const res = await fetch("/api/vpn/connection");
        if (!res.ok) throw new Error("Failed to fetch VPN connection");
        return res.json();
      },
      refetchInterval: 60000, // Refresh every minute
    });

  const { data: statusData } = useQuery<VpnStatusData>({
    queryKey: ["vpn-status"],
    queryFn: async () => {
      const res = await fetch("/api/vpn/status");
      if (!res.ok) throw new Error("Failed to fetch VPN status");
      return res.json();
    },
    refetchInterval: 30000, // Check status every 30 seconds
  });

  const handleCopy = async () => {
    if (!connectionData?.connectionString) return;

    try {
      await navigator.clipboard.writeText(connectionData.connectionString);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "VLESS connection string copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-mono text-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span>VPN CONNECTION</span>
          </div>
          {statusData && (
            <div className="flex items-center gap-2 text-xs font-normal">
              {statusData.status === "up" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-success">ONLINE</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">OFFLINE</span>
                </>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingConnection ? (
          <div className="text-center py-8 text-muted-foreground font-mono text-sm">
            Loading VPN configuration...
          </div>
        ) : connectionData ? (
          <>
            {/* Connection String */}
            <div className="space-y-2">
              <Label htmlFor="connection-string" className="font-mono text-xs">
                VLESS Connection String
              </Label>
              <div className="flex gap-2">
                <Input
                  id="connection-string"
                  value={connectionData.connectionString}
                  readOnly
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  className="font-mono"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">
                  HOST
                </Label>
                <div className="font-mono text-sm text-foreground">
                  {connectionData.host}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">
                  PORT
                </Label>
                <div className="font-mono text-sm text-foreground">
                  {connectionData.port}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">
                  PROTOCOL
                </Label>
                <div className="font-mono text-sm text-foreground uppercase">
                  {connectionData.protocol}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">
                  NETWORK
                </Label>
                <div className="font-mono text-sm text-foreground uppercase">
                  {connectionData.network}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="font-mono text-xs text-muted-foreground">
                  UUID
                </Label>
                <div className="font-mono text-xs text-foreground break-all">
                  {connectionData.uuid}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="font-mono text-xs text-muted-foreground">
                  WEBSOCKET PATH
                </Label>
                <div className="font-mono text-sm text-foreground">
                  {connectionData.path}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-destructive font-mono text-sm">
            Failed to load VPN configuration
          </div>
        )}
      </CardContent>
    </Card>
  );
}
