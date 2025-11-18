import { Brain, Github } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface HeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export const Header = ({ selectedModel, onModelChange }: HeaderProps) => {
  return (
    <header className="z-50">
      <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4">
        <div className="glass-card flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-[20px] font-medium tracking-tight">Cognify.AI</h1>
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3">Claude 3</SelectItem>
                <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </Button>

            <Button variant="outline" size="sm">
              Demo
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};