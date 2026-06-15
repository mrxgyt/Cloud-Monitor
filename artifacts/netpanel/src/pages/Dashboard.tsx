import { StatusHeader } from "@/components/StatusHeader";
import { SpeedTestCard } from "@/components/SpeedTestCard";
import { LatencyCard } from "@/components/LatencyCard";
import { IpInfoCard } from "@/components/IpInfoCard";
import { DnsLookupCard } from "@/components/DnsLookupCard";
import { VpnCard } from "@/components/VpnCard";
import { Activity } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground p-4 md:p-6 lg:p-8 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3 text-foreground">
              <Activity className="h-8 w-8 text-primary" />
              NET<span className="text-primary">PANEL</span>
            </h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">Real-time network diagnostics & telemetry</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            SYSTEM ACTIVE
          </div>
        </header>

        {/* Global Status Summary */}
        <StatusHeader />

        {/* VPN Connection Card */}
        <VpnCard />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area (Speed + DNS) */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
            <SpeedTestCard />
            <DnsLookupCard />
          </div>

          {/* Sidebar Area (Latency + IP Info) */}
          <div className="col-span-1 flex flex-col gap-6">
            <LatencyCard />
            <IpInfoCard />
          </div>
        </div>
        
        <footer className="mt-12 text-center text-xs text-muted-foreground font-mono pt-6 border-t border-border/50">
          Network Panel API • {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}