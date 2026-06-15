import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, ChevronDown, Server, ArrowDown, ArrowUp, Activity, Wifi } from "lucide-react";

type Phase = "idle" | "ping" | "download" | "upload" | "complete" | "error";

interface SpeedServer {
  id: string;
  name: string;
  location: string;
  latencyMs: number | null;
}

interface Results {
  pingMs: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  server: string | null;
}

// ---- SVG Speedometer ----
// 280° arc from 130° to 50° clockwise (SVG coords)
const CX = 120, CY = 118, R = 90;
const START_DEG = 130, SWEEP_DEG = 280;
const ARC_LEN = 2 * Math.PI * R * (SWEEP_DEG / 360);

function toRad(deg: number) { return (deg * Math.PI) / 180; }
function arcPoint(deg: number, r = R) {
  return { x: CX + r * Math.cos(toRad(deg)), y: CY + r * Math.sin(toRad(deg)) };
}

const arcStart = arcPoint(START_DEG);
const arcEnd = arcPoint(START_DEG + SWEEP_DEG);

const FULL_ARC = `M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A ${R} ${R} 0 1 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}`;

function autoMax(mbps: number): number {
  if (mbps < 50) return 100;
  if (mbps < 200) return 500;
  if (mbps < 800) return 1000;
  if (mbps < 3000) return 5000;
  return 10000;
}

interface GaugeProps {
  value: number;
  maxValue: number;
  phase: Phase;
  pingSample?: { sample: number; total: number };
}

function Gauge({ value, maxValue, phase, pingSample }: GaugeProps) {
  const pct = Math.min(value / maxValue, 1);
  const dashOffset = ARC_LEN * (1 - pct);

  // Needle
  const needleDeg = START_DEG + pct * SWEEP_DEG;
  const needle = arcPoint(needleDeg, 72);

  // Color by phase
  const color = phase === "download"
    ? "hsl(var(--success))"
    : phase === "upload"
    ? "hsl(var(--primary))"
    : phase === "ping"
    ? "hsl(var(--warning))"
    : "hsl(var(--primary))";

  // Speed scale ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const tickPct = i / tickCount;
    const tickDeg = START_DEG + tickPct * SWEEP_DEG;
    const inner = arcPoint(tickDeg, R - 10);
    const outer = arcPoint(tickDeg, R + 4);
    const label = arcPoint(tickDeg, R - 22);
    const val = Math.round(tickPct * maxValue);
    return { inner, outer, label, val, pct: tickPct };
  });

  return (
    <svg width="240" height="210" viewBox="0 0 240 210" className="select-none">
      {/* Background arc */}
      <path
        d={FULL_ARC}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth="14"
        strokeLinecap="round"
      />

      {/* Progress arc */}
      <path
        d={FULL_ARC}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={ARC_LEN}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.25s ease, stroke 0.3s ease" }}
      />

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={t.inner.x} y1={t.inner.y}
            x2={t.outer.x} y2={t.outer.y}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <text
            x={t.label.x} y={t.label.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="8"
            fill="hsl(var(--muted-foreground))"
            opacity="0.7"
          >
            {t.val >= 1000 ? `${t.val / 1000}K` : t.val}
          </text>
        </g>
      ))}

      {/* Needle */}
      <line
        x1={CX} y1={CY}
        x2={needle.x} y2={needle.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: "all 0.25s ease" }}
      />
      <circle cx={CX} cy={CY} r="6" fill={color} style={{ transition: "fill 0.3s ease" }} />
      <circle cx={CX} cy={CY} r="3" fill="hsl(var(--background))" />

      {/* Phase label */}
      {phase === "ping" && pingSample && (
        <text x={CX} y={CY + 30} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
          {pingSample.sample} / {pingSample.total} samples
        </text>
      )}
    </svg>
  );
}

// ---- Server Selector ----
interface ServerSelectorProps {
  servers: SpeedServer[];
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}

function ServerSelector({ servers, selected, onSelect, disabled }: ServerSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = servers.find(s => s.id === selected);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        data-testid="button-server-selector"
        className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Server className="h-3.5 w-3.5" />
        {current ? `${current.name} — ${current.location}` : "Select server"}
        {current?.latencyMs != null && (
          <span className="text-xs text-primary ml-1">{current.latencyMs}ms</span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[280px] overflow-hidden">
          {servers.map(s => (
            <button
              key={s.id}
              data-testid={`button-server-${s.id}`}
              onClick={() => { onSelect(s.id); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left ${s.id === selected ? "bg-primary/10 text-primary" : "text-foreground"}`}
            >
              <div>
                <span className="font-medium font-mono">{s.name}</span>
                <span className="text-muted-foreground ml-2">{s.location}</span>
              </div>
              {s.latencyMs != null ? (
                <span className={`text-xs font-mono ml-4 ${s.latencyMs < 50 ? "text-success" : s.latencyMs < 150 ? "text-warning" : "text-destructive"}`}>
                  {s.latencyMs}ms
                </span>
              ) : (
                <span className="text-xs text-muted-foreground ml-4">timeout</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Metric Box ----
function MetricBox({ label, value, unit, icon: Icon, color }: {
  label: string;
  value: number | null;
  unit: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-background/60 rounded-xl p-3 border border-border/50 flex flex-col items-center gap-1">
      <div className={`flex items-center gap-1 text-xs font-mono ${color} opacity-80`}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-2xl font-bold font-mono ${color} ${value == null ? "opacity-40" : ""}`}>
        {value != null ? value.toFixed(value >= 100 ? 0 : 1) : "--"}
      </div>
      <div className="text-xs text-muted-foreground font-mono">{unit}</div>
    </div>
  );
}

// ---- Main Component ----
export function SpeedTestCard() {
  const [servers, setServers] = useState<SpeedServer[]>([]);
  const [selectedServer, setSelectedServer] = useState("cloudflare");
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [maxValue, setMaxValue] = useState(1000);
  const [pingSample, setPingSample] = useState({ sample: 0, total: 20 });
  const [results, setResults] = useState<Results>({ pingMs: null, jitterMs: null, downloadMbps: null, uploadMbps: null, server: null });
  const [phaseLabel, setPhaseLabel] = useState("");
  const esRef = useRef<EventSource | null>(null);

  // Load servers on mount
  useEffect(() => {
    fetch("/api/network/speedtest/servers")
      .then(r => r.json())
      .then((data: SpeedServer[]) => setServers(data))
      .catch(() => setServers([
        { id: "cloudflare", name: "Cloudflare", location: "Global (Auto)", latencyMs: null }
      ]));
  }, []);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setPhase(prev => prev !== "idle" && prev !== "complete" && prev !== "error" ? "idle" : prev);
  }, []);

  const startTest = useCallback(() => {
    if (esRef.current) { esRef.current.close(); }
    setPhase("idle");
    setLiveSpeed(0);
    setMaxValue(1000);
    setPingSample({ sample: 0, total: 20 });
    setResults({ pingMs: null, jitterMs: null, downloadMbps: null, uploadMbps: null, server: null });

    const es = new EventSource(`/api/network/speedtest/stream?server=${selectedServer}`);
    esRef.current = es;

    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as Record<string, unknown>;

      switch (msg.type) {
        case "phase":
          setPhase(msg.phase as Phase);
          if (msg.phase === "ping") { setPhaseLabel("PING"); setLiveSpeed(0); }
          if (msg.phase === "download") { setPhaseLabel("DOWNLOAD"); setLiveSpeed(0); }
          if (msg.phase === "upload") { setPhaseLabel("UPLOAD"); setLiveSpeed(0); }
          break;

        case "ping_sample": {
          const ms = msg.ms as number;
          setLiveSpeed(ms);
          setMaxValue(prev => Math.max(prev, autoMax(ms)));
          setPingSample({ sample: msg.sample as number, total: msg.total as number });
          break;
        }

        case "ping_done":
          setResults(r => ({ ...r, pingMs: (msg.pingMs as number | null) ?? null, jitterMs: (msg.jitterMs as number | null) ?? null }));
          setLiveSpeed(0);
          setMaxValue(1000);
          break;

        case "download_progress": {
          const mbps = msg.mbps as number;
          setLiveSpeed(mbps);
          setMaxValue(prev => mbps > prev * 0.8 ? autoMax(mbps * 1.2) : prev);
          break;
        }

        case "download_done":
          setResults(r => ({ ...r, downloadMbps: (msg.downloadMbps as number | null) ?? null }));
          setLiveSpeed(0);
          setMaxValue(1000);
          break;

        case "upload_progress": {
          const mbps = msg.mbps as number;
          setLiveSpeed(mbps);
          setMaxValue(prev => mbps > prev * 0.8 ? autoMax(mbps * 1.2) : prev);
          break;
        }

        case "upload_done":
          setResults(r => ({ ...r, uploadMbps: (msg.uploadMbps as number | null) ?? null }));
          break;

        case "complete":
          setResults(r => ({ ...r, server: (msg.server as string) ?? null }));
          setPhase("complete");
          setPhaseLabel("COMPLETE");
          es.close();
          esRef.current = null;
          break;

        case "error":
          setPhase("error");
          setPhaseLabel("ERROR");
          es.close();
          esRef.current = null;
          break;
      }
    };

    es.onerror = () => {
      setPhase("error");
      setPhaseLabel("ERROR");
      es.close();
      esRef.current = null;
    };
  }, [selectedServer]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  const isRunning = phase === "ping" || phase === "download" || phase === "upload";

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card border-card-border overflow-visible">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Speed Test
          </CardTitle>
          <div className="flex items-center gap-3">
            {servers.length > 0 && (
              <ServerSelector
                servers={servers}
                selected={selectedServer}
                onSelect={setSelectedServer}
                disabled={isRunning}
              />
            )}
            {isRunning ? (
              <Button
                onClick={stop}
                variant="outline"
                size="sm"
                data-testid="button-stop-test"
                className="border-destructive/30 hover:bg-destructive/10 text-destructive font-mono"
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={startTest}
                size="sm"
                data-testid="button-start-test"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold tracking-wider px-6"
              >
                <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                GO
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">

          {/* Left: Gauge + phase label */}
          <div className="flex flex-col items-center">
            {/* Phase badge */}
            <div className={`text-xs font-mono font-bold tracking-widest mb-1 h-4 transition-colors ${
              phase === "ping" ? "text-warning" :
              phase === "download" ? "text-success" :
              phase === "upload" ? "text-primary" :
              phase === "complete" ? "text-success" :
              phase === "error" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {phase === "idle" ? "READY" : phaseLabel}
            </div>

            {/* SVG Gauge */}
            <div className="relative">
              <Gauge
                value={liveSpeed}
                maxValue={maxValue}
                phase={phase}
                pingSample={phase === "ping" ? pingSample : undefined}
              />

              {/* Center speed readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
                <div className={`text-3xl font-bold font-mono tabular-nums transition-colors ${
                  phase === "download" ? "text-success" :
                  phase === "upload" ? "text-primary" :
                  phase === "ping" ? "text-warning" :
                  "text-foreground"
                }`}>
                  {phase === "idle" || phase === "complete" || phase === "error"
                    ? "--"
                    : phase === "ping"
                    ? (liveSpeed > 0 ? liveSpeed.toFixed(0) : "--")
                    : liveSpeed.toFixed(liveSpeed >= 100 ? 0 : 1)
                  }
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  {phase === "ping" ? "ms" : "Mbps"}
                </div>
              </div>
            </div>

            {/* Max scale label */}
            <div className="text-xs text-muted-foreground font-mono opacity-50 mt-1">
              {phase !== "ping" ? `max ${maxValue >= 1000 ? `${maxValue / 1000}K` : maxValue} Mbps` : "20 ping samples"}
            </div>
          </div>

          {/* Right: Metrics + progress */}
          <div className="flex flex-col gap-4">
            {/* 4 metric boxes */}
            <div className="grid grid-cols-2 gap-3">
              <MetricBox
                label="DOWNLOAD"
                value={results.downloadMbps}
                unit="Mbps"
                icon={ArrowDown}
                color="text-success"
              />
              <MetricBox
                label="UPLOAD"
                value={results.uploadMbps}
                unit="Mbps"
                icon={ArrowUp}
                color="text-primary"
              />
              <MetricBox
                label="PING"
                value={results.pingMs}
                unit="ms"
                icon={Wifi}
                color="text-warning"
              />
              <MetricBox
                label="JITTER"
                value={results.jitterMs}
                unit="ms"
                icon={Activity}
                color="text-muted-foreground"
              />
            </div>

            {/* Phase progress indicator */}
            <div className="flex gap-2 items-center">
              {(["ping", "download", "upload"] as const).map(p => (
                <div key={p} className="flex-1 flex flex-col gap-1">
                  <div className={`h-1 rounded-full transition-all duration-500 ${
                    phase === p ? "bg-primary animate-pulse" :
                    (phase === "download" && p === "ping") ||
                    (phase === "upload" && (p === "ping" || p === "download")) ||
                    (phase === "complete") ? "bg-primary/60" :
                    "bg-muted"
                  }`} />
                  <span className={`text-xs font-mono text-center ${
                    phase === p ? "text-primary" :
                    (phase === "download" && p === "ping") ||
                    (phase === "upload" && (p === "ping" || p === "download")) ||
                    phase === "complete" ? "text-muted-foreground" :
                    "text-muted-foreground/40"
                  }`}>
                    {p.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Server info or idle hint */}
            {phase === "idle" && (
              <p className="text-xs text-muted-foreground font-mono text-center">
                Press GO to begin — results update live
              </p>
            )}
            {phase === "complete" && results.server && (
              <p className="text-xs text-muted-foreground font-mono text-center">
                via {results.server}
              </p>
            )}
            {phase === "error" && (
              <p className="text-xs text-destructive font-mono text-center">
                Test failed — check connection and retry
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
