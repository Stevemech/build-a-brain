import { lazy, Suspense, useState, useCallback, useRef, useEffect } from "react";
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

const PARAM_META = [
  {
    key: "attentionalFocus" as keyof PipelineParams,
    label: "Attentional Focus",
    description: "High = narrow deep focus, Low = diffuse awareness",
    color: "#7C3AED",
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
    description: "Signal degradation from high perceptual noise",
    params: { perceptualNoise: 85, attentionalFocus: 50, priorExpectation: 40, encodingStrength: 30, retrievalCue: 35 },
  },
  {
    id: "biased-observer",
    emoji: "🕶️",
    name: "The Biased Observer",
    description: "Top-down distortion and false memories",
    params: { perceptualNoise: 15, attentionalFocus: 80, priorExpectation: 90, encodingStrength: 60, retrievalCue: 55 },
  },
  {
    id: "inattentional-blindness",
    emoji: "👁️",
    name: "Inattentional Blindness",
    description: "Attention as gatekeeper — missing the obvious",
    params: { perceptualNoise: 20, attentionalFocus: 15, priorExpectation: 25, encodingStrength: 50, retrievalCue: 50 },
  },
  {
    id: "deep-vs-shallow",
    emoji: "📚",
    name: "Deep vs. Shallow",
    description: "Toggle between deep and shallow encoding strategies",
    params: { perceptualNoise: 20, attentionalFocus: 65, priorExpectation: 40, encodingStrength: 90, retrievalCue: 60 },
    variantB: { perceptualNoise: 20, attentionalFocus: 65, priorExpectation: 40, encodingStrength: 15, retrievalCue: 60 },
    variantALabel: "Deep (enc=90)",
    variantBLabel: "Shallow (enc=15)",
  },
  {
    id: "tip-of-tongue",
    emoji: "💭",
    name: "Tip of the Tongue",
    description: "Retrieval failure despite solid encoding",
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
// PARTICLE BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: 2 + Math.random() * 3,
  left: 5 + Math.random() * 90,
  bottom: 5 + Math.random() * 40,
  duration: 5 + Math.random() * 6,
  delay: Math.random() * 7,
  drift: (Math.random() - 0.5) * 50,
  opacity: 0.15 + Math.random() * 0.25,
}));

function ParticleBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            opacity: p.opacity,
            "--duration": `${p.duration}s`,
            "--delay": `${p.delay}s`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
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
          background: var(--thumb-color, #7C3AED);
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 8px var(--thumb-color, #7C3AED);
          transition: transform 0.1s;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--thumb-color, #7C3AED);
          cursor: pointer;
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 8px var(--thumb-color, #7C3AED);
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
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "var(--color-text-muted)" }}>
        Signal waveform across stages
      </p>
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
            stroke="#FBF7EC"
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
    <div
      className="rounded-xl flex flex-col items-center justify-center p-4"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 self-start" style={{ color: "var(--color-text-muted)" }}>
        Brain Activity Map
      </p>
      <svg viewBox="0 0 200 180" style={{ width: "100%", maxWidth: 200 }}>
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="#F3F1EE" stroke="#E4E0DA" strokeWidth={1.5} />
        <ellipse cx={100} cy={148} rx={40} ry={22} fill={`rgba(245,158,11,${regionOpacity(0) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={42} rx={50} ry={30} fill={`rgba(139,92,246,${regionOpacity(1) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={52} cy={100} rx={30} ry={38} fill={`rgba(99,102,241,${regionOpacity(2) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={148} cy={100} rx={30} ry={38} fill={`rgba(20,184,166,${regionOpacity(3) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={90} rx={28} ry={28} fill={`rgba(16,185,129,${regionOpacity(4) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={78} cy={55} rx={22} ry={18} fill={`rgba(6,182,212,${regionOpacity(5) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={122} cy={55} rx={22} ry={18} fill={`rgba(59,130,246,${regionOpacity(6) * 0.7})`} style={{ transition: "fill 0.4s" }} />
        <ellipse cx={100} cy={90} rx={85} ry={78} fill="none" stroke="#E4E0DA" strokeWidth={1.5} />
        <rect x={86} y={164} width={28} height={14} rx={6} fill="#F3F1EE" stroke="#E4E0DA" strokeWidth={1} />
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
    <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)", fontSize: "1rem" }}>
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
                  <path d={arcPath(60, 60, 46, -45, 225)} fill="none" stroke="#E4E0DA22" strokeWidth={8} strokeLinecap="round" />
                  <path d={arcPath(60, 60, 32, -45, 225)} fill="none" stroke="#E4E0DA22" strokeWidth={8} strokeLinecap="round" />
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
  onApply: (params: PipelineParams) => void;
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
                const activeParams = variant === "B" && preset.variantB ? preset.variantB : preset.params;

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
                          onClick={() => onApply(activeParams)}
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
// PIPELINE INFORMATION FLOW DIAGRAM (mini circles)
// ─────────────────────────────────────────────────────────────────────────────
function PipelineFlowDiagram({ stages }: { stages: StageResult[] }) {
  const avg = Math.round(stages.reduce((a, s) => a + clamp(s.signalStrength), 0) / stages.length);
  const emoji = avg >= 70 ? "🌟" : avg >= 50 ? "👍" : avg >= 30 ? "🌤" : "🌧";
  const summaryText = avg >= 70
    ? "Your brain processed this really well — strong signal throughout."
    : avg >= 50
    ? "A solid processing run — most stages held up nicely."
    : avg >= 30
    ? "Some signal faded along the way — a few stages struggled."
    : "This was a tough one — the signal had a hard time getting through.";

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "linear-gradient(135deg, var(--color-surface), var(--color-surface-2))", border: "1px solid var(--color-border)" }}
    >
      {/* Friendly summary */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{emoji}</span>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{summaryText}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Average signal strength: {avg}%</p>
        </div>
      </div>

      {/* Stage flow — generous spacing */}
      <div className="flex items-center justify-between gap-0 px-2">
        {stages.map((s, i) => {
          const cfg = STAGE_CONFIG[i];
          const signal = clamp(s.signalStrength) / 100;
          const size = 28 + signal * 12;
          const nextSignal = i < stages.length - 1 ? clamp(stages[i + 1].signalStrength) / 100 : null;

          return (
            <div key={cfg.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ minWidth: 44 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.08, type: "spring", stiffness: 180, damping: 14 }}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    background: `${cfg.color}18`,
                    border: `2px solid ${cfg.color}80`,
                    boxShadow: `0 0 ${signal * 16}px ${cfg.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.5s ease",
                  }}
                >
                  <span style={{ fontSize: 12, color: cfg.color, fontWeight: 700 }}>{Math.round(clamp(s.signalStrength))}</span>
                </motion.div>
                <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.shortLabel}</span>
              </div>
              {nextSignal !== null && (
                <div className="flex-1 flex items-center justify-center px-0.5" style={{ minWidth: 8 }}>
                  <div
                    className="rounded-full w-full"
                    style={{
                      height: Math.max(2, nextSignal * 4),
                      background: `linear-gradient(to right, ${cfg.color}50, ${STAGE_CONFIG[i + 1].color}50)`,
                      transition: "all 0.5s ease",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl p-5"
      style={{ background: "var(--color-surface)", border: "1px solid #7C3AED18" }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "#7C3AED10", border: "1px solid #7C3AED20" }}
        >
          <Quote size={16} color="#7C3AED" />
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

// ── Unique SVG icons per stage ────────────────────────────────────────────────
const STAGE_ICONS_SVG: Record<string, React.ReactNode> = {
  sensation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  attention: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  perception: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  encoding: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  storage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  retrieval: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
};

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
          border: "1.5px solid #D4D3CF",
          background: "#F0E9D6",
          color: "#A39E96",
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
              background: "#1C1916",
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
              borderTop: "5px solid #1C1916",
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ── Scroll-fade wrapper ───────────────────────────────────────────────────────
function ScrollFade({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
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
  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
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
        background: "#FBF7EC",
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
          <span style={{ fontSize: 80, fontWeight: 700, color: "#1C1916", lineHeight: 1, fontFamily: "Lora, Georgia, serif" }}>
            {Math.round(finalSignal)}
          </span>
          <span style={{ fontSize: 28, fontWeight: 400, color: "#A39E96" }}>/100</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          style={{ color: "#A39E96", fontSize: 13, marginBottom: 32, letterSpacing: "0.04em" }}
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
                  opacity: s.signalStrength / 100,
                  minOpacity: 0.2,
                }} />
                <span style={{ fontSize: 9, color: "#A39E96", fontWeight: 600, letterSpacing: "0.05em" }}>
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
            background: "#F0E9D6",
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
              style={{ fontSize: 14, color: "#5C5650", lineHeight: 1.6, marginBottom: i < summaryLines.length - 1 ? 10 : 0 }}
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
            color: "#FBF7EC",
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
  attentionalFocus: "How narrowly focused your attention is. High = deep focus on a few features; Low = diffuse, superficial awareness of everything at once.",
  perceptualNoise: "Environmental interference degrading the signal. High = like listening in a noisy room or seeing through fog. Low = crystal-clear input.",
  priorExpectation: "How strongly your prior knowledge shapes perception. High = brain fills in gaps from expectations; Low = purely data-driven, unbiased processing.",
  encodingStrength: "Depth of memory formation. High = rich semantic encoding (connected to meaning); Low = shallow structural encoding (just the surface form).",
  retrievalCue: "How useful the context cues are when trying to recall. High = retrieval cues closely match encoding context; Low = mismatched or absent cues.",
};

// ── DashCard: scroll-triggered reveal card for dashboard sections ─────────────
function DashCard({ children, label, delay = 0 }: { children: React.ReactNode; label: string; delay?: number }) {
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
        initial={{ opacity: 0, y: 32 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
        style={{
          background: "#FBF7EC",
          border: "1.5px solid #D9CFBB",
          borderRadius: 20,
          padding: "28px 32px",
          marginBottom: 20,
        }}
      >
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          color: "#C4C0BB",
          textTransform: "uppercase",
          marginBottom: 20,
        }}>
          {label}
        </p>
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

  const displayResultsA = comparisonMode ? resultsA : results;
  const displayResultsB = comparisonMode ? resultsB : null;
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
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#A39E96", textTransform: "uppercase", marginBottom: 14 }}>
              Step 1
            </p>
            <h2 style={{ fontSize: 38, fontWeight: 700, color: "#1C1916", marginBottom: 12, letterSpacing: "-0.02em", fontFamily: "Lora, Georgia, serif" }}>
              Choose a stimulus
            </h2>
            <p style={{ fontSize: 17, color: "#5C5650", marginBottom: 44, lineHeight: 1.65 }}>
              Pick the sensory input your brain will process through the pipeline.
            </p>
          </ScrollFade>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {STIMULI.map((s, i) => {
              const isSelected = selectedStimulus.id === s.id;
              return (
                <ScrollFade key={s.id} delay={i * 0.08}>
                  <button
                    onClick={() => handleStimulusSelect(s)}
                    style={{
                      width: "100%",
                      padding: "28px 24px",
                      borderRadius: 20,
                      border: isSelected ? "2px solid #7C3AED" : "1.5px solid #D9CFBB",
                      background: isSelected ? "#7C3AED" : "#FBF7EC",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                      boxShadow: isSelected ? "0 4px 24px rgba(124,58,237,0.3)" : "none",
                    }}
                  >
                    <div style={{
                      color: isSelected ? "#FBF7EC" : "#5C5650",
                      marginBottom: 12,
                      opacity: 0.85,
                    }}>
                      {STIMULUS_ICONS[s.name] ?? <span style={{ fontSize: 28 }}>{s.imageEmoji}</span>}
                    </div>
                    <p style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: isSelected ? "#FBF7EC" : "#1C1916",
                      marginBottom: 4,
                      letterSpacing: "-0.01em",
                    }}>
                      {s.name}
                    </p>
                    <p style={{
                      fontSize: 12,
                      color: isSelected ? "rgba(255,255,255,0.6)" : "#A39E96",
                      lineHeight: 1.45,
                    }}>
                      {s.sceneDescription.slice(0, 60)}…
                    </p>
                    <span style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: isSelected ? "rgba(255,255,255,0.15)" : "#F0E9D6",
                      color: isSelected ? "rgba(255,255,255,0.75)" : "#A39E96",
                    }}>
                      {s.modality}
                    </span>
                  </button>
                </ScrollFade>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 2: Brain parameters ────────────────────────────────── */}
        <div ref={paramsRef} />
        <section style={{ padding: "40px 0 80px" }}>
          <ScrollFade>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", color: "#A39E96", textTransform: "uppercase", marginBottom: 14 }}>
              Step 2
            </p>
            <h2 style={{ fontSize: 38, fontWeight: 700, color: "#1C1916", marginBottom: 12, letterSpacing: "-0.02em", fontFamily: "Lora, Georgia, serif" }}>
              Set brain parameters
            </h2>
            <p style={{ fontSize: 17, color: "#5C5650", marginBottom: 44, lineHeight: 1.65 }}>
              Tune five cognitive knobs. Hover the <span style={{ background: "#F0E9D6", borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 700, color: "#A39E96", border: "1px solid #D9CFBB" }}>i</span> buttons to learn what each one does.
            </p>
          </ScrollFade>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {PARAM_META.map((meta, i) => (
              <ScrollFade key={meta.key} delay={i * 0.06}>
                <div style={{
                  padding: "26px 0",
                  borderBottom: "1px solid #E6DCCA",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        background: meta.color,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#1C1916", letterSpacing: "-0.01em" }}>
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
                      background: "#E6DCCA",
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
                    <span style={{ fontSize: 10, color: "#C4C0BB" }}>{meta.description.split(",")[0].split("=")[1]?.trim() ?? "Low"}</span>
                    <span style={{ fontSize: 10, color: "#C4C0BB" }}>{meta.description.split(",")[1]?.split("=")[1]?.trim() ?? "High"}</span>
                  </div>
                </div>
              </ScrollFade>
            ))}
          </div>

          {/* Quick presets */}
          <ScrollFade delay={0.3}>
            <div style={{ marginTop: 24, marginBottom: 32 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#A39E96", textTransform: "uppercase", marginBottom: 10 }}>
                Quick Experiments
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: "1.5px solid #D9CFBB",
                      background: "#FBF7EC",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#5C5650",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#1C1916";
                      (e.currentTarget as HTMLButtonElement).style.color = "#1C1916";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#D9CFBB";
                      (e.currentTarget as HTMLButtonElement).style.color = "#5C5650";
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{p.emoji}</span>
                    {p.name}
                  </button>
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
                padding: "20px 24px",
                borderRadius: 16,
                border: "none",
                background: "#7C3AED",
                color: "#FBF7EC",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                letterSpacing: "-0.01em",
                boxShadow: "0 4px 28px rgba(124,58,237,0.22)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                <path d="M3 2.5a.5.5 0 01.776-.416l10 5.5a.5.5 0 010 .832l-10 5.5A.5.5 0 013 13.5v-11z"/>
              </svg>
              Run the Pipeline
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
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#A39E96", textTransform: "uppercase", marginBottom: 6 }}>Full Results</p>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1C1916", letterSpacing: "-0.02em", fontFamily: "Lora, Georgia, serif" }}>Pipeline Dashboard</h2>
                  </div>
                </div>

                {/* Dashboard layout: control strip + full-width results */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* ── Top control strip ── */}
                  <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Row 1: Stimulus + Re-run + Compare controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#A39E96", textTransform: "uppercase", flexShrink: 0 }}>Stimulus:</span>
                      {STIMULI.map(s => {
                        const active = selectedStimulus.id === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedStimulus(s)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 999,
                              border: active ? "1.5px solid #7C3AED" : "1.5px solid #D9CFBB",
                              background: active ? "#7C3AED" : "#FBF7EC",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{s.imageEmoji}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: active ? "#FBF7EC" : "#5C5650" }}>{s.name}</span>
                          </button>
                        );
                      })}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button
                          onClick={handleDashboardRun}
                          style={{
                            padding: "8px 18px",
                            borderRadius: 10,
                            border: "none",
                            background: "#7C3AED",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                            boxShadow: "0 2px 10px #7C3AED30",
                            transition: "opacity 0.15s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                        >
                          <Play size={12} />
                          Re-run
                        </button>
                        <button
                          onClick={toggleComparisonMode}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: comparisonMode ? "none" : "1.5px solid #D9CFBB",
                            background: comparisonMode ? "#7C3AED" : "#FBF7EC",
                            color: comparisonMode ? "#fff" : "#5C5650",
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
                            border: "1.5px solid #D9CFBB",
                            background: "#FBF7EC",
                            color: "#A39E96",
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
                      background: "#FBF7EC",
                      border: "1.5px solid #D9CFBB",
                      borderRadius: 12,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                    }}>
                      {/* label */}
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#A39E96", textTransform: "uppercase", flexShrink: 0, marginRight: 16 }}>Params</span>
                      {comparisonMode && (
                        <div style={{ display: "flex", gap: 3, marginRight: 12, flexShrink: 0 }}>
                          {(["A","B"] as const).map(set => (
                            <button key={set} onClick={() => setActiveSet(set)} style={{
                              padding: "2px 8px", borderRadius: 4,
                              border: activeSet === set ? "none" : "1px solid #D9CFBB",
                              background: activeSet === set ? (set === "A" ? "#7C3AED" : "#60a5fa") : "transparent",
                              color: activeSet === set ? "#fff" : "#A39E96",
                              fontSize: 10, fontWeight: 700, cursor: "pointer",
                            }}>{set}</button>
                          ))}
                        </div>
                      )}
                      {/* 5 param sliders in one row */}
                      <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0 }}>
                        {PARAM_META.map(meta => (
                          <div key={meta.key} style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#5C5650", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, marginLeft: "auto", flexShrink: 0 }}>{currentParams[meta.key]}</span>
                            </div>
                            <div style={{ position: "relative", height: 16 }}>
                              <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, borderRadius: 3, background: "#E6DCCA", transform: "translateY(-50%)" }} />
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
                  <main style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {!displayResultsA ? (
                      <div style={{
                        background: "#F0E9D6",
                        borderRadius: 18,
                        padding: "60px 24px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        border: "1.5px solid #D9CFBB",
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
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#1C1916", marginBottom: 6 }}>Ready when you are</p>
                        <p style={{ fontSize: 13, color: "#A39E96", maxWidth: 280, lineHeight: 1.6 }}>
                          Adjust the parameters on the left and hit Re-run to see how your brain processes the stimulus.
                        </p>
                      </div>
                    ) : (
                      <>
                        {comparisonMode && (
                          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                            <span style={{ padding: "4px 12px", borderRadius: 999, background: "#7C3AED18", color: "#7C3AED", fontSize: 12, fontWeight: 700 }}>A: purple</span>
                            <span style={{ padding: "4px 12px", borderRadius: 999, background: "#60a5fa18", color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>B: blue</span>
                          </div>
                        )}

                        {/* 1 — Pipeline flow */}
                        <DashCard delay={0} label="Signal Overview">
                          <PipelineFlowDiagram stages={displayResultsA} />
                        </DashCard>

                        {/* 2 — What happened */}
                        <DashCard delay={0.1} label="What Happened">
                          <ScenarioNarration params={comparisonMode ? (activeSet === "A" ? paramsA : paramsB) : params} />
                        </DashCard>

                        {/* 3 — Stimulus context */}
                        <DashCard delay={0.18} label="Stimulus">
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
                            <span style={{ fontSize: 52 }}>{selectedStimulus.imageEmoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1C1916", letterSpacing: "-0.02em", fontFamily: "Lora, Georgia, serif" }}>{selectedStimulus.name}</h3>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                                  background: selectedStimulus.modality === "auditory" ? "#06b6d412" : "#7C3AED12",
                                  color: selectedStimulus.modality === "auditory" ? "#06b6d4" : "#7C3AED",
                                  textTransform: "uppercase", letterSpacing: "0.06em",
                                }}>
                                  {selectedStimulus.modality}
                                </span>
                              </div>
                              <p style={{ fontSize: 15, color: "#5C5650", lineHeight: 1.65, marginBottom: 14 }}>
                                {selectedStimulus.sceneDescription}
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {selectedStimulus.features.map(f => (
                                  <span key={f} style={{
                                    fontSize: 12, padding: "5px 14px", borderRadius: 999,
                                    background: "#F0E9D6", color: "#78716C", border: "1px solid #D9CFBB",
                                  }}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DashCard>

                        {/* 4 — Signal Journey */}
                        <DashCard delay={0.26} label="Signal Journey">
                          <SignalWaveform stages={displayResultsA} />
                          <div style={{ marginTop: 16 }}>
                            <DistortionTracker stages={displayResultsA} />
                          </div>
                        </DashCard>

                        {/* 5 — Brain + Feature survival */}
                        <DashCard delay={0.34} label="Brain Activity & Feature Survival">
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <BrainHeatmap stages={displayResultsA} />
                            <FeatureSurvivalGrid stimulus={selectedStimulus} stages={displayResultsA} />
                          </div>
                        </DashCard>

                        {/* 6 — Stage breakdown */}
                        <DashCard delay={0.42} label="Stage-by-Stage Breakdown">
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
                        </DashCard>

                        {/* 7 — Summary */}
                        <DashCard delay={0.5} label="Run Summary">
                          <PipelineSummary stages={displayResultsA} stagesB={displayResultsB ?? undefined} />
                        </DashCard>
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
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "pipeline", label: "Pipeline", icon: <Zap size={14} /> },
    { id: "learn", label: "Learn", icon: <BookOpen size={14} /> },
    { id: "about", label: "About", icon: <Info size={14} /> },
  ];

  return (
    <div
      className="sticky top-0 z-40 flex items-center px-6 py-3.5 md:px-10 gap-4"
      style={{
        background: "var(--color-surface)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Brain size={20} color="#7C3AED" strokeWidth={1.5} />
        <span className="text-sm font-bold hidden sm:block" style={{ color: "var(--color-text)" }}>
          Build-A-<span style={{ color: "#7C3AED" }}>Brain</span>
        </span>
      </div>

      {/* Tab pills */}
      <div
        className="flex items-center gap-1 mx-auto rounded-full p-1"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              style={{
                background: isActive ? "#7C3AED" : "transparent",
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
        style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
      >
        PSYC 203
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
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
      }}
    >
      {/* Particle background */}
      <ParticleBackground />

      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "transparent",
        }}
      />

      {/* PSYC 203 badge */}
      <div
        className="relative z-10 mb-6 text-[12px] font-semibold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full"
        style={{ border: "1px solid #7C3AED30", color: "#7C3AED", background: "#EDE9FE" }}
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
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight mb-3" style={{ fontFamily: "var(--font-display)" }}>
          Build-A-<span style={{ color: "#7C3AED" }}>Brain</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl mb-8" style={{ color: "var(--color-text-muted)", letterSpacing: "0.02em" }}>
          Cognitive Pipeline Simulator
        </p>

        {/* CTA */}
        <button
          onClick={scrollToSimulator}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, #7C3AED, #7c3aed)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 32px #7C3AED40",
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
