import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { PromptEditor } from "@/components/PromptEditor";
import { ModelControls } from "@/components/ModelControls";
import { TokenTimeline, Token } from "@/components/TokenTimeline";
import { CoTPanel, CoTStep } from "@/components/CoTPanel";
import { AttentionHeatmap } from "@/components/AttentionHeatmap";
import { SessionShare } from "@/components/SessionShare";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Cpu, Bot, GitBranch, Share2, Info } from "lucide-react";

// Demo data for showcase
const generateDemoTokens = (): Token[] => {
  const words = ["The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog", "in", "the", "garden"];
  return words.map((word, i) => ({
    id: `token-${i}`,
    text: word,
    activation: Math.random() * 0.8 + 0.2,
    probabilities: [
      { token: word, prob: Math.random() * 0.5 + 0.5 },
      { token: "alt1", prob: Math.random() * 0.3 },
      { token: "alt2", prob: Math.random() * 0.2 },
    ],
    timestamp: Date.now() + i * 100,
  }));
};

const demoCoTSteps: CoTStep[] = [
  {
    id: "step-1",
    stepNumber: 1,
    summary: "Understanding the context",
    fullText: "The model first analyzes the input prompt to understand the overall context and intent. It identifies key entities and relationships between them.",
    tokenRange: [0, 3],
  },
  {
    id: "step-2",
    stepNumber: 2,
    summary: "Planning response structure",
    fullText: "Based on the context, the model plans the structure of its response. It determines what information needs to be conveyed and in what order.",
    tokenRange: [4, 7],
  },
  {
    id: "step-3",
    stepNumber: 3,
    summary: "Generating output",
    fullText: "The model generates the output tokens while maintaining coherence with the planned structure and original context.",
    tokenRange: [8, 11],
  },
];

const generateDemoHeatmap = (size: number): number[][] => {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      const distance = Math.abs(i - j);
      return Math.max(0, 1 - distance / size) * Math.random();
    })
  );
};

export default function Playground() {
  const [model, setModel] = useState("gpt-4");
  const [temperature, setTemperature] = useState(0.7);
  const [isRunning, setIsRunning] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [cotSteps, setCoTSteps] = useState<CoTStep[]>([]);
  const [sessionId] = useState("demo-session-123");

  // Heatmap state
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [selectedHead, setSelectedHead] = useState(0);
  const [averageHeads, setAverageHeads] = useState(false);
  const [heatmapData, setHeatmapData] = useState<number[][] | undefined>();
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);

  const handleRun = async (prompt: string, enableCoT: boolean) => {
    setIsRunning(true);
    setTokens([]);
    setCoTSteps([]);
    setHeatmapData(undefined);
    setSelectedTokenId(null);

    // Simulate streaming tokens
    const demoTokens = generateDemoTokens();
    for (let i = 0; i < demoTokens.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setTokens((prev) => [...prev, demoTokens[i]]);
    }

    // Load CoT steps
    if (enableCoT) {
      setCoTSteps(demoCoTSteps);
    }

    // Load heatmap
    setIsLoadingHeatmap(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setHeatmapData(generateDemoHeatmap(12));
    setIsLoadingHeatmap(false);

    setIsRunning(false);
  };

  const handleCancel = () => {
    setIsRunning(false);
  };

  const handleHighlightTokens = (tokenRange: [number, number]) => {
    const [start, end] = tokenRange;
    if (tokens[start]) {
      setSelectedTokenId(tokens[start].id);
      // Scroll to token would happen here
    }
  };

  const scrollToPrompt = () => {
    const el = document.getElementById("prompt-editor");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <Header selectedModel={model} onModelChange={setModel} />

      <main className="flex-1">
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero removed per design request - minimal top spacing */}
          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Column - 7 columns */}
            <div className="lg:col-span-7 space-y-8" style={{ animationDelay: "100ms" }}>
              {/* Prompt Editor */}
              <div id="prompt-editor">
                <Card className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Prompt Editor</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent>
                  <PromptEditor
                    onRun={handleRun}
                    isRunning={isRunning}
                    onCancel={handleCancel}
                  />
                </CardContent>
                </Card>
              </div>

              {/* Model Controls */}
              <Card
                className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up"
                style={{ animationDelay: "200ms" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    <span>Model Configuration</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent>
                  <ModelControls
                    temperature={temperature}
                    onTemperatureChange={setTemperature}
                    model={model}
                    onModelChange={setModel}
                  />
                </CardContent>
              </Card>

              {/* Token Timeline */}
              <Card
                className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up"
                style={{ animationDelay: "300ms" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    <span>Token Timeline</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent>
                  <TokenTimeline
                    tokens={tokens}
                    selectedTokenId={selectedTokenId}
                    onTokenSelect={setSelectedTokenId}
                    isStreaming={isRunning}
                  />
                </CardContent>
              </Card>

              {/* Chain of Thought */}
              <Card
                className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up"
                style={{ animationDelay: "400ms" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    <span>Chain of Thought</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent>
                  <CoTPanel
                    steps={cotSteps}
                    onHighlightTokens={handleHighlightTokens}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - 5 columns */}
            <div className="lg:col-span-5 space-y-6">
              {/* Attention Heatmap */}
              <Card
                className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up"
                style={{ animationDelay: "500ms" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    <span>Attention Heatmap</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent>
                  <AttentionHeatmap
                    isLoading={isLoadingHeatmap}
                    layers={12}
                    heads={8}
                    selectedLayer={selectedLayer}
                    selectedHead={selectedHead}
                    onLayerChange={setSelectedLayer}
                    onHeadChange={setSelectedHead}
                    averageHeads={averageHeads}
                    onAverageHeadsChange={setAverageHeads}
                    matrixData={heatmapData}
                  />
                </CardContent>
              </Card>

              {/* Model Info */}
              <Card
                className="glass-card group hover:bg-white/10 transition-colors duration-300 stagger animate-slide-up"
                style={{ animationDelay: "600ms" }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    <span>Model Information</span>
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Architecture</div>
                    <div className="text-sm font-medium">Transformer (12 layers, 8 heads)</div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Parameters</div>
                    <div className="text-sm font-medium">~350M parameters</div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Context Window</div>
                    <div className="text-sm font-medium">8,192 tokens</div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Share */}
              <div
                className="stagger animate-slide-up"
                style={{ animationDelay: "700ms" }}
              >
                <SessionShare sessionId={sessionId} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}