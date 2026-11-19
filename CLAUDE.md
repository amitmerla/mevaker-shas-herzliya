# המבקר · ש״ס והרצליה

An investigation page for "המבקר" (Yossi Mizrahi, Channel 12): "איך ש״ס שודדת את כספי תושבי הרצליה". Everything is in Hebrew, RTL.

## Decisions already made (don't undo without asking)

- **No server side.** Static HTML + CSS + JS (ES modules) + animations. Run with `python3 serve.py 4192` (see .claude/launch.json; it sends no-store so browsers never mix cached and new modules); opening the file directly will not load the modules.
- **All content lives in `js/data.js`** (STORY, ISSUES, EVENTS, DOCS). The timeline, documents, counters and the agent all read from it. All of it is real material now (`PLACEHOLDER = false`; setting it to true shows the draft note in the footer). The opening text (STORY.lede) was agreed with the user: dry and documented, "מיליוני שקלים" with no exact figure, no council member names, the event-hall claim attributed to the warning letter, and the user described only as "תושב העיר" (no name).
- **AI agent = same design as ../oracle-move-ai:** intent map for explicit orders → Chrome Prompt API (Gemini Nano, on device) planning one tool call per turn with a JSON schema → fallback rule engine + BM25 retrieval (`js/rag.js`, tuned for Hebrew prefixes). Tools are also published through WebMCP. It answers only from the page's material.
- **Logos:** `assets/logos/shas.png` (the tablets logo, from the user) and `assets/logos/shas-ballot.png` (the Shas ballot note "שס", from the user; shown in the hero, the footer, and enlarged in the modal). `assets/logos/channel12.png` (from the user; header, intro, byline, footer, kept at its own 264:226 ratio).
- **המבקר branding (from the user, approved by Yossi Mizrahi for this page):** `assets/logos/hamevaker.png` (the logo: header, intro, byline, footer) and `assets/hamevaker-banner.png` (Yossi + logo: the "presenter" section between the hero and the timeline, also tour step 2).
- **Theme:** Money Heist mood (black, jumpsuit red, vault, falling banknotes) with Apple/Tesla clean layout. No Netflix / show artwork is used.
- Timeline runs right → left (Hebrew reading order); RTL scrollLeft is 0 → negative.
- Document files: set `file` on a doc in data.js (e.g. `docs/d3.pdf`) and the doc modal shows it in an iframe.

## Not verified yet

The test browser had the Prompt API object but no model ("unavailable"), so only the rule engine + RAG path was seen working. The Gemini Nano path (including Hebrew output quality) was not seen.
