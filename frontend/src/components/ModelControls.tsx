import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Alert, AlertDescription } from "./ui/alert";

interface ModelControlsProps {
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  model: string;
  onModelChange: (model: string) => void;
  isRerunRequired: boolean;
}

export const ModelControls = ({
  temperature,
  onTemperatureChange,
  model,
  onModelChange,
  isRerunRequired,
}: ModelControlsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[200px] space-y-2">
          <Label className="text-sm font-medium">Model</Label>
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="claude-3">Claude 3</SelectItem>
              <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Temperature</Label>
            <span className="text-sm text-muted-foreground font-mono">
              {temperature.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[temperature]}
            onValueChange={([value]) => onTemperatureChange(value)}
            min={0}
            max={2}
            step={0.01}
            className="py-2"
          />
        </div>
      </div>
      {isRerunRequired && (
        <Alert variant="destructive">
          <AlertDescription>
            Temperature changed. Click "Run Analysis" to apply.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
