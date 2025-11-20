import { useState, useEffect, useRef } from "react";
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

export default function Playground() {
  const [model, setModel] = useState("gpt-4");
  const [temperature, setTemperature] = useState(0.7);
  const [isRunning, setIsRunning] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [cotSteps, setCoTSteps] = useState<CoTStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const ws = useRef<WebSocket | null>(null);

  // Heatmap state
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [selectedHead, setSelectedHead] = useState(0);
  const [averageHeads, setAverageHeads] = useState(false);
  const [heatmapData, setHeatmapData] = useState<number[][] | undefined>();
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);

  const handleRun = async (prompt: string, enableCoT: boolean) => {
    setPrompt(prompt);
    setIsRunning(true);
    setTokens([]);
    setCoTSteps([]);
    setHeatmapData(undefined);
    setSelectedTokenId(null);
    setSessionId(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          cot: enableCoT,
          stream: true,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start analysis session");
      }

      const data = await response.json();
      setSessionId(data.session_id);

      const wsUrl = `ws://${window.location.host}${data.ws_url}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        ws.current?.send(JSON.stringify({ client_id: "frontend" }));
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.message_type === "token_partial") {
          const newToken = {
            id: `token-${message.token_index}`,
            text: message.token_string,
            activation: Math.random(),
            probabilities: [],
            timestamp: Date.now(),
          };
          setTokens((prev) => [...prev, newToken]);
        } else if (message.message_type === "generation_end") {
          setIsRunning(false);
        }
      };

      ws.current.onclose = () => {
        setIsRunning(false);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsRunning(false);
      };

    } catch (error) {
      console.error("Error running analysis:", error);
      setIsRunning(false);
    }
  };
  
    useEffect(() => {
    if (sessionId && !isRunning) {
      const interval = setInterval(() => {
        fetchTraces(sessionId);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [sessionId, isRunning]);

  useEffect(() => {
    if (prompt) {
      handleRun(prompt, true);
    }
  }, [temperature]);

  useEffect(() => {
    if (sessionId) {
      fetchHeatmap();
    }
  }, [selectedLayer, selectedHead, averageHeads]);


  const fetchHeatmap = async () => {
    if (!sessionId) return;
    setIsLoadingHeatmap(true);
    try {
      const response = await fetch(`/api/session/${sessionId}/artifact/attention_rollout?layer=${selectedLayer}&head=${selectedHead}&average=${averageHeads}`);
      if(response.ok) {
        const heatmapJson = await response.json();
        setHeatmapData(heatmapJson.data);
      }
    } catch (error) {
      console.error("Error fetching heatmap:", error);
    } finally {
      setIsLoadingHeatmap(false);
    }
  };

  const fetchTraces = async (sessionId: string) => {
    try {
      setIsLoadingHeatmap(true);
      const response = await fetch(`/api/session/${sessionId}/traces`);
      if(response.ok) {
        const traces = await response.json();
          if (traces.status === "completed") {
            fetchHeatmap();
            if (traces.precomputed && traces.precomputed.length > 0) {
                const cotArtifact = traces.precomputed.find((p: any) => p.name === "cot_steps");
                if (cotArtifact) {
                    const cotResponse = await fetch(`/api/session/${sessionId}/artifact/cot_steps`);
                    if(cotResponse.ok) {
                        const cotJson = await cotResponse.json();
                        setCoTSteps(cotJson.data);
                    }
                }
            }
        }
      }
    } catch (error) {
        console.error("Error fetching traces:", error);
    } finally {
        setIsLoadingHeatmap(false);
    }
  };


  const handleCancel = () => {
    if (ws.current) {
      ws.current.close();
    }
    setIsRunning(false);
  };

  const handleHighlightTokens = (tokenRange: [number, number]) => {
    const [start, end] = tokenRange;
    if (tokens[start]) {
      setSelectedTokenId(tokens[start].id);
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <Header />

      <main className="flex-1">
        <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 space-y-8" style={{ animationDelay: "100ms" }}>
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

            <div className="lg:col-span-5 space-y-6">
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

              {sessionId &&
                <div
                  className="stagger animate-slide-up"
                  style={{ animationDelay: "700ms" }}
                >
                  <SessionShare sessionId={sessionId} />
                </div>
              }
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}