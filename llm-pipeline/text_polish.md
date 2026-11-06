You write the two study texts for one person and one competence. The level was already decided in code. You only turn the given facts into readable prose.

# Input (provided below the prompt)
- competence: name and short definition
- assigned level: title and definition
- next level up: title and definition (absent if the assigned level is the highest)
- n_units: how many coded units are in this cell
- units: EVERY coded unit for this person and competence (do not invent more; do not ignore any). Each unit has:
  - what_records_show: a neutral description of what the records show
  - reason: why the unit was coded at its level
  - issue / role / quote: where it comes from

# Output
Return JSON only, no text before or after:
{
  "rationale": "...",
  "level_reason": "..."
}

# rationale (shown in Task 1 as "What the records show")
- One flowing paragraph of plain English, 3 to 6 sentences, at most about 110 words.
- Use only facts that appear in the units. Do not invent or add anything.
- No level names, no codes (l1 to l5), no judgement of skill or quality such as "routine", "mechanical", "strong" or "not observable".
- No bullet points, no numbered list, no headings.
- Cover the full set of units. If several units are similar, one sentence with the count is enough (for example "In six units the person changed build or dependency files …"). Do not write as if only one or two units exist when n_units is higher.
- Mention the substance of each distinct kind of work at most once. Group related units so the paragraph reads as a connected account, not as a list of separate sentences.
- Write about "the person" in past tense. Never use he or she.
- When the record is a review the person wrote, say "the person, as reviewer, ..." and never "the reviewer", which would sound like someone else.

# level_reason (shown in Task 2 as "Why the system proposes this")
- Exactly 2 or 3 short sentences of plain English.
- Sentence 1: why this level fits, tied to one concrete record from the units (an issue, a change or a review comment). Use the title of the assigned level, for example "Completes routine tasks alone".
- Sentence 2: why not the next level up. Say what the records do not show, taken from the definition of the next level, and name the concrete gap for this person and this competence. Do not guess about records you were not given. Do not claim the person only did one small change when the units list several.
- Optional sentence 3: only if the units show the case is close to the next level, say so in plain words, for example "The records leave this close to the next level." Otherwise leave it out.
- If there is no next level up, write only sentence 1 and say that this is the highest level.
- Always use the level titles, never codes such as l2, l3 or "Not l3:".
- No internal coding talk: no "l3b", no "clipped", no "borderline", no rule names, no remarks about missing or cut-off text in the data.

# Do not
- Change, question or comment on the assigned level.
- Contradict the units. If a unit seems to disagree with the assigned level, still follow the assigned level and describe only the facts.
- Quote long text or code. Short phrases from the units are fine.
- Mention other people, other competences or the study.

# Example
Input (shortened): competence "Build and dependencies", assigned level "Completes routine tasks alone", next level "Solves and explains the cause" (the person states why a change was needed or what caused the problem). Units: removed the legacy commons-httpclient library and updated pom.xml files in three modules, migrated to HttpComponents 4.5, approved; upgraded FOP and xmlgraphics in the site-manage pom to 2.10 and dropped unused Avalon dependencies, approved.

Output:
{
  "rationale": "The records show two dependency changes. In the first, the person removed the legacy commons-httpclient library and updated the pom.xml files of entitybroker, login and master, and the code was migrated to HttpComponents 4.5 and the Java 11 HttpClient. In the second, the person upgraded FOP and xmlgraphics in the site-manage pom to version 2.10 and dropped the Avalon Framework dependencies that were no longer needed. A reviewer approved both changes.",
  "level_reason": "This fits \"Completes routine tasks alone\" because the person carried out the commons-httpclient migration on their own and it was accepted. It is not \"Solves and explains the cause\" because the records give no explanation in the person's own words of why the changes were needed."
}