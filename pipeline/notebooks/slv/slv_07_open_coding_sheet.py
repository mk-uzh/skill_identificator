"""
Build an Excel sheet for OPEN (bottom-up) coding of a drawn sample.

Why this exists: the competence list (model/taxonomy.json) came from open coding
of 120 Sakai units. NiFi was not part of that. Before the list is frozen, a
sample of NiFi units has to be coded the same way: without the list, in your own
words, and only afterwards compared with the 12 competences. What does not fit
is the finding.

What goes in the sheet
    - the units of an already drawn sample (ids from pipeline/data/<project>/silver/samples/)
    - the text of each unit from the pseudonymised export docs/evidence/<project>_evidence_units.csv,
      split into "The task" (context only, never evidence) and "what the person did"
    - empty input cells (yellow) for what you see
    - nothing from any earlier coding proposal and nothing from a model, on purpose

Usage (from the repository root):
    py pipeline/notebooks/slv/slv_07_open_coding_sheet.py --project nifi --sample sample_n60_seed42.csv

Writes next to the sample:
    pipeline/data/<project>/silver/samples/open_coding_<project>_<sample name>.xlsx

pipeline/data/ is git-ignored by design (raw data and identities stay local).
"""

import argparse
import csv
import json
import math
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

csv.field_size_limit(10 ** 9)

FONT = "Arial"
HEAD_FILL = PatternFill("solid", fgColor="D9D9D9")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
ILLEGAL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
SECTION = re.compile(r"^## (.+)$", re.M)


def find_root() -> Path:
    here = Path(__file__).resolve()
    for cand in (here.parent, *here.parents):
        if (cand / "docs" / "evidence").exists() and (cand / "model" / "taxonomy.json").exists():
            return cand
    raise SystemExit("Could not find the repository root (docs/evidence, model/taxonomy.json).")


def clean(text: str) -> str:
    return ILLEGAL.sub("", text or "")


def put(ws, ref, value, bold=False, fill=None, wrap=True, size=10, italic=False):
    cell = ws[ref]
    cell.value = value
    if isinstance(value, str) and not value.startswith("="):
        cell.data_type = "s"
    elif isinstance(value, str):
        pass
    cell.font = Font(name=FONT, size=size, bold=bold, italic=italic)
    cell.alignment = Alignment(wrap_text=wrap, vertical="top")
    if fill:
        cell.fill = fill
    return cell


def split_unit(text: str):
    """Return (task_text, person_text). 'The task' is context only (rule R1)."""
    text = clean(text).strip()
    marks = list(SECTION.finditer(text))
    if not marks:
        return "", text
    task, person = [], []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        block = text[m.start():end].strip()
        (task if m.group(1).strip().lower() == "the task" else person).append(block)
    return "\n\n".join(task), "\n\n".join(person)


def row_height(*cols):
    """cols = (text, column width). Excel caps a row at 409 points."""
    lines = 1
    for text, width in cols:
        per_line = max(10, int(width * 1.1))
        n = sum(max(1, math.ceil(len(line) / per_line)) for line in (text or "").split("\n"))
        lines = max(lines, n)
    return min(409, max(30, 13 * lines))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, choices=["sakai", "nifi"])
    ap.add_argument("--sample", required=True, help="e.g. sample_n60_seed42.csv")
    args = ap.parse_args()

    root = find_root()
    sample_csv = root / "pipeline" / "data" / args.project / "silver" / "samples" / args.sample
    units_csv = root / "docs" / "evidence" / f"{args.project}_evidence_units.csv"
    for p in (sample_csv, units_csv):
        if not p.exists():
            raise SystemExit(f"Missing file: {p}")

    ids = [r["evidence_id"] for r in csv.DictReader(sample_csv.open(encoding="utf-8-sig"))]
    units = {r["evidence_id"]: r for r in csv.DictReader(units_csv.open(encoding="utf-8"))}
    missing = [i for i in ids if i not in units]
    if missing:
        raise SystemExit(f"{len(missing)} sample ids not found in {units_csv.name}: {missing[:3]}")

    tax = json.loads((root / "model" / "taxonomy.json").read_text(encoding="utf-8"))
    cats = sorted(tax["categories"], key=lambda c: c.get("order", 0))

    n = len(ids)
    wb = Workbook()

    # ---------------------------------------------------------------- Anleitung
    ws = wb.active
    ws.title = "Anleitung"
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 120
    put(ws, "A1", f"Offene Kodierung {args.project.upper()} ({n} Units, {Path(args.sample).stem})", bold=True, size=13, wrap=False)
    lines = [
        ("Ziel", "Herausfinden, welche Fähigkeiten in den Units sichtbar sind, OHNE die Liste der 12 Kompetenzen zu kennen. Erst danach wird verglichen. Was in keine der 12 passt, ist der Befund."),
        ("1", "Die Liste der 12 Kompetenzen (Blatt «Liste_spaeter») erst öffnen, wenn alle Units kodiert sind. Auch keine frühere Kodierung ansehen."),
        ("2", "Blatt «Kodierung» von oben nach unten. Spalte D (Aufgabe) ist nur Kontext und kein Beleg. Spalte E zeigt, was die Person getan oder geschrieben hat. Lange Texte: Zelle anklicken, dann steht der volle Text in der Bearbeitungsleiste."),
        ("3", "Gelbe Zelle F: in eigenen Worten (2 bis 5 Wörter), welche Fähigkeit die Person hier zeigt. Gelbe Zelle G nur, wenn eine zweite klar sichtbar ist."),
        ("4", "Nichts Beobachtbares (nur Urteil wie APPROVED oder LGTM, nur Ticket-Text, Versionsnummer, generierte Dateien): Spalte H = ja und in I den Grund. Das ist ein Ergebnis, kein Fehler."),
        ("5", "Gleiche Fähigkeit immer gleich benennen, sonst lässt sie sich später nicht zusammenfassen."),
        ("6", "Danach Blatt «Gruppieren»: deine Bezeichnungen eintragen, die Anzahl zählt sich selbst. Erst dort die Zuordnung zu den 12 wählen oder «keine passt (neu)»."),
        ("7", f"Entscheidungsregel (Vorschlag, VOR dem Kodieren bestätigen oder ändern): eine neue Kompetenz nur, wenn mindestens {max(3, round(n * 0.08))} von {n} Units (rund 8 Prozent) in keine der 12 passen und eine zusammenhängende Gruppe bilden. Sonst bleibt es «other»."),
        ("8", "Level werden in diesem Schritt nicht vergeben."),
        ("", "Gelbe Zellen = hier eintragen. Alles andere nicht ändern."),
        ("", "Die Texte sind pseudonymisiert, nicht anonym. Datei nicht weitergeben (siehe docs/evidence/README.md)."),
    ]
    r = 3
    for k, t in lines:
        put(ws, f"A{r}", k, bold=True)
        put(ws, f"B{r}", t, bold=(k == "Ziel" and False))
        ws.row_dimensions[r].height = row_height((t, 120))
        r += 1
    r += 1
    put(ws, f"B{r}", "Beispiel (erfunden, so soll eine Zeile aussehen)", bold=True)
    r += 1
    ex = [
        ("F: Fehlerursache finden", "G: Tests ergänzen", "H: nein", "I: Ursache im Code-Kommentar genannt, Test dazu"),
        ("F: (leer)", "G: (leer)", "H: ja", "I: nur APPROVED, kein Inhalt"),
    ]
    for e in ex:
        put(ws, f"B{r}", "   |   ".join(e), fill=INPUT_FILL)
        r += 1

    # ---------------------------------------------------------------- Kodierung
    wk = wb.create_sheet("Kodierung")
    heads = ["Nr", "Evidence-ID", "Rolle", "Aufgabe (nur Kontext, kein Beleg)",
             "Was die Person getan oder geschrieben hat", "Sichtbare Fähigkeit (dein Wort)",
             "Zweite Fähigkeit (optional)", "Nicht beurteilbar?", "Grund / Notiz"]
    widths = [5, 30, 10, 55, 95, 34, 28, 14, 40]
    for i, (h, w) in enumerate(zip(heads, widths)):
        col = chr(ord("A") + i)
        wk.column_dimensions[col].width = w
        c = put(wk, f"{col}1", h, bold=True, fill=HEAD_FILL)
        c.border = BOX
    wk.row_dimensions[1].height = 32
    dv_yes = DataValidation(type="list", formula1='"ja,nein"', allow_blank=True)
    wk.add_data_validation(dv_yes)
    for i, eid in enumerate(ids, 1):
        row = i + 1
        u = units[eid]
        task, person = split_unit(u["text"])
        put(wk, f"A{row}", i)
        put(wk, f"B{row}", eid)
        put(wk, f"C{row}", u["role"])
        put(wk, f"D{row}", task)
        put(wk, f"E{row}", person)
        for col in "FGHI":
            put(wk, f"{col}{row}", None, fill=INPUT_FILL)
        for col in "ABCDEFGHI":
            wk[f"{col}{row}"].border = BOX
        dv_yes.add(f"H{row}")
        wk.row_dimensions[row].height = row_height((task, 55), (person, 95))
    wk.freeze_panes = "C2"
    wk.auto_filter.ref = f"A1:I{n + 1}"

    # ---------------------------------------------------------------- Gruppieren
    wg = wb.create_sheet("Gruppieren")
    gh = ["Bezeichnung (aus Spalte F/G)", "Anzahl Units", "Passt zu (erst jetzt wählen)", "Notiz"]
    gw = [42, 14, 42, 60]
    for i, (h, w) in enumerate(zip(gh, gw)):
        col = chr(ord("A") + i)
        wg.column_dimensions[col].width = w
        c = put(wg, f"{col}1", h, bold=True, fill=HEAD_FILL)
        c.border = BOX
    list_last = len(cats) + 2  # rows 2..(12+1 neu)
    dv_cat = DataValidation(type="list", formula1=f"=Liste_spaeter!$A$2:$A${list_last}", allow_blank=True)
    wg.add_data_validation(dv_cat)
    first, last = 2, n + 1
    for row in range(2, 32):
        put(wg, f"A{row}", None, fill=INPUT_FILL)
        put(wg, f"B{row}", f'=IF(A{row}="","",COUNTIF(Kodierung!$F${first}:$G${last},A{row}))')
        put(wg, f"C{row}", None, fill=INPUT_FILL)
        put(wg, f"D{row}", None, fill=INPUT_FILL)
        for col in "ABCD":
            wg[f"{col}{row}"].border = BOX
        dv_cat.add(f"C{row}")
    put(wg, "A33", "Units ohne Befund (Spalte H = ja)", bold=True)
    put(wg, "B33", f'=COUNTIF(Kodierung!$H${first}:$H${last},"ja")')
    put(wg, "A34", "Units mit Eintrag in Spalte F", bold=True)
    put(wg, "B34", f'=COUNTA(Kodierung!$F${first}:$F${last})')
    wg.freeze_panes = "A2"

    # ------------------------------------------------------------- Liste_spaeter
    wl = wb.create_sheet("Liste_spaeter")
    for col, w in zip("ABC", (28, 42, 80)):
        wl.column_dimensions[col].width = w
    for col, h in zip("ABC", ("key", "label", "Beschreibung")):
        put(wl, f"{col}1", h, bold=True, fill=HEAD_FILL).border = BOX
    for i, c in enumerate(cats, 2):
        put(wl, f"A{i}", c["key"])
        put(wl, f"B{i}", c["label"])
        put(wl, f"C{i}", c.get("plain", ""))
    put(wl, f"A{len(cats) + 2}", "keine passt (neu)")
    put(wl, f"B{len(cats) + 4}", "Diese Liste erst nach dem Kodieren ansehen.", bold=True)

    wb.calculation.fullCalcOnLoad = True
    out = sample_csv.parent / f"open_coding_{args.project}_{sample_csv.stem}.xlsx"
    wb.save(out)
    print(f"wrote {out}")
    print(f"{n} units; roles: " + ", ".join(
        f"{role}={sum(1 for i in ids if units[i]['role'] == role)}" for role in ("author", "reviewer")))


if __name__ == "__main__":
    main()
