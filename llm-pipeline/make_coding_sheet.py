"""Build the Excel sheet for the manual reference coding (gold standard).

The sample is drawn from the evidence units of the study people, stratified by
person x role, with a fixed seed. The sheet contains NO model output from the
pipeline, so the human coding stays independent of it.

Optional: --draft draft_claude.json pre-fills the yellow columns with a draft (to be
overwritten by the human coder). The draft itself is kept in its own json file.

Usage (from llm-pipeline):
    python make_coding_sheet.py --project sakai --n 120 --seed 42 [--draft draft_claude.json]
Writes runs/<project>_coding_sheet_n<N>_seed<S>.xlsx and the plain list of ids (csv).
"""
from __future__ import annotations

import argparse
import csv
import json
import random
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

from classify import draw_stratified, usable_study_units
from common import ensure_runs, evidence_csv, load_config, read_csv

LEVELS = ["l1", "l2", "l3", "l4", "n/o"]
MAX_TEXT = 30000


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--draft", help="json with a second rater's coding, keyed by evidence_id")
    a = ap.parse_args()

    cfg = load_config()
    cats = list(cfg["competences"]) + ["other", "(none)"]
    pool = usable_study_units(read_csv(evidence_csv(a.project)), cfg["study_developers"])
    units = draw_stratified(pool, a.n, a.seed)

    # dev / test halves, seeded and balanced by drawing order within person x role
    rng = random.Random(a.seed)
    order = list(range(len(units)))
    rng.shuffle(order)
    split = {}
    for rank, i in enumerate(order):
        split[units[i]["evidence_id"]] = "dev" if rank % 2 == 0 else "test"

    draft = json.load(open(a.draft, encoding="utf-8")) if a.draft else {}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Units"
    head = [
        "evidence_id", "split", "dev_id", "role", "issue_key", "text",
        "YOUR category 1", "YOUR level 1", "YOUR category 2", "YOUR level 2", "YOUR note",
    ]
    ws.append(head)
    for u in units:
        d = draft.get(u["evidence_id"], {})
        text = ILLEGAL_CHARACTERS_RE.sub("", u.get("text") or "")
        if len(text) > MAX_TEXT:
            text = text[:MAX_TEXT] + "\n[... text shortened for Excel]"
        ws.append([
            u["evidence_id"], split[u["evidence_id"]], u["dev_id"], u["role"], u["issue_key"], text,
            d.get("category1"), d.get("level1"), d.get("category2"), d.get("level2"), d.get("reason"),
        ])

    bold = Font(bold=True)
    you = PatternFill("solid", fgColor="FFF2CC")
    for c in ws[1]:
        c.font = bold
        c.fill = you if c.value.startswith("YOUR") else PatternFill()
    widths = {"A": 30, "B": 7, "C": 8, "D": 9, "E": 12, "F": 90, "G": 22, "H": 9, "I": 22, "J": 9,
              "K": 50}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[row[0].row].height = 220
    ws.freeze_panes = "G2"

    last = ws.max_row
    dv_cat = DataValidation(type="list", formula1='"' + ",".join(cats) + '"', allow_blank=True)
    dv_lvl = DataValidation(type="list", formula1='"' + ",".join(LEVELS) + '"', allow_blank=True)
    ws.add_data_validation(dv_cat)
    ws.add_data_validation(dv_lvl)
    dv_cat.add(f"G2:G{last}"); dv_cat.add(f"I2:I{last}")
    dv_lvl.add(f"H2:H{last}"); dv_lvl.add(f"J2:J{last}")

    guide = wb.create_sheet("How to code")
    for line in [
        "Reference coding (gold standard). Fill only the yellow 'YOUR ...' columns.",
        "Read the unit text, then pick the main competence and its level. A second competence is optional.",
        "Levels: l1 follows a given approach; l2 completes routine tasks alone; l3 solves and explains the cause; "
        "l4 others rely on it; n/o = nothing the person wrote or did about a competence. No l5 (see docs/CODEBOOK.md).",
        "Category '(none)' with level n/o if the unit holds nothing observable.",
        "Evidence is what the person did or wrote. The ticket text ('The task') is context, never evidence.",
        "Between two levels take the lower one (R10).",
        "If a draft was passed with --draft, the yellow columns are PRE-FILLED with a draft. Overwrite or delete it: "
        "only your own coding counts as the gold standard. The draft is kept separately in runs/*_draft_claude_*.json.",
        "Column 'split': dev units may be used to improve the prompt, test units are only for the final figure.",
    ]:
        guide.append([line])
    guide.column_dimensions["A"].width = 140

    out = ensure_runs() / f"{a.project}_coding_sheet_n{a.n}_seed{a.seed}.xlsx"
    wb.save(out)
    ids = out.with_suffix(".csv")
    with ids.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["evidence_id", "split", "dev_id", "role"])
        for u in units:
            w.writerow([u["evidence_id"], split[u["evidence_id"]], u["dev_id"], u["role"]])
    print(f"{len(units)} units -> {out}")
    print(f"ids -> {ids}")


if __name__ == "__main__":
    main()
