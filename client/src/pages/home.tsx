import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Eye, Ear, Focus, Database, Search, FileText, Zap, ChevronRight, RotateCcw, Info, Sun, Moon } from "lucide-react";
import { STIMULI, runPipeline, type PipelineParams, type StageResult, type Stimulus } from "@/lib/pipeline-engine";

const STAGE_ICONS: Record<string, typeof Brain> = {
  sensation: Eye,
  attention: Focus,
  perception: Brain,
  encoding: Database,
  storage: Zap,
  retrieval: Search,
  report: FileText,
};

const STAGE_COLORS: Record<string, string> = {
  sensation: "from-amber-500 to-orange-500",
  attention: "from-violet-500 to-purple-500",
  perception: "from-indigo-500 to-blue-500",
  encoding: "from-teal-500 to-emerald-500",
  storage: "from-emerald-500 to-green-500",
  retrieval: "from-cyan-500 to-blue-500",
  report: "from-blue-500 to-indigo-500",
};

const STAGE_BG: Record<string, string> = {
  sensation: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300",
  attention: "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-300",
  perception: "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  encoding: "bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300",
  storage: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  retrieval: "bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  report: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
};

function SignalBar({ strength, color }: { strength: number; color: string }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${strength}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
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
  const bg = STAGE_BG[result.stage];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card
        className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
          isExpanded ? "ring-1 ring-primary/30" : ""
        }`}
        onClick={onToggle}
        data-testid={`stage-card-${result.stage}`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg border ${bg} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm">{result.label}</h3>
              <span className="text-xs font-mono text-muted-foreground">{Math.round(result.signalStrength)}%</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{result.description}</p>
            <SignalBar strength={result.signalStrength} color={color} />
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                <div className="text-sm leading-relaxed">{result.details}</div>
                <div className={`text-xs p-3 rounded-lg border ${bg}`}>
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{result.concept}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function PipelineConnector({ fromStrength, toStrength }: { fromStrength: number; toStrength: number }) {
  const avgStrength = (fromStrength + toStrength) / 2;
  const opacity = 0.2 + (avgStrength / 100) * 0.6;
  return (
    <div className="flex justify-center py-1">
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.3 }}
        style={{ opacity }}
      >
        <ChevronRight className="w-4 h-4 rotate-90 text-primary" />
      </motion.div>
    </div>
  );
}

function ParamSlider({ label, value, onChange, description, icon: Icon }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  description: string;
  icon: typeof Brain;
}) {
  return (
    <div className="space-y-2" data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StimulusSelector({ stimuli, selected, onSelect }: {
  stimuli: Stimulus[];
  selected: Stimulus;
  onSelect: (s: Stimulus) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {stimuli.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`text-left p-3 rounded-lg border transition-all duration-200 ${
            selected.id === s.id
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border hover:border-primary/30 hover:bg-muted/50"
          }`}
          data-testid={`stimulus-${s.id}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{s.imageEmoji}</span>
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function BrainLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none" aria-label="Build-A-Brain logo">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      <path d="M11 16c0-3 2-5.5 5-5.5s5 2.5 5 5.5-2 5.5-5 5.5-5-2.5-5-5.5z" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      <path d="M16 10.5v-3M16 24.5v-3M10.5 16h-3M24.5 16h-3" stroke="currentColor" strokeWidth="1.2" className="text-primary/60" />
      <circle cx="16" cy="16" r="2" fill="currentColor" className="text-primary" />
      <path d="M12 12l-2-2M20 12l2-2M12 20l-2 2M20 20l2 2" stroke="currentColor" strokeWidth="1" className="text-primary/40" />
    </svg>
  );
}

export default function Home() {
  const [isDark, setIsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
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

  const runSimulation = useCallback(() => {
    const pipelineResults = runPipeline(selectedStimulus, params);
    setResults(pipelineResults);
    setExpandedStage(null);
  }, [selectedStimulus, params]);

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
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrainLogo />
            <div>
              <h1 className="text-sm font-semibold tracking-tight leading-none">Build-A-Brain</h1>
              <p className="text-[10px] text-muted-foreground">Cognitive Pipeline Simulator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-mono">PSYC 203</Badge>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
              data-testid="theme-toggle"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-8 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold tracking-tight mb-2">
              How does your brain process information?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Adjust the sliders to tune your cognitive "brain" parameters, select a stimulus, 
              and watch how the same input gets processed differently through the pipeline — 
              from raw sensation to final memory report. Every stage interacts with the others, 
              showing how <strong>Sensation & Perception</strong>, <strong>Attention</strong>, 
              and <strong>Memory</strong> are deeply interconnected.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="learn" data-testid="tab-learn">Learn</TabsTrigger>
            <TabsTrigger value="about" data-testid="tab-about">About</TabsTrigger>
          </TabsList>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Controls */}
              <div className="lg:col-span-4 space-y-5">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Select Stimulus</h3>
                  <StimulusSelector
                    stimuli={STIMULI}
                    selected={selectedStimulus}
                    onSelect={setSelectedStimulus}
                  />
                </Card>

                <Card className="p-4 space-y-5">
                  <h3 className="text-sm font-semibold">Tune the Brain</h3>
                  
                  <ParamSlider
                    label="Attentional Focus"
                    value={params.attentionalFocus}
                    onChange={(v) => setParams(p => ({ ...p, attentionalFocus: v }))}
                    description="How narrowly focused is attention? High = deep focus on few features. Low = diffuse, spread-thin attention."
                    icon={Focus}
                  />
                  
                  <ParamSlider
                    label="Perceptual Noise"
                    value={params.perceptualNoise}
                    onChange={(v) => setParams(p => ({ ...p, perceptualNoise: v }))}
                    description="How much noise degrades the incoming signal? High = unclear, degraded input. Low = crisp, clear stimulus."
                    icon={Ear}
                  />
                  
                  <ParamSlider
                    label="Prior Expectations"
                    value={params.priorExpectation}
                    onChange={(v) => setParams(p => ({ ...p, priorExpectation: v }))}
                    description="How strongly do existing beliefs shape perception? High = strong top-down influence. Low = mostly data-driven."
                    icon={Brain}
                  />
                  
                  <ParamSlider
                    label="Encoding Strength"
                    value={params.encodingStrength}
                    onChange={(v) => setParams(p => ({ ...p, encodingStrength: v }))}
                    description="How deeply is information encoded into memory? High = deep semantic processing. Low = shallow surface encoding."
                    icon={Database}
                  />
                  
                  <ParamSlider
                    label="Retrieval Cue"
                    value={params.retrievalCue}
                    onChange={(v) => setParams(p => ({ ...p, retrievalCue: v }))}
                    description="How strong are the cues when trying to remember? High = context matches encoding. Low = poor retrieval support."
                    icon={Search}
                  />

                  <div className="flex gap-2 pt-1">
                    <Button onClick={runSimulation} className="flex-1" data-testid="run-button">
                      <Zap className="w-4 h-4 mr-1.5" />
                      Run Pipeline
                    </Button>
                    <Button variant="outline" onClick={resetParams} data-testid="reset-button">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right: Pipeline Results */}
              <div className="lg:col-span-8">
                {results ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold">Pipeline Output</h3>
                      <p className="text-xs text-muted-foreground">Click any stage to expand</p>
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
                          <PipelineConnector
                            fromStrength={result.signalStrength}
                            toStrength={results[i + 1].signalStrength}
                          />
                        )}
                      </div>
                    ))}
                    
                    {/* Summary Card */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Card className="p-4 mt-4 bg-primary/5 border-primary/20">
                        <h4 className="text-sm font-semibold mb-2">Pipeline Summary</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          The signal entered at <strong>{Math.round(results[0].signalStrength)}%</strong> strength 
                          and emerged as a memory report at <strong>{Math.round(results[results.length - 1].signalStrength)}%</strong>.
                          {" "}
                          {results[results.length - 1].signalStrength < results[0].signalStrength * 0.5
                            ? "Significant signal degradation occurred — demonstrating how cognitive bottlenecks can dramatically alter what we remember compared to what was actually present."
                            : results[results.length - 1].signalStrength > results[0].signalStrength * 0.8
                              ? "The pipeline preserved the signal well, but remember: preservation doesn't mean accuracy. Top-down processes may have 'filled in' details that weren't in the original stimulus."
                              : "Moderate signal transformation occurred — each stage shaped the information, showing the constructive nature of cognition."
                          }
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {results.map((r) => (
                            <Badge key={r.stage} variant="secondary" className="text-[10px] font-mono">
                              {r.label}: {Math.round(r.signalStrength)}%
                            </Badge>
                          ))}
                        </div>
                      </Card>
                    </motion.div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    </motion.div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">No simulation running</h3>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Choose a stimulus, adjust your brain parameters, then click "Run Pipeline" to see how information flows through the cognitive system.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Learn Tab */}
          <TabsContent value="learn" className="space-y-6">
            <div className="max-w-3xl space-y-6">
              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">The Cognitive Pipeline</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  The brain doesn't passively record reality — it actively constructs our experience through 
                  a series of interconnected processing stages. This simulator models that pipeline, 
                  letting you see how changing one parameter ripples through the entire system.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      title: "Bottom-Up vs Top-Down",
                      desc: "Sensation feeds data upward (bottom-up), while expectations and knowledge flow downward (top-down). Perception sits at the intersection.",
                      icon: "↕️"
                    },
                    {
                      title: "Attentional Bottleneck",
                      desc: "We can't process everything. Attention acts as a selective filter, determining which sensory information reaches deeper processing stages.",
                      icon: "🔍"
                    },
                    {
                      title: "Levels of Processing",
                      desc: "Craik & Lockhart showed that deeper, more meaningful encoding produces stronger memories than shallow, surface-level processing.",
                      icon: "📊"
                    },
                    {
                      title: "Encoding Specificity",
                      desc: "Tulving's principle: retrieval works best when the context at recall matches the context at encoding. Memory is context-dependent.",
                      icon: "🔑"
                    },
                  ].map((item) => (
                    <div key={item.title} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">{item.icon}</span>
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">Topic Integration: How They Connect</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  This project doesn't treat Sensation & Perception, Attention, and Memory as isolated modules. 
                  Instead, it shows their deep integration:
                </p>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <h4 className="text-sm font-semibold mb-1">Sensation → Perception → Memory</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      What you sense determines what you can perceive. What you perceive determines what gets encoded. 
                      Try running the pipeline with high perceptual noise — you'll see how degraded sensation 
                      propagates through perception and weakens the final memory. The pipeline is a cause-and-effect chain.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <h4 className="text-sm font-semibold mb-1">Attention as Gatekeeper</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Attention sits between sensation and perception, filtering what gets through. 
                      Low attentional focus means more data is lost before it can be perceived and encoded. 
                      This demonstrates inattentional blindness and the limited capacity of working memory.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <h4 className="text-sm font-semibold mb-1">Top-Down Processing Shapes Memory</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When prior expectations are high, perception resolves ambiguity by "filling in" details — 
                      but those filled-in details may not match reality. The memory stage then stores this 
                      interpretation as if it were fact, demonstrating how expectations can create false memories.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">Try These Experiments</h3>
                <div className="space-y-2">
                  {[
                    {
                      name: "The Noisy Room",
                      config: "Set Perceptual Noise to 90, everything else to 50",
                      prediction: "Watch how noisy input degrades every downstream stage"
                    },
                    {
                      name: "The Biased Observer",
                      config: "Set Prior Expectations to 95, Perceptual Noise to 60",
                      prediction: "See how expectations 'fill in' what noise obscures — for better or worse"
                    },
                    {
                      name: "Inattentional Blindness",
                      config: "Set Attentional Focus to 10, everything else moderate",
                      prediction: "Observe how spreading attention too thin causes feature loss"
                    },
                    {
                      name: "Deep vs Shallow Processing",
                      config: "Run twice: once with Encoding at 90, once at 10",
                      prediction: "Compare how encoding depth affects the final memory report"
                    },
                    {
                      name: "Tip of the Tongue",
                      config: "Set Encoding to 70 (strong memory), Retrieval Cue to 10 (weak cue)",
                      prediction: "The memory exists but can't be accessed — classic TOT phenomenon"
                    },
                  ].map((exp, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">Experiment {i + 1}</Badge>
                        <h4 className="text-sm font-semibold">{exp.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground"><strong>Setup:</strong> {exp.config}</p>
                      <p className="text-xs text-muted-foreground"><strong>Observe:</strong> {exp.prediction}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            <div className="max-w-3xl space-y-6">
              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">About This Project</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  This is the <strong>Cognitive Pipeline Simulator</strong> — a Build-A-Brain project for 
                  PSYC 203 at Rice University. It represents the brain as an interactive information-processing 
                  pipeline, allowing users to explore how cognitive processes transform raw sensory input into 
                  conscious experience and memory.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The project integrates <strong>Sensation & Perception</strong> and <strong>Memory</strong> 
                  (with <strong>Attention</strong> as a bridging mechanism) by modeling them as interconnected 
                  stages in a single processing chain. Rather than treating these topics in isolation, the 
                  simulator shows how a change at any stage propagates through the entire system — just like 
                  in the real brain.
                </p>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">Cognitive Science Concepts</h3>
                <div className="space-y-2">
                  {[
                    { term: "Bottom-Up Processing", def: "Data-driven processing that starts with sensory input and builds up to perception" },
                    { term: "Top-Down Processing", def: "Knowledge-driven processing where expectations and prior experience shape perception" },
                    { term: "Broadbent's Filter Theory", def: "Attention acts as an early filter, selecting information based on physical characteristics" },
                    { term: "Treisman's Attenuation Model", def: "Unattended information is weakened (attenuated) rather than completely blocked" },
                    { term: "Inattentional Blindness", def: "Failure to notice unexpected stimuli when attention is focused elsewhere" },
                    { term: "Gestalt Principles", def: "Perceptual rules (proximity, similarity, closure) that help organize sensory input into coherent objects" },
                    { term: "Levels of Processing (Craik & Lockhart)", def: "Deeper, more meaningful encoding produces stronger, more durable memories" },
                    { term: "Multi-Store Model (Atkinson & Shiffrin)", def: "Memory flows from sensory → short-term → long-term storage" },
                    { term: "Encoding Specificity (Tulving)", def: "Retrieval is most effective when cues at recall match those present during encoding" },
                    { term: "Reconstructive Memory", def: "Memory recall is not playback — it's an active reconstruction influenced by schemas and post-event information" },
                  ].map((item) => (
                    <div key={item.term} className="flex gap-2 text-sm">
                      <span className="font-semibold shrink-0 min-w-[200px]">{item.term}</span>
                      <span className="text-muted-foreground">{item.def}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-bold mb-3">Technical Details</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                  Built with React, TypeScript, and Tailwind CSS. The simulation engine models signal propagation 
                  through seven cognitive stages, where each stage's output depends on the previous stage's result 
                  and the user-configured parameters.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The pipeline is deterministic for a given set of parameters (with minor randomness in feature detection 
                  to simulate perceptual noise), allowing users to systematically explore how individual parameter 
                  changes affect the entire chain.
                </p>
              </Card>

              <Card className="p-5">
                <p className="text-xs text-muted-foreground text-center">
                  Steve Zhang · PSYC 203 · Rice University · Spring 2026
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
