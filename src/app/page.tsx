"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Steps } from "@/components/Steps";
import { clientSession } from "@/lib/client-session";
import { CATEGORIES, DEVELOPERS } from "@/lib/study-config";

export default function IntroPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantCode: code.trim(), consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unknown error");

      clientSession.clear();
      clientSession.setSessionId(data.sessionId);
      clientSession.setParticipantCode(code.trim());
      router.push("/task1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <Steps current={0} />
      <div className="card">
        <h1>Team skill matrix: assessment with and without system support</h1>
        <p className="lede">
          Thank you for taking part. The study takes about 15 minutes and consists of two tasks.
        </p>

        <h2>Procedure</h2>
        <p className="small">
          You will assess the competences of {DEVELOPERS.length} fictitious team members across{" "}
          {CATEGORIES.length} categories. In <strong>Task 1</strong> you fill an empty matrix without
          support. In <strong>Task 2</strong> the matrix is pre-filled with system suggestions; each
          cell shows confidence and your Task&nbsp;1 value. You can accept, adjust or reject each
          suggestion and inspect evidence.
        </p>
        <p className="small muted">
          There is no objectively correct solution – we are interested in how you proceed.
        </p>

        <h2>Data protection</h2>
        <p className="small">
          We record your ratings as well as your interactions with the interface (changes,
          timestamps, how you handle the suggestions). The analysis is pseudonymised via the
          participant code; no names, email addresses or IP addresses are stored. You may end your
          participation at any time without giving reasons.
        </p>

        <div className="field" style={{ marginTop: 24 }}>
          <label htmlFor="code">Participant code</label>
          <input
            id="code"
            type="text"
            value={code}
            placeholder="e.g. P07"
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <p className="small muted" style={{ marginTop: 6 }}>
            You receive the code from the study team.
          </p>
        </div>

        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have read the information and consent to the described processing of my data.
            </span>
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <span />
          <button
            type="button"
            className="btn"
            disabled={!code.trim() || !consent || busy}
            onClick={start}
          >
            {busy ? "Starting …" : "Start study →"}
          </button>
        </div>
      </div>
    </div>
  );
}
