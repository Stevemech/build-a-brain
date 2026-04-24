import { lazy, Suspense, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Brain,
  RotateCcw,
  Play,
  AlertTriangle,
  GitCompare,
  Lightbulb,
  Quote,
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
  { id: "attention",  color: "#7C3AED", gradient: "linear-gradient(to right, #7C3AED, #8B5CF6)", label: "Attention",  icon: "◎", shortLabel: "ATT" },
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

// Endpoint labels on each slider are parsed from `description` using the
// literal pattern "Low = X, High = Y". LEFT label = what follows the first
// "=", RIGHT label = what follows the second. Keep this order so the labels
// align with 0→100 on the track.
const PARAM_META = [
  {
    key: "attentionalFocus" as keyof PipelineParams,
    label: "Attentional Focus",
    description: "Low = diffuse attention, High = selective focus",
    color: "#7C3AED",
  },
  {
    key: "perceptualNoise" as keyof PipelineParams,
    label: "Perceptual Noise",
    description: "Low = clear signal, High = degraded signal",
    color: "#ef4444",
  },
  {
    key: "priorExpectation" as keyof PipelineParams,
    label: "Prior Expectations",
    description: "Low = data-driven, High = expectation-driven",
    color: "#6366f1",
  },
  {
    key: "encodingStrength" as keyof PipelineParams,
    label: "Encoding Strength",
    description: "Low = shallow encoding, High = deep encoding",
    color: "#14b8a6",
  },
  {
    key: "retrievalCue" as keyof PipelineParams,
    label: "Retrieval Cue",
    description: "Low = weak cue match, High = strong cue match",
    color: "#06b6d4",
  },
];

// ─── Real-world examples per stage ───────────────────────────────────────────
const STAGE_EXAMPLES: Record<string, string> = {
  sensation: "Driving in heavy fog — your headlights barely cut through. The raw visual signal is severely degraded before your brain even begins to interpret it.",
  attention: "The cocktail party effect — in a noisy room, you hear your name mentioned across the room because attention automatically shifts to personally relevant stimuli.",
  perception: "Eyewitness testimony — two witnesses to the same car accident report different colors for the car because their expectations and viewing angles shaped perception differently.",
  encoding: "Studying for an exam — simply re-reading notes (shallow/structural) produces weaker memories than explaining concepts in your own words (deep/semantic).",
  storage: "Childhood memories — some vivid memories from age 5 persist for decades (strong consolidation), while you can't remember what you had for lunch last Tuesday (weak trace).",
  retrieval: "Walking into a room and forgetting why — the context change eliminated the retrieval cues. Walking back to the original room often restores the memory.",
  report: "The Mandela Effect — large groups of people confidently 'remember' events that never happened (like Nelson Mandela dying in prison in the 1980s), demonstrating the gap between confidence and accuracy.",
};

// ─── Presets ──────────────────────────────────────────────────────────────────
interface Preset {
  id: string;
  emoji: string;
  name: string;
  description: string;
  params: PipelineParams;
  variantB?: PipelineParams;
  variantBLabel?: string;
  variantALabel?: string;
}

const PRESETS: Preset[] = [
  {
    id: "noisy-room",
    emoji: "🔊",
    name: "The Noisy Room",
    description: "High perceptual noise degrades the incoming signal, illustrating signal-detection theory: the brain must separate meaningful information from environmental interference.",
    params: { perceptualNoise: 85, attentionalFocus: 50, priorExpectation: 40, encodingStrength: 30, retrievalCue: 35 },
  },
  {
    id: "biased-observer",
    emoji: "🕶️",
    name: "The Biased Observer",
    description: "Strong prior expectations dominate perception, demonstrating top-down processing. Useful for understanding how preconceptions shape interpretation and produce reconstructive memory errors.",
    params: { perceptualNoise: 15, attentionalFocus: 80, priorExpectation: 90, encodingStrength: 60, retrievalCue: 55 },
  },
  {
    id: "inattentional-blindness",
    emoji: "👁️",
    name: "Inattentional Blindness",
    description: "Attention is minimal, so salient but unattended stimuli fail to reach awareness. Reproduces the Simons & Chabris (1999) gorilla paradigm.",
    params: { perceptualNoise: 20, attentionalFocus: 15, priorExpectation: 25, encodingStrength: 50, retrievalCue: 50 },
  },
  {
    id: "deep-vs-shallow",
    emoji: "📚",
    name: "Deep vs. Shallow",
    description: "Side-by-side comparison of deep (semantic) vs. shallow (structural) encoding, illustrating Craik & Lockhart's levels-of-processing framework and its effect on long-term retention.",
    params: { perceptualNoise: 20, attentionalFocus: 65, priorExpectation: 40, encodingStrength: 90, retrievalCue: 60 },
    variantB: { perceptualNoise: 20, attentionalFocus: 65, priorExpectation: 40, encodingStrength: 15, retrievalCue: 60 },
    variantALabel: "Deep (enc=90)",
    variantBLabel: "Shallow (enc=15)",
  },
  {
    id: "tip-of-tongue",
    emoji: "💭",
    name: "Tip of the Tongue",
    description: "Memory is encoded strongly but retrieval cues are poorly matched, producing recall failure despite high metacognitive confidence. Demonstrates Tulving's encoding specificity principle.",
    params: { perceptualNoise: 15, attentionalFocus: 75, priorExpectation: 45, encodingStrength: 85, retrievalCue: 15 },
  },
];

// ─── Glossary ─────────────────────────────────────────────────────────────────
const GLOSSARY: Record<string, string> = {
  "Bottom-up processing": "Processing driven purely by incoming stimulus data, starting from sensory receptors and moving 'up' to the brain",
  "Top-down processing": "Processing influenced by prior knowledge, expectations, and context — the brain 'predicts' what it will perceive",
  "Broadbent's Filter Theory": "Attention acts as a single-channel filter that completely blocks unattended information based on physical features",
  "Treisman's Attenuation Model": "Unattended information is weakened (attenuated) rather than completely blocked",
  "Inattentional blindness": "Failure to perceive an unexpected stimulus in plain sight when attention is engaged elsewhere",
  "Gestalt principles": "Rules of perceptual organization (proximity, similarity, closure, continuity) that explain how we group features",
  "Levels of processing": "Theory that deeper, more meaningful encoding produces stronger memories",
  "Multi-store model": "Atkinson & Shiffrin's model of three memory stores: sensory, short-term, and long-term",
  "Encoding specificity": "Memory retrieval is most successful when cues at retrieval match those at encoding",
  "Reconstructive memory": "Memory is not a recording but a reconstruction, subject to distortion and confabulation",
  "Signal detection theory": "Framework for understanding how we detect signals against background noise, involving hits, misses, false alarms, and correct rejections",
  "Misinformation effect": "Post-event information can alter or distort a person's memory of the original event",
  "Cocktail party effect": "Ability to focus on one conversation while filtering out background noise, yet still detecting personally relevant info",
  "False memory": "A memory of an event that did not actually occur, often created by suggestion or expectation",
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOSSARY TOOLTIP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function GlossaryTerm({ term, children }: { term: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const definition = GLOSSARY[term] ?? GLOSSARY[Object.keys(GLOSSARY).find(k => k.toLowerCase() === term.toLowerCase()) ?? ""];
  if (!definition) return <>{children}</>;

  return (
    <span
      className="relative inline"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span
        style={{
          borderBottom: "1px dashed #7C3AED80",
          color: "#8B5CF6",
          cursor: "help",
        }}
      >
        {children}
      </span>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 bottom-full mb-2 w-64 rounded-lg p-3 text-[12px] leading-relaxed pointer-events-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid #7C3AED50",
              color: "var(--color-text-dim)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #7C3AED20",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#7C3AED" }}>
              {term}
            </p>
            {definition}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

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
            background: "transparent",
            animationDuration: "1.8s",
          }}
        />
        <div
          className="absolute rounded-full opacity-30"
          style={{
            width: 160,
            height: 160,
            background: "transparent",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <Brain size={72} color="#8B5CF6" strokeWidth={1.5} />
      </div>
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
// ANIMATED PATHWAY CONNECTOR (flowing dots)
// ─────────────────────────────────────────────────────────────────────────────
function PathwayConnector({ fromVal, toVal, color }: { fromVal: number; toVal: number; color: string }) {
  const delta = Math.round(clamp(toVal) - clamp(fromVal));
  const sign = delta >= 0 ? "+" : "";
  const isPositive = delta >= 0;
  const strength = clamp(toVal) / 100;
  // Speed inversely proportional to signal — stronger = faster
  const speedSecs = 2.4 - strength * 1.4; // range ~1s to 2.4s
  const dotOpacity = 0.3 + strength * 0.6;

  const dots = [0, 1, 2, 3, 4];

  return (
    <div className="flex items-center justify-center py-0 gap-2" style={{ height: 36, position: "relative" }}>
      {/* Center animated dots column */}
      <div className="flex-1 flex items-center justify-center relative" style={{ height: 36 }}>
        {/* Side lines */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center gap-2">
          <div className="flex-1 h-px" style={{ background: `${color}40` }} />
          <span
            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full z-10 relative"
            style={{
              background: isPositive ? "#d1fae5" : "#ede9fe",
              color: isPositive ? "#34d399" : "#8B5CF6",
              border: `1px solid ${isPositive ? "#10b98125" : "#8B5CF625"}`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {sign}{delta}%
          </span>
          <div className="flex-1 h-px" style={{ background: `${color}40` }} />
        </div>

        {/* Flowing dots */}
        <div
          className="absolute flex gap-3 items-start justify-center"
          style={{ height: 36, width: 80, overflow: "hidden" }}
        >
          {dots.map((d) => (
            <div
              key={d}
              className="flow-dot rounded-full flex-shrink-0"
              style={{
                width: 4,
                height: 4,
                background: color,
                boxShadow: `0 0 6px ${color}`,
                opacity: dotOpacity,
                "--speed": `${speedSecs}s`,
                "--dot-delay": `${d * (speedSecs / dots.length)}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL WAVEFORM VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────
function SignalWaveform({ stages }: { stages: StageResult[] }) {
  const width = 600;
  const height = 90;
  const mid = height / 2;

  // Build the waveform path across all stages
  const buildPath = (): string => {
    const points: { x: number; y: number }[] = [];
    const totalPoints = 140;

    for (let i = 0; i <= totalPoints; i++) {
      const t = i / totalPoints;
      // Which stage are we in?
      const stageIdx = Math.min(Math.floor(t * stages.length), stages.length - 1);
      const stage = stages[stageIdx];
      const signal = clamp(stage.signalStrength) / 100;

      // Base sine wave
      const baseFreq = 6;
      // Noise-derived jaggedness from sensation → the first stage
      const sensationNoise = 1 - (clamp(stages[0].signalStrength) / 100);
      const noiseAmp = sensationNoise * 8;

      // Attention = gaps (reduce signal in low-attn stages)
      const attentionFactor = stageIdx === 1 ? signal : 1;

      // Amplitude scales with signal strength
      const amplitude = signal * 28 * attentionFactor;

      // Sine oscillation
      const sine = Math.sin(t * Math.PI * 2 * baseFreq);
      // Noise jitter (pseudo-random based on i)
      const jitter = Math.sin(i * 7.3) * noiseAmp * (1 - signal);

      const y = mid - (sine * amplitude + jitter);
      const x = (i / totalPoints) * width;
      points.push({ x, y });
    }

    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  };

  const pathD = buildPath();

  // Build gradient stops per stage
  const gradientId = "waveform-gradient";

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 280, height: 90 }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {STAGE_CONFIG.map((cfg, i) => (
                <stop
                  key={cfg.id}
                  offset={`${(i / (STAGE_CONFIG.length - 1)) * 100}%`}
                  stopColor={cfg.color}
                />
              ))}
            </linearGradient>
          </defs>

          {/* Stage dividers */}
          {STAGE_CONFIG.map((cfg, i) => {
            const x = (i / STAGE_CONFIG.length) * width;
            return (
              <g key={cfg.id}>
                {i > 0 && (
                  <line x1={x} y1={0} x2={x} y2={height} stroke={cfg.color} strokeOpacity={0.15} strokeWidth={1} strokeDasharray="3,3" />
                )}
                <text
                  x={x + (width / STAGE_CONFIG.length) / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize={8}
                  fill={cfg.color}
                  opacity={0.7}
                >
                  {cfg.shortLabel}
                </text>
              </g>
            );
          })}

          {/* Centerline */}
          <line x1={0} y1={mid} x2={width} y2={mid} stroke="var(--color-border)" strokeWidth={1} opacity={0.4} />

          {/* Waveform */}
          <motion.path
            d={pathD}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />

          {/* Signal strength dots at each stage boundary */}
          {stages.map((s, i) => {
            const x = ((i + 0.5) / stages.length) * width;
            const signal = clamp(s.signalStrength) / 100;
            const r = 3 + signal * 2;
            const cfg = STAGE_CONFIG[i];
            return (
              <circle
                key={i}
                cx={x}
                cy={mid - signal * 24}
                r={r}
                fill={cfg.color}
                opacity={0.85}
                style={{ transition: "all 0.4s ease" }}
              />
            );
          })}

          {/* Peak/Trough annotations */}
          {(() => {
            const sortedBySignal = [...stages].map((s, i) => ({ s, i })).sort((a, b) => b.s.signalStrength - a.s.signalStrength);
            const peakEntry = sortedBySignal[0];
            const troughEntry = sortedBySignal[sortedBySignal.length - 1];
            const peakX = ((peakEntry.i + 0.5) / stages.length) * width;
            const peakSignal = clamp(peakEntry.s.signalStrength) / 100;
            const troughX = ((troughEntry.i + 0.5) / stages.length) * width;
            const troughSignal = clamp(troughEntry.s.signalStrength) / 100;
            const peakCfg = STAGE_CONFIG[peakEntry.i];
            const troughCfg = STAGE_CONFIG[troughEntry.i];

            return (
              <g>
                {/* Peak label */}
                <rect
                  x={Math.min(peakX - 30, width - 70)}
                  y={mid - peakSignal * 24 - 20}
                  width={68}
                  height={14}
                  rx={4}
                  fill={`${peakCfg.color}22`}
                  stroke={peakCfg.color}
                  strokeOpacity={0.4}
                  strokeWidth={0.5}
                />
                <text
                  x={Math.min(peakX - 30, width - 70) + 4}
                  y={mid - peakSignal * 24 - 10}
                  fontSize={7.5}
                  fill={peakCfg.color}
                  fontWeight={600}
                >
                  Peak {Math.round(clamp(peakEntry.s.signalStrength))}% ({peakCfg.shortLabel})
                </text>

                {/* Trough label */}
                <rect
                  x={Math.min(troughX - 36, width - 78)}
                  y={mid - troughSignal * 24 + 6}
                  width={74}
                  height={14}
                  rx={4}
                  fill={`${troughCfg.color}22`}
                  stroke={troughCfg.color}
                  strokeOpacity={0.4}
                  strokeWidth={0.5}
                />
                <text
                  x={Math.min(troughX - 36, width - 78) + 4}
                  y={mid - troughSignal * 24 + 16}
                  fontSize={7.5}
                  fill={troughCfg.color}
                  fontWeight={600}
                >
                  Trough {Math.round(clamp(troughEntry.s.signalStrength))}% ({troughCfg.shortLabel})
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE PARAMETER DRIVERS
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_DRIVERS = {
  sensation:  "Perceptual Noise (primary) — higher noise degrades the raw sensory signal before any interpretation",
  attention:  "Attentional Focus (primary) — controls the width of the cognitive spotlight and how many features are gated through",
  perception: "Prior Expectations (primary), Sensation signal (secondary) — top-down predictions blend with incoming feature data",
  encoding:   "Encoding Strength (primary), Perception quality (secondary) — determines depth from shallow structural to deep semantic",
  storage:    "Encoding quality (primary), Perceptual Noise (secondary) — a weak trace will crumble regardless of storage capacity",
  retrieval:  "Retrieval Cue (primary), Storage quality (secondary) — the cue unlocks access; without it, even good traces stay hidden",
  report:     "All preceding stages (cumulative) — every distortion compounds here; confidence and fidelity can diverge dramatically",
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CARD (with real-world examples)
// ─────────────────────────────────────────────────────────────────────────────
interface StageCardProps {
  stage: StageResult;
  config: (typeof STAGE_CONFIG)[0];
  index: number;
  // Comparison mode
  comparisonStage?: StageResult;
  isComparisonMode?: boolean;
}

function StageCard({ stage, config, index, comparisonStage, isComparisonMode }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const clamped = clamp(stage.signalStrength);
  const statusLabel = getStatusLabel(clamped);
  const statusColor = getStatusColor(clamped);

  const compClamped = comparisonStage ? clamp(comparisonStage.signalStrength) : null;
  const delta = compClamped !== null ? Math.round(compClamped - clamped) : null;

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

        {/* Score + comparison + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className="text-lg font-bold"
            style={{ color: config.color, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            {Math.round(clamped)}%
          </span>
          {isComparisonMode && compClamped !== null && delta !== null && (
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: "#60a5fa18",
                  color: "#60a5fa",
                  fontFamily: "var(--font-mono)",
                }}
              >
                B:{Math.round(compClamped)}%
              </span>
              <span
                className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: delta >= 0 ? "#10b98118" : "#ef444418",
                  color: delta >= 0 ? "#34d399" : "#f87171",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {delta >= 0 ? "+" : ""}{delta}%
              </span>
            </div>
          )}
          <div style={{ color: "var(--color-text-muted)" }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="px-4 pb-2 space-y-1.5">
        <SignalBar value={clamped} gradient={config.gradient} />
        {isComparisonMode && compClamped !== null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold" style={{ color: "#60a5fa", minWidth: 14 }}>B</span>
            <div className="flex-1">
              <SignalBar
                value={compClamped}
                gradient="linear-gradient(to right, #60a5fa, #93c5fd)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Signal strength indicator */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <div
          className={clamped >= 70 ? "pulse-strong" : clamped >= 40 ? "pulse-moderate" : "pulse-weak"}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: clamped >= 70 ? "#10b981" : clamped >= 40 ? "#8B5CF6" : "#f59e0b",
            color: clamped >= 70 ? "#10b981" : clamped >= 40 ? "#8B5CF6" : "#f59e0b",
            flexShrink: 0,
          }}
        />
        <span className="text-[11px]" style={{ color: clamped >= 70 ? "#10b981" : clamped >= 40 ? "#8B5CF6" : "#f59e0b" }}>
          {clamped >= 70 ? "Clear signal" : clamped >= 40 ? "Moderate signal" : "Faint signal"}
        </span>
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
              {/* Parameter Impact — What Drives This Stage */}
              <div
                className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
                style={{ background: `${config.color}0a`, border: `1px solid ${config.color}20` }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 mt-0.5" style={{ color: config.color }}>Driven by</span>
                <p className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>
                  {STAGE_DRIVERS[stage.stage as keyof typeof STAGE_DRIVERS] ?? "All pipeline parameters"}
                </p>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                  {stage.details}
                </p>
              </div>

              {/* Real-world example */}
              {STAGE_EXAMPLES[stage.stage] && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: `${config.color}0a`, border: `1px solid ${config.color}25` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: config.color }}>
                    Real-World Example
                  </p>
                  <p className="text-[12px] leading-relaxed italic" style={{ color: "var(--color-text-dim)" }}>
                    {STAGE_EXAMPLES[stage.stage]}
                  </p>
                </div>
              )}

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
                          style={{ background: "var(--color-surface)", color: "var(--color-text-dim)" }}
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
                      style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c" }}
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
// RADAR CHART (SVG polygon)
// ─────────────────────────────────────────────────────────────────────────────
function RadarChart({ stages, stagesB }: { stages: StageResult[]; stagesB?: StageResult[] }) {
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

  const pointStrB = stagesB
    ? stagesB
        .map((s, i) => {
          const angle = angleFor(i);
          const val = clamp(s.signalStrength) / 100;
          const px = cx + r * val * Math.cos(angle);
          const py = cy + r * val * Math.sin(angle);
          return `${px},${py}`;
        })
        .join(" ")
    : null;

  const axisPoints = Array.from({ length: n }, (_, i) => {
    const angle = angleFor(i);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

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
      {/* Set B polygon (if comparison mode) */}
      {pointStrB && (
        <polygon
          points={pointStrB}
          fill="#60a5fa20"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4,2"
          style={{ transition: "all 0.4s ease" }}
        />
      )}
      {/* Set A (main) data polygon */}
      <polygon
        points={pointStr}
        fill="#7C3AED30"
        stroke="#7C3AED"
        strokeWidth={2}
        style={{ transition: "all 0.4s ease" }}
      />
      {/* Set A data points */}
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
            stroke="#FFFFFF"
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
              fontFamily="var(--font-display)"
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
    <div className="overflow-hidden">
      <p className="text-[11px] font-medium mb-2" style={{ color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
        Feature survival
      </p>
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
          <div className="w-3 h-3 rounded-sm" style={{ background: "#7C3AED35", border: "1px solid #7C3AED60" }} />
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
  const regionOpacity = (idx: number) => clamp(stages[idx]?.signalStrength ?? 0) / 100;

  return (
    <div className="flex flex-col items-center justify-center">
      <p className="text-[11px] font-medium mb-3 self-start" style={{ color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
        Brain activity
      </p>
      <svg viewBox="0 0 200 180" style={{ width: "100%", maxWidth: 200 }}>
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="#F4F5F7" stroke="#E4E7EC" strokeWidth={1.5} />
        <ellipse cx={100} cy={148} rx={40} ry={22} fill={`rgba(245,158,11,${regionOpacity(0) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={42} rx={50} ry={30} fill={`rgba(139,92,246,${regionOpacity(1) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={52} cy={100} rx={30} ry={38} fill={`rgba(99,102,241,${regionOpacity(2) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={148} cy={100} rx={30} ry={38} fill={`rgba(20,184,166,${regionOpacity(3) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={90} rx={28} ry={28} fill={`rgba(16,185,129,${regionOpacity(4) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={78} cy={55} rx={22} ry={18} fill={`rgba(6,182,212,${regionOpacity(5) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={122} cy={55} rx={22} ry={18} fill={`rgba(59,130,246,${regionOpacity(6) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="none" stroke="#E4E7EC" strokeWidth={1.5} />
        <rect x={86} y={164} width={28} height={14} rx={6} fill="#F4F5F7" stroke="#E4E7EC" strokeWidth={1} />
      </svg>
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
function PipelineSummary({ stages, stagesB }: { stages: StageResult[]; stagesB?: StageResult[] }) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase" style={{ color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
          Fidelity score
        </span>
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
          { label: "Avg Score", value: `${avgSignal}%`, color: "#7C3AED" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-3 text-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>
              {stat.label}
            </p>
            <p
              className="text-xl font-bold"
              style={{ color: stat.color, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Confidence vs Accuracy Gauge */}
      {(() => {
        const reportStage = stages.find(s => s.stage === "report");
        const confidenceSub = reportStage?.subMetrics?.find(m => m.label.toLowerCase().includes("confidence"));
        const fidelitySub = reportStage?.subMetrics?.find(m => m.label.toLowerCase().includes("fidelity") || m.label.toLowerCase().includes("accuracy"));
        const confidence = Math.round(clamp(confidenceSub?.value ?? outputSignal));
        const fidelity = Math.round(clamp(fidelitySub?.value ?? outputSignal * 0.85));
        const diff = confidence - fidelity;
        const calibrationLabel = diff > 15 ? "⚠ False Memory Risk" : diff < -10 ? "Underconfident — memory is better than perceived" : "✓ Well-Calibrated";
        const calibrationColor = diff > 15 ? "#ef4444" : diff < -10 ? "#06b6d4" : "#10b981";

        // SVG arc helper
        const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
          const toRad = (d: number) => (d - 90) * Math.PI / 180;
          const x1 = cx + r * Math.cos(toRad(startDeg));
          const y1 = cy + r * Math.sin(toRad(startDeg));
          const x2 = cx + r * Math.cos(toRad(endDeg));
          const y2 = cy + r * Math.sin(toRad(endDeg));
          const large = endDeg - startDeg > 180 ? 1 : 0;
          return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
        };

        const confAngle = (confidence / 100) * 270; // 0-270 degree sweep
        const fidelAngle = (fidelity / 100) * 270;

        return (
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
              Confidence vs. Accuracy
            </p>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
                  {/* Background tracks */}
                  <path d={arcPath(60, 60, 46, -45, 225)} fill="none" stroke="#E4E7EC22" strokeWidth={8} strokeLinecap="round" />
                  <path d={arcPath(60, 60, 32, -45, 225)} fill="none" stroke="#E4E7EC22" strokeWidth={8} strokeLinecap="round" />
                  {/* Fidelity arc (inner) */}
                  {fidelAngle > 0 && (
                    <motion.path
                      d={arcPath(60, 60, 32, -45, -45 + fidelAngle)}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={8}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  )}
                  {/* Confidence arc (outer) */}
                  {confAngle > 0 && (
                    <motion.path
                      d={arcPath(60, 60, 46, -45, -45 + confAngle)}
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth={8}
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1 }}
                    />
                  )}
                  {/* Center text */}
                  <text x="60" y="56" textAnchor="middle" fontSize={14} fontWeight={700} fill="#e8e4f0">{confidence}%</text>
                  <text x="60" y="70" textAnchor="middle" fontSize={8} fill="#8b8aaa">conf.</text>
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "#7C3AED" }} />
                  <span className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>Confidence: <strong style={{ color: "#7C3AED" }}>{confidence}%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "#10b981" }} />
                  <span className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>Fidelity: <strong style={{ color: "#10b981" }}>{fidelity}%</strong></span>
                </div>
                <div
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg mt-2"
                  style={{ background: `${calibrationColor}15`, color: calibrationColor, border: `1px solid ${calibrationColor}30` }}
                >
                  {calibrationLabel}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Radar chart + summary text */}
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <RadarChart stages={stages} stagesB={stagesB} />
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
// PRESETS PANEL
// ─────────────────────────────────────────────────────────────────────────────
interface PresetsPanelProps {
  onApply: (preset: Preset) => void;
}

function PresetsPanel({ onApply }: PresetsPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeVariants, setActiveVariants] = useState<Record<string, "A" | "B">>({});

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ background: "#7C3AED", border: "none", color: "#fff", borderRadius: open ? "12px 12px 0 0" : 12 }}
        onClick={() => setOpen((o) => !o)}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#fff" }}>
          ⚡ Quick Experiments
        </p>
        <div style={{ color: "rgba(255,255,255,0.8)" }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-3 pb-3 space-y-2"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              {PRESETS.map((preset) => {
                const variant = activeVariants[preset.id] ?? "A";
                // When the user clicks "Apply & Run" on a specific variant, pass a
                // preset whose base params are that variant so `handleApplyPreset`
                // applies the right knob values.
                const presetForApply: Preset = variant === "B" && preset.variantB
                  ? { ...preset, params: preset.variantB }
                  : preset;

                return (
                  <div
                    key={preset.id}
                    className="rounded-lg p-3"
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {/* Toggle row for Deep vs Shallow */}
                    {preset.variantB && (
                      <div className="flex gap-1 mb-2">
                        <button
                          onClick={() => setActiveVariants((v) => ({ ...v, [preset.id]: "A" }))}
                          className="flex-1 py-0.5 rounded text-[10px] font-semibold transition-all"
                          style={{
                            background: variant === "A" ? "#7C3AED" : "transparent",
                            color: variant === "A" ? "#fff" : "var(--color-text-muted)",
                            border: variant === "A" ? "none" : "1px solid var(--color-border)",
                            cursor: "pointer",
                          }}
                        >
                          {preset.variantALabel}
                        </button>
                        <button
                          onClick={() => setActiveVariants((v) => ({ ...v, [preset.id]: "B" }))}
                          className="flex-1 py-0.5 rounded text-[10px] font-semibold transition-all"
                          style={{
                            background: variant === "B" ? "#7C3AED" : "transparent",
                            color: variant === "B" ? "#fff" : "var(--color-text-muted)",
                            border: variant === "B" ? "none" : "1px solid var(--color-border)",
                            cursor: "pointer",
                          }}
                        >
                          {preset.variantBLabel}
                        </button>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0 mt-0.5">{preset.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold mb-0.5" style={{ color: "var(--color-text)" }}>
                          {preset.name}
                        </p>
                        <p className="text-[11px] mb-2" style={{ color: "var(--color-text-muted)" }}>
                          {preset.description}
                        </p>
                        <button
                          onClick={() => onApply(presetForApply)}
                          className="w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                          style={{
                            background: "linear-gradient(135deg, #7C3AED, #7c3aed)",
                            color: "var(--color-text)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Apply &amp; Run
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// DISTORTION TRACKER
// ─────────────────────────────────────────────────────────────────────────────
function DistortionTracker({ stages }: { stages: StageResult[] }) {
  const segments = stages.map((s, i) => {
    const curr = clamp(s.signalStrength);
    const prev = i === 0 ? curr : clamp(stages[i - 1].signalStrength);
    const delta = curr - prev;
    let status: "boost" | "shift" | "steady" | "dip";
    let color: string;
    let label: string;
    if (delta > 2) { status = "boost"; color = "#10b981"; label = "+" + Math.round(delta) + "%"; }
    else if (delta >= -10) { status = "shift"; color = "#8B5CF6"; label = Math.round(delta) + "%"; }
    else { status = "dip"; color = "#f59e0b"; label = Math.round(delta) + "%"; }
    if (Math.abs(delta) <= 1) { status = "steady"; color = "#6366f1"; label = "~0%"; }
    return { ...STAGE_CONFIG[i], delta, status, color, label, signal: curr };
  });

  const peakStage = [...stages].sort((a, b) => b.signalStrength - a.signalStrength)[0];
  const troughStage = [...stages].sort((a, b) => a.signalStrength - b.signalStrength)[0];
  const peakCfg = STAGE_CONFIG.find(c => c.id === peakStage.stage)!;
  const troughCfg = STAGE_CONFIG.find(c => c.id === troughStage.stage)!;

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        How the signal changed at each stage
      </p>

      {/* Horizontal bar segments */}
      <div className="flex rounded-xl overflow-hidden" style={{ height: 40 }}>
        {segments.map((seg, i) => (
          <motion.div
            key={seg.id}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            className="flex-1 flex flex-col items-center justify-center relative"
            title={`${seg.label} — ${seg.id}`}
            style={{ background: `${seg.color}15`, borderRight: i < segments.length - 1 ? "1px solid var(--color-bg)" : "none" }}
          >
            <span className="text-[10px] font-semibold" style={{ color: seg.color }}>{seg.shortLabel}</span>
            <span className="text-[9px] font-mono opacity-80" style={{ color: seg.color }}>{seg.label}</span>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {([{color:"#10b981",label:"Boosted"},{color:"#6366f1",label:"Steady"},{color:"#8B5CF6",label:"Slight shift"},{color:"#f59e0b",label:"Noticeable dip"}] as const).map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Friendly narration */}
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
        The signal was strongest at <span style={{ color: peakCfg.color, fontWeight: 600 }}>{peakCfg.label}</span> ({Math.round(clamp(peakStage.signalStrength))}%) and softest at <span style={{ color: troughCfg.color, fontWeight: 600 }}>{troughCfg.label}</span> ({Math.round(clamp(troughStage.signalStrength))}%).
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO NARRATION
// ─────────────────────────────────────────────────────────────────────────────
function ScenarioNarration({ params }: { params: PipelineParams }) {
  const sentences: string[] = [];

  if (params.perceptualNoise > 70) {
    sentences.push("The signal arrived muddied — like trying to read a sign through heavy rain.");
  } else if (params.perceptualNoise < 20) {
    sentences.push("The signal came through crystal clear — every feature sharp and distinct from the start.");
  }

  if (params.attentionalFocus < 30) {
    sentences.push("Your attention wandered, casting a wide but shallow net across the incoming features.");
  } else if (params.attentionalFocus > 80) {
    sentences.push("Attention narrowed to a laser-sharp spotlight — deep focus on fewer features, everything else fading to the periphery.");
  }

  if (params.priorExpectation > 70) {
    sentences.push("Strong expectations painted over the ambiguities, filling gaps with what the brain predicted — not what was actually there.");
  } else if (params.priorExpectation < 20) {
    sentences.push("With almost no prior expectations, the brain processed features purely on their own terms — raw, unfiltered data-driven perception.");
  }

  if (params.encodingStrength < 30) {
    sentences.push("The memory trace was written in pencil, not ink — faint and fading before the page was even turned.");
  } else if (params.encodingStrength > 75) {
    sentences.push("Deep semantic encoding wove the information into existing knowledge structures — durable and richly connected.");
  }

  if (params.retrievalCue < 30) {
    sentences.push("Reaching for the memory felt like groping in a dark room — the information exists but the light switch is missing.");
  } else if (params.retrievalCue > 75) {
    sentences.push("Strong retrieval cues unlocked the memory cleanly — context matched encoding, and the trace surfaced readily.");
  }

  if (sentences.length === 0) {
    sentences.push("Balanced parameters produced a textbook cognitive pipeline — moderate signal, moderate attention, moderate memory quality.");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "#7C3AED0D" }}
        >
          <Quote size={14} color="#7C3AED" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium mb-2" style={{ color: "#7C3AED" }}>
            What happened inside your brain
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
            {sentences.join(" ")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE TAB  — new scroll-driven single-page flow
// ─────────────────────────────────────────────────────────────────────────────

// ── Stimulus display icons ────────────────────────────────────────────────────
const STIMULUS_ICONS: Record<string, React.ReactNode> = {
  "Ambiguous Face": (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
      <circle cx="20" cy="20" r="16"/>
      <circle cx="15" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="25" cy="16" r="1.5" fill="currentColor"/>
      <path d="M14 25c1.5 2 10.5 2 12 0"/>
    </svg>
  ),
  "Street Scene": (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
      <rect x="4" y="16" width="12" height="18" rx="1"/>
      <rect x="24" y="10" width="12" height="24" rx="1"/>
      <path d="M4 34h32M16 24h8"/>
      <path d="M8 16V10l4-4 4 4v6"/>
    </svg>
  ),
  "Muffled Conversation": (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
      <path d="M20 8a8 8 0 018 8v4a8 8 0 01-16 0v-4a8 8 0 018-8z"/>
      <path d="M8 22c0 7 5 12 12 12s12-5 12-12"/>
      <line x1="20" y1="34" x2="20" y2="38"/>
      <line x1="14" y1="38" x2="26" y2="38"/>
    </svg>
  ),
};

// ── Info tooltip ──────────────────────────────────────────────────────────────
// ── Stimulus info tooltip ─────────────────────────────────────────────────────
// Richer variant that shows the stimulus name, full scene description, and the
// individual feature chips. Lives in the top-right corner of each stimulus card.
function StimulusInfoTooltip({
  title,
  description,
  features,
  modality,
  inverted,
}: {
  title: string;
  description: string;
  features: readonly string[] | string[];
  modality: string;
  inverted?: boolean;
}) {
  const [show, setShow] = useState(false);
  // When the card is in its dark/selected state, invert the button colors so
  // it stays legible against the near-black background.
  const bg = inverted ? "rgba(255,255,255,0.1)" : "#F0F2F5";
  const border = inverted ? "rgba(255,255,255,0.22)" : "#CDD2DB";
  const fg = inverted ? "rgba(255,255,255,0.85)" : "#8B93A0";
  return (
    <span className="relative inline-flex" style={{ verticalAlign: "middle" }}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(s => !s); }}
        style={{
          width: 22, height: 22,
          borderRadius: "50%",
          border: `1.5px solid ${border}`,
          background: bg,
          color: fg,
          fontSize: 11,
          fontWeight: 700,
          fontStyle: "italic",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 1,
          fontFamily: "Georgia, serif",
          transition: "background 0.15s ease, border-color 0.15s ease",
        }}
        aria-label={`More info about ${title}`}
      >
        i
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#0B0D10",
              color: "#fff",
              padding: "14px 16px",
              borderRadius: 10,
              width: 260,
              zIndex: 100,
              pointerEvents: "auto",
              boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
                background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)",
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>
                {modality}
              </span>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.8)", marginBottom: features.length ? 10 : 0 }}>
              {description}
            </p>
            {features.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {features.map(f => (
                  <span
                    key={f}
                    style={{
                      fontSize: 10.5,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
            {/* Caret pointing up to the button */}
            <div style={{
              position: "absolute", bottom: "100%", right: 8,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "6px solid #0B0D10",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── HoverTooltip: wraps any trigger element and reveals rich content on hover
// Used for the Quick Experiments preset chips so the full scholarly
// description appears without forcing it into the tight pill UI.
function HoverTooltip({
  title,
  body,
  children,
}: {
  title?: string;
  body: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      // Explicit inline-flex + relative. Using inline styles (not Tailwind
      // classes) guarantees the wrapper has a real bounding box, which is
      // required for onMouseEnter to fire reliably.
      style={{ position: "relative", display: "inline-flex" }}
      onMouseOver={() => setShow(true)}
      onMouseOut={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#0B0D10",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              width: 260,
              zIndex: 100,
              pointerEvents: "none",
              boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              textAlign: "left",
            }}
          >
            {title && (
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.005em", marginBottom: 4, color: "#fff" }}>
                {title}
              </p>
            )}
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.82)" }}>
              {body}
            </p>
            <div style={{
              position: "absolute", top: "100%", left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #0B0D10",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" style={{ verticalAlign: "middle" }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{
          width: 18, height: 18,
          borderRadius: "50%",
          border: "1.5px solid #CDD2DB",
          background: "#F0F2F5",
          color: "#8B93A0",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="More info"
      >
        i
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#0B0D10",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 12,
              lineHeight: 1.45,
              width: 220,
              zIndex: 100,
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
            }}
          >
            {text}
            <div style={{
              position: "absolute", top: "100%", left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #0B0D10",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Scroll-fade wrapper ───────────────────────────────────────────────────────
function ScrollFade({ children, delay = 0, stretch = false }: { children: React.ReactNode; delay?: number; stretch?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  // When `stretch` is on, the wrapper expands to fill its parent grid/flex
  // track so children can equalize their height (used by the stimulus card
  // grid). When off, children stack as normal block flow.
  return (
    <div ref={ref} style={stretch ? { height: "100%", display: "flex" } : undefined}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
        style={stretch ? { width: "100%", display: "flex" } : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ── Full-screen Result Summary card ──────────────────────────────────────────
interface ResultSummaryProps {
  stimulus: Stimulus;
  params: PipelineParams;
  stages: StageResult[];
  onContinue: () => void;
}
function ResultSummary({ stimulus, params, stages, onContinue }: ResultSummaryProps) {
  const finalSignal = stages[stages.length - 1]?.signalStrength ?? 0;
  const avgSignal = stages.reduce((s, r) => s + r.signalStrength, 0) / stages.length;
  const weakStages = stages.filter(s => s.signalStrength < 40);
  const strongStages = stages.filter(s => s.signalStrength >= 70);

  const getOutcome = () => {
    if (finalSignal >= 70) return { label: "Strong recall", color: "#059669", icon: "✦" };
    if (finalSignal >= 45) return { label: "Partial recall", color: "#D97706", icon: "◈" };
    return { label: "Weak recall", color: "#DC2626", icon: "◎" };
  };
  const outcome = getOutcome();

  const getSummaryText = () => {
    const lines: string[] = [];
    if (params.attentionalFocus < 35) {
      lines.push(`Low attentional focus meant your brain processed "${stimulus.name}" superficially — most features never made it past the gate.`);
    } else if (params.attentionalFocus > 70) {
      lines.push(`Strong attentional focus locked onto "${stimulus.name}" — signals were captured deeply and thoroughly.`);
    } else {
      lines.push(`Moderate attention engaged with "${stimulus.name}", letting through a reasonable slice of the signal.`);
    }
    if (params.perceptualNoise > 65) {
      lines.push("High perceptual noise scrambled the incoming signal before it could be organized — like trying to hear through static.");
    }
    if (params.priorExpectation > 70) {
      lines.push("Strong prior expectations shaped what was perceived — the brain 'filled in' ambiguous features based on what it expected to see.");
    }
    if (params.encodingStrength < 35) {
      lines.push("Shallow encoding meant memories formed weakly — like writing in sand instead of stone.");
    } else if (params.encodingStrength > 75) {
      lines.push("Deep encoding carved a durable memory trace — semantic connections locked this in for the long haul.");
    }
    if (params.retrievalCue < 30) {
      lines.push("The retrieval cue was too weak to surface the memory reliably — like having the answer on the tip of your tongue.");
    }
    if (weakStages.length > 0) {
      lines.push(`The pipeline bottlenecked at: ${weakStages.map(s => s.stage).join(", ")}.`);
    }
    if (strongStages.length >= 5) {
      lines.push("Across nearly every stage, signals survived at high strength — a well-functioning cognitive system.");
    }
    return lines;
  };

  const summaryLines = getSummaryText();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        style={{ maxWidth: 560, width: "100%", textAlign: "center" }}
      >
        {/* Outcome badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 999,
            background: `${outcome.color}12`,
            border: `1.5px solid ${outcome.color}30`,
            marginBottom: 24,
          }}
        >
          <span style={{ color: outcome.color, fontSize: 14 }}>{outcome.icon}</span>
          <span style={{ color: outcome.color, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {outcome.label}
          </span>
        </motion.div>

        {/* Main signal score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 8 }}
        >
          <span style={{ fontSize: 80, fontWeight: 700, color: "#0B0D10", lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif" }}>
            {Math.round(finalSignal)}
          </span>
          <span style={{ fontSize: 28, fontWeight: 400, color: "#8B93A0" }}>/100</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          style={{ color: "#8B93A0", fontSize: 13, marginBottom: 32, letterSpacing: "0.04em" }}
        >
          final signal · avg {Math.round(avgSignal)} across 7 stages
        </motion.p>

        {/* Stage mini-bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 32 }}
        >
          {stages.map((s, i) => {
            const cfg = STAGE_CONFIG[i];
            return (
              <div key={s.stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 36,
                  height: 5,
                  borderRadius: 3,
                  background: `linear-gradient(to right, ${cfg.color}, ${cfg.color}88)`,
                  opacity: Math.max(0.2, s.signalStrength / 100),
                }} />
                <span style={{ fontSize: 9, color: "#8B93A0", fontWeight: 600, letterSpacing: "0.05em" }}>
                  {cfg.shortLabel}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Summary lines */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            background: "#F0F2F5",
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 32,
            textAlign: "left",
          }}
        >
          {summaryLines.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65 + i * 0.1, duration: 0.4 }}
              style={{ fontSize: 14, color: "#4A5058", lineHeight: 1.6, marginBottom: i < summaryLines.length - 1 ? 10 : 0 }}
            >
              {line}
            </motion.p>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={onContinue}
          style={{
            background: "#7C3AED",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 12,
            padding: "14px 32px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            letterSpacing: "0.02em",
          }}
          whileHover={{ opacity: 0.88 }}
          whileTap={{ scale: 0.97 }}
        >
          Explore Full Dashboard
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M3 8h10M9 4l4 4-4 4"/>
          </svg>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── Param tooltip descriptions (richer than PARAM_META.description) ──────────
const PARAM_TOOLTIP: Record<string, string> = {
  attentionalFocus:
    "Controls the selectivity of attention. Higher values narrow the attentional spotlight, deepening processing of fewer stimuli; lower values distribute attention broadly at the cost of depth. Reflects Broadbent's filter theory.",
  perceptualNoise:
    "Represents interference that degrades the sensory signal before interpretation. Higher values reduce the signal-to-noise ratio, making detection harder — the core variable in signal-detection theory.",
  priorExpectation:
    "Weights the influence of top-down predictions on perception. Higher values let prior beliefs fill ambiguous input, increasing speed but also susceptibility to error. Central to constructivist theories of perception.",
  encodingStrength:
    "Controls depth of processing at encoding. Higher values reflect semantic elaboration that links new information to existing knowledge; lower values reflect shallow, structural processing (Craik & Lockhart, 1972).",
  retrievalCue:
    "Quantifies the overlap between retrieval context and the context present at encoding. Higher values denote closely matching cues, maximizing recall probability — Tulving's encoding specificity principle.",
};

// ── ActiveSetPill: small "A" / "B" indicator shown in compare mode ───────────
function ActiveSetPill({ set }: { set: "A" | "B" }) {
  const color = set === "A" ? "#7C3AED" : "#2563EB";
  return (
    <span
      aria-label={`Viewing set ${set}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 999,
        background: `${color}14`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block" }}
      />
      Viewing {set}
    </span>
  );
}

// ── Collapsible: lazy-reveal section for heavier/optional content ────────────
function Collapsible({ children, label, delay = 0, defaultOpen = false }: { children: React.ReactNode; label: string; delay?: number; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.06 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4E7EC",
          borderRadius: 12,
          marginBottom: 12,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            padding: "16px 24px",
            cursor: "pointer",
            textAlign: "left",
            color: "#0B0D10",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          <span>{label}</span>
          <ChevronDown
            size={16}
            color="#8B93A0"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }}
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ padding: "6px 24px 22px" }}>
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── DashCard: scroll-triggered reveal card for dashboard sections ─────────────
function DashCard({ children, label, subtitle, trailing, delay = 0 }: { children: React.ReactNode; label: string; subtitle?: string; trailing?: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.06 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4E7EC",
          borderRadius: 12,
          padding: "22px 24px",
          marginBottom: 12,
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: subtitle ? 4 : 16,
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#0B0D10",
            letterSpacing: "-0.01em",
            margin: 0,
          }}>
            {label}
          </h3>
          {trailing}
        </div>
        {subtitle && (
          <p style={{ fontSize: 13, color: "#8B93A0", marginBottom: 18, lineHeight: 1.55 }}>
            {subtitle}
          </p>
        )}
        {children}
      </motion.div>
    </div>
  );
}

function PipelineTab() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [selectedStimulus, setSelectedStimulus] = useState<Stimulus>(STIMULI[0]);
  const [params, setParams] = useState<PipelineParams>({ ...DEFAULT_PARAMS });
  const [results, setResults] = useState<StageResult[] | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // ── Comparison mode state ────────────────────────────────────────────────────
  const [comparisonMode, setComparisonMode] = useState(false);
  const [activeSet, setActiveSet] = useState<"A" | "B">("A");
  const [paramsA, setParamsA] = useState<PipelineParams>({ ...DEFAULT_PARAMS });
  const [paramsB, setParamsB] = useState<PipelineParams>({ ...DEFAULT_PARAMS });
  const [resultsA, setResultsA] = useState<StageResult[] | null>(null);
  const [resultsB, setResultsB] = useState<StageResult[] | null>(null);

  // Monotonically increasing id that bumps on every explicit Re-run.
  // Used as a remount key so charts visibly re-animate, giving clear feedback
  // even when results happen to be identical to the previous run.
  const [runId, setRunId] = useState(0);

  // ── Refs for scroll ──────────────────────────────────────────────────────────
  const paramsRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleParam = useCallback(
    (key: keyof PipelineParams, val: number) => {
      if (comparisonMode) {
        if (activeSet === "A") {
          setParamsA(prev => { const n = { ...prev, [key]: val }; if (hasRun) setResultsA(runPipeline(selectedStimulus, n)); return n; });
        } else {
          setParamsB(prev => { const n = { ...prev, [key]: val }; if (hasRun) setResultsB(runPipeline(selectedStimulus, n)); return n; });
        }
      } else {
        setParams(prev => { const n = { ...prev, [key]: val }; if (hasRun) setResults(runPipeline(selectedStimulus, n)); return n; });
      }
    },
    [comparisonMode, activeSet, hasRun, selectedStimulus]
  );

  const handleRun = () => {
    const r = runPipeline(selectedStimulus, params);
    setResults(r);
    setHasRun(true);
    setShowSummary(true);
  };

  const handleDashboardRun = () => {
    if (comparisonMode) {
      setResultsA(runPipeline(selectedStimulus, paramsA));
      setResultsB(runPipeline(selectedStimulus, paramsB));
    } else {
      setResults(runPipeline(selectedStimulus, params));
    }
    setHasRun(true);
    setRunId(id => id + 1);
  };

  const handleReset = () => {
    setParams({ ...DEFAULT_PARAMS });
    setResults(null);
    setHasRun(false);
    setShowDashboard(false);
    setComparisonMode(false);
    setResultsA(null);
    setResultsB(null);
    setParamsA({ ...DEFAULT_PARAMS });
    setParamsB({ ...DEFAULT_PARAMS });
  };

  const handleApplyPreset = (preset: Preset) => {
    if (comparisonMode && preset.variantB) {
      setParamsA({ ...preset.params });
      setParamsB({ ...preset.variantB });
      if (hasRun) {
        setResultsA(runPipeline(selectedStimulus, preset.params));
        setResultsB(runPipeline(selectedStimulus, preset.variantB));
      }
    } else {
      setParams({ ...preset.params });
      if (hasRun) setResults(runPipeline(selectedStimulus, preset.params));
    }
  };

  const toggleComparisonMode = () => {
    if (!comparisonMode) {
      setParamsA({ ...params });
      setParamsB({ ...params });
      setResultsA(results ? [...results] : null);
      setResultsB(results ? [...results] : null);
    }
    setComparisonMode(c => !c);
  };

  // In compare mode, the "primary" data shown in all charts follows the
  // currently-selected set (A or B) so toggling the A/B tabs actually swaps
  // the visualization. The "secondary" is the other set, used for overlays.
  const displayResultsA = comparisonMode
    ? (activeSet === "A" ? resultsA : resultsB)
    : results;
  const displayResultsB = comparisonMode
    ? (activeSet === "A" ? resultsB : resultsA)
    : null;
  const currentParams = comparisonMode ? (activeSet === "A" ? paramsA : paramsB) : params;

  const handleStimulusSelect = (s: Stimulus) => {
    setSelectedStimulus(s);
    // Scroll to params after short delay
    setTimeout(() => {
      paramsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  const handleSummaryDone = () => {
    setShowSummary(false);
    setShowDashboard(true);
    setTimeout(() => {
      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <>
      {/* ── Full-screen summary overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {showSummary && results && (
          <ResultSummary
            stimulus={selectedStimulus}
            params={params}
            stages={results}
            onContinue={handleSummaryDone}
          />
        )}
      </AnimatePresence>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>

        {/* ── SECTION 1: Choose a stimulus ───────────────────────────────── */}
        <section style={{ padding: "100px 0 80px" }}>
          <ScrollFade>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#8B93A0", textTransform: "uppercase", marginBottom: 14 }}>
              Step 1
            </p>
            <h2 style={{ fontSize: 38, fontWeight: 700, color: "#0B0D10", marginBottom: 12, letterSpacing: "-0.02em", fontFamily: "Inter, system-ui, sans-serif" }}>
              Choose a stimulus
            </h2>
            <p style={{ fontSize: 17, color: "#4A5058", marginBottom: 44, lineHeight: 1.65 }}>
              Pick the sensory input your brain will process through the pipeline.
            </p>
          </ScrollFade>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {STIMULI.map((s, i) => {
              const isSelected = selectedStimulus.id === s.id;
              return (
                <ScrollFade key={s.id} delay={i * 0.08} stretch>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => handleStimulusSelect(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleStimulusSelect(s);
                      }
                    }}
                    className={isSelected ? undefined : "card-hover"}
                    style={{
                      position: "relative",
                      width: "100%",
                      padding: "22px 22px",
                      borderRadius: 12,
                      border: isSelected ? "1px solid #0B0D10" : "1px solid #E4E7EC",
                      background: isSelected ? "#0B0D10" : "#FFFFFF",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.18s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      outline: "none",
                    }}
                  >
                    {/* Info (i) button — sits in the top-right, shows full description on hover */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{ position: "absolute", top: 14, right: 14, zIndex: 2 }}
                    >
                      <StimulusInfoTooltip
                        title={s.name}
                        description={s.sceneDescription}
                        features={s.features}
                        modality={s.modality}
                        inverted={isSelected}
                      />
                    </div>

                    <div style={{
                      color: isSelected ? "#FFFFFF" : "#4A5058",
                      marginBottom: 10,
                      opacity: isSelected ? 0.95 : 0.85,
                    }}>
                      {STIMULUS_ICONS[s.name] ?? <span style={{ fontSize: 26 }}>{s.imageEmoji}</span>}
                    </div>
                    <p style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: isSelected ? "#FFFFFF" : "#0B0D10",
                      marginBottom: 4,
                      letterSpacing: "-0.01em",
                      paddingRight: 24,
                    }}>
                      {s.name}
                    </p>
                    <p style={{
                      fontSize: 12.5,
                      color: isSelected ? "rgba(255,255,255,0.65)" : "#8B93A0",
                      lineHeight: 1.45,
                    }}>
                      {s.sceneDescription.slice(0, 60)}…
                    </p>
                    <span style={{
                      display: "inline-block",
                      marginTop: "auto",
                      paddingTop: 12,
                    }}>
                      <span style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: isSelected ? "rgba(255,255,255,0.12)" : "#F0F2F5",
                        color: isSelected ? "rgba(255,255,255,0.8)" : "#8B93A0",
                      }}>
                        {s.modality}
                      </span>
                    </span>
                  </div>
                </ScrollFade>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 2: Brain parameters ────────────────────────────────── */}
        <div ref={paramsRef} />
        <section style={{ padding: "40px 0 80px" }}>
          <ScrollFade>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#8B93A0", textTransform: "uppercase", marginBottom: 14 }}>
              Step 2
            </p>
            <h2 style={{ fontSize: 38, fontWeight: 700, color: "#0B0D10", marginBottom: 12, letterSpacing: "-0.02em", fontFamily: "Inter, system-ui, sans-serif" }}>
              Set brain parameters
            </h2>
            <p style={{ fontSize: 17, color: "#4A5058", marginBottom: 44, lineHeight: 1.65 }}>
              Tune five cognitive knobs. Hover the <span style={{ background: "#F0F2F5", borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 700, color: "#8B93A0", border: "1px solid #E4E7EC" }}>i</span> buttons to learn what each one does.
            </p>
          </ScrollFade>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {PARAM_META.map((meta, i) => (
              <ScrollFade key={meta.key} delay={i * 0.06}>
                <div style={{
                  padding: "26px 0",
                  borderBottom: "1px solid #E6E9EE",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        background: meta.color,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#0B0D10", letterSpacing: "-0.01em" }}>
                        {meta.label}
                      </span>
                      <InfoTooltip text={PARAM_TOOLTIP[meta.key] ?? meta.description} />
                    </div>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: meta.color,
                      minWidth: 36,
                      textAlign: "right",
                    }}>
                      {currentParams[meta.key]}
                    </span>
                  </div>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      right: 0,
                      height: 4,
                      borderRadius: 4,
                      background: "#E6E9EE",
                      transform: "translateY(-50%)",
                    }} />
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      width: `${currentParams[meta.key]}%`,
                      height: 4,
                      borderRadius: 4,
                      background: meta.color,
                      transform: "translateY(-50%)",
                      transition: "width 0.15s ease",
                    }} />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={currentParams[meta.key]}
                      onChange={e => handleParam(meta.key, Number(e.target.value))}
                      style={{
                        position: "relative",
                        width: "100%",
                        height: 20,
                        appearance: "none",
                        WebkitAppearance: "none",
                        background: "transparent",
                        cursor: "pointer",
                        margin: 0,
                        zIndex: 1,
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#8B93A0" }}>{meta.description.split(",")[0].split("=")[1]?.trim() ?? "Low"}</span>
                    <span style={{ fontSize: 10, color: "#8B93A0" }}>{meta.description.split(",")[1]?.split("=")[1]?.trim() ?? "High"}</span>
                  </div>
                </div>
              </ScrollFade>
            ))}
          </div>

          {/* Quick presets */}
          <ScrollFade delay={0.3}>
            <div style={{ marginTop: 24, marginBottom: 32 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#8B93A0", textTransform: "uppercase", marginBottom: 10 }}>
                Quick Experiments
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESETS.map(p => (
                  <HoverTooltip key={p.id} title={p.name} body={p.description}>
                    <button
                      onClick={() => handleApplyPreset(p)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: "1.5px solid #E4E7EC",
                        background: "#FFFFFF",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#4A5058",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#0B0D10";
                        (e.currentTarget as HTMLButtonElement).style.color = "#0B0D10";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#E4E7EC";
                        (e.currentTarget as HTMLButtonElement).style.color = "#4A5058";
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{p.emoji}</span>
                      {p.name}
                    </button>
                  </HoverTooltip>
                ))}
              </div>
            </div>
          </ScrollFade>

          {/* Run button */}
          <ScrollFade delay={0.35}>
            <button
              onClick={handleRun}
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: 10,
                border: "none",
                background: "#0B0D10",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                letterSpacing: "-0.005em",
                transition: "transform 0.15s ease, background 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#7C3AED"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0B0D10"; }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
                <path d="M3 2.5a.5.5 0 01.776-.416l10 5.5a.5.5 0 010 .832l-10 5.5A.5.5 0 013 13.5v-11z"/>
              </svg>
              Run pipeline
            </button>
          </ScrollFade>
        </section>

      </div>{/* end maxWidth:760 wrapper */}

      {/* ── SECTION 3: Full Dashboard (fades in after summary) ─────────── */}
      <AnimatePresence>
          {showDashboard && (
            <motion.div
              ref={dashboardRef}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <section style={{ paddingBottom: 80, padding: "0 32px 80px" }}>
                {/* Section header */}
                <div style={{ marginBottom: 28, paddingTop: 28 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#8B93A0", textTransform: "uppercase", marginBottom: 6 }}>Full Results</p>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0B0D10", letterSpacing: "-0.02em", fontFamily: "Inter, system-ui, sans-serif" }}>Pipeline Dashboard</h2>
                  </div>
                </div>

                {/* Dashboard layout: control strip + full-width results */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* ── Top control strip ── */}
                  <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Row 1: Stimulus + Re-run + Compare controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8B93A0", textTransform: "uppercase", flexShrink: 0 }}>Stimulus:</span>
                      {STIMULI.map(s => {
                        const active = selectedStimulus.id === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedStimulus(s)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 999,
                              border: active ? "1.5px solid #7C3AED" : "1.5px solid #E4E7EC",
                              background: active ? "#7C3AED" : "#FFFFFF",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{s.imageEmoji}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: active ? "#FFFFFF" : "#4A5058" }}>{s.name}</span>
                          </button>
                        );
                      })}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <motion.button
                          onClick={handleDashboardRun}
                          whileTap={{ scale: 0.96 }}
                          style={{
                            padding: "8px 18px",
                            borderRadius: 10,
                            border: "none",
                            background: "#0B0D10",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#7C3AED"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#0B0D10"; }}
                        >
                          <Play size={12} />
                          Re-run
                        </motion.button>
                        <button
                          onClick={toggleComparisonMode}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: comparisonMode ? "none" : "1.5px solid #E4E7EC",
                            background: comparisonMode ? "#7C3AED" : "#FFFFFF",
                            color: comparisonMode ? "#fff" : "#4A5058",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                            transition: "all 0.2s ease",
                          }}
                        >
                          <GitCompare size={13} />
                          {comparisonMode ? "Exit Compare" : "A vs B"}
                        </button>
                        <button
                          onClick={handleReset}
                          title="Reset"
                          style={{
                            padding: "8px",
                            borderRadius: 10,
                            border: "1.5px solid #E4E7EC",
                            background: "#FFFFFF",
                            color: "#8B93A0",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: compact params strip */}
                    <div style={{
                      background: "#FFFFFF",
                      border: "1.5px solid #E4E7EC",
                      borderRadius: 12,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                    }}>
                      {/* label */}
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#8B93A0", textTransform: "uppercase", flexShrink: 0, marginRight: 16 }}>Params</span>
                      {comparisonMode && (
                        <div
                          role="tablist"
                          aria-label="Compare set"
                          style={{
                            display: "flex",
                            gap: 2,
                            padding: 3,
                            marginRight: 14,
                            flexShrink: 0,
                            background: "#F0F2F5",
                            border: "1px solid #E4E7EC",
                            borderRadius: 8,
                          }}
                        >
                          {(["A","B"] as const).map(set => {
                            const isActive = activeSet === set;
                            const setColor = set === "A" ? "#7C3AED" : "#2563EB";
                            return (
                              <button
                                key={set}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveSet(set)}
                                style={{
                                  padding: "3px 14px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: isActive ? setColor : "transparent",
                                  color: isActive ? "#FFFFFF" : "#4A5058",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  cursor: "pointer",
                                  transition: "background 0.18s ease, color 0.18s ease",
                                }}
                              >
                                {set}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* 5 param sliders in one row */}
                      <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
                        {PARAM_META.map(meta => (
                          <div key={meta.key} style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#4A5058", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, marginLeft: "auto", flexShrink: 0 }}>{currentParams[meta.key]}</span>
                            </div>
                            <div style={{ position: "relative", height: 16 }}>
                              <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, borderRadius: 3, background: "#E6E9EE", transform: "translateY(-50%)" }} />
                              <div style={{ position: "absolute", top: "50%", left: 0, width: `${currentParams[meta.key]}%`, height: 3, borderRadius: 3, background: meta.color, transform: "translateY(-50%)", transition: "width 0.15s ease" }} />
                              <input
                                type="range" min={0} max={100}
                                value={currentParams[meta.key]}
                                onChange={e => handleParam(meta.key, Number(e.target.value))}
                                style={{ position: "relative", width: "100%", height: 16, appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", margin: 0, zIndex: 1 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Presets inline */}
                      <div style={{ marginLeft: 16, flexShrink: 0 }}>
                        <PresetsPanel onApply={handleApplyPreset} />
                      </div>
                    </div>
                  </aside>

                  {/* ── Main results ── */}
                  <main key={`run-${runId}-${activeSet}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {!displayResultsA ? (
                      <div style={{
                        background: "#F0F2F5",
                        borderRadius: 18,
                        padding: "60px 24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        border: "1.5px solid #E4E7EC",
                      }}>
                        <div style={{
                          width: 56, height: 56,
                          borderRadius: 16,
                          background: "#EEECFF",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginBottom: 16,
                        }}>
                          <Brain size={28} color="#7C3AED" strokeWidth={1.5} />
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#0B0D10", marginBottom: 6 }}>Ready when you are</p>
                        <p style={{ fontSize: 13, color: "#8B93A0", maxWidth: 280, lineHeight: 1.6 }}>
                          Adjust the parameters on the left and hit Re-run to see how your brain processes the stimulus.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 1 — Stimulus header (compact, no label chrome) */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 16,
                          padding: "16px 20px",
                          background: "#FFFFFF",
                          border: "1px solid #E4E7EC",
                          borderRadius: 12,
                          marginBottom: 12,
                        }}>
                          <span style={{ fontSize: 36, lineHeight: 1 }}>{selectedStimulus.imageEmoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0B0D10", letterSpacing: "-0.01em" }}>
                                {selectedStimulus.name}
                              </h3>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                background: "#F0F2F5", color: "#8B93A0",
                                textTransform: "uppercase", letterSpacing: "0.08em",
                              }}>
                                {selectedStimulus.modality}
                              </span>
                              {comparisonMode && <ActiveSetPill set={activeSet} />}
                            </div>
                            <p style={{ fontSize: 13, color: "#8B93A0", lineHeight: 1.55 }}>
                              {selectedStimulus.sceneDescription}
                            </p>
                          </div>
                        </div>

                        {/* 2 — Signal Journey (main chart) */}
                        <DashCard
                          delay={0.06}
                          label="Signal journey"
                          trailing={comparisonMode ? <ActiveSetPill set={activeSet} /> : undefined}
                        >
                          <SignalWaveform stages={displayResultsA} />
                        </DashCard>

                        {/* 3 — Plain-English narration */}
                        <DashCard
                          delay={0.12}
                          label="What happened"
                          trailing={comparisonMode ? <ActiveSetPill set={activeSet} /> : undefined}
                        >
                          <ScenarioNarration params={currentParams} />
                        </DashCard>

                        {/* 4 — Run summary (compact scorecard) */}
                        <DashCard
                          delay={0.18}
                          label="Run summary"
                          trailing={comparisonMode ? <ActiveSetPill set={activeSet} /> : undefined}
                        >
                          <PipelineSummary stages={displayResultsA} stagesB={displayResultsB ?? undefined} />
                        </DashCard>

                        {/* 5 — Collapsible details: per-stage breakdown, brain activity, distortion */}
                        <Collapsible label="Stage-by-stage details" delay={0.24}>
                          {displayResultsA.map((stage, i) => {
                            const cfg = STAGE_CONFIG.find(c => c.id === stage.stage) ?? STAGE_CONFIG[i];
                            const compStage = displayResultsB ? displayResultsB[i] : undefined;
                            return (
                              <div key={stage.stage}>
                                <StageCard stage={stage} config={cfg} index={i} comparisonStage={compStage} isComparisonMode={comparisonMode} />
                                {i < displayResultsA.length - 1 && (
                                  <PathwayConnector fromVal={stage.signalStrength} toVal={displayResultsA[i+1].signalStrength} color={STAGE_CONFIG[i+1].color} />
                                )}
                              </div>
                            );
                          })}
                        </Collapsible>

                        <Collapsible label="Brain activity & feature survival" delay={0.28}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <BrainHeatmap stages={displayResultsA} />
                            <FeatureSurvivalGrid stimulus={selectedStimulus} stages={displayResultsA} />
                          </div>
                        </Collapsible>

                        <Collapsible label="Signal distortion map" delay={0.32}>
                          <DistortionTracker stages={displayResultsA} />
                        </Collapsible>
                      </>
                    )}
                  </main>
                </div>
              </section>
            </motion.div>
          )}
      </AnimatePresence>

    </>
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
    color: "#7C3AED",
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
    body: "Atkinson & Shiffrin's Multi-Store Model (1968) describes memory as three interconnected stores: Sensory Memory (~250ms for visual/iconic, 2–4s for auditory/echoic), Short-Term/Working Memory (15–30s without rehearsal, limited to a few items), and Long-Term Memory (potentially unlimited capacity and duration). Information moves from short-term to long-term through rehearsal and consolidation — a process where the hippocampus plays a central role, gradually transferring memories to the neocortex.",
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

// Refs that have glossary entries (case-insensitive matching)
const GLOSSARY_REFS: Record<string, string> = {
  "Broadbent's Filter Theory": "Broadbent's Filter Theory",
  "Treisman's Attenuation Model": "Treisman's Attenuation Model",
  "Cocktail Party Effect": "Cocktail party effect",
  "Inattentional Blindness": "Inattentional blindness",
  "Gestalt Principles": "Gestalt principles",
  "Encoding Specificity": "Encoding specificity",
  "Misinformation Effect": "Misinformation effect",
  "False Memories (Loftus)": "False memory",
};

// Try-It prompts per stage
const TRY_IT_PROMPTS: Record<string, string> = {
  Sensation: "Try setting Perceptual Noise to 90 and watch how the Sensation signal drops. Then lower it to 10 — notice how many more features survive?",
  Attention: "Set Attentional Focus to 15 to see inattentional blindness in action. Then try 90 — notice how the spotlight narrows and fewer features make it through?",
  Perception: "Max out Prior Expectations to 95 and watch how perception \u2018fills in\u2019 ambiguous features. Then drop it to 5 to see purely data-driven perception.",
  Encoding: "Compare encoding at 90 (deep semantic) vs. 15 (shallow structural) — use the \u2018Deep vs. Shallow\u2019 preset to see the dramatic difference in memory quality.",
  Storage: "Run the pipeline with low encoding (15) and watch the Storage trace crumble. Then try high encoding (90) — the hippocampal consolidation kicks in.",
  Retrieval: "Use the \u2018Tip of the Tongue\u2019 preset — high encoding but low retrieval cue. The memory is \u2018in there\u2019 but won\u2019t surface. Then increase the cue to 80.",
  Report: "Use the \u2018Biased Observer\u2019 preset — notice the Report shows HIGH confidence but potentially LOW fidelity. This is exactly how false memories form.",
};

// Myths vs Reality data
const MYTHS = [
  {
    myth: "Memory works like a video camera",
    reality: "Memory is reconstructive — every recall is a re-creation that can be altered by expectations, context, and post-event information (Bartlett, 1932; Loftus, 1979).",
  },
  {
    myth: "We perceive the world exactly as it is",
    reality: "Perception is heavily shaped by top-down processing. Your brain fills in gaps, resolves ambiguity using expectations, and sometimes creates features that aren\u2019t there (Gregory, 1970).",
  },
  {
    myth: "Attention means we just need to \u2018try harder\u2019",
    reality: "Attention is a limited-capacity resource with a physical bottleneck. You literally cannot attend to everything — Broadbent (1958) showed this is a structural limitation, not a motivational one.",
  },
  {
    myth: "Confident memories are accurate memories",
    reality: "Confidence and accuracy are surprisingly independent. Loftus & Palmer (1974) showed that subtle wording changes in questions could distort eyewitness reports, and later work by Loftus demonstrated that suggestion can produce vivid false memories reported with high confidence.",
  },
  {
    myth: "Studying = memorizing",
    reality: "Craik & Lockhart (1972) showed that HOW you process information matters more than HOW LONG. Deep semantic processing — connecting material to meaning — produces far stronger memory traces than extended rote repetition.",
  },
];

function LearnTab() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          How Your Brain Processes Information
        </h2>
        <p className="text-base" style={{ color: "var(--color-text-dim)" }}>
          A guided tour through the seven stages of cognitive processing — from raw sensation to conscious memory.
        </p>
      </div>

      {/* Key concepts highlight */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { label: "Bottom-up processing", desc: "Driven by stimulus features — pure sensation flowing upward through the system without prior influence.", color: "#f59e0b" },
          { label: "Top-down processing", desc: "Driven by prior knowledge and expectations — your brain predicts what it will perceive before perceiving it.", color: "#6366f1" },
          { label: "Broadbent's Filter Theory", desc: "Attention acts as a single-channel filter that blocks out all but one input stream based on physical characteristics.", color: "#7C3AED" },
          { label: "Levels of processing", desc: "Deeper, more meaningful encoding creates stronger, more durable memory traces than shallow structural analysis.", color: "#14b8a6" },
          { label: "Encoding specificity", desc: "Memory retrieval is best when cues at retrieval match the context present at the time of encoding.", color: "#06b6d4" },
          { label: "Reconstructive memory", desc: "We don't replay memories like videos — we rebuild them from fragments, influenced by subsequent experiences.", color: "#3b82f6" },
        ].map((c) => (
          <div
            key={c.label}
            className="p-4 rounded-xl"
            style={{ background: `${c.color}0d`, border: `1px solid ${c.color}28` }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: c.color }}>
              <GlossaryTerm term={c.label}>{c.label}</GlossaryTerm>
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
              {c.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Myths vs Reality section */}
      <div>
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          Common Myths About Memory &amp; Perception
        </h3>
        <div className="space-y-3">
          {MYTHS.map((item, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderLeft: "4px solid #ef4444" }}
              >
                <span className="text-base flex-shrink-0 mt-0.5" style={{ color: "#ef4444" }}>&#10007;</span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#f87171" }}>Myth</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{item.myth}</p>
                </div>
              </div>
              <div
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderLeft: "4px solid #10b981", borderTop: "1px solid var(--color-border)" }}
              >
                <span className="text-base flex-shrink-0 mt-0.5" style={{ color: "#10b981" }}>&#10003;</span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#34d399" }}>Reality</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>{item.reality}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
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
              <h3 className="text-base font-bold" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
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
                {s.refs.map((r) => {
                  const glossaryKey = GLOSSARY_REFS[r] ?? r;
                  const hasGlossary = !!(GLOSSARY[glossaryKey] || GLOSSARY[Object.keys(GLOSSARY).find(k => k.toLowerCase() === glossaryKey.toLowerCase()) ?? ""]);
                  return (
                    <span
                      key={r}
                      className="text-[11px] px-2.5 py-1 rounded-full"
                      style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                    >
                      {hasGlossary ? <GlossaryTerm term={glossaryKey}>{r}</GlossaryTerm> : r}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Try It Yourself box */}
            {TRY_IT_PROMPTS[s.title] && (
              <div
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #7C3AED08, #6366f108)",
                  border: "1px solid #7C3AED35",
                  boxShadow: "inset 0 0 0 1px #6366f120",
                }}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#7C3AED18", border: "1px solid #7C3AED30" }}
                >
                  <Lightbulb size={13} color="#8B5CF6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#8B5CF6" }}>
                    Try It in the Pipeline
                  </p>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                    {TRY_IT_PROMPTS[s.title]}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* PSYC 203 Module Integration section */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
            Connecting the Dots: PSYC 203 Module Integration
          </h3>
          <p className="text-[13px]" style={{ color: "var(--color-text-dim)" }}>
            How the simulator maps to your course modules
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div
            className="p-4 rounded-xl"
            style={{ background: "#f59e0b0d", border: "1px solid #f59e0b28", borderLeft: "4px solid #f59e0b" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#f59e0b" }}>
              Module 3: Sensation &amp; Perception
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
              The simulator&apos;s first three stages — Sensation, Attention, and Perception — directly model the concepts from Module 3. The Perceptual Noise slider demonstrates signal detection theory. The Prior Expectations slider shows the interplay between bottom-up and top-down processing. The pipeline shows that perception is not passive reception but active construction.
            </p>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{ background: "#14b8a60d", border: "1px solid #14b8a628", borderLeft: "4px solid #14b8a6" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#14b8a6" }}>
              Module 6: Memory
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
              The final four stages — Encoding, Storage, Retrieval, and Report — map to Module 6&apos;s memory concepts. The Encoding Strength slider directly illustrates Craik &amp; Lockhart&apos;s levels of processing. The Retrieval Cue slider demonstrates Tulving&apos;s encoding specificity principle. And the Report stage reveals how memory is always reconstruction, never replay.
            </p>
          </div>
        </div>
        <div
          className="p-4 rounded-xl"
          style={{ background: "#7C3AED0a", border: "1px solid #7C3AED25" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#7C3AED" }}>
            The Bridge
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
            The most important insight: these aren&apos;t isolated modules. The pipeline shows that what you perceive directly determines what you remember. Distortions accumulate — a noisy sensation leads to a filtered attention, which leads to a biased perception, which gets shallowly encoded, weakly stored, and poorly retrieved. Every stage matters.
          </p>
        </div>
      </div>
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
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          About Build-A-Brain
        </h2>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
          An interactive educational simulator designed to make cognitive psychology tangible. Built for PSYC 203 students who want to understand not just <em>what</em> happens in cognition, but <em>why</em> and <em>how</em> each stage shapes the final experience.
        </p>
      </div>

      {[
        {
          title: "The Mission",
          color: "#7C3AED",
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
          body: "1. Select a stimulus (Ambiguous Face, Street Scene, or Muffled Conversation). 2. Set your brain parameters — try extreme values first to see the effects. 3. Press 'Run Pipeline'. 4. Explore each stage card by clicking to expand details. 5. After the first run, slider changes update results in real time. 6. Use Quick Experiments presets to jump to famous cognitive scenarios.",
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
              <span className="font-mono font-semibold flex-shrink-0 text-[12px]" style={{ color: "#7C3AED", minWidth: 140, fontFamily: "var(--font-mono)" }}>
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
            github.com/Stevemech/build-a-brain — open source educational project
          </p>
        </div>
      </div>

      <p className="text-[11px] text-center pb-4" style={{ color: "var(--color-text-muted)" }}>
        Built for PSYC 203 · Cognitive Psychology · Interactive Simulator v3.0
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
  const tabs: { id: Tab; label: string }[] = [
    { id: "pipeline", label: "Pipeline" },
    { id: "learn", label: "Learn" },
    { id: "about", label: "About" },
  ];

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-8 px-6 md:px-10"
      style={{
        height: 56,
        background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
        backdropFilter: "saturate(140%) blur(14px)",
        WebkitBackdropFilter: "saturate(140%) blur(14px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
            display: "inline-block",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          }}
        />
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
          Build-A-Brain
        </span>
      </div>

      {/* Tabs — minimal underline style */}
      <nav className="flex items-center gap-6" aria-label="Primary">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative text-[13px] font-medium transition-colors"
              style={{
                height: 56,
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
              }}
            >
              {tab.label}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -1,
                  height: 2,
                  borderRadius: 2,
                  background: isActive ? "var(--color-accent)" : "transparent",
                  transition: "background 0.18s ease",
                }}
              />
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
        >
          PSYC 203
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION (with particle background)
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const scrollToSimulator = () => {
    document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative flex flex-col items-center justify-center overflow-hidden bg-grid"
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      {/* Edge-to-edge radial wash behind brain. A single smooth two-stop
          gradient that reaches full transparency *past* the viewport edges,
          so neither the gradient's elliptical falloff nor its container box
          ever show as a visible rectangle or ring. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 100% at 50% 40%, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0) 85%)",
        }}
      />

      {/* Dotted grid overlay with an equally smooth two-stop mask. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-grid"
        style={{
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse 110% 100% at center, black 0%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 110% 100% at center, black 0%, transparent 85%)",
        }}
      />

      {/* 3D Brain */}
      <div className="relative z-10 w-full max-w-2xl h-80 sm:h-[28rem] md:h-[34rem] mb-2">
        <Suspense fallback={<BrainFallback />}>
          <BrainScene />
        </Suspense>
      </div>

      {/* Title */}
      <div className="relative z-10 text-center px-4 max-w-xl">
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[0.95] mb-4"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}
        >
          Build-A-Brain
        </h1>
        <p
          className="text-base sm:text-lg mb-10"
          style={{ color: "var(--color-text-dim)", letterSpacing: "-0.005em", lineHeight: 1.5 }}
        >
          An interactive simulator for the stages of cognitive processing.
        </p>

        {/* CTA */}
        <button
          onClick={scrollToSimulator}
          className="inline-flex items-center gap-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.98]"
          style={{
            padding: "12px 22px",
            borderRadius: 10,
            background: "var(--color-text)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Launch simulator
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="14" height="14">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Hint */}
      <p
        className="absolute bottom-8 text-[11px] uppercase tracking-[0.18em] z-10"
        style={{ color: "var(--color-text-muted)" }}
      >
        Move cursor to rotate
      </p>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-[5]"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-bg))" }}
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
  // Suppress unused import warnings
  void useRef;
  void useEffect;

  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
      <HeroSection />
      <SimulatorSection />
    </div>
  );
}
