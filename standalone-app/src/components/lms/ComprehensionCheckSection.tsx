"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseChoicesJson, type ComprehensionMode } from "@/lib/comprehension";
import type { ComprehensionViewSnapshot } from "@/lib/comprehension-storage";

type ComprehensionCheckSectionProps = {
  recordId: string;
  mode: ComprehensionMode;
  question: string;
  choicesJson: string;
  initialPassed: boolean;
  /** Saved question / correct lines / explanation after pass (from parent + localStorage). */
  completedSnapshot?: ComprehensionViewSnapshot | null;
  onPassed: (snapshot: ComprehensionViewSnapshot) => void;
};

export function ComprehensionCheckSection({
  recordId,
  mode,
  question,
  choicesJson,
  initialPassed,
  completedSnapshot = null,
  onPassed,
}: ComprehensionCheckSectionProps) {
  const choices = useMemo(() => parseChoicesJson(choicesJson), [choicesJson]);
  const [singleId, setSingleId] = useState<string>("");
  const [multiIds, setMultiIds] = useState<Set<string>>(() => new Set());
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [quizPassed, setQuizPassed] = useState(false);
  /** When the parent does not hydrate a snapshot (e.g. demo / first visit), keep the verify response for the reference card. */
  const [sessionPassedSnapshot, setSessionPassedSnapshot] = useState<ComprehensionViewSnapshot | null>(null);

  const passed = initialPassed || quizPassed;

  useEffect(() => {
    setSingleId("");
    setMultiIds(new Set());
    setFreeText("");
    setError(null);
    setExplanation(null);
    setQuizPassed(false);
    setSessionPassedSnapshot(null);
  }, [recordId]);

  const toggleMulti = useCallback((id: string) => {
    setMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { recordId };
      if (mode === "single") {
        if (!singleId) {
          setError("Select an answer.");
          setSubmitting(false);
          return;
        }
        body.singleChoiceId = singleId;
      } else if (mode === "multi") {
        if (multiIds.size === 0) {
          setError("Select one or more answers.");
          setSubmitting(false);
          return;
        }
        body.multiChoiceIds = [...multiIds];
      } else {
        body.freeText = freeText;
      }
      const res = await fetch("/api/comprehension/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        pass?: boolean;
        explanation?: string;
        referenceQuestion?: string;
        referenceCorrectLines?: string[];
        referenceFreeSubmitted?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not verify answer.");
        setSubmitting(false);
        return;
      }
      if (data.pass) {
        const snapshot: ComprehensionViewSnapshot = {
          question: (data.referenceQuestion ?? question).trim() || question.trim() || "Question",
          correctLines: Array.isArray(data.referenceCorrectLines) ? data.referenceCorrectLines.map(String) : [],
          explanation: data.explanation != null ? String(data.explanation) : null,
          freeSubmitted: data.referenceFreeSubmitted,
        };
        setQuizPassed(true);
        setSessionPassedSnapshot(snapshot);
        setExplanation(snapshot.explanation);
        onPassed(snapshot);
      } else {
        setError(mode === "free" ? "Enter at least two complete sentences (roughly 40+ characters)." : "Not quite — try again.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [recordId, mode, singleId, multiIds, freeText, onPassed, question]);

  if (passed) {
    const ref = completedSnapshot ?? sessionPassedSnapshot;
    const q = (ref?.question ?? question).trim() || "Question";
    const lines = ref?.correctLines ?? [];
    const expl = ref?.explanation ?? explanation;
    const freeSubmittedTrim = (ref?.freeSubmitted ?? "").trim();
    const legacyFreeBody =
      mode === "free" &&
      !freeSubmittedTrim &&
      lines.length >= 2 &&
      String(lines[0]).trim() === "Your submitted response:"
        ? lines
            .slice(1)
            .map((x) => String(x).trim())
            .filter(Boolean)
            .join("\n")
        : "";
    const freeBodyDisplay = freeSubmittedTrim || legacyFreeBody;

    return (
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-4 shadow-sm" data-testid="comprehension-done">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground m-0">Comprehension check (completed)</p>
        <div className="prose prose-sm max-w-none text-foreground">
          <p className="text-base font-medium leading-relaxed whitespace-pre-wrap m-0">{q}</p>
        </div>
        {mode === "free" && freeBodyDisplay ? (
          <div>
            <p className="text-sm font-semibold text-foreground mb-2 m-0">Your submitted response</p>
            <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap m-0">{freeBodyDisplay}</p>
          </div>
        ) : mode !== "free" && lines.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-foreground mb-2 m-0">Correct answer(s)</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-foreground/95 m-0">
              {lines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : mode !== "free" ? (
          <p className="text-sm text-muted-foreground m-0">Correct answer details were saved before this update; submit again to refresh the reference card.</p>
        ) : null}
        {expl ? (
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm leading-relaxed">
            <span className="font-semibold text-foreground">Why this is correct: </span>
            <span className="text-foreground/90 whitespace-pre-wrap">{expl}</span>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground m-0">Use the buttons below when you&apos;re ready to continue.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-6 space-y-5 shadow-sm" data-testid="comprehension-quiz">
      <div className="prose prose-sm max-w-none text-foreground">
        <p className="text-base font-medium leading-relaxed whitespace-pre-wrap m-0">{question.trim() || "Question"}</p>
      </div>

      {mode === "single" && choices.length > 0 ? (
        <div className="space-y-3" role="radiogroup" aria-label="Answer choices">
          {choices.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                singleId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                name={`comp-${recordId}`}
                checked={singleId === c.id}
                onChange={() => setSingleId(c.id)}
              />
              <span className="text-sm leading-relaxed">{c.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {mode === "multi" && choices.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select all that apply.</p>
          {choices.map((c) => (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                multiIds.has(c.id) ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <Checkbox
                checked={multiIds.has(c.id)}
                onCheckedChange={() => toggleMulti(c.id)}
                className="mt-0.5 shrink-0"
                aria-label={c.label}
              />
              <span className="text-sm leading-relaxed">{c.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {mode === "free" ? (
        <div className="space-y-2">
          <label htmlFor={`free-${recordId}`} className="text-sm text-muted-foreground block">
            Type your response (at least two sentences).
          </label>
          <textarea
            id={`free-${recordId}`}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={6}
            className="flex w-full resize-y min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Write your answer here…"
          />
        </div>
      ) : null}

      {(mode === "single" || mode === "multi") && choices.length === 0 ? (
        <p className="text-sm text-destructive">No choices are configured for this question. Add a valid JSON array to the Choices field in Airtable.</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" className="w-full sm:w-auto" onClick={() => void submit()} disabled={submitting}>
        {submitting ? "Checking…" : "Submit answer"}
      </Button>
    </div>
  );
}
