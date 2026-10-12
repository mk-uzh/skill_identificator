"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Legend } from "@/components/Legend";
import { SkillMatrix } from "@/components/SkillMatrix";
import { emptyMatrix, setCell } from "@/lib/matrix";
import { DEVELOPERS } from "@/lib/study-config";
import { useVisibility } from "@/lib/visibility-context";
import type { Matrix, SkillLevel } from "@/lib/types";

const STORAGE_PREFIX = "devskill.devMatrix.";

export default function DeveloperPage() {
  const { visibility, labels } = useVisibility();
  const [devId, setDevId] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix);
  const [saved, setSaved] = useState(false);

  const developer = useMemo(
    () => DEVELOPERS.find((d) => d.id === devId) ?? null,
    [devId],
  );

  useEffect(() => {
    if (!loggedIn || !devId) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + devId);
      if (raw) {
        setMatrix(JSON.parse(raw) as Matrix);
      } else {
        setMatrix(emptyMatrix());
      }
    } catch {
      setMatrix(emptyMatrix());
    }
  }, [loggedIn, devId]);

  function login() {
    if (!devId) return;
    setLoggedIn(true);
    setSaved(false);
  }

  function logout() {
    setLoggedIn(false);
    setDevId("");
    setSaved(false);
  }

  function handleChange(dId: string, categoryId: string, next: SkillLevel | null) {
    setMatrix((current) => setCell(current, dId, categoryId, next));
    setSaved(false);
  }

  function save() {
    if (!devId) return;
    window.localStorage.setItem(STORAGE_PREFIX + devId, JSON.stringify(matrix));
    setSaved(true);
  }

  return (
    <div className="page page--wide">
      <div className="card">
        <div className="card__title-row">
          <h1>Developer self-view</h1>
          <Link href="/" className="btn btn--ghost">
            Study home
          </Link>
        </div>
        <p className="lede">
          Log in as a developer to review and adjust your own skill row. Visibility setting:{" "}
          <strong>{labels[visibility]}</strong> — in every regime you can see your own values
          (self-view).
        </p>

        {!loggedIn && (
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="devLogin">Developer</label>
            <select
              id="devLogin"
              value={devId}
              onChange={(e) => setDevId(e.target.value)}
            >
              <option value="">Select …</option>
              {DEVELOPERS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — {d.role}
                </option>
              ))}
            </select>
            <div className="actions" style={{ marginTop: 16 }}>
              <span />
              <button type="button" className="btn" disabled={!devId} onClick={login}>
                Log in
              </button>
            </div>
          </div>
        )}

        {loggedIn && developer && (
          <>
            <p className="small">
              Signed in as <strong>{developer.label}</strong> ({developer.role}). Only your row is
              editable.
            </p>
            <SkillMatrix
              mode="task1"
              matrix={matrix}
              developerFilter={[developer.id]}
              onCellChange={handleChange}
            />
            <Legend />
            <div className="actions">
              <button type="button" className="btn btn--ghost" onClick={logout}>
                Log out
              </button>
              <button type="button" className="btn" onClick={save}>
                {saved ? "Saved" : "Save my skills"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
