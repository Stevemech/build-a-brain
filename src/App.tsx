import { lazy, Suspense, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  BookOpen,
  Info,
  RotateCcw,
  Play,
  AlertTriangle,
} from "lucide-react";
import {
  STIMULI,
  runPipeline,
  type Stimulus,
  type StageResult,
  type PipelineParams,
} from "./pipeline-engine";

// Lazy load the heavy 3D scene
const BrainScene = lazy(() => import("./BrainScene"));

// ─── Clamp utility ───────────────────────────────────────────────────────────
const clamp = (v: number) => Math.min(100, Math.max(0, v));

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { id: "sensation",  color: "#f59e0b", gradient: "linear-gradient(to right, #f59e0b, #fbbf24)", label: "Sensation",  icon: "◉", shortLabel: "SEN" },
  { id: "attention",  color: "#8b5cf6", gradient: "linear-gradient(to right, #8b5cf6, #a78bfa)", label: "Attention",  icon: "◎", shortLabel: "ATT" },
  { id: "perception", color: "#6366f1", gradient: "linear-gradient(to right, #6366f1, #818cf8)", label: "Perception", icon: "⬡", shortLabel: "PER" },
  { id: "encoding",   color: "#14b8a6", gradient: "linear-gradient(to right, #14b8a6, #2dd4bf)", label: "Encoding",   icon: "▣", shortLabel: "ENC" },
  { id: "storage",    color: "#10b981", gradient: "linear-gradient(to right, #10b981, #34d399)", label: "Storage",    icon: "⬢", shortLabel: "STR" },
  { id: "retrieval",  color: "#06b6d4", gradient: "linear-gradient(to right, #06b6d4, #22d3ee)", label: "Retrieval",  icon: "◈", shortLabel: "RET" },
  { id: "report",     color: "#3b82f6", gradient: "linear-gradient(to right, #3b82f6, #60a5fa)", label: "Report",     icon: "★", shortLabel: "REP" },
];

const getStatusLabel = (v: number) =>
  v >= 70 ? "Strong" : v >= 40 ? "Moderate" : "Weak";
const getStatusColor = (v: number) =>
  v >= 70 ? "#10b981" : v >= 40 ? "#f59e0b" : "#ef4444";

// ─── Default params ───────────────────────────────────────────────────────────
const DEFAULT_PARAMS: PipelineParams = {
  attentionalFocus: 65,
  perceptualNoise: 30,
  priorExpectation: 50,
  encodingStrength: 60,
  retrievalCue: 55,
};

const PARAM_META = [
  {
    key: "attentionalFocus" as keyof PipelineParams,
    label: "Attentional Focus",
    description: "High = narrow deep focus, Low = diffuse awareness",
    color: "#8b5cf6",
  },
  {
    key: "perceptualNoise" as keyof PipelineParams,
    label: "Perceptual Noise",
    description: "High = degraded/unclear signal, Low = crisp input",
    color: "#ef4444",
  },
  {
    key: "priorExpectation" as keyof PipelineParams,
    label: "Prior Expectations",
    description: "High = strong top-down shaping, Low = data-driven",
    color: "#6366f1",
  },
  {
    key: "encodingStrength" as keyof PipelineParams,
    label: "Encoding Strength",
    description: "High = deep semantic encoding, Low = shallow structural",
    color: "#14b8a6",
  },
  {
    key: "retrievalCue" as keyof PipelineParams,
    label: "Retrieval Cue",
    description: "High = strong context cue, Low = weak/absent cue",
    color: "#06b6d4",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BRAIN FALLBACK (pulsing glow)
// ─────────────────────────────────────────────────────────────────────────────
function BrainFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full opacity-20 animate-ping"
          style={{
            width: 220,
            height: 220,
            background: "radial-gradient(circle, #8b5cf6, transparent)",
            animationDuration: "1.8s",
          }}
        />
        <div
          className="absolute rounded-full opacity-30"
          style={{
            width: 160,
            height: 160,
            background: "radial-gradient(circle, #8b5cf6 40%, transparent 80%)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <Brain size={72} color="#a78bfa" strokeWidth={1.5} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface SliderProps {
  label: string;
  description: string;
  value: number;
  color: string;
  paramKey: keyof PipelineParams;
  onChange: (key: keyof PipelineParams, val: number) => void;
}

function ParamSlider({ label, description, value, color, paramKey, onChange }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        <span
          className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{
            color,
            background: `${color}18`,
            fontFamily: "var(--font-mono)",
          }}
        >
          {value}
        </span>
      </div>
      <div className="relative mb-1.5">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(paramKey, Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={
            {
              background: `linear-gradient(to right, ${color} ${value}%, var(--color-surface-2) ${value}%)`,
              "--thumb-color": color,
            } as React.CSSProperties
          }
        />
      </div>
      <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </p>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--thumb-color, #8b5cf6);
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 8px var(--thumb-color, #8b5cf6);
          transition: transform 0.1s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--thumb-color, #8b5cf6);
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 8px var(--thumb-color, #8b5cf6);
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
function SignalBar({ value, gradient }: { value: number; gradient: string }) {
  const clamped = clamp(value);
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height: 16, background: "var(--color-surface-2)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: gradient,
          transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI METRIC BAR
// ─────────────────────────────────────────────────────────────────────────────
function MiniBar({ value, color }: { value: number; color: string }) {
  const clamped = clamp(value);
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height: 6, background: "var(--color-surface-2)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: color,
          transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CARD
// ─────────────────────────────────────────────────────────────────────────────
interface StageCardProps {
  stage: StageResult;
  config: (typeof STAGE_CONFIG)[0];
  index: number;
}

function StageCard({ stage, config, index }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const clamped = clamp(stage.signalStrength);
  const statusLabel = getStatusLabel(clamped);
  const statusColor = getStatusColor(clamped);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded((x) => !x)}
        style={{ borderLeft: `4px solid ${config.color}` }}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
          style={{ background: `${config.color}20`, color: config.color }}
        >
          {config.icon}
        </div>

        {/* Stage name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {stage.label}
            </span>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${statusColor}22`, color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {stage.description}
          </p>
        </div>

        {/* Score + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className="text-lg font-mono font-bold"
            style={{ color: config.color, fontFamily: "var(--font-mono)" }}
          >
            {Math.round(clamped)}%
          </span>
          <div style={{ color: "var(--color-text-muted)" }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <SignalBar value={clamped} gradient={config.gradient} />
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-4 pb-4 space-y-4"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              {/* Description */}
              <div className="pt-3">
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                  {stage.details}
                </p>
              </div>

              {/* Concept */}
              <div
                className="p-3 rounded-lg"
                style={{ background: `${config.color}0d`, border: `1px solid ${config.color}30` }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: config.color }}>
                  Key Concept
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                  {stage.concept}
                </p>
              </div>

              {/* Sub-metrics */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                  Sub-metrics
                </p>
                <div className="space-y-2.5">
                  {stage.subMetrics.map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>
                          {m.label}
                        </span>
                        <span
                          className="text-[12px] font-mono font-semibold"
                          style={{ color: config.color, fontFamily: "var(--font-mono)" }}
                        >
                          {Math.round(clamp(m.value))}%
                        </span>
                      </div>
                      <MiniBar value={m.value} color={config.color} />
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {m.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features in/out */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                    Features In
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {stage.featuresIn.length === 0 ? (
                      <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>—</span>
                    ) : (
                      stage.featuresIn.map((f) => (
                        <span
                          key={f}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ background: "var(--color-surface-2)", color: "var(--color-text-dim)" }}
                        >
                          {f}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                    Features Out
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {stage.featuresOut.length === 0 ? (
                      <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>—</span>
                    ) : (
                      stage.featuresOut.map((f) => (
                        <span
                          key={f}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{
                            background: `${config.color}18`,
                            color: config.color,
                          }}
                        >
                          {f}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {stage.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {stage.warnings.map((w) => (
                    <div
                      key={w}
                      className="flex items-start gap-2 p-2.5 rounded-lg text-[12px]"
                      style={{ background: "#ef444418", border: "1px solid #ef444430", color: "#f87171" }}
                    >
                      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEURAL PATHWAY CONNECTOR
// ─────────────────────────────────────────────────────────────────────────────
function PathwayConnector({ fromVal, toVal, color }: { fromVal: number; toVal: number; color: string }) {
  const delta = Math.round(clamp(toVal) - clamp(fromVal));
  const sign = delta >= 0 ? "+" : "";
  const isPositive = delta >= 0;
  return (
    <div className="flex items-center justify-center py-1 gap-2">
      <div className="flex-1 h-px" style={{ background: `${color}40` }} />
      <span
        className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{
          background: isPositive ? "#10b98118" : "#ef444418",
          color: isPositive ? "#34d399" : "#f87171",
          border: `1px solid ${isPositive ? "#10b98130" : "#ef444430"}`,
          fontFamily: "var(--font-mono)",
        }}
      >
        {sign}{delta}%
      </span>
      <div className="flex-1 h-px" style={{ background: `${color}40` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR CHART (SVG polygon)
// ─────────────────────────────────────────────────────────────────────────────
function RadarChart({ stages }: { stages: StageResult[] }) {
  const cx = 150;
  const cy = 150;
  const r = 90;
  const labelR = r + 42;
  const n = stages.length;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointStr = stages
    .map((s, i) => {
      const angle = angleFor(i);
      const val = clamp(s.signalStrength) / 100;
      const px = cx + r * val * Math.cos(angle);
      const py = cy + r * val * Math.sin(angle);
      return `${px},${py}`;
    })
    .join(" ");

  const axisPoints = Array.from({ length: n }, (_, i) => {
    const angle = angleFor(i);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: 300 }}>
      {/* Grid rings */}
      {rings.map((ring) => {
        const pts = Array.from({ length: n }, (_, i) => {
          const angle = angleFor(i);
          return `${cx + r * ring * Math.cos(angle)},${cy + r * ring * Math.sin(angle)}`;
        }).join(" ");
        return (
          <polygon
            key={ring}
            points={pts}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
            opacity={0.6}
          />
        );
      })}
      {/* Axis lines */}
      {axisPoints.map((pt, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={pt.x}
          y2={pt.y}
          stroke="var(--color-border)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}
      {/* Data polygon */}
      <polygon
        points={pointStr}
        fill="#8b5cf630"
        stroke="#8b5cf6"
        strokeWidth={2}
        style={{ transition: "all 0.4s ease" }}
      />
      {/* Data points */}
      {stages.map((s, i) => {
        const angle = angleFor(i);
        const val = clamp(s.signalStrength) / 100;
        const cfg = STAGE_CONFIG[i];
        return (
          <circle
            key={i}
            cx={cx + r * val * Math.cos(angle)}
            cy={cy + r * val * Math.sin(angle)}
            r={4}
            fill={cfg.color}
            stroke="#0a0818"
            strokeWidth={1.5}
            style={{ transition: "all 0.4s ease" }}
          />
        );
      })}
      {/* Labels */}
      {stages.map((s, i) => {
        const angle = angleFor(i);
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        const cfg = STAGE_CONFIG[i];
        const anchor =
          Math.abs(lx - cx) < 10 ? "middle" : lx < cx ? "end" : "start";
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 5}
              textAnchor={anchor}
              fontSize={10}
              fill={cfg.color}
              fontWeight={600}
            >
              {cfg.shortLabel}
            </text>
            <text
              x={lx}
              y={ly + 7}
              textAnchor={anchor}
              fontSize={9}
              fill="var(--color-text-muted)"
              fontFamily="var(--font-mono)"
            >
              {Math.round(clamp(s.signalStrength))}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE SURVIVAL GRID
// ─────────────────────────────────────────────────────────────────────────────
function FeatureSurvivalGrid({ stimulus, stages }: { stimulus: Stimulus; stages: StageResult[] }) {
  const allFeatures = stimulus.features;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <div className="px-3 pt-3 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Feature Survival
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th
                className="text-left px-3 py-1.5 font-medium sticky left-0 z-10"
                style={{ color: "var(--color-text-muted)", background: "var(--color-surface)", minWidth: 120 }}
              >
                Feature
              </th>
              {STAGE_CONFIG.map((cfg) => (
                <th
                  key={cfg.id}
                  className="px-1 py-1.5 font-semibold text-center"
                  style={{ color: cfg.color, minWidth: 34 }}
                >
                  {cfg.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFeatures.map((feature) => (
              <tr key={feature} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td
                  className="px-3 py-1.5 font-medium sticky left-0 z-10"
                  style={{ color: "var(--color-text-dim)", background: "var(--color-surface)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {feature}
                </td>
                {stages.map((stage, si) => {
                  const survived = stage.featuresOut.some(
                    (f) => f.toLowerCase().includes(feature.toLowerCase()) || feature.toLowerCase().includes(f.toLowerCase().split(" ")[0])
                  );
                  const inStage = stage.featuresIn.some(
                    (f) => f.toLowerCase().includes(feature.toLowerCase()) || feature.toLowerCase().includes(f.toLowerCase().split(" ")[0])
                  );
                  const cfg = STAGE_CONFIG[si];
                  let bg = "var(--color-surface-2)";
                  let title = "N/A";
                  if (inStage && survived) {
                    bg = `${cfg.color}35`;
                    title = "Survived";
                  } else if (inStage && !survived) {
                    bg = "#ef444428";
                    title = "Lost";
                  }
                  return (
                    <td key={si} className="px-1 py-1.5 text-center">
                      <div
                        className="mx-auto rounded"
                        title={title}
                        style={{
                          width: 20,
                          height: 20,
                          background: bg,
                          border: inStage && survived ? `1px solid ${cfg.color}60` : inStage ? "1px solid #ef444440" : "1px solid transparent",
                          transition: "background 0.3s",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex gap-4 px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "#8b5cf635", border: "1px solid #8b5cf660" }} />
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Survived</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "#ef444428", border: "1px solid #ef444440" }} />
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Lost</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "var(--color-surface-2)" }} />
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>N/A</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAIN HEATMAP SVG
// ─────────────────────────────────────────────────────────────────────────────
function BrainHeatmap({ stages }: { stages: StageResult[] }) {
  // Map stage indices to rough brain regions
  const regionOpacity = (idx: number) => clamp(stages[idx]?.signalStrength ?? 0) / 100;

  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center p-4"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 self-start" style={{ color: "var(--color-text-muted)" }}>
        Brain Activity Map
      </p>
      <svg viewBox="0 0 200 180" style={{ width: "100%", maxWidth: 200 }}>
        {/* Outer brain silhouette */}
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="#1a1735" stroke="#2a2650" strokeWidth={1.5} />
        {/* Cortex fold shapes for regions */}
        {/* Occipital (sensation - amber) */}
        <ellipse cx={100} cy={148} rx={40} ry={22} fill={`rgba(245,158,11,${regionOpacity(0) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Frontal (attention - violet) */}
        <ellipse cx={100} cy={42} rx={50} ry={30} fill={`rgba(139,92,246,${regionOpacity(1) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Temporal (perception - indigo) */}
        <ellipse cx={52} cy={100} rx={30} ry={38} fill={`rgba(99,102,241,${regionOpacity(2) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Hippocampus / medial (encoding - teal) */}
        <ellipse cx={148} cy={100} rx={30} ry={38} fill={`rgba(20,184,166,${regionOpacity(3) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Central (storage - emerald) */}
        <ellipse cx={100} cy={90} rx={28} ry={28} fill={`rgba(16,185,129,${regionOpacity(4) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* PFC (retrieval - cyan) */}
        <ellipse cx={78} cy={55} rx={22} ry={18} fill={`rgba(6,182,212,${regionOpacity(5) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Output (report - blue) */}
        <ellipse cx={122} cy={55} rx={22} ry={18} fill={`rgba(59,130,246,${regionOpacity(6) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        {/* Outline again on top */}
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="none" stroke="#2a2650" strokeWidth={1.5} />
        {/* Brain stem */}
        <rect x={86} y={164} width={28} height={14} rx={6} fill="#1a1735" stroke="#2a2650" strokeWidth={1} />
      </svg>
      {/* Region labels */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full">
        {STAGE_CONFIG.map((cfg, i) => (
          <div key={cfg.id} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: cfg.color, opacity: 0.4 + regionOpacity(i) * 0.6 }}
            />
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {cfg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
function PipelineSummary({ stages }: { stages: StageResult[] }) {
  const inputSignal = Math.round(clamp(stages[0]?.signalStrength ?? 0));
  const outputSignal = Math.round(clamp(stages[stages.length - 1]?.signalStrength ?? 0));
  const avgSignal = Math.round(stages.reduce((acc, s) => acc + clamp(s.signalStrength), 0) / stages.length);
  const signalChange = outputSignal - inputSignal;

  const lastStage = stages[stages.length - 1];
  const distortionCount = lastStage?.warnings?.length ?? 0;

  let summaryText = "";
  if (outputSignal >= 70) {
    summaryText = "Excellent pipeline performance. The signal was well-preserved through all stages, resulting in a high-fidelity memory of the stimulus.";
  } else if (outputSignal >= 45) {
    summaryText = "Moderate pipeline performance. Some signal was lost at key bottlenecks, resulting in a partially complete but workable representation.";
  } else {
    summaryText = "Weak pipeline performance. Significant signal degradation occurred across multiple stages. The final report is likely incomplete or distorted.";
  }

  const scoreColor = outputSignal >= 70 ? "#10b981" : outputSignal >= 45 ? "#f59e0b" : "#ef4444";
  const scoreLabel = outputSignal >= 70 ? "High Fidelity" : outputSignal >= 45 ? "Partial Fidelity" : "Low Fidelity";

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Pipeline Summary
        </h3>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${scoreColor}20`, color: scoreColor }}
        >
          {scoreLabel}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Input Signal", value: `${inputSignal}%`, color: "#f59e0b" },
          { label: "Output Signal", value: `${outputSignal}%`, color: scoreColor },
          { label: "Signal Δ", value: `${signalChange >= 0 ? "+" : ""}${signalChange}%`, color: signalChange >= 0 ? "#10b981" : "#ef4444" },
          { label: "Avg Score", value: `${avgSignal}%`, color: "#8b5cf6" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>
              {stat.label}
            </p>
            <p
              className="text-xl font-mono font-bold"
              style={{ color: stat.color, fontFamily: "var(--font-mono)" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Radar chart + summary text */}
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <RadarChart stages={stages} />
        <div className="space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
            {summaryText}
          </p>
          {distortionCount > 0 && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg text-[12px]"
              style={{ background: "#ef444412", border: "1px solid #ef444425", color: "#fca5a5" }}
            >
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              {distortionCount === 1
                ? "1 notable distortion detected in the final report."
                : `${distortionCount} distortions detected in the final report.`}
            </div>
          )}
          {/* Score pills */}
          <div className="flex flex-wrap gap-2">
            {stages.map((s, i) => {
              const cfg = STAGE_CONFIG[i];
              const v = Math.round(clamp(s.signalStrength));
              return (
                <span
                  key={cfg.id}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono"
                  style={{
                    background: `${cfg.color}20`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}35`,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {cfg.shortLabel} {v}%
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE TAB
// ─────────────────────────────────────────────────────────────────────────────
function PipelineTab() {
  const [selectedStimulus, setSelectedStimulus] = useState<Stimulus>(STIMULI[0]);
  const [params, setParams] = useState<PipelineParams>({ ...DEFAULT_PARAMS });
  const [results, setResults] = useState<StageResult[] | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const handleParam = useCallback(
    (key: keyof PipelineParams, val: number) => {
      setParams((prev) => {
        const next = { ...prev, [key]: val };
        if (hasRun) {
          setResults(runPipeline(selectedStimulus, next));
        }
        return next;
      });
    },
    [hasRun, selectedStimulus]
  );

  const handleStimulusChange = useCallback(
    (s: Stimulus) => {
      setSelectedStimulus(s);
      if (hasRun) {
        setResults(runPipeline(s, params));
      }
    },
    [hasRun, params]
  );

  const handleRun = () => {
    const r = runPipeline(selectedStimulus, params);
    setResults(r);
    setHasRun(true);
  };

  const handleReset = () => {
    setParams({ ...DEFAULT_PARAMS });
    setResults(null);
    setHasRun(false);
  };

  const avgScore = results
    ? Math.round(results.reduce((acc, s) => acc + clamp(s.signalStrength), 0) / results.length)
    : null;

  return (
    <div className="flex flex-col md:flex-row gap-6 px-6 pt-6 pb-8 md:px-10 md:pt-8 md:pb-10 max-w-[1600px] mx-auto">
      {/* ── LEFT SIDEBAR ── */}
      <aside
        className="w-full md:w-[370px] flex-shrink-0 space-y-5 md:max-h-[calc(100vh-80px)] md:overflow-y-auto md:sticky md:top-[56px] no-scrollbar"
        style={{ minWidth: 0 }}
      >
        {/* Stimulus selector */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
            Stimulus
          </p>
          <div className="space-y-2">
            {STIMULI.map((s) => {
              const isSelected = s.id === selectedStimulus.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleStimulusChange(s)}
                  className="w-full text-left rounded-xl p-3 transition-all duration-200"
                  style={{
                    background: isSelected ? "var(--color-surface-2)" : "var(--color-surface)",
                    border: isSelected ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{s.imageEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                          {s.name}
                        </span>
                        <span
                          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: s.modality === "auditory" ? "#06b6d418" : "#8b5cf618",
                            color: s.modality === "auditory" ? "#06b6d4" : "#8b5cf6",
                          }}
                        >
                          {s.modality}
                        </span>
                      </div>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {s.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parameters */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
            Brain Parameters
          </p>
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            {PARAM_META.map((meta) => (
              <ParamSlider
                key={meta.key}
                label={meta.label}
                description={meta.description}
                value={params[meta.key]}
                color={meta.color}
                paramKey={meta.key}
                onChange={handleParam}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 24px #8b5cf640",
            }}
          >
            <Play size={15} />
            {hasRun ? "Re-run Pipeline" : "Run Pipeline"}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 hover:opacity-80 active:scale-[0.95]"
            title="Reset"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-dim)",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {!hasRun && (
          <p className="text-[12px] text-center" style={{ color: "var(--color-text-muted)" }}>
            Adjust parameters then press Run Pipeline to simulate
          </p>
        )}
      </aside>

      {/* ── MAIN RESULTS ── */}
      <main className="flex-1 min-w-0 space-y-5">
        {!results ? (
          <div
            className="rounded-2xl flex flex-col items-center justify-center text-center py-24 px-8"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              minHeight: "400px",
              boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
            }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: "#8b5cf612", border: "1px solid #8b5cf630" }}
            >
              <Brain size={36} color="#8b5cf6" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
              Pipeline not yet run
            </p>
            <p className="text-sm max-w-sm" style={{ color: "var(--color-text-dim)" }}>
              Select a stimulus, adjust the brain parameters, then press "Run Pipeline" to simulate how your brain would process this stimulus.
            </p>
          </div>
        ) : (
          <>
            {/* Output header */}
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }}
              />
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                Pipeline Output
              </h2>
              {avgScore !== null && (
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded-full ml-auto"
                  style={{
                    background: `${getStatusColor(avgScore)}20`,
                    color: getStatusColor(avgScore),
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  avg {avgScore}%
                </span>
              )}
            </div>

            {/* Current stimulus card */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl">{selectedStimulus.imageEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
                      {selectedStimulus.name}
                    </h3>
                    <span
                      className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full"
                      style={{
                        background: selectedStimulus.modality === "auditory" ? "#06b6d418" : "#8b5cf618",
                        color: selectedStimulus.modality === "auditory" ? "#06b6d4" : "#8b5cf6",
                      }}
                    >
                      {selectedStimulus.modality}
                    </span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: "var(--color-text-dim)" }}>
                    {selectedStimulus.sceneDescription}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStimulus.features.map((f) => (
                      <span
                        key={f}
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap + Feature Survival */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BrainHeatmap stages={results} />
              <FeatureSurvivalGrid stimulus={selectedStimulus} stages={results} />
            </div>

            {/* Stage cards + connectors */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
                Cognitive Stages
              </p>
              <div className="space-y-0">
                {results.map((stage, i) => {
                  const cfg = STAGE_CONFIG.find((c) => c.id === stage.stage) ?? STAGE_CONFIG[i];
                  return (
                    <div key={stage.stage}>
                      <StageCard
                        stage={stage}
                        config={cfg}
                        index={i}

                      />
                      {i < results.length - 1 && (
                        <PathwayConnector
                          fromVal={stage.signalStrength}
                          toVal={results[i + 1].signalStrength}
                          color={STAGE_CONFIG[i + 1].color}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <PipelineSummary stages={results} />
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEARN TAB
// ─────────────────────────────────────────────────────────────────────────────
const LEARN_SECTIONS = [
  {
    icon: "◉",
    color: "#f59e0b",
    title: "Sensation",
    subtitle: "The Gateway to Cognition",
    body: "Sensation is the raw, bottom-up detection of physical stimuli through sensory receptors. Your eyes convert light into neural signals; your ears convert sound pressure waves into electrical impulses. This is purely physical — no interpretation yet, just transduction of energy into neural code. The quality of this initial signal sets the ceiling for all downstream processing.",
    concept: "Signal Transduction & Receptor Thresholds",
    refs: ["Weber's Law", "Just Noticeable Differences (JND)", "Absolute Threshold"],
  },
  {
    icon: "◎",
    color: "#8b5cf6",
    title: "Attention",
    subtitle: "The Cognitive Bottleneck",
    body: "Attention is a selective spotlight — we simply cannot process everything at once. Broadbent's Filter Theory (1958) proposed that we filter information based on physical properties before meaning is extracted. Treisman's Attenuation Model refined this, showing that unattended channels are dimmed rather than blocked. High attentional focus means deep processing of fewer features; low focus means shallow processing of many.",
    concept: "Selective vs. Divided Attention",
    refs: ["Broadbent's Filter Theory", "Treisman's Attenuation Model", "Cocktail Party Effect", "Inattentional Blindness"],
  },
  {
    icon: "⬡",
    color: "#6366f1",
    title: "Perception",
    subtitle: "Constructing Reality",
    body: "Perception is active and constructive. It blends bottom-up data (raw sensory features) with top-down processing (prior knowledge, expectations, context). Gestalt principles describe how we organize features into coherent wholes. High prior expectations can lead your brain to fill in ambiguous features — sometimes accurately, sometimes not. This is why two people can see the same event and report entirely different experiences.",
    concept: "Bottom-Up vs. Top-Down Processing",
    refs: ["Gestalt Principles", "Perceptual Set (Allport)", "Gregory's Constructivist Theory", "Gibson's Direct Perception"],
  },
  {
    icon: "▣",
    color: "#14b8a6",
    title: "Encoding",
    subtitle: "Depth of Processing",
    body: "Craik & Lockhart's Levels of Processing theory (1972) showed that the depth at which we process information determines memory durability. Structural encoding (appearance) is shallowest and fades fastest. Phonemic encoding (sound) is intermediate. Semantic encoding (meaning) is deepest and produces the most durable traces. Elaborative rehearsal — connecting new information to existing knowledge — dramatically improves long-term retention.",
    concept: "Levels of Processing (Craik & Lockhart, 1972)",
    refs: ["Semantic vs. Structural Encoding", "Elaborative Rehearsal", "Self-Reference Effect", "Distinctiveness"],
  },
  {
    icon: "⬢",
    color: "#10b981",
    title: "Storage",
    subtitle: "The Multi-Store Model",
    body: "Atkinson & Shiffrin's Multi-Store Model (1968) describes memory as three interconnected stores: Sensory Memory (250ms-2s), Short-Term/Working Memory (15-30s, 7±2 items), and Long-Term Memory (potentially unlimited). Information moves from short-term to long-term through rehearsal and consolidation — a process where the hippocampus plays a central role, gradually transferring memories to the neocortex.",
    concept: "Atkinson-Shiffrin Multi-Store Model (1968)",
    refs: ["Sensory Register", "Working Memory (Baddeley)", "Hippocampal Consolidation", "Decay vs. Interference"],
  },
  {
    icon: "◈",
    color: "#06b6d4",
    title: "Retrieval",
    subtitle: "Accessing the Archive",
    body: "Tulving's Encoding Specificity Principle states that retrieval is most successful when cues at retrieval match cues at encoding — the famous 'context-dependent memory' effect (divers remembering better underwater what they learned underwater). Memory is not like reading a file; it's reconstructive. Every retrieval subtly alters the trace, making it susceptible to post-event misinformation and false memories (Loftus & Palmer).",
    concept: "Encoding Specificity Principle (Tulving, 1983)",
    refs: ["Context-Dependent Memory", "Tip-of-Tongue (TOT) Phenomenon", "Encoding Specificity", "Misinformation Effect"],
  },
  {
    icon: "★",
    color: "#3b82f6",
    title: "Report",
    subtitle: "The Reconstructed Experience",
    body: "The final conscious report — what you 'remember' experiencing — is shaped by every preceding stage. It is not a photographic copy of reality but a reconstruction colored by attention, expectations, encoding depth, and retrieval cues. Confidence and accuracy can diverge dramatically: high confidence in a false memory is one of the most striking phenomena in cognitive psychology, with profound implications for eyewitness testimony.",
    concept: "Memory as Reconstruction (Bartlett, 1932)",
    refs: ["False Memories (Loftus)", "Misinformation Effect", "Confidence-Accuracy Calibration", "Eyewitness Testimony"],
  },
];

function LearnTab() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          How Your Brain Processes Information
        </h2>
        <p className="text-base" style={{ color: "var(--color-text-dim)" }}>
          A guided tour through the seven stages of cognitive processing — from raw sensation to conscious memory.
        </p>
      </div>

      {/* Key concepts highlight */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { label: "Bottom-Up Processing", desc: "Driven by stimulus features — pure sensation flowing upward through the system without prior influence.", color: "#f59e0b" },
          { label: "Top-Down Processing", desc: "Driven by prior knowledge and expectations — your brain predicts what it will perceive before perceiving it.", color: "#6366f1" },
          { label: "Broadbent's Filter Theory", desc: "Attention acts as a single-channel filter that blocks out all but one input stream based on physical characteristics.", color: "#8b5cf6" },
          { label: "Levels of Processing", desc: "Deeper, more meaningful encoding creates stronger, more durable memory traces than shallow structural analysis.", color: "#14b8a6" },
          { label: "Encoding Specificity", desc: "Memory retrieval is best when cues at retrieval match the context present at the time of encoding.", color: "#06b6d4" },
          { label: "Memory as Reconstruction", desc: "We don't replay memories like videos — we rebuild them from fragments, influenced by subsequent experiences.", color: "#3b82f6" },
        ].map((c) => (
          <div
            key={c.label}
            className="p-4 rounded-xl"
            style={{ background: `${c.color}0d`, border: `1px solid ${c.color}28` }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: c.color }}>
              {c.label}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
              {c.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Stage sections */}
      {LEARN_SECTIONS.map((s) => (
        <div
          key={s.title}
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-center gap-4 px-5 py-4"
            style={{ borderLeft: `4px solid ${s.color}` }}
          >
            <span
              className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg font-bold flex-shrink-0"
              style={{ background: `${s.color}20`, color: s.color }}
            >
              {s.icon}
            </span>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                {s.title}
              </h3>
              <p className="text-[12px]" style={{ color: s.color }}>
                {s.subtitle}
              </p>
            </div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <p className="text-sm leading-relaxed pt-2" style={{ color: "var(--color-text-dim)" }}>
              {s.body}
            </p>
            <div
              className="p-3 rounded-lg"
              style={{ background: `${s.color}0d`, border: `1px solid ${s.color}28` }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: s.color }}>
                Core Concept
              </p>
              <p className="text-[12px] font-semibold" style={{ color: "var(--color-text)" }}>
                {s.concept}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Key Terms
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.refs.map((r) => (
                  <span
                    key={r}
                    className="text-[11px] px-2.5 py-1 rounded-full"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT TAB
// ─────────────────────────────────────────────────────────────────────────────
function AboutTab() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)" }}>
          About Build-A-Brain
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
          An interactive educational simulator designed to make cognitive psychology tangible. Built for PSYC 203 students who want to understand not just <em>what</em> happens in cognition, but <em>why</em> and <em>how</em> each stage shapes the final experience.
        </p>
      </div>

      {[
        {
          title: "The Mission",
          color: "#8b5cf6",
          body: "Textbooks describe cognitive stages in sequence — sensation, attention, perception, encoding, storage, retrieval, report — but the feedback loops and parameter interactions only become clear when you can actually manipulate them. Build-A-Brain lets you do exactly that.",
        },
        {
          title: "The Simulation Engine",
          color: "#06b6d4",
          body: "The pipeline engine models each cognitive stage as a signal-transformation function. Parameters like Attentional Focus, Perceptual Noise, and Prior Expectations are continuous knobs that modulate signal strength, feature survival, and distortion patterns at each stage. The output is a deterministic function of your parameters — same inputs always produce the same outputs, making it ideal for demonstrating cause and effect.",
        },
        {
          title: "Methodology",
          color: "#14b8a6",
          body: "The simulation draws on Broadbent's Filter Theory (attention as bottleneck), Craik & Lockhart's Levels of Processing (encoding depth), Tulving's Encoding Specificity Principle (retrieval cues), and Atkinson & Shiffrin's Multi-Store Model. It's a simplified model intended to build intuition, not replace careful empirical work.",
        },
        {
          title: "How to Use It",
          color: "#f59e0b",
          body: "1. Select a stimulus (Ambiguous Face, Street Scene, or Muffled Conversation). 2. Set your brain parameters — try extreme values first to see the effects. 3. Press 'Run Pipeline'. 4. Explore each stage card by clicking to expand details. 5. After the first run, slider changes update results in real time.",
        },
      ].map((section) => (
        <div
          key={section.title}
          className="rounded-xl p-5"
          style={{ background: "var(--color-surface)", border: `1px solid ${section.color}30`, borderLeft: `4px solid ${section.color}` }}
        >
          <h3 className="text-sm font-bold mb-2" style={{ color: section.color }}>
            {section.title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
            {section.body}
          </p>
        </div>
      ))}

      {/* Theories reference */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--color-text)" }}>
          Theoretical Foundations
        </h3>
        <div className="space-y-2">
          {[
            ["Broadbent (1958)", "Filter Theory of Attention — the first information-processing model of selective attention"],
            ["Treisman (1964)", "Attenuation Model — unattended information is weakened, not blocked"],
            ["Craik & Lockhart (1972)", "Levels of Processing — depth of encoding predicts memory durability"],
            ["Atkinson & Shiffrin (1968)", "Multi-Store Model — sensory, short-term, and long-term memory stores"],
            ["Tulving (1983)", "Encoding Specificity Principle — context-dependent memory retrieval"],
            ["Baddeley & Hitch (1974)", "Working Memory Model — the active workspace of cognition"],
            ["Loftus & Palmer (1974)", "Misinformation Effect — post-event information alters memory traces"],
          ].map(([author, desc]) => (
            <div key={author} className="flex gap-3 text-sm">
              <span className="font-mono font-semibold flex-shrink-0 text-[12px]" style={{ color: "#8b5cf6", minWidth: 140, fontFamily: "var(--font-mono)" }}>
                {author}
              </span>
              <span style={{ color: "var(--color-text-dim)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub placeholder */}
      <div
        className="rounded-xl p-5 flex items-center gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-text-muted)" }} className="flex-shrink-0"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
        <div>
          <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--color-text)" }}>
            Source Code
          </p>
          <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            github.com/psyc203/build-a-brain — open source educational project
          </p>
        </div>
      </div>

      <p className="text-[11px] text-center pb-4" style={{ color: "var(--color-text-muted)" }}>
        Built for PSYC 203 · Cognitive Psychology · Interactive Simulator v2.0
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY NAV BAR
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "pipeline" | "learn" | "about";

interface NavBarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}

function NavBar({ activeTab, onTabChange }: NavBarProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "pipeline", label: "Pipeline", icon: <Zap size={14} /> },
    { id: "learn", label: "Learn", icon: <BookOpen size={14} /> },
    { id: "about", label: "About", icon: <Info size={14} /> },
  ];

  return (
    <div
      className="sticky top-0 z-40 flex items-center px-6 py-3.5 md:px-10 gap-4"
      style={{
        background: "rgba(10,8,24,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Brain size={20} color="#8b5cf6" strokeWidth={1.5} />
        <span className="text-sm font-bold hidden sm:block" style={{ color: "var(--color-text)" }}>
          Build-A-<span style={{ color: "#8b5cf6" }}>Brain</span>
        </span>
      </div>

      {/* Tab pills */}
      <div
        className="flex items-center gap-1 mx-auto rounded-full p-1"
        style={{ background: "var(--color-surface)" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              style={{
                background: isActive ? "#8b5cf6" : "transparent",
                color: isActive ? "#fff" : "var(--color-text-muted)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Badge */}
      <div
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
      >
        PSYC 203
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const scrollToSimulator = () => {
    document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #2a0a4e 0%, #150d30 35%, #0a0818 70%)",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 55%, #8b5cf614 0%, transparent 70%)",
        }}
      />

      {/* PSYC 203 badge */}
      <div
        className="relative z-10 mb-6 text-[12px] font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full"
        style={{ border: "1px solid #8b5cf640", color: "#a78bfa", background: "#8b5cf610" }}
      >
        PSYC 203
      </div>

      {/* 3D Brain */}
      <div className="relative z-10 w-full max-w-sm h-64 sm:h-80 md:h-96 mb-4">
        <Suspense fallback={<BrainFallback />}>
          <BrainScene />
        </Suspense>
      </div>

      {/* Title */}
      <div className="relative z-10 text-center px-4">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight mb-3">
          Build-A-<span style={{ color: "#8b5cf6" }}>Brain</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl mb-8" style={{ color: "var(--color-text-dim)" }}>
          Cognitive Pipeline Simulator
        </p>

        {/* CTA */}
        <button
          onClick={scrollToSimulator}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 32px #8b5cf640",
          }}
        >
          Explore the Pipeline
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Hint */}
      <p
        className="absolute bottom-8 text-[11px] uppercase tracking-[0.18em] z-10"
        style={{ color: "var(--color-text-muted)" }}
      >
        Move your cursor to rotate the brain
      </p>

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-10"
        style={{ background: "linear-gradient(to bottom, transparent, #0a0818)" }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATOR SECTION
// ─────────────────────────────────────────────────────────────────────────────
function SimulatorSection() {
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");

  return (
    <section id="simulator" style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "pipeline" && <PipelineTab />}
          {activeTab === "learn" && <LearnTab />}
          {activeTab === "about" && <AboutTab />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <HeroSection />
      <SimulatorSection />
    </div>
  );
}
