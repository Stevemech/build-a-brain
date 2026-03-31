import { useState, useCallback, useEffect, useRef, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Eye, Ear, Focus, Database, Search, FileText, Zap,
  ChevronDown, RotateCcw, Info, Sun, Moon, ArrowDown, Sparkles
} from "lucide-react";
import { STIMULI, runPipeline, type PipelineParams, type StageResult, type Stimulus } from "@/lib/pipeline-engine";

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

const STAGE_ACCENT: Record<string, string> = {
  sensation: "text-amber-500 dark:text-amber-400",
  attention: "text-violet-500 dark:text-violet-400",
  perception: "text-indigo-500 dark:text-indigo-400",
  encoding: "text-teal-500 dark:text-teal-400",
  storage: "text-emerald-500 dark:text-emerald-400",
  retrieval: "text-cyan-500 dark:text-cyan-400",
  report: "text-blue-500 dark:text-blue-400",
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

// ─── Components ───────────────────────────────────────────────────

function SignalBar({ strength, color }: { strength: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden backdrop-blur-sm">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${strength}%` }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function StageCard({ result, index, isExpanded, onToggle }: {
  result: StageResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = STAGE_ICONS[result.stage] || Brain;
  const color = STAGE_COLORS[result.stage];
  const accent = STAGE_ACCENT[result.stage];
  const glow = STAGE_GLOW[result.stage];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={`group relative rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 
          cursor-pointer transition-all duration-300 hover:bg-card
          ${isExpanded ? `ring-1 ring-primary/20 shadow-lg ${glow}` : "hover:shadow-md"}`}
        onClick={onToggle}
        data-testid={`stage-card-${result.stage}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${accent} transition-transform duration-300 ${isExpanded ? "scale-110" : "group-hover:scale-105"}`}>
            <Icon className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-sm tracking-tight">{result.label}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {Math.round(result.signalStrength)}%
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </motion.div>
              </div>
            </div>
            <SignalBar strength={result.signalStrength} color={color} />
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
              <div className="mt-4 pt-3 border-t border-border/30 space-y-3">
                <p className="text-sm leading-relaxed text-foreground/80">{result.details}</p>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed text-muted-foreground">{result.concept}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PipelineFlow({ fromStrength, toStrength }: { fromStrength: number; toStrength: number }) {
  const avg = (fromStrength + toStrength) / 2;
  return (
    <div className="flex justify-center py-0.5">
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 0.15 + (avg / 100) * 0.5, scaleY: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-0.5"
      >
        <div className="w-px h-3 bg-gradient-to-b from-primary/40 to-primary/10" />
        <ChevronDown className="w-3 h-3 text-primary/40" />
      </motion.div>
    </div>
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

function StimulusCard({ stimulus, isSelected, onSelect }: {
  stimulus: Stimulus;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
        isSelected
          ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/5"
          : "border-border/50 bg-card/50 hover:border-primary/20 hover:bg-card/80"
      }`}
      data-testid={`stimulus-${stimulus.id}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{stimulus.imageEmoji}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">{stimulus.name}</div>
          <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{stimulus.description}</div>
        </div>
      </div>
    </motion.button>
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
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* 3D Brain */}
      <div className="relative w-full h-[50vh] max-h-[500px]">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="w-24 h-24 text-violet-400/50" />
            </motion.div>
          </div>
        }>
          <BrainScene />
        </Suspense>
      </div>

      {/* Title */}
      <motion.div
        className="relative text-center z-10 -mt-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-2 mb-3"
        >
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-lg text-white/40 tracking-wide font-light"
        >
          Cognitive Pipeline Simulator
        </motion.p>
      </motion.div>

      {/* Enter button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
        className="relative z-10 mt-10"
      >
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

      {/* Bottom hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 text-white/20 text-xs tracking-widest uppercase"
      >
        Move your cursor to rotate the brain
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function Home() {
  const [showLanding, setShowLanding] = useState(true);
  const [isDark, setIsDark] = useState(true); // default dark for the sci theme
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Auto-run pipeline whenever params or stimulus change (if a simulation has been run before)
  const hasRun = useRef(false);
  
  const runSimulation = useCallback(() => {
    const pipelineResults = runPipeline(selectedStimulus, params);
    setResults(pipelineResults);
    hasRun.current = true;
  }, [selectedStimulus, params]);

  // Re-run when sliders change after initial run
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
  }, []);

  return (
    <>
      {/* Landing Page */}
      <AnimatePresence>
        {showLanding && (
          <LandingHero onEnter={() => setShowLanding(false)} />
        )}
      </AnimatePresence>

      {/* Main App */}
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
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              Pipeline Output
                            </h3>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60">Click to expand</p>
                        </div>
                        {results.map((result, i) => (
                          <div key={result.stage}>
                            <StageCard
                              result={result}
                              index={i}
                              isExpanded={expandedStage === result.stage}
                              onToggle={() => setExpandedStage(
                                expandedStage === result.stage ? null : result.stage
                              )}
                            />
                            {i < results.length - 1 && (
                              <PipelineFlow
                                fromStrength={result.signalStrength}
                                toStrength={results[i + 1].signalStrength}
                              />
                            )}
                          </div>
                        ))}
                        
                        {/* Summary */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 }}
                          className="mt-4"
                        >
                          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/5 to-indigo-500/5 
                            border border-primary/10 backdrop-blur-sm">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                              Summary
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Signal entered at <strong className="text-foreground">{Math.round(results[0].signalStrength)}%</strong>
                              {" → "}emerged at <strong className="text-foreground">{Math.round(results[results.length - 1].signalStrength)}%</strong>.
                              {" "}
                              {results[results.length - 1].signalStrength < results[0].signalStrength * 0.5
                                ? "Significant degradation — cognitive bottlenecks dramatically altered the output."
                                : results[results.length - 1].signalStrength > results[0].signalStrength * 0.8
                                  ? "Signal preserved well, but top-down processes may have filled in inaccurate details."
                                  : "Moderate transformation — each stage shaped the information constructively."
                              }
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {results.map((r) => (
                                <span key={r.stage}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono tabular-nums 
                                    px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground">
                                  {r.label} {Math.round(r.signalStrength)}%
                                </span>
                              ))}
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
