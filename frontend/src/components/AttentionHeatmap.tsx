import { useEffect, useRef, useState } from "react";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Loader2 } from "lucide-react";

interface AttentionHeatmapProps {
  isLoading: boolean;
  layers: number;
  heads: number;
  selectedLayer: number;
  selectedHead: number;
  onLayerChange: (layer: number) => void;
  onHeadChange: (head: number) => void;
  averageHeads: boolean;
  onAverageHeadsChange: (average: boolean) => void;
  matrixData?: number[][];
}

export const AttentionHeatmap = ({
  isLoading,
  layers,
  heads,
  selectedLayer,
  selectedHead,
  onLayerChange,
  onHeadChange,
  averageHeads,
  onAverageHeadsChange,
  matrixData,
}: AttentionHeatmapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    source: number;
    target: number;
    weight: number;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !matrixData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Resize for high-DPI displays so the heatmap is crisp
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = matrixData.length;

    // Make canvas square based on available width
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.width * dpr));

    // Reset transform and scale to device pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cellSize = rect.width / size;

    // Clear canvas (use CSS pixel size)
    ctx.clearRect(0, 0, rect.width, rect.width);

    // Color mapping: interpolate hue/lightness from cool -> warm
    const colorFor = (v: number) => {
      // v is between 0..1
      // Hue: 220 (blue) -> 20 (orange/red)
      const h = 220 - 200 * Math.min(1, Math.max(0, v));
      const s = 75;
      const l = 78 - 55 * Math.min(1, Math.max(0, v));
      return `hsl(${h} ${s}% ${l}%)`;
    };

    // Draw heatmap cells
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const value = Math.max(0, Math.min(1, matrixData[i][j]));
        ctx.fillStyle = colorFor(value);
        ctx.globalAlpha = 1; // color already encodes intensity
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }

    // Draw subtle grid lines in CSS pixels
    ctx.setLineDash([]);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i <= size; i++) {
      const pos = i * cellSize;
      // vertical
      ctx.beginPath();
      ctx.moveTo(pos + 0.25, 0);
      ctx.lineTo(pos + 0.25, rect.width);
      ctx.stroke();
      // horizontal
      ctx.beginPath();
      ctx.moveTo(0, pos + 0.25);
      ctx.lineTo(rect.width, pos + 0.25);
      ctx.stroke();
    }
  }, [matrixData]);

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !matrixData) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const size = matrixData.length;
    const cellSize = canvasRef.current.width / size;

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (row >= 0 && row < size && col >= 0 && col < size) {
      setHoveredCell({
        source: col,
        target: row,
        weight: matrixData[row][col],
      });
    } else {
      setHoveredCell(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[140px] space-y-2">
          <Label className="text-sm font-medium">Layer</Label>
          <Select
            value={selectedLayer.toString()}
            onValueChange={(v) => onLayerChange(parseInt(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: layers }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  Layer {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[140px] space-y-2">
          <Label className="text-sm font-medium">Head</Label>
          <Select
            value={selectedHead.toString()}
            onValueChange={(v) => onHeadChange(parseInt(v))}
            disabled={averageHeads}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: heads }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  Head {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="average-heads"
            checked={averageHeads}
            onCheckedChange={(checked) =>
              onAverageHeadsChange(checked as boolean)
            }
          />
          <Label
            htmlFor="average-heads"
            className="text-sm font-normal cursor-pointer"
          >
            Average heads
          </Label>
        </div>
      </div>

      <div className="relative border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading attention matrix...
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full h-auto animate-blur-in"
              onMouseMove={handleCanvasHover}
              onMouseLeave={() => setHoveredCell(null)}
            />

            {hoveredCell && (
              <div className="absolute top-2 left-2 bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg text-xs border border-border">
                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground">Source:</span>{" "}
                    <span className="font-mono font-medium">
                      {hoveredCell.source}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target:</span>{" "}
                    <span className="font-mono font-medium">
                      {hoveredCell.target}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Weight:</span>{" "}
                    <span className="font-mono font-medium">
                      {hoveredCell.weight.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Source tokens →</span>
        <span>↓ Target tokens</span>
      </div>
    </div>
  );
};