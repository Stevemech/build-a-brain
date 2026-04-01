import { useState, useCallback, useEffect, useRef, Suspense, lazy, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Eye, Ear, Focus, Database, Search, FileText, Zap,
  ChevronDown, RotateCcw, Info, Sun, Moon, ArrowDown, Sparkles,
  AlertTriangle, Activity, Waves, Volume2, User, Building2, LampDesk,
  Camera, TrendingDown, TrendingUp, Minus, Copy, X, ArrowRight
} from "lucide-react";
import { STIMULI, runPipeline, type PipelineParams, type StageResult, type Stimulus, type SubMetric } from "@/lib/pipeline-engine";

const BrainScene = lazy(() => import("@/components/brain-scene"));

// ─── Constants ────────────────────────────────────────────────────

const STAGE_ICONS: Record<string, typeof Brain> = {
  sensation: Eye, attention: Focus, perception: Brain,
  encoding: Database, storage: Zap, retrieval: Search, report: FileText,
};

const STAGE_COLORS: Record<string, string> = {
  sensation: "from-amber-400 to-orange-500",
  attention: "from-violet-400 to-purple-500",
  perception: "from-indigo-400 to-blue-500",
  encoding: "from-teal-400 to-emerald-500",
  storage: "from-emerald-400 to-green-500",
  retrieval: "from-cyan-400 to-blue-500",
  report: "from-blue-400 to-indigo-500",
};

const STAGE_BAR_COLORS: Record<string, string> = {
  sensation: "bg-gradient-to-r from-amber-400 to-orange-500",
  attention: "bg-gradient-to-r from-violet-400 to-purple-500",
  perception: "bg-gradient-to-r from-indigo-400 to-blue-500",
  encoding: "bg-gradient-to-r from-teal-400 to-emerald-500",
  storage: "bg-gradient-to-r from-emerald-400 to-green-500",
  retrieval: "bg-gradient-to-r from-cyan-400 to-blue-500",
  report: "bg-gradient-to-r from-blue-400 to-indigo-500",
};

const STAGE_ACCENT: Record<string, string> = {
  sensation: "text-amber-500 dark:text-amber-400",
  attention: "text-violet-500 dark:text-violet-400",
  perception: "text-indigo-500 dark:text-indigo-400",
  encoding: "text-teal-500 dark:text-teal-400",
  storage: "text-emerald-500 dark:text-emerald-400",
  retrieval: "text-cyan-500 dark:text-cyan-400",
  report: "text-blue-500 dark:text-blue-400",
};

const STAGE_BG: Record<string, string> = {
  sensation: "bg-amber-500/10 border-amber-500/20",
  attention: "bg-violet-500/10 border-violet-500/20",
  perception: "bg-indigo-500/10 border-indigo-500/20",
  encoding: "bg-teal-500/10 border-teal-500/20",
  storage: "bg-emerald-500/10 border-emerald-500/20",
  retrieval: "bg-cyan-500/10 border-cyan-500/20",
  report: "bg-blue-500/10 border-blue-500/20",
};

const STAGE_GLOW: Record<string, string> = {
  sensation: "shadow-amber-500/20",
  attention: "shadow-violet-500/20",
  perception: "shadow-indigo-500/20",
  encoding: "shadow-teal-500/20",
  storage: "shadow-emerald-500/20",
  retrieval: "shadow-cyan-500/20",
  report: "shadow-blue-500/20",
};

const STAGE_HEX: Record<string, string> = {
  sensation: "#f59e0b",
  attention: "#8b5cf6",
  perception: "#6366f1",
  encoding: "#14b8a6",
  storage: "#10b981",
  retrieval: "#06b6d4",
  report: "#3b82f6",
};

// Brain region SVG coordinates for heatmap
const BRAIN_REGIONS: Record<string, { cx: number; cy: number; r: number; stages: string[] }> = {
  occipital: { cx: 100, cy: 145, r: 28, stages: ["sensation"] },
  temporal_left: { cx: 40, cy: 100, r: 25, stages: ["sensation", "encoding", "storage"] },
  temporal_right: { cx: 160, cy: 100, r: 25, stages: ["sensation", "encoding", "storage"] },
  parietal: { cx: 100, cy: 55, r: 30, stages: ["attention", "perception"] },
  frontal: { cx: 100, cy: 20, r: 28, stages: ["retrieval", "report"] },
  hippocampus: { cx: 100, cy: 105, r: 18, stages: ["encoding", "storage", "retrieval"] },
};

// ─── Hooks ────────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(target);

  useEffect(() => {
    const from = fromRef.current;
    if (Math.abs(from - target) < 0.5) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const startTime = performance.now();
    startRef.current = startTime;
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  // Update fromRef when display settles
  useEffect(() => {
    return () => { fromRef.current = display; };
  }, []);

  return Math.round(display);
}

// ─── Stimulus Illustrations (SVG-based) ────────────────────────────

function FaceIllustration({ noise, className }: { noise: number; className?: string }) {
  const blur = noise * 0.04;
  const opacity = Math.max(0.4, 1 - noise * 0.006);
  return (
    <svg viewBox="0 0 120 120" className={className} style={{ filter: `blur(${blur}px)` }}>
      <circle cx="90" cy="30" r="25" fill="url(#lampGlow)" opacity={0.4} />
      <ellipse cx="55" cy="60" rx="28" ry="35" fill="#c9a0dc" opacity={opacity} />
      <ellipse cx="45" cy="52" rx="4" ry="3" fill="#1a1030" opacity={opacity} />
      <ellipse cx="65" cy="52" rx="4" ry="3" fill="#1a1030" opacity={opacity} />
      <path d="M39 46 Q45 43, 51 46" stroke="#1a1030" strokeWidth="1.5" fill="none" opacity={opacity * 0.7} />
      <path d="M59 46 Q65 43, 71 46" stroke="#1a1030" strokeWidth="1.5" fill="none" opacity={opacity * 0.7} />
      <path d="M45 72 Q55 76, 65 72" stroke="#1a1030" strokeWidth="1.8" fill="none" opacity={opacity * 0.8} />
      <path d="M55 56 L52 65 L58 65" stroke="#1a1030" strokeWidth="1" fill="none" opacity={opacity * 0.5} />
      <path d="M27 45 Q30 20, 55 18 Q80 20, 83 45" stroke="#6b4c8a" strokeWidth="3" fill="none" opacity={opacity * 0.6} />
      <defs>
        <radialGradient id="lampGlow">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function StreetIllustration({ noise, className }: { noise: number; className?: string }) {
  const blur = noise * 0.03;
  const opacity = Math.max(0.4, 1 - noise * 0.005);
  return (
    <svg viewBox="0 0 120 90" className={className} style={{ filter: `blur(${blur}px)` }}>
      <rect width="120" height="55" fill="url(#skyGrad)" opacity={opacity} />
      <rect x="5" y="15" width="18" height="40" rx="1" fill="#2d1f5e" opacity={opacity * 0.7} />
      <rect x="8" y="20" width="4" height="4" rx="0.5" fill="#fbbf24" opacity={opacity * 0.5} />
      <rect x="14" y="25" width="4" height="4" rx="0.5" fill="#fbbf24" opacity={opacity * 0.4} />
      <rect x="28" y="8" width="22" height="47" rx="1" fill="#1e1545" opacity={opacity * 0.7} />
      <rect x="31" y="15" width="4" height="4" rx="0.5" fill="#fbbf24" opacity={opacity * 0.5} />
      <rect x="39" y="12" width="4" height="4" rx="0.5" fill="#fbbf24" opacity={opacity * 0.4} />
      <rect x="75" y="12" width="20" height="43" rx="1" fill="#251b4d" opacity={opacity * 0.7} />
      <rect x="100" y="20" width="16" height="35" rx="1" fill="#2d1f5e" opacity={opacity * 0.7} />
      <rect y="55" width="120" height="35" fill="#1a1030" opacity={opacity} />
      {[0, 1, 2, 3, 4].map(i => (
        <rect key={i} x={45 + i * 7} y="60" width="5" height="20" rx="0.5" fill="#f5f5f5" opacity={opacity * 0.4} />
      ))}
      <line x1="25" y1="35" x2="25" y2="55" stroke="#888" strokeWidth="1.5" opacity={opacity * 0.6} />
      <circle cx="25" cy="34" r="3" fill="#fbbf24" opacity={opacity * 0.8} />
      <line x1="95" y1="35" x2="95" y2="55" stroke="#888" strokeWidth="1.5" opacity={opacity * 0.6} />
      <circle cx="95" cy="34" r="3" fill="#fbbf24" opacity={opacity * 0.7} />
      <ellipse cx="60" cy="63" rx="3" ry="4" fill="#a78bfa" opacity={opacity * 0.8} />
      <line x1="60" y1="67" x2="60" y2="76" stroke="#a78bfa" strokeWidth="1.5" opacity={opacity * 0.8} />
      <line x1="60" y1="76" x2="57" y2="82" stroke="#a78bfa" strokeWidth="1.2" opacity={opacity * 0.7} />
      <line x1="60" y1="76" x2="63" y2="82" stroke="#a78bfa" strokeWidth="1.2" opacity={opacity * 0.7} />
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SoundIllustration({ noise, className }: { noise: number; className?: string }) {
  const blur = noise * 0.02;
  const opacity = Math.max(0.4, 1 - noise * 0.005);
  return (
    <svg viewBox="0 0 120 90" className={className} style={{ filter: `blur(${blur}px)` }}>
      <rect x="55" y="0" width="10" height="90" fill="#374151" opacity={opacity * 0.8} />
      <circle cx="25" cy="40" r="8" fill="#818cf8" opacity={opacity * 0.3} />
      <circle cx="25" cy="40" r="5" fill="#a78bfa" opacity={opacity * 0.5} />
      <circle cx="25" cy="60" r="6" fill="#818cf8" opacity={opacity * 0.2} />
      <circle cx="25" cy="60" r="4" fill="#a78bfa" opacity={opacity * 0.4} />
      {[0, 1, 2, 3].map(i => (
        <path key={i}
          d={`M${40 + i * 3} ${30 + i * 2} Q${43 + i * 3} 45, ${40 + i * 3} ${60 - i * 2}`}
          stroke="#a78bfa" strokeWidth={2 - i * 0.3} fill="none"
          opacity={opacity * (0.6 - i * 0.12)}
        />
      ))}
      {[0, 1, 2].map(i => (
        <path key={i}
          d={`M${70 + i * 5} ${35 + i} Q${73 + i * 5} 45, ${70 + i * 5} ${55 - i}`}
          stroke="#c4b5fd" strokeWidth={1.5 - i * 0.3} fill="none"
          opacity={opacity * (0.35 - i * 0.08)}
          strokeDasharray={i > 0 ? "3 2" : "none"}
        />
      ))}
      <path d="M95 40 Q102 35, 102 45 Q102 55, 95 50 Q92 47, 95 45 Q97 43, 95 40Z"
        fill="#c4b5fd" opacity={opacity * 0.5} />
    </svg>
  );
}

const STIMULUS_ILLUSTRATIONS: Record<string, typeof FaceIllustration> = {
  face: FaceIllustration,
  scene: StreetIllustration,
  sound: SoundIllustration,
};

// ─── CSS-Transition Progress Bar (THE FIX) ────────────────────────

function SignalBar({ strength, color }: { strength: number; color: string }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-muted/40 overflow-hidden backdrop-blur-sm">
      <div
        className={`h-full rounded-full ${color}`}
        style={{
          width: `${strength}%`,
          transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

// ─── Sub-metric mini bar (CSS transition) ─────────────────────────

function MiniMetricBar({ metric, color }: { metric: SubMetric; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{metric.label}</span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">{Math.round(metric.value)}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${metric.value}%`,
            transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Brain Region Heatmap ─────────────────────────────────────────

function BrainHeatmap({ results }: { results: StageResult[] }) {
  const stageStrengths: Record<string, number> = {};
  results.forEach(r => { stageStrengths[r.stage] = r.signalStrength; });

  const getRegionIntensity = (region: typeof BRAIN_REGIONS[string]) => {
    const strengths = region.stages.map(s => stageStrengths[s] || 0);
    return strengths.reduce((a, b) => a + b, 0) / strengths.length / 100;
  };

  const getRegionColor = (region: typeof BRAIN_REGIONS[string]) => {
    const primaryStage = region.stages[0];
    return STAGE_HEX[primaryStage] || "#8b5cf6";
  };

  return (
    <div className="relative">
      <svg viewBox="0 0 200 175" className="w-full max-w-[180px] mx-auto">
        {/* Brain outline */}
        <ellipse cx="100" cy="85" rx="85" ry="80"
          fill="none" stroke="currentColor" strokeWidth="1.5"
          className="text-border/40" />
        {/* Central fissure */}
        <line x1="100" y1="10" x2="100" y2="80"
          stroke="currentColor" strokeWidth="0.8" className="text-border/20" />
        {/* Lateral fissure hints */}
        <path d="M30 95 Q65 80, 100 90" fill="none" stroke="currentColor"
          strokeWidth="0.6" className="text-border/20" />
        <path d="M170 95 Q135 80, 100 90" fill="none" stroke="currentColor"
          strokeWidth="0.6" className="text-border/20" />

        {/* Region glows */}
        {Object.entries(BRAIN_REGIONS).map(([name, region]) => {
          const intensity = getRegionIntensity(region);
          const color = getRegionColor(region);
          return (
            <circle
              key={name}
              cx={region.cx} cy={region.cy} r={region.r}
              fill={color}
              style={{
                opacity: 0.08 + intensity * 0.55,
                transition: "opacity 0.4s ease-out",
                filter: `blur(${4 + intensity * 8}px)`,
              }}
            />
          );
        })}

        {/* Region dots */}
        {Object.entries(BRAIN_REGIONS).map(([name, region]) => {
          const intensity = getRegionIntensity(region);
          const color = getRegionColor(region);
          return (
            <circle
              key={`dot-${name}`}
              cx={region.cx} cy={region.cy} r={3}
              fill={color}
              style={{
                opacity: 0.3 + intensity * 0.7,
                transition: "opacity 0.4s ease-out",
              }}
            />
          );
        })}

        {/* Labels */}
        <text x="100" y="172" textAnchor="middle" className="fill-muted-foreground/40 text-[7px]">
          Brain Activity Map
        </text>
      </svg>
    </div>
  );
}

// ─── Feature Survival Waterfall ───────────────────────────────────

function FeatureSurvivalTracker({ results, stimulus }: { results: StageResult[]; stimulus: Stimulus }) {
  const allFeatures = stimulus.features;
  const stageLabels = results.map(r => r.label[0]); // S, A, P, E, S, R, R

  return (
    <div className="space-y-1.5">
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Feature Survival
      </h5>
      {allFeatures.map((feature, fi) => {
        // Track feature through each stage
        const survived = results.map(r => r.featuresOut.some(f =>
          f.includes(feature) || feature.includes(f.split(" ")[0])
        ));
        return (
          <div key={fi} className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground/70 w-20 truncate shrink-0" title={feature}>
              {feature}
            </span>
            <div className="flex gap-0.5 flex-1">
              {results.map((r, si) => {
                const isIn = r.featuresIn.includes(feature);
                const isOut = r.featuresOut.includes(feature);
                const wasModified = r.featuresOut.some(f => f.includes("expectation") && isIn);
                return (
                  <div
                    key={si}
                    className="h-3 flex-1 rounded-sm"
                    style={{
                      backgroundColor: isOut
                        ? `${STAGE_HEX[r.stage]}40`
                        : isIn && !isOut
                          ? "#ef444430"
                          : wasModified
                            ? "#f59e0b30"
                            : "rgba(128,128,128,0.08)",
                      transition: "background-color 0.3s ease",
                    }}
                    title={`${r.label}: ${isOut ? "survived" : isIn ? "lost" : "n/a"}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex gap-3 mt-1 pt-1 border-t border-border/20">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-emerald-500/30" />
          <span className="text-[8px] text-muted-foreground/50">Survived</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-500/30" />
          <span className="text-[8px] text-muted-foreground/50">Lost</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-gray-500/10" />
          <span className="text-[8px] text-muted-foreground/50">N/A</span>
        </div>
      </div>
    </div>
  );
}

// ─── Cognitive Bottleneck Detector ─────────────────────────────────

function BottleneckDetector({ results }: { results: StageResult[] }) {
  const weakest = results.reduce((min, r) => r.signalStrength < min.signalStrength ? r : min, results[0]);
  const isBottleneck = weakest.signalStrength < 50;
  if (!isBottleneck) return null;

  const severity = weakest.signalStrength < 30 ? "critical" : "moderate";
  const suggestions: Record<string, string> = {
    sensation: "Reduce Perceptual Noise to improve signal clarity.",
    attention: "Increase Attentional Focus to let more information through.",
    perception: "Adjust Prior Expectations or reduce noise for better interpretation.",
    encoding: "Increase Encoding Strength for deeper memory processing.",
    storage: "Improve encoding quality upstream for more durable storage.",
    retrieval: "Increase Retrieval Cue strength for better memory access.",
    report: "Improve upstream stages — the report reflects cumulative processing.",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-3 rounded-xl border ${
        severity === "critical"
          ? "bg-red-500/5 border-red-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 ${severity === "critical" ? "text-red-400" : "text-amber-500"}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold">Bottleneck: {weakest.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              severity === "critical"
                ? "bg-red-500/10 text-red-400"
                : "bg-amber-500/10 text-amber-500"
            }`}>
              {Math.round(weakest.signalStrength)}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {suggestions[weakest.stage] || "Adjust parameters to improve this stage."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Neural Pathway Connector ─────────────────────────────────────

function NeuralPathway({ fromStrength, toStrength, fromStage, toStage }: {
  fromStrength: number; toStrength: number; fromStage: string; toStage: string;
}) {
  const delta = toStrength - fromStrength;
  const avgStrength = (fromStrength + toStrength) / 2;
  const dotCount = Math.max(1, Math.round(avgStrength / 25));
  const pathId = `path-${fromStage}-${toStage}`;

  return (
    <div className="flex items-center justify-center py-1 relative" style={{ height: 36 }}>
      <svg width="200" height="36" viewBox="0 0 200 36" className="overflow-visible">
        {/* Neural pathway curve */}
        <path
          id={pathId}
          d="M100 0 C100 12, 100 24, 100 36"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary/15"
          style={{
            opacity: 0.1 + (avgStrength / 100) * 0.5,
            transition: "opacity 0.3s ease",
          }}
        />

        {/* Animated flowing dots */}
        {Array.from({ length: dotCount }).map((_, i) => (
          <circle
            key={i}
            r="2"
            fill={STAGE_HEX[fromStage] || "#8b5cf6"}
            style={{
              opacity: 0.3 + (avgStrength / 100) * 0.5,
              transition: "opacity 0.3s ease",
            }}
          >
            <animateMotion
              dur={`${1.2 + i * 0.3}s`}
              repeatCount="indefinite"
              begin={`${i * 0.4}s`}
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        ))}
      </svg>

      {/* Delta label */}
      {Math.abs(delta) > 3 && (
        <span
          className={`absolute right-[calc(50%-60px)] top-1/2 -translate-y-1/2 text-[9px] font-mono flex items-center gap-0.5 ${
            delta > 5 ? "text-emerald-500" : delta < -10 ? "text-red-400" : "text-muted-foreground/40"
          }`}
          style={{ transition: "color 0.3s ease" }}
        >
          {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : delta < -5 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
          {delta > 0 ? "+" : ""}{Math.round(delta)}%
        </span>
      )}
    </div>
  );
}

// ─── Signal Radar Chart (SVG, CSS transitions) ───────────────────

function SignalRadar({ results }: { results: StageResult[] }) {
  const cx = 100, cy = 100, r = 75;
  const n = results.length;

  const points = results.map((res, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const dist = (res.signalStrength / 100) * r;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      labelX: cx + Math.cos(angle) * (r + 18),
      labelY: cy + Math.sin(angle) * (r + 18),
      strength: res.signalStrength,
      label: res.label,
    };
  });

  const polyPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(scale => (
        <circle key={scale} cx={cx} cy={cy} r={r * scale}
          fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/30" />
      ))}
      {/* Grid lines */}
      {results.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r}
            stroke="currentColor" strokeWidth="0.5" className="text-border/20"
          />
        );
      })}
      {/* Data polygon - CSS transition */}
      <polygon
        points={polyPoints}
        fill="url(#radarFill)"
        stroke="url(#radarStroke)"
        strokeWidth="2"
        style={{ transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i}
          cx={p.x} cy={p.y} r="3.5"
          fill="white" stroke="url(#radarStroke)" strokeWidth="1.5"
          style={{ transition: "cx 0.4s ease, cy 0.4s ease" }}
        />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={`label-${i}`}
          x={p.labelX} y={p.labelY}
          textAnchor="middle" dominantBaseline="middle"
          className="fill-muted-foreground text-[7px] font-medium"
        >
          {p.label}
        </text>
      ))}
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="radarStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Feature Flow Tracker ────────────────────────────────────────

function FeatureTracker({ featuresIn, featuresOut }: { featuresIn: string[]; featuresOut: string[] }) {
  const lost = featuresIn.filter(f => !featuresOut.includes(f));
  const gained = featuresOut.filter(f => !featuresIn.includes(f));
  if (lost.length === 0 && gained.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {lost.map((f, i) => (
        <span key={`lost-${i}`} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400/80 border border-red-500/10 line-through">
          {f}
        </span>
      ))}
      {gained.map((f, i) => (
        <span key={`gained-${i}`} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10">
          + {f}
        </span>
      ))}
    </div>
  );
}

// ─── Stage Card ──────────────────────────────────────────────────

function StageCard({ result, index, isExpanded, onToggle, snapshotResult }: {
  result: StageResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  snapshotResult?: StageResult | null;
}) {
  const Icon = STAGE_ICONS[result.stage] || Brain;
  const barColor = STAGE_BAR_COLORS[result.stage];
  const accent = STAGE_ACCENT[result.stage];
  const bg = STAGE_BG[result.stage];
  const glow = STAGE_GLOW[result.stage];
  const animatedStrength = useAnimatedNumber(result.signalStrength);

  const strengthLevel = result.signalStrength > 70 ? "high" : result.signalStrength > 40 ? "mid" : "low";
  const snapshotDelta = snapshotResult ? Math.round(result.signalStrength - snapshotResult.signalStrength) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={`group relative rounded-xl border bg-card/80 backdrop-blur-sm 
          cursor-pointer transition-all duration-300 hover:bg-card overflow-hidden
          ${isExpanded ? `ring-1 ring-primary/20 shadow-lg ${glow} border-primary/20` : "border-border/50 hover:shadow-md hover:border-border/80"}`}
        onClick={onToggle}
        data-testid={`stage-card-${result.stage}`}
      >
        {/* Animated accent bar at top - CSS transition */}
        <div
          className={`h-0.5 ${barColor}`}
          style={{
            width: `${result.signalStrength}%`,
            transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        <div className="p-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="relative">
              <div className={`${accent} transition-transform duration-300 ${isExpanded ? "scale-110" : "group-hover:scale-105"}`}>
                <div className={`w-9 h-9 rounded-lg ${bg} border flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                </div>
              </div>
              {result.warnings.length > 0 && (
                <div className="absolute -top-1 -right-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm tracking-tight">{result.label}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                    strengthLevel === "high" ? "bg-emerald-500/10 text-emerald-500" :
                    strengthLevel === "mid" ? "bg-amber-500/10 text-amber-500" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {strengthLevel === "high" ? "Strong" : strengthLevel === "mid" ? "Moderate" : "Weak"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {snapshotDelta !== null && snapshotDelta !== 0 && (
                    <span className={`text-[9px] font-mono ${snapshotDelta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {snapshotDelta > 0 ? "+" : ""}{snapshotDelta}
                    </span>
                  )}
                  <span className="text-sm font-mono tabular-nums font-semibold"
                    data-testid={`strength-${result.stage}`}>
                    {animatedStrength}%
                  </span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </motion.div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/70 mb-2">{result.description}</p>

              {/* Main bar + optional snapshot comparison */}
              <div className="space-y-1">
                <SignalBar strength={result.signalStrength} color={barColor} />
                {snapshotResult && (
                  <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} opacity-30`}
                      style={{
                        width: `${snapshotResult.signalStrength}%`,
                        transition: "width 0.35s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-3 border-t border-border/30 space-y-4">
                  {/* Sub-metrics grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {result.subMetrics.map((metric) => (
                      <MiniMetricBar key={metric.label} metric={metric} color={barColor} />
                    ))}
                  </div>

                  {/* Details text */}
                  <p className="text-sm leading-relaxed text-foreground/80">{result.details}</p>

                  {/* Feature tracking */}
                  <FeatureTracker featuresIn={result.featuresIn} featuresOut={result.featuresOut} />

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-500/90">{result.warnings.join(". ")}</p>
                    </div>
                  )}

                  {/* Concept box */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs leading-relaxed text-muted-foreground">{result.concept}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Processing Timeline ──────────────────────────────────────────

function ProcessingTimeline({ results, isAnimating }: { results: StageResult[]; isAnimating: boolean }) {
  if (!isAnimating) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-1 mb-4 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15"
    >
      <Zap className="w-3.5 h-3.5 text-violet-500 animate-pulse" />
      <span className="text-[11px] text-violet-500 font-medium">Signal propagating through pipeline...</span>
      <div className="flex gap-1 ml-auto">
        {results.map((r, i) => (
          <motion.div
            key={r.stage}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STAGE_HEX[r.stage] }}
            initial={{ opacity: 0.15, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Stimulus Card ───────────────────────────────────────────────

function StimulusCard({ stimulus, isSelected, onSelect, noise }: {
  stimulus: Stimulus;
  isSelected: boolean;
  onSelect: () => void;
  noise: number;
}) {
  const Illustration = STIMULUS_ILLUSTRATIONS[stimulus.id];
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`w-full text-left rounded-xl border transition-all duration-300 overflow-hidden ${
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
          : "border-border/50 bg-card/50 hover:border-primary/20 hover:bg-card/80"
      }`}
      data-testid={`stimulus-${stimulus.id}`}
    >
      {isSelected && Illustration && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 80, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-gradient-to-b from-background/50 to-transparent px-3 pt-2 flex items-center justify-center"
        >
          <Illustration noise={noise} className="h-16 w-auto opacity-80" />
        </motion.div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{stimulus.imageEmoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">{stimulus.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/60 uppercase tracking-wider">
                {stimulus.modality}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{stimulus.description}</div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ParamSlider({ label, value, onChange, description, icon: Icon, accentClass }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
  icon: typeof Brain;
  accentClass?: string;
}) {
  return (
    <div className="space-y-2.5 group" data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accentClass || "text-muted-foreground"} transition-colors`} strokeWidth={1.5} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
          {value}
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────

function LandingHero({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f0a1a 0%, #1a1030 40%, #0d0d2b 100%)" }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative w-full h-[50vh] max-h-[500px]">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
              <Brain className="w-24 h-24 text-violet-400/50" />
            </motion.div>
          </div>
        }>
          <BrainScene />
        </Suspense>
      </div>
      <motion.div
        className="relative text-center z-10 -mt-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-2 mb-3">
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-400/30 text-[10px] font-mono tracking-wider">
            PSYC 203
          </Badge>
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-3"
          style={{ fontFamily: "'General Sans', sans-serif" }}>
          Build-A-
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Brain
          </span>
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="text-lg text-white/40 tracking-wide font-light">
          Cognitive Pipeline Simulator
        </motion.p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}
        className="relative z-10 mt-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEnter}
          className="group flex items-center gap-2 px-8 py-3 rounded-full 
            bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium
            shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
            transition-shadow duration-300"
          data-testid="enter-button"
        >
          <Sparkles className="w-4 h-4" />
          <span>Explore the Pipeline</span>
          <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
        </motion.button>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
        className="absolute bottom-8 text-white/20 text-xs tracking-widest uppercase">
        Move your cursor to rotate the brain
      </motion.div>
    </motion.div>
  );
}

// ─── Snapshot type ────────────────────────────────────────────────
interface Snapshot {
  params: PipelineParams;
  results: StageResult[];
  timestamp: number;
}

// ─── Main Page ────────────────────────────────────────────────────

export default function Home() {
  const [showLanding, setShowLanding] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [selectedStimulus, setSelectedStimulus] = useState<Stimulus>(STIMULI[0]);
  const [params, setParams] = useState<PipelineParams>({
    attentionalFocus: 65,
    perceptualNoise: 30,
    priorExpectation: 50,
    encodingStrength: 60,
    retrievalCue: 55,
  });
  const [results, setResults] = useState<StageResult[] | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [isAnimating, setIsAnimating] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const hasRun = useRef(false);

  const runSimulation = useCallback(() => {
    const pipelineResults = runPipeline(selectedStimulus, params);
    if (!hasRun.current) {
      // First run: show animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1400);
    }
    setResults(pipelineResults);
    hasRun.current = true;
  }, [selectedStimulus, params]);

  // Live updates after first run
  useEffect(() => {
    if (hasRun.current) {
      const pipelineResults = runPipeline(selectedStimulus, params);
      setResults(pipelineResults);
    }
  }, [params, selectedStimulus]);

  const resetParams = useCallback(() => {
    setParams({
      attentionalFocus: 65,
      perceptualNoise: 30,
      priorExpectation: 50,
      encodingStrength: 60,
      retrievalCue: 55,
    });
    setResults(null);
    setExpandedStage(null);
    hasRun.current = false;
    setSnapshot(null);
  }, []);

  const saveSnapshot = useCallback(() => {
    if (results) {
      setSnapshot({ params: { ...params }, results: [...results], timestamp: Date.now() });
    }
  }, [params, results]);

  const clearSnapshot = useCallback(() => setSnapshot(null), []);

  // Calculate overall pipeline health
  const pipelineHealth = results
    ? Math.round(results.reduce((sum, r) => sum + r.signalStrength, 0) / results.length)
    : 0;
  const totalWarnings = results ? results.reduce((sum, r) => sum + r.warnings.length, 0) : 0;
  const animatedHealth = useAnimatedNumber(pipelineHealth);

  return (
    <>
      <AnimatePresence>
        {showLanding && (
          <LandingHero onEnter={() => setShowLanding(false)} />
        )}
      </AnimatePresence>

      <motion.div
        className="min-h-screen bg-background"
        initial={false}
        animate={{ opacity: showLanding ? 0 : 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <motion.div
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: showLanding ? 0 : 1, x: showLanding ? -10 : 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Brain className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight leading-none">Build-A-Brain</h1>
                <p className="text-[10px] text-muted-foreground font-medium">Cognitive Pipeline Simulator</p>
              </div>
            </motion.div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono tracking-wider border-primary/20">
                PSYC 203
              </Badge>
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg hover:bg-muted/50 transition-all duration-200"
                aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                data-testid="theme-toggle"
              >
                <motion.div
                  key={isDark ? "sun" : "moon"}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.3 }}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </motion.div>
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <motion.section
          className="py-10 px-4 sm:px-6 border-b border-border/30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showLanding ? 0 : 1, y: showLanding ? 20 : 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold tracking-tight mb-2.5">
                How does your brain process information?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tune the cognitive parameters, select a stimulus, and watch real-time signal propagation
                through the pipeline. Sliders update the simulation instantly — explore how{" "}
                <span className="text-violet-500 dark:text-violet-400 font-medium">Sensation & Perception</span>,{" "}
                <span className="text-indigo-500 dark:text-indigo-400 font-medium">Attention</span>, and{" "}
                <span className="text-emerald-500 dark:text-emerald-400 font-medium">Memory</span>{" "}
                shape what you remember.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full max-w-sm bg-muted/50 p-1">
              <TabsTrigger value="pipeline" data-testid="tab-pipeline" className="text-xs font-semibold">
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="learn" data-testid="tab-learn" className="text-xs font-semibold">
                Learn
              </TabsTrigger>
              <TabsTrigger value="about" data-testid="tab-about" className="text-xs font-semibold">
                About
              </TabsTrigger>
            </TabsList>

            {/* ─── Pipeline Tab ─── */}
            <TabsContent value="pipeline" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Controls */}
                <div className="lg:col-span-4 space-y-4">
                  <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                      Stimulus
                    </h3>
                    <div className="space-y-2">
                      {STIMULI.map((s) => (
                        <StimulusCard
                          key={s.id}
                          stimulus={s}
                          isSelected={selectedStimulus.id === s.id}
                          onSelect={() => setSelectedStimulus(s)}
                          noise={params.perceptualNoise}
                        />
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4 space-y-5 bg-card/80 backdrop-blur-sm border-border/50">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Brain Parameters
                    </h3>

                    <ParamSlider
                      label="Attentional Focus"
                      value={params.attentionalFocus}
                      onChange={(v) => setParams(p => ({ ...p, attentionalFocus: v }))}
                      description="High = narrow deep focus. Low = diffuse attention."
                      icon={Focus}
                      accentClass="text-violet-500 dark:text-violet-400"
                    />
                    <ParamSlider
                      label="Perceptual Noise"
                      value={params.perceptualNoise}
                      onChange={(v) => setParams(p => ({ ...p, perceptualNoise: v }))}
                      description="High = degraded signal. Low = crisp input."
                      icon={Ear}
                      accentClass="text-amber-500 dark:text-amber-400"
                    />
                    <ParamSlider
                      label="Prior Expectations"
                      value={params.priorExpectation}
                      onChange={(v) => setParams(p => ({ ...p, priorExpectation: v }))}
                      description="High = strong top-down influence. Low = data-driven."
                      icon={Brain}
                      accentClass="text-indigo-500 dark:text-indigo-400"
                    />
                    <ParamSlider
                      label="Encoding Strength"
                      value={params.encodingStrength}
                      onChange={(v) => setParams(p => ({ ...p, encodingStrength: v }))}
                      description="High = deep semantic processing. Low = shallow."
                      icon={Database}
                      accentClass="text-teal-500 dark:text-teal-400"
                    />
                    <ParamSlider
                      label="Retrieval Cue"
                      value={params.retrievalCue}
                      onChange={(v) => setParams(p => ({ ...p, retrievalCue: v }))}
                      description="High = strong context match. Low = weak cues."
                      icon={Search}
                      accentClass="text-cyan-500 dark:text-cyan-400"
                    />

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={runSimulation}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
                        data-testid="run-button"
                      >
                        <Zap className="w-4 h-4 mr-1.5" />
                        Run Pipeline
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetParams}
                        className="border-border/50 hover:bg-muted/50"
                        data-testid="reset-button"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                </div>

                {/* Pipeline Results */}
                <div className="lg:col-span-8">
                  <AnimatePresence mode="wait">
                    {results ? (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-1.5"
                      >
                        {/* Header with live stats */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Pipeline Output
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`text-[10px] font-mono ${
                                pipelineHealth > 65 ? "border-emerald-500/30 text-emerald-500" :
                                pipelineHealth > 40 ? "border-amber-500/30 text-amber-500" :
                                "border-red-500/30 text-red-400"
                              }`}>
                                <Activity className="w-3 h-3 mr-1" />
                                {animatedHealth}% avg
                              </Badge>
                              {totalWarnings > 0 && (
                                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-500">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {totalWarnings} alert{totalWarnings > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!snapshot ? (
                              <Button
                                variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); saveSnapshot(); }}
                                className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                data-testid="snapshot-button"
                              >
                                <Camera className="w-3 h-3" /> Snapshot
                              </Button>
                            ) : (
                              <Button
                                variant="ghost" size="sm"
                                onClick={(e) => { e.stopPropagation(); clearSnapshot(); }}
                                className="h-7 text-[10px] gap-1 text-violet-500 hover:text-violet-400"
                                data-testid="clear-snapshot-button"
                              >
                                <X className="w-3 h-3" /> Clear Comparison
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Processing timeline animation */}
                        <AnimatePresence>
                          <ProcessingTimeline results={results} isAnimating={isAnimating} />
                        </AnimatePresence>

                        {/* Bottleneck detector */}
                        <BottleneckDetector results={results} />

                        {/* Stimulus visualization */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                          className="mb-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 border border-primary/10"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-24 h-20 rounded-lg bg-background/50 border border-border/30 flex items-center justify-center overflow-hidden">
                              {(() => {
                                const Illus = STIMULUS_ILLUSTRATIONS[selectedStimulus.id];
                                return Illus ? <Illus noise={params.perceptualNoise} className="w-20 h-auto" /> : null;
                              })()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{selectedStimulus.imageEmoji}</span>
                                <h4 className="text-sm font-semibold">{selectedStimulus.name}</h4>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 uppercase tracking-wider">
                                  {selectedStimulus.modality}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{selectedStimulus.sceneDescription}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {selectedStimulus.features.map((f, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground/70">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        {/* Brain heatmap + stage cards in two columns on large screens */}
                        <div className="grid grid-cols-1 xl:grid-cols-[180px_1fr] gap-4">
                          {/* Brain heatmap sidebar */}
                          <div className="hidden xl:block sticky top-20 self-start">
                            <BrainHeatmap results={results} />
                            <div className="mt-4">
                              <FeatureSurvivalTracker results={results} stimulus={selectedStimulus} />
                            </div>
                          </div>

                          {/* Stage cards column */}
                          <div className="space-y-1.5">
                            {results.map((result, i) => (
                              <div key={result.stage}>
                                <StageCard
                                  result={result}
                                  index={i}
                                  isExpanded={expandedStage === result.stage}
                                  onToggle={() => setExpandedStage(
                                    expandedStage === result.stage ? null : result.stage
                                  )}
                                  snapshotResult={snapshot?.results[i] || null}
                                />
                                {i < results.length - 1 && (
                                  <NeuralPathway
                                    fromStrength={result.signalStrength}
                                    toStrength={results[i + 1].signalStrength}
                                    fromStage={result.stage}
                                    toStage={results[i + 1].stage}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Brain heatmap + feature tracker for mobile */}
                        <div className="xl:hidden mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex justify-center">
                            <BrainHeatmap results={results} />
                          </div>
                          <FeatureSurvivalTracker results={results} stimulus={selectedStimulus} />
                        </div>

                        {/* Summary with radar */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mt-6"
                        >
                          <div className="p-5 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 
                            border border-primary/10 backdrop-blur-sm">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                              Pipeline Summary
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Radar chart */}
                              <div>
                                <SignalRadar results={results} />
                              </div>

                              {/* Text summary + badges */}
                              <div className="flex flex-col justify-center space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30">
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Input Signal</p>
                                    <p className="text-lg font-bold tabular-nums">{Math.round(results[0].signalStrength)}%</p>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30">
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Output Signal</p>
                                    <p className="text-lg font-bold tabular-nums">{Math.round(results[results.length - 1].signalStrength)}%</p>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30">
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Signal Change</p>
                                    <p className={`text-lg font-bold tabular-nums ${
                                      results[results.length - 1].signalStrength >= results[0].signalStrength
                                        ? "text-emerald-500" : "text-red-400"
                                    }`}>
                                      {results[results.length - 1].signalStrength >= results[0].signalStrength ? "+" : ""}
                                      {Math.round(results[results.length - 1].signalStrength - results[0].signalStrength)}%
                                    </p>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30">
                                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Distortions</p>
                                    <p className={`text-lg font-bold tabular-nums ${
                                      totalWarnings === 0 ? "text-emerald-500" : "text-amber-500"
                                    }`}>
                                      {totalWarnings}
                                    </p>
                                  </div>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {results[results.length - 1].signalStrength < results[0].signalStrength * 0.5
                                    ? "Significant degradation — cognitive bottlenecks dramatically altered the output."
                                    : results[results.length - 1].signalStrength > results[0].signalStrength * 0.8
                                      ? "Signal preserved well, but top-down processes may have filled in inaccurate details."
                                      : "Moderate transformation — each stage shaped the information constructively."
                                  }
                                </p>

                                {/* Snapshot comparison summary */}
                                {snapshot && (
                                  <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
                                    <p className="text-[10px] text-violet-400 font-medium mb-1">
                                      Comparing to snapshot
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {results.map((r, i) => {
                                        const d = Math.round(r.signalStrength - (snapshot.results[i]?.signalStrength || 0));
                                        return (
                                          <span key={r.stage}
                                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                              d > 0 ? "bg-emerald-500/10 text-emerald-500" :
                                              d < 0 ? "bg-red-500/10 text-red-400" :
                                              "bg-muted/30 text-muted-foreground/50"
                                            }`}>
                                            {r.label} {d > 0 ? "+" : ""}{d}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-1.5">
                                  {results.map((r) => (
                                    <span key={r.stage}
                                      className="inline-flex items-center gap-1 text-[10px] font-mono tabular-nums 
                                        px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
                                      {r.label} {Math.round(r.signalStrength)}%
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-[500px] text-center"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.08, 1],
                            opacity: [0.15, 0.25, 0.15],
                          }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Brain className="w-20 h-20 text-primary/20 mb-6" strokeWidth={1} />
                        </motion.div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                          Ready to simulate
                        </h3>
                        <p className="text-xs text-muted-foreground/60 max-w-xs">
                          Choose a stimulus and adjust parameters, then click Run Pipeline.
                          After the first run, sliders update results in real time.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </TabsContent>

            {/* ─── Learn Tab ─── */}
            <TabsContent value="learn" className="space-y-6">
              <div className="max-w-3xl space-y-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-5 bg-card/80 backdrop-blur-sm border-border/50">
                    <h3 className="text-lg font-bold mb-3">The Cognitive Pipeline</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      The brain doesn't passively record reality — it actively constructs experience through
                      interconnected processing stages. This simulator lets you see how changing one parameter
                      ripples through the entire system.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { title: "Bottom-Up vs Top-Down", desc: "Sensation feeds data upward, while expectations flow downward. Perception sits at the intersection.", icon: "↕️" },
                        { title: "Attentional Bottleneck", desc: "Attention acts as a selective filter, determining which information reaches deeper processing.", icon: "🔍" },
                        { title: "Levels of Processing", desc: "Deeper, more meaningful encoding produces stronger memories than shallow processing.", icon: "📊" },
                        { title: "Encoding Specificity", desc: "Retrieval works best when the context at recall matches the context at encoding.", icon: "🔑" },
                      ].map((item, i) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="p-3 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{item.icon}</span>
                            <h4 className="text-sm font-semibold">{item.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                <Card className="p-5 bg-card/80 backdrop-blur-sm border-border/50">
                  <h3 className="text-lg font-bold mb-3">Topic Integration</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    This project shows deep integration between Sensation & Perception, Attention, and Memory:
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { title: "Sensation → Perception → Memory", desc: "What you sense determines what you perceive, which determines what gets encoded. Run the pipeline with high noise to see degradation propagate." },
                      { title: "Attention as Gatekeeper", desc: "Attention filters what reaches deeper processing. Low focus means data loss before perception — demonstrating inattentional blindness." },
                      { title: "Top-Down Processing Shapes Memory", desc: "High expectations fill in ambiguous details, which get encoded as 'real' — creating false memories through constructive cognition." },
                    ].map((item, i) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.1 }}
                        className="p-3 rounded-xl bg-primary/5 border border-primary/10"
                      >
                        <h4 className="text-sm font-semibold mb-1">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5 bg-card/80 backdrop-blur-sm border-border/50">
                  <h3 className="text-lg font-bold mb-3">Try These Experiments</h3>
                  <div className="space-y-2">
                    {[
                      { name: "The Noisy Room", config: "Perceptual Noise → 90", prediction: "Watch signal degrade at every downstream stage" },
                      { name: "The Biased Observer", config: "Expectations → 95, Noise → 60", prediction: "Expectations fill in what noise obscures" },
                      { name: "Inattentional Blindness", config: "Focus → 10", prediction: "Spreading attention thin causes feature loss" },
                      { name: "Deep vs Shallow", config: "Run twice: Encoding 90 vs 10", prediction: "Compare how depth affects the final report" },
                      { name: "Tip of the Tongue", config: "Encoding → 70, Retrieval → 10", prediction: "Memory exists but can't be accessed" },
                    ].map((exp, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-primary/60">0{i + 1}</span>
                          <h4 className="text-sm font-semibold">{exp.name}</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground"><strong>Setup:</strong> {exp.config}</p>
                        <p className="text-[11px] text-muted-foreground"><strong>Observe:</strong> {exp.prediction}</p>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* ─── About Tab ─── */}
            <TabsContent value="about" className="space-y-6">
              <div className="max-w-3xl space-y-6">
                <Card className="p-5 bg-card/80 backdrop-blur-sm border-border/50">
                  <h3 className="text-lg font-bold mb-3">About This Project</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    The <strong className="text-foreground">Cognitive Pipeline Simulator</strong> is a Build-A-Brain project for
                    PSYC 203 at Rice University. It models the brain as an interactive information-processing
                    pipeline where cognitive processes transform raw sensory input into conscious experience and memory.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The project integrates <strong className="text-foreground">Sensation & Perception</strong> and{" "}
                    <strong className="text-foreground">Memory</strong> (with{" "}
                    <strong className="text-foreground">Attention</strong> as a bridge) by modeling them as interconnected
                    stages. Changes at any stage propagate through the entire system.
                  </p>
                </Card>

                <Card className="p-5 bg-card/80 backdrop-blur-sm border-border/50">
                  <h3 className="text-lg font-bold mb-3">Glossary</h3>
                  <div className="space-y-2">
                    {[
                      { term: "Bottom-Up Processing", def: "Data-driven processing starting from sensory input" },
                      { term: "Top-Down Processing", def: "Knowledge-driven processing shaped by expectations" },
                      { term: "Broadbent's Filter Theory", def: "Attention as an early filter based on physical characteristics" },
                      { term: "Treisman's Attenuation", def: "Unattended information is weakened, not blocked" },
                      { term: "Inattentional Blindness", def: "Failure to notice stimuli when attention is focused elsewhere" },
                      { term: "Gestalt Principles", def: "Rules (proximity, similarity, closure) that organize perception" },
                      { term: "Levels of Processing", def: "Deeper encoding = stronger memories (Craik & Lockhart)" },
                      { term: "Multi-Store Model", def: "Sensory → short-term → long-term memory (Atkinson & Shiffrin)" },
                      { term: "Encoding Specificity", def: "Retrieval best when cues match encoding context (Tulving)" },
                      { term: "Reconstructive Memory", def: "Recall is active reconstruction, not playback" },
                    ].map((item) => (
                      <div key={item.term} className="flex gap-3 py-1.5 border-b border-border/20 last:border-0">
                        <span className="text-sm font-semibold shrink-0 w-[180px]">{item.term}</span>
                        <span className="text-sm text-muted-foreground">{item.def}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground/50">
                    Steve Zhang · PSYC 203 · Rice University · Spring 2026
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </motion.div>
    </>
  );
}
