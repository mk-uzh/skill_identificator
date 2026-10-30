// ---------------------------------------------------------------------------
// Demo assessments generator
//
//   node tools/make-demo-assessments.mjs [sakai|nifi]
//
// Writes study-data/assessments.json (sakai, the default) or
// study-data/assessments.nifi.json (nifi): one entry per developer x competence.
// Both projects share the same study script (levels, wrong cells); only the
// wording differs, so the two are comparable.
// This is PLACEHOLDER content standing in for the real pipeline output. It is
// generated rather than hand-written so that the file stays consistent with
// model/taxonomy.json, and seeded so that re-running produces byte-identical
// output - a study must not silently change between runs.
//
// The level matrix below IS the study script: it decides what the system will
// propose, and which of those proposals are deliberately wrong.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const PROJECT = process.argv[2] ?? "sakai";
if (!["sakai", "nifi"].includes(PROJECT)) throw new Error(`unknown project ${PROJECT}`);

const taxonomy = JSON.parse(readFileSync("model/taxonomy.json", "utf8"));
const COMPETENCES = taxonomy.categories.map((c) => c.key);
const N = "not_observable";

// developer -> level per competence, in the order of COMPETENCES.
const SCRIPT = {
  "DEV-01": ["l3", "l3", "l4", "l3", N,    "l4", "l3", "l3", N,    "l3"],
  "DEV-02": ["l1", N,    "l2", "l1", N,    "l2", N,    N,    "l2", "l1"],
  "DEV-04": ["l3", "l2", "l3", "l4", "l3", "l3", N,    N,    "l5", "l4"],
  "DEV-06": ["l2", "l2", "l2", "l2", N,    "l2", "l4", "l4", N,    "l2"],
  "DEV-07": ["l3", "l3", "l3", "l3", "l2", "l3", "l3", "l3", "l3", "l2"],
  "DEV-09": ["l2", "l1", "l1", "l1", N,    "l1", "l2", "l2", N,    "l1"],
};

// Cells where the system is deliberately wrong (the study's error condition).
// Spread over developers and over the level range, not clustered in the weak
// people, so that veracity is not confounded with how much evidence there is.
const INCORRECT = new Set([
  "DEV-01::debug_software",
  "DEV-01::design_user_interface",
  "DEV-02::integrate_components",
  "DEV-02::migrate_existing_data",
  "DEV-04::concurrent_programming",
  "DEV-04::object_oriented_modelling",
  "DEV-06::dev_automated_tests",
  "DEV-06::javascript",
  "DEV-07::dev_automated_tests",
  "DEV-07::migrate_existing_data",
  "DEV-07::concurrent_programming",
  "DEV-09::design_user_interface",
  "DEV-09::ict_debugging_tools",
]);

const AREAS = {
  sakai: {
    "DEV-01": "the course tools",
    "DEV-02": "the import and export of course material",
    "DEV-04": "the part that stores course material and marks",
    "DEV-06": "the screens teachers see",
    "DEV-07": "the quiz tool and the gradebook",
    "DEV-09": "a number of small areas",
  },
  nifi: {
    "DEV-01": "the engine that runs a data flow",
    "DEV-02": "the import and export of flow definitions",
    "DEV-04": "the part that stores data in transit and its history",
    "DEV-06": "the canvas on which users build flows",
    "DEV-07": "the processors and the shared services they use",
    "DEV-09": "a number of small areas",
  },
};
const AREA = AREAS[PROJECT];

// Wording that is specific to one project. The sakai texts are the originals;
// for nifi each is swapped for its counterpart when a sentence is filled in.
const WORDS = {
  sakai: {
    lock: "locking a quiz while it is being published",
    form: "forms that teachers fill in",
    scheme: "stop the error when a marking scheme is attached",
    access: "usable with a screen reader",
    avail: "the platform stayed available",
  },
  nifi: {
    lock: "two processors writing to the same queue",
    form: "dialogs in which users configure a processor",
    scheme: "stop the error when a processor is configured without a required property",
    access: "usable with the keyboard only",
    avail: "the cluster stayed available",
  },
};
const localise = (str) =>
  Object.keys(WORDS.sakai).reduce(
    (acc, k) => acc.replaceAll(WORDS.sakai[k], WORDS[PROJECT][k]),
    str,
  );

// What the records cannot show, per competence (DP7).
const BLIND = {
  dev_automated_tests:
    "whether this person can test behaviour under heavy load, and whether they decide how a whole area is tested rather than writing individual tests",
  ict_debugging_tools:
    "which tools were used on their own machine, since only the result of the search reaches the records",
  debug_software:
    "faults that were diagnosed in conversation and fixed by somebody else",
  design_patterns:
    "design decisions taken in a meeting and never written down in the project",
  concurrent_programming:
    "whether the chosen approach holds under real load, which no record here measures",
  integrate_components:
    "work on systems outside this project that had to be adjusted at the same time",
  design_user_interface:
    "whether the result was tested with the people who use it",
  javascript:
    "knowledge of the language beyond what this project happens to need",
  migrate_existing_data:
    "whether the migration ran cleanly on the production data, which is not recorded here",
  object_oriented_modelling:
    "modelling work done on a whiteboard before any code was written",
};

// Narrative per competence. {n} slots are filled from the seeded generator.
const NARRATIVE = {
  dev_automated_tests:
    "Of the {total} changes in the window, {a} touched tests, and in {b} of those the tests were new, so they covered behaviour nobody had checked before.",
  ict_debugging_tools:
    "In {a} task discussions this person described how they narrowed a fault down, naming the log output or the stack trace they worked from.",
  debug_software:
    "{a} of the changes are linked to a fault report, and in {b} of them the task discussion names the cause rather than only the fix.",
  design_patterns:
    "In {a} changes an existing structure was replaced rather than worked around, and {b} of those were later built on by somebody else.",
  concurrent_programming:
    "{a} changes touch the places where two people can act at the same time, for example locking a quiz while it is being published.",
  integrate_components:
    "{a} changes join parts of the software that are developed separately, and {b} of them had to be coordinated with another team's work.",
  design_user_interface:
    "{a} changes are on the screens themselves, {b} of them on forms that teachers fill in.",
  javascript:
    "{a} of the changes are in the browser part of the software, spread over {b} different screens.",
  migrate_existing_data:
    "This person wrote {a} of the steps that move existing data to a new shape, including {b} that had to run while the platform stayed available.",
  object_oriented_modelling:
    "In {a} changes the names and the cut of the parts were revised, not just their contents.",
};

const LEVEL_CLAUSE = {
  l1: "The approach was set by someone else in each case.",
  l2: "None of this work was sent back for rework.",
  l3: "In {c} of them the reasoning is set out in the task discussion.",
  l4: "{c} other people later built on this work, and this person read and approved {d} of their changes.",
  l5: "This is the person others turn to here: {d} of the changes in this area were read and approved by them.",
};

const EV_TITLES = {
  commit: [
    "fix: {area}, correct the order in which changes are applied",
    "refactor: {area}, pull the repeated part into one place",
    "fix: {area}, stop the error when a marking scheme is attached",
  ],
  pull_request: [
    "{area}: rework after review",
    "{area}: new behaviour behind a setting",
  ],
  review: [
    "Review of somebody else's change in {area}",
    "Review: asked for rework before this was accepted",
  ],
  issue: [
    "Fault report: behaviour in {area} after an update",
    "Request: make {area} usable with a screen reader",
  ],
};

// --- seeded generator so re-running changes nothing -------------------------
function rngFrom(seed) {
  let h = 0x811c9dc5;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const CONFIDENCE_BAND = {
  not_observable: [0.28, 0.44],
  l1: [0.45, 0.6],
  l2: [0.6, 0.73],
  l3: [0.73, 0.86],
  l4: [0.86, 0.94],
  l5: [0.88, 0.96],
};

const TOTALS = {
  "DEV-01": 212, "DEV-02": 47, "DEV-04": 168,
  "DEV-06": 94, "DEV-07": 148, "DEV-09": 39,
};

function isoIn(r) {
  const start = Date.parse("2025-01-15T00:00:00.000Z");
  const end = Date.parse("2026-09-30T00:00:00.000Z");
  return new Date(start + Math.floor(r() * (end - start))).toISOString();
}

const assessments = [];
for (const [devId, levels] of Object.entries(SCRIPT)) {
  levels.forEach((level, i) => {
    const key = COMPETENCES[i];
    const r = rngFrom(PROJECT === "sakai" ? `${devId}::${key}` : `${PROJECT}::${devId}::${key}`);
    const total = TOTALS[devId];
    const area = AREA[devId];
    const observed = level !== N;

    const a = observed ? between(r, 3, Math.max(5, Math.round(total * 0.18))) : 0;
    const b = observed ? Math.max(1, Math.round(a * (0.3 + r() * 0.4))) : 0;
    const c = observed ? Math.max(1, Math.round(b * 0.8)) : 0;
    const d = observed ? between(r, 2, 14) : 0;
    const fill = (s) =>
      s.replace("{total}", total).replace("{a}", a).replace("{b}", b)
       .replace("{c}", c).replace("{d}", d).replace("{area}", area);
    const say = (str) => localise(fill(str));

    const rationale = observed
      ? `${say(NARRATIVE[key])} ${say(LEVEL_CLAUSE[level])}`
      : `Nothing in the records of this person speaks to this competence. There is no change, no review and no task discussion in ${area} that touches it. This is a declared blind spot, not a low rating.`;

    const kinds = observed
      ? ["commit", "pull_request", "review", "issue"].filter(() => r() > 0.25)
      : ["issue"];
    const evidence = (kinds.length ? kinds : ["commit"]).map((kind, j) => ({
      kind,
      title: say(pick(r, EV_TITLES[kind])),
      timestamp: isoIn(r),
      url: `https://example.org/demo/${PROJECT === "sakai" ? "" : PROJECT + "/"}${kind}/${devId.toLowerCase()}-${key}-${j + 1}`,
    }));

    const [lo, hi] = CONFIDENCE_BAND[level];
    const confidence = Math.round((lo + r() * (hi - lo)) * 100) / 100;
    const incorrect = INCORRECT.has(`${devId}::${key}`);

    assessments.push({
      id: `assess-${devId}-${key}`,
      developer_id: devId,
      category_id: key,
      level,
      confidence,
      rationale,
      evidence,
      blind_spots: localise(BLIND[key]),
      study: {
        // Descriptive only: the level above is absolute. These fields say in
        // which direction the designed proposal pulls and by how much.
        direction: ["l3", "l4", "l5"].includes(level) ? "raise" : "lower",
        delta: incorrect ? 2 : 1,
        veracity: incorrect ? "incorrect" : "correct",
      },
    });
  });
}

const doc = {
  taxonomy_version: taxonomy.taxonomy_version,
  organization_id: PROJECT === "sakai" ? "demo-project" : `demo-project-${PROJECT}`,
  computed_at: "2026-10-25T00:00:00.000Z",
  config_hash: "",
  generated_by: "tools/make-demo-assessments.mjs",
  data_status: "PLACEHOLDER - generated demo content, not pipeline output",
  assessments,
};
doc.config_hash = createHash("sha256")
  .update(JSON.stringify(doc.assessments))
  .digest("hex")
  .slice(0, 16);

const OUT = PROJECT === "sakai" ? "study-data/assessments.json" : `study-data/assessments.${PROJECT}.json`;
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n", "utf8");

const counts = assessments.reduce((acc, a) => {
  acc[a.level] = (acc[a.level] ?? 0) + 1;
  return acc;
}, {});
console.log(`${assessments.length} Eintraege, config_hash ${doc.config_hash}`);
console.log("Stufenverteilung:", JSON.stringify(counts));
console.log("absichtlich falsch:", assessments.filter((a) => a.study.veracity === "incorrect").length);
