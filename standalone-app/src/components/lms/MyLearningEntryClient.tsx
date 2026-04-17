"use client";

/**
 * My Learning – email entry (standalone: POST /api/contacts/lookup).
 */
import { useState } from "react";
import { normalizeEmailForLookup } from "@/lib/contact-email";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

const MY_LEARNING_TRACKS_SLUG = "/my-learning-tracks";

export default function MyLearningEntryClient() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = normalizeEmailForLookup(email);
    if (!trimmed) {
      setError("Please enter your email.");
      return;
    }
    setSubmitted(true);
    try {
      const res = await fetch("/api/contacts/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as {
        multiple?: boolean;
        matches?: { id?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "We couldn't verify your email right now. Please try again.");
        setSubmitted(false);
        return;
      }
      if (data.multiple) {
        setError("Multiple profiles found. Please contact your administrator.");
        setSubmitted(false);
        return;
      }
      const matches = data.matches ?? [];
      if (matches.length === 0) {
        setError("We couldn't find your profile. Reach out to your National Artist Services Team with any questions.");
        setSubmitted(false);
        return;
      }
      const personId = matches[0].id;
      if (!personId || personId.length < 5) {
        setError("Could not load your profile. Please try again or contact support.");
        setSubmitted(false);
        return;
      }
      window.location.href = `${MY_LEARNING_TRACKS_SLUG}?personId=${encodeURIComponent(personId)}`;
    } catch {
      setError("We couldn't verify your email right now. Please try again.");
      setSubmitted(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 md:px-6 py-12">
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-10 w-10 text-primary" />
              <CardTitle className="text-2xl">My Learning</CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              Enter the email address associated with your profile to see your assigned tracks and continue your progress.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="my-learning-email" className="block text-sm font-medium mb-2">
                  Email address
                </label>
                <input
                  id="my-learning-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitted}
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitted}>
                {submitted ? "Redirecting…" : "Continue to My Learning"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
