// Cognitive Pipeline Simulation Engine
// Models the flow: Stimulus → Sensation → Attention → Perception → Encoding → Storage → Retrieval → Report

export interface PipelineParams {
  attentionalFocus: number;    // 0-100: how focused attention is
  perceptualNoise: number;     // 0-100: noise/clarity of stimulus
  priorExpectation: number;    // 0-100: strength of top-down expectations
  encodingStrength: number;    // 0-100: how deeply info is encoded into memory
  retrievalCue: number;        // 0-100: strength of retrieval cue
}

export interface SubMetric {
  label: string;
  value: number;       // 0-100
  description: string;
}

export interface StageResult {
  stage: string;
  label: string;
  description: string;
  signalStrength: number;      // 0-100
  details: string;
  concept: string;             // the psych concept at play
  subMetrics: SubMetric[];     // breakdown metrics for this stage
  featuresIn: string[];        // features entering this stage
  featuresOut: string[];       // features leaving this stage
  warnings: string[];          // notable effects or distortions
}

export interface Stimulus {
  id: string;
  name: string;
  description: string;
  imageEmoji: string;
  features: string[];          // features that can be perceived
  ambiguousFeatures: string[]; // features affected by expectations
  memoryTrace: string;         // what gets stored in memory
  sceneDescription: string;    // rich description for visualization
  modality: "visual" | "auditory" | "mixed";
}

export const STIMULI: Stimulus[] = [
  {
    id: "face",
    name: "Ambiguous Face",
    description: "A face in a dimly lit room — is the expression happy or anxious?",
    imageEmoji: "🎭",
    features: ["oval shape", "two eyes", "mouth curve", "skin tone", "hair outline"],
    ambiguousFeatures: ["mouth curve (smile or grimace?)", "eyebrow position (relaxed or tense?)", "overall expression"],
    memoryTrace: "A person's face in dim lighting",
    sceneDescription: "A dimly lit room with a figure whose face is partially illuminated by warm lamplight. The expression shifts between contentment and concern.",
    modality: "visual",
  },
  {
    id: "scene",
    name: "Street Scene",
    description: "A busy intersection at dusk — a figure moves between parked cars.",
    imageEmoji: "🌆",
    features: ["street lamps", "parked cars", "crosswalk", "moving figure", "building silhouettes"],
    ambiguousFeatures: ["figure identity (pedestrian or cyclist?)", "movement direction", "time of day (dusk or dawn?)"],
    memoryTrace: "A busy street scene at twilight",
    sceneDescription: "A city intersection at the golden hour. Street lamps flicker on as a figure darts between parked vehicles. Building silhouettes frame an orange-purple sky.",
    modality: "visual",
  },
  {
    id: "sound",
    name: "Muffled Conversation",
    description: "Voices through a wall — are they arguing or laughing?",
    imageEmoji: "🔊",
    features: ["two voices", "rising pitch", "rhythm patterns", "volume changes", "pauses"],
    ambiguousFeatures: ["emotional tone (angry or joyful?)", "word content", "number of speakers"],
    memoryTrace: "Muffled voices through a wall",
    sceneDescription: "Sound waves ripple through a wall. Muffled tones rise and fall — rhythmic bursts that could be heated debate or shared laughter.",
    modality: "auditory",
  },
];

export function runPipeline(stimulus: Stimulus, params: PipelineParams): StageResult[] {
  const stages: StageResult[] = [];
  
  // Use deterministic seed based on params to avoid random flicker
  const seed = (params.attentionalFocus + params.perceptualNoise * 7 + params.priorExpectation * 13 + params.encodingStrength * 19 + params.retrievalCue * 31) % 1000;
  const pseudoRandom = (i: number) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;

  // Stage 1: SENSATION — Raw sensory input
  const sensationStrength = Math.max(5, 100 - params.perceptualNoise * 0.8);
  const featuresDetected = stimulus.features.filter((_, i) => {
    const threshold = (params.perceptualNoise / 100) * 0.6;
    return pseudoRandom(i) > threshold || i < 2;
  });
  
  const clarity = Math.round(100 - params.perceptualNoise);
  const featureDetectionRate = Math.round((featuresDetected.length / stimulus.features.length) * 100);
  const signalToNoise = Math.round(Math.max(0, (100 - params.perceptualNoise * 1.5)));

  stages.push({
    stage: "sensation",
    label: "Sensation",
    description: "Raw sensory data enters the system",
    signalStrength: sensationStrength,
    details: `Detected features: ${featuresDetected.join(", ")}. ${
      params.perceptualNoise > 60 
        ? "Heavy noise is degrading the signal — many details lost." 
        : params.perceptualNoise > 30 
          ? "Some noise present — a few details are unclear." 
          : "Clear signal — most features are well-detected."
    }`,
    concept: "Sensation is the raw, bottom-up process of detecting physical stimuli through our sensory receptors. It converts physical energy (light, sound waves) into neural signals.",
    subMetrics: [
      { label: "Clarity", value: clarity, description: "Signal clarity after noise" },
      { label: "Feature Detection", value: featureDetectionRate, description: "% of features detected" },
      { label: "Signal/Noise", value: signalToNoise, description: "Signal-to-noise ratio" },
    ],
    featuresIn: stimulus.features,
    featuresOut: featuresDetected,
    warnings: params.perceptualNoise > 70 ? ["Critical noise level — significant feature loss"] : [],
  });

  // Stage 2: ATTENTION — Selective filtering
  const attentionStrength = params.attentionalFocus;
  const attendedCount = Math.max(1, Math.ceil(featuresDetected.length * (params.attentionalFocus / 100)));
  const attendedFeatures = featuresDetected.slice(0, attendedCount);
  
  const selectivity = Math.round(params.attentionalFocus * 0.9 + 10);
  const spotlightWidth = Math.round(100 - params.attentionalFocus * 0.7);
  const sustainedFocus = Math.round(Math.min(100, params.attentionalFocus * 1.1));

  stages.push({
    stage: "attention",
    label: "Attention",
    description: "Selective spotlight filters what gets processed",
    signalStrength: attentionStrength,
    details: `Attended to: ${attendedFeatures.join(", ")}. ${
      params.attentionalFocus > 70
        ? "High focus — like a narrow spotlight, deeply processing selected features (but potentially missing peripheral info)."
        : params.attentionalFocus > 35
          ? "Moderate attention — a balanced spotlight capturing several features at reasonable depth."
          : "Low focus — attention is spread thin. Many features get shallow processing, like trying to listen to every conversation at a party."
    }`,
    concept: "Attention acts as a cognitive bottleneck — we can't process everything at once. Broadbent's filter theory and Treisman's attenuation model both describe how attention selects and prioritizes incoming information.",
    subMetrics: [
      { label: "Selectivity", value: selectivity, description: "How precisely attention filters" },
      { label: "Spotlight Width", value: spotlightWidth, description: "Breadth of attentional focus" },
      { label: "Sustained Focus", value: sustainedFocus, description: "Ability to maintain attention" },
    ],
    featuresIn: featuresDetected,
    featuresOut: attendedFeatures,
    warnings: params.attentionalFocus < 25 ? ["Inattentional blindness risk — features may be missed entirely"] : [],
  });

  // Stage 3: PERCEPTION — Interpretation with top-down influence
  const perceptionBase = (sensationStrength * 0.4 + attentionStrength * 0.3);
  const topDownInfluence = params.priorExpectation * 0.3;
  const perceptionStrength = Math.min(100, perceptionBase + topDownInfluence);
  
  const ambiguityResolved = params.priorExpectation > 50;
  const ambiguousInterpretations = stimulus.ambiguousFeatures.map(f => {
    if (ambiguityResolved) {
      return `${f} → resolved by expectation`;
    }
    return `${f} → remains ambiguous`;
  });

  const bottomUpWeight = Math.round(100 - params.priorExpectation * 0.7);
  const topDownWeight = Math.round(params.priorExpectation * 0.8);
  const gestaltGrouping = Math.round(Math.min(100, perceptionStrength * 0.8 + 20));

  const perceivedFeatures = [...attendedFeatures];
  if (ambiguityResolved) {
    perceivedFeatures.push("(expectation-filled details)");
  }

  stages.push({
    stage: "perception",
    label: "Perception",
    description: "Brain interprets and organizes sensory data",
    signalStrength: perceptionStrength,
    details: `${ambiguousInterpretations.join(". ")}. ${
      params.priorExpectation > 70
        ? "Strong prior expectations are heavily shaping perception — you're seeing what you expect to see. This is top-down processing in action."
        : params.priorExpectation > 35
          ? "Some expectations are guiding interpretation of ambiguous features, blending bottom-up data with top-down knowledge."
          : "Perception is mostly data-driven (bottom-up). Ambiguous features remain unresolved without strong expectations."
    }`,
    concept: "Perception is the active, constructive process of organizing and interpreting sensory information. It involves both bottom-up processing (driven by stimulus data) and top-down processing (driven by knowledge, expectations, and context). Gestalt principles help us group features into coherent wholes.",
    subMetrics: [
      { label: "Bottom-Up", value: bottomUpWeight, description: "Data-driven processing strength" },
      { label: "Top-Down", value: topDownWeight, description: "Expectation-driven processing" },
      { label: "Gestalt Grouping", value: gestaltGrouping, description: "Feature organization quality" },
    ],
    featuresIn: attendedFeatures,
    featuresOut: perceivedFeatures,
    warnings: params.priorExpectation > 80 ? ["High expectation bias — perception may not match reality"] : [],
  });

  // Stage 4: ENCODING — Forming a memory trace
  const encodingBase = perceptionStrength * 0.5 + params.encodingStrength * 0.5;
  const encodingResult = Math.min(100, encodingBase);
  
  const encodingType = params.encodingStrength > 70 
    ? "deep (semantic)" 
    : params.encodingStrength > 35 
      ? "moderate (elaborative)" 
      : "shallow (structural)";

  const semanticDepth = Math.round(params.encodingStrength * 0.9);
  const elaboration = Math.round(Math.min(100, params.encodingStrength * 0.7 + perceptionStrength * 0.2));
  const distinctiveness = Math.round(Math.min(100, params.encodingStrength * 0.5 + (100 - params.perceptualNoise) * 0.3 + params.attentionalFocus * 0.2));

  const encodedFeatures = perceivedFeatures.slice(0, Math.max(1, Math.ceil(perceivedFeatures.length * (encodingResult / 100))));

  stages.push({
    stage: "encoding",
    label: "Encoding",
    description: "Perceived information is encoded into memory",
    signalStrength: encodingResult,
    details: `Encoding level: ${encodingType}. ${
      params.encodingStrength > 70
        ? "Deep encoding — creating rich semantic connections and meaningful associations. This information is being linked to existing knowledge networks, making it far more likely to be remembered (Levels of Processing theory)."
        : params.encodingStrength > 35
          ? "Moderate encoding — some meaningful connections are forming, but the trace may not be robust enough for long-term retention."
          : "Shallow encoding — only surface features (shape, sound) are being stored. Without deeper processing, this trace will fade quickly."
    }`,
    concept: "Encoding is the process of transforming perceived information into a memory trace. Craik & Lockhart's Levels of Processing theory shows that deeper, more meaningful encoding (semantic) produces stronger, more durable memories than shallow (structural or phonemic) encoding.",
    subMetrics: [
      { label: "Semantic Depth", value: semanticDepth, description: "Meaning-based processing depth" },
      { label: "Elaboration", value: elaboration, description: "Connection to existing knowledge" },
      { label: "Distinctiveness", value: distinctiveness, description: "How unique the memory trace is" },
    ],
    featuresIn: perceivedFeatures,
    featuresOut: encodedFeatures,
    warnings: params.encodingStrength < 25 ? ["Shallow processing — high forgetting risk"] : [],
  });

  // Stage 5: STORAGE — Memory consolidation
  const storageStrength = encodingResult * 0.7 + (100 - params.perceptualNoise * 0.3);
  const storageResult = Math.min(100, Math.max(5, storageStrength));

  const consolidation = Math.round(Math.min(100, encodingResult * 0.8 + 10));
  const traceStrength = Math.round(storageResult * 0.9);
  const interferenceResistance = Math.round(Math.min(100, params.encodingStrength * 0.5 + params.attentionalFocus * 0.3 + 10));

  stages.push({
    stage: "storage",
    label: "Storage",
    description: "Memory trace is consolidated and maintained",
    signalStrength: storageResult,
    details: `Memory trace: "${stimulus.memoryTrace}" stored with ${storageResult > 70 ? "strong" : storageResult > 35 ? "moderate" : "weak"} consolidation. ${
      encodingResult > 60 
        ? "The well-encoded trace is being consolidated into long-term memory through hippocampal replay."
        : "Weak encoding means the trace is fragile — it may be stored in short-term memory but is unlikely to consolidate fully."
    }`,
    concept: "Memory storage involves maintaining information over time. The multi-store model (Atkinson & Shiffrin) describes how information moves from sensory memory → short-term memory → long-term memory. Consolidation strengthens the memory trace, but the quality depends on how well the information was encoded.",
    subMetrics: [
      { label: "Consolidation", value: consolidation, description: "Transfer to long-term memory" },
      { label: "Trace Strength", value: traceStrength, description: "Durability of the memory" },
      { label: "Interference Resist.", value: interferenceResistance, description: "Resistance to forgetting" },
    ],
    featuresIn: encodedFeatures,
    featuresOut: encodedFeatures,
    warnings: storageResult < 30 ? ["Fragile trace — likely to decay before retrieval"] : [],
  });

  // Stage 6: RETRIEVAL — Accessing stored memories
  const retrievalBase = storageResult * 0.5 + params.retrievalCue * 0.5;
  const retrievalResult = Math.min(100, Math.max(5, retrievalBase));
  
  const retrievalSuccess = retrievalResult > 50;
  const cueEffectiveness = Math.round(params.retrievalCue * 0.85 + 5);
  const contextMatch = Math.round(Math.min(100, params.retrievalCue * 0.6 + params.encodingStrength * 0.3));
  const reconstructionAccuracy = Math.round(Math.min(100, retrievalResult * 0.7 + (100 - params.priorExpectation * 0.3)));

  const retrievedFeatures = encodedFeatures.slice(0, Math.max(1, Math.ceil(encodedFeatures.length * (retrievalResult / 100))));

  stages.push({
    stage: "retrieval",
    label: "Retrieval",
    description: "Attempting to access the stored memory",
    signalStrength: retrievalResult,
    details: `${retrievalSuccess ? "Retrieval successful" : "Retrieval partially failed"} — ${
      params.retrievalCue > 70
        ? "Strong retrieval cues are activating the memory trace effectively. Context-dependent retrieval is helping access the stored information (encoding specificity principle)."
        : params.retrievalCue > 35
          ? "Moderate retrieval cues provide some access, but details may be incomplete or reconstructed."
          : "Weak retrieval cues — the memory trace exists but is hard to access. Like having a word 'on the tip of your tongue' (TOT phenomenon)."
    }`,
    concept: "Retrieval is the process of accessing stored memories. Tulving's encoding specificity principle states that retrieval is most successful when the cues present at retrieval match those present during encoding. Memory isn't like reading a file — it's a reconstructive process.",
    subMetrics: [
      { label: "Cue Effectiveness", value: cueEffectiveness, description: "How well cues activate memory" },
      { label: "Context Match", value: contextMatch, description: "Encoding-retrieval overlap" },
      { label: "Reconstruction", value: reconstructionAccuracy, description: "Accuracy of recall" },
    ],
    featuresIn: encodedFeatures,
    featuresOut: retrievedFeatures,
    warnings: params.retrievalCue < 25 ? ["Tip-of-tongue state — memory exists but is inaccessible"] : [],
  });

  // Stage 7: REPORT — Final output / conscious experience
  const reportStrength = retrievalResult;
  const wasDistortedByExpectations = params.priorExpectation > 60;
  const wasLimitedByAttention = params.attentionalFocus < 40;
  const wasWeaklyEncoded = params.encodingStrength < 35;

  let reportQuality = "accurate";
  const distortions: string[] = [];
  if (wasDistortedByExpectations) distortions.push("expectations filled in ambiguous details (potentially inaccurately)");
  if (wasLimitedByAttention) distortions.push("inattentional blindness may have caused missed features");
  if (wasWeaklyEncoded) distortions.push("shallow encoding led to detail loss");
  if (params.perceptualNoise > 60) distortions.push("noisy input degraded the original signal");
  
  if (distortions.length > 2) reportQuality = "significantly distorted";
  else if (distortions.length > 0) reportQuality = "partially distorted";

  const fidelity = Math.round(Math.max(0, 100 - distortions.length * 22));
  const completeness = Math.round((retrievedFeatures.length / stimulus.features.length) * 100);
  const confidence = Math.round(Math.min(100, reportStrength * 0.6 + params.priorExpectation * 0.3 + 10));

  stages.push({
    stage: "report",
    label: "Report",
    description: "Final conscious output — what you 'remember'",
    signalStrength: reportStrength,
    details: `Output quality: ${reportQuality}. ${
      distortions.length > 0 
        ? `Distortions: ${distortions.join("; ")}.` 
        : "The pipeline preserved the signal well — minimal distortion across all stages."
    } This demonstrates that what we remember is not a perfect recording, but a reconstruction shaped by every stage of cognitive processing.`,
    concept: "The final report — what we consciously experience and remember — is the product of every preceding stage. It shows that cognition is not a camera recording reality, but an active, constructive process where sensation, attention, perception, and memory all interact to create our subjective experience.",
    subMetrics: [
      { label: "Fidelity", value: fidelity, description: "How true to original stimulus" },
      { label: "Completeness", value: completeness, description: "% of original features recalled" },
      { label: "Confidence", value: confidence, description: "Subjective certainty of memory" },
    ],
    featuresIn: retrievedFeatures,
    featuresOut: retrievedFeatures,
    warnings: distortions.length > 2 
      ? ["Memory significantly diverges from original stimulus"] 
      : confidence > 80 && fidelity < 50 
        ? ["High confidence but low fidelity — false memory risk"] 
        : [],
  });

  return stages;
}
