import { useState } from "react";
import { MessageSquareText, Search } from "lucide-react";
import type { AppSettings, Program, ProgramAnswer } from "../domain/types";
import { askAboutProgram } from "../ai/askProgram";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface AskProgramProps {
  program: Program;
  settings: AppSettings;
}

export function AskProgram({ program, settings }: AskProgramProps) {
  const [question, setQuestion] = useState("What are the language requirements?");
  const [answer, setAnswer] = useState<ProgramAnswer | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setAnswer(await askAboutProgram(question, program, settings));
    setBusy(false);
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquareText className="h-4 w-4 text-primary" />
        Ask about this program
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Answers come only from this program's own information and are not official admission advice.
      </p>
      <Textarea
        className="min-h-16 text-sm"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="e.g. What is the application deadline?"
      />
      <Button size="sm" className="w-fit" onClick={ask} disabled={busy || !question.trim()}>
        <Search className="h-4 w-4" />
        {busy ? "Searching..." : "Ask"}
      </Button>
      {answer ? (
        <div className="grid gap-2">
          {answer.warning ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{answer.warning}</p>
          ) : null}
          <pre className="whitespace-pre-wrap rounded-2xl bg-white/80 p-4 font-sans text-sm leading-6 text-foreground shadow-sm">
            {answer.answer}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
