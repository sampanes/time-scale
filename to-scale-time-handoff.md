# To Scale: Time — Project Handoff

tags: #timeline #javascript #github-pages #science #education #ideas

---

## The Concept

A static ES-module app hosted on GitHub Pages. You type in any mix of geological eras, periods, epochs, events, or future milestones — it places them on a **true to-scale linear timeline**. The whole point is that it looks broken at cosmic scales. Human civilization is invisible next to the Hadean. That's not a bug, that's the lesson.

No backend and no dependency install. The current build step only copies static files into `_site`. Add events by editing `src/data/timeline-data.js`.

---

## Design Decisions Made

### Unit: Ma (Millions of Years Ago)

Internal unit is **Ma (millions of years ago)**. Positive = past, zero = now, negative = future.

Why Ma and not fractions of universe age:
- Scientists already use Ma — data can be copied from Wikipedia directly
- Floating point handles the full range fine (13,800 Ma to -1×10³² Ma)
- Human-readable numbers for data entry

**Precision:**
- Geological deep time: 1-2 decimal places (e.g. 251.9 Ma)
- Recent events: 3 decimals (0.012 Ma = 12,000 years ago)
- Future far events: scientific notation acceptable (-1e32 for heat death)

### Future Events as Negative Ma

Negative Ma values represent future events. No special casing — the math just works. Examples in dataset:
- Sun leaves main sequence: -5,000 Ma
- Earth surface sterilized: -5,400 Ma
- Last stars burn out: -100,000,000 Ma
- Heat death of universe: -1×10³² Ma

### Data Object Shape

```json
{
  "id": "triassic",
  "name": "Triassic",
  "type": "period",
  "start_ma": 251.9,
  "end_ma": 201.4,
  "aliases": ["triassic period"],
  "color": "#a16b5b"
}
```

Point events (no duration) use `start_ma === end_ma`. Rendered as vertical lines instead of blocks.

**Types in use:** `eon`, `era`, `period`, `epoch`, `event`, `future`

Each type has its own color palette (4 shades, cycles). You'll want to expand or fully customize this.

### Linear Default, Log Toggle

Linear is default — intentionally. The "it looks broken" moment IS the pedagogical experience. Kids ask if the app is broken. Answer: nope, just tiny by comparison.

Log scale toggle exists for scientific users who want to see everything at once. Toggling shows a warning banner. Log scale is honest but defeats the purpose for newcomers.

### Mixed Taxonomy Input

User can type "Hadean, Paleozoic, Triassic, end of earth" — mixing eons, eras, periods, and events freely. The app doesn't care about hierarchy. Every entry has `start_ma` and `end_ma`. Hierarchy (`parent` field, not yet implemented) is optional metadata for autocomplete grouping only.

### Rendering Logic

```
1. Find min(end_ma) and max(start_ma) across all selected items
2. Add 3% padding each side
3. Normalize each item to 0-100% of that range
4. Render proportional CSS blocks
```

Works identically whether input spans 14 billion years or 3 million years.

---

## What's Built So Far

### Dataset (~55 entries)

**Cosmological:** Big Bang, First Stars, Milky Way Forms, Solar System Forms

**Eons:** Hadean, Archean, Proterozoic, Phanerozoic

**Eras:** Paleozoic, Mesozoic, Cenozoic

**Periods — Paleozoic:** Cambrian, Ordovician, Silurian, Devonian, Carboniferous, Permian

**Periods — Mesozoic:** Triassic, Jurassic, Cretaceous

**Periods — Cenozoic:** Paleogene, Neogene, Quaternary

**Epochs:** Paleocene, Eocene, Oligocene, Miocene, Pliocene, Pleistocene, Holocene

**Life Events:** First Life, First Eukaryotes, Great Oxidation Event, First Multicellular Life, Cambrian Explosion, First Fish, First Sharks, First Land Plants, First Insects, First Amphibians, First Reptiles, Permian Mass Extinction, First Dinosaurs, First Mammals, First Birds, First Flowering Plants, K-Pg Mass Extinction, First Primates, First Grasses, First Whales, Himalayas Form, First Horses, First Great Apes, First Hominins, Homo Erectus, Homo Sapiens, First Agriculture, Now

**Future:** Sun Leaves Main Sequence, Earth Surface Sterilized, Sun Becomes White Dwarf, Last Stars Burn Out, Heat Death of Universe

### Features Working

- Fuzzy search with autocomplete (keyboard navigable, arrow keys + enter)
- Alias system — "dinosaur extinction", "chicxulub", "asteroid" all find K-Pg
- Chips UI for selected items with individual removal
- True proportional linear rendering
- Log scale toggle with warning
- Point events rendered as vertical lines
- Hover tooltips with name, type, start, end, duration
- "Now" line rendered when 0 Ma is in view range
- Tick marks with formatted labels (Ma, Ga, kya, yrs ago)
- 5 presets: Eons, Paleozoic, Big Bang→Heat Death, Recent 3, Mesozoic
- Single HTML file, zero dependencies except Google Fonts
- GitHub Pages ready — just drop the file

---

## Things Not Yet Built (Ideas We Discussed)

### High Priority for Your GUI Work

- **Color customization per entry** — `color` field is in the data shape but not yet wired up. Type palette is auto-assigned. Let individual entries override.
- **Parent/hierarchy field** — for grouping in autocomplete (e.g. "Triassic" shows under "Mesozoic" in suggestions)
- **Labels on narrow segments** — currently hidden when segment < 3% wide. Need a better solution (rotated label, label outside segment, hover-reveal)
- **Zoom and pan** — click and drag to zoom into a region. Essential for "show me Quaternary at full detail"
- **Persistent URL state** — encode selected items in URL hash so you can share a specific view
- **Export / screenshot** — save current view as PNG or SVG

### Data Expansion (Add to `TIMELINE_ITEMS`)

- All remaining epochs (Fortunian, Stage 2... Cambrian stages etc.)
- Major extinction events with severity data
- First appearance of major animal groups (insects, beetles, ants, bees, whales, elephants, cats, dogs)
- Human prehistory at finer granularity (stone age, bronze age, iron age)
- Astronomical events (first galaxy clusters, reionization epoch, dark ages)
- Climate events (snowball earth, PETM, glacial cycles)
- Your own custom additions as you find things interesting

### Scale Improvements

- **Ruler with major/minor ticks** scaled to current zoom level
- **Scale indicator** ("1cm = X million years") like a map scale bar
- **Comparison callout** ("The entire history of human civilization is 0.0001% of this view")

### UI Ideas to Explore

- **Vertical vs horizontal toggle** — some people read timelines top-to-bottom
- **Stacked rows** — group by type so eons, eras, periods are on separate rows simultaneously
- **Search from URL** — `?q=triassic,jurassic,cretaceous` loads preset
- **"Surprise me" button** — random interesting combination
- **Nested zoom** — click a period to "zoom in" and see its epochs

---

## File Structure for GitHub Pages

```
your-repo/
  index.html
  to-scale-time.html
  README.md
  package.json
  scripts/
    build-site.mjs
  src/
    app.js
    styles.css
    data/
      timeline-data.js
    lib/
      search.js
      time-scale.js
      timeline-view-model.js
```

`index.html` is the GitHub Pages entry point. `to-scale-time.html` is a compatibility redirect for the old direct URL. Edit `src/data/timeline-data.js` to add entries, presets, or type colors.

Run `npm run build` to create `_site`, then deploy that folder through GitHub Actions.

---

## Data Entry Format Reference

```javascript
// Span (era, period, epoch etc.)
{ id:"unique-id", name:"Display Name", type:"period",
  start_ma: 251.9, end_ma: 201.4,
  aliases: ["alternate name", "another way to search for it"] }

// Point event
{ id:"first-sharks", name:"First Sharks", type:"event",
  start_ma: 450, end_ma: 450,
  aliases: ["sharks","chondrichthyes"] }

// Future event (negative Ma)
{ id:"heat-death", name:"Heat Death", type:"future",
  start_ma: -1e32, end_ma: -1e32,
  aliases: ["heat death","end of universe"] }
```

Types: `eon` `era` `period` `epoch` `event` `future` (or add your own — color palette auto-assigns)

---

## Notes on Scale

For reference when adding data:

| Span | Ma value |
|---|---|
| Big Bang | 13,800 Ma |
| Earth forms | 4,600 Ma |
| First life | 3,800 Ma |
| Cambrian | 538.8 Ma |
| Dinosaur extinction | 66 Ma |
| First humans | 0.3 Ma |
| First agriculture | 0.012 Ma |
| 1,000 years | 0.001 Ma |
| 100 years | 0.0001 Ma |
| Sun expands | -5,000 Ma |
| Heat death | -1×10³² Ma |

---

## Related Notes

- `vault-sync-ideas.md` — this project lives on GitHub Pages, completed files can sync to Obsidian vault
- `claude-design-ideas.md` — Claude Design could help generate UI mockups for the GUI work ahead

---

*Built: May 2026 — v0.1 scaffold complete, GUI work ongoing*

---

## Known Limitations — Scale Math

### What Actually Works

JavaScript `number` is 64-bit float, handles up to ~1.8×10³⁰⁸. So heat death at -1×10³² Ma doesn't overflow — that's fine. The data storage is not the problem.

### What's Actually Broken

**Log scale at extreme ranges:** The current `toLog()` function uses a naive shift-and-log approach:

```javascript
const shift = Math.abs(minMa) + 1;
const val = ma + shift;
// ...log10 math...
```

When the range spans 32+ orders of magnitude (Big Bang to heat death), this shift produces values where `Math.log10()` returns `Infinity` or `NaN`. The rendering silently breaks — segments appear at wrong positions or disappear entirely.

**Tick label formatter:** Doesn't handle post-stellar values gracefully. `-1×10³²` renders as a mangled number. No scientific notation fallback implemented past ~1,000 Ma.

**Linear scale at cosmic ranges:** Mathematically correct but visually useless. Big Bang to heat death makes everything in geological history a fraction of a pixel. Intentional for pedagogy — but the renderer doesn't gracefully handle "segment is 0.000000001px wide" so labels and tooltips break.

### The Proper Fix

**For log scale** — replace naive shift with a signed log transform that handles mixed positive/negative ranges and zero cleanly:

```javascript
function signedLog(x) {
  if (x === 0) return 0;
  return Math.sign(x) * Math.log10(1 + Math.abs(x));
}
```

No NaN, no Infinity, handles negatives, handles zero.

**For tick labels** — auto-switch to scientific notation past a threshold:

```javascript
function formatMa(ma) {
  const abs = Math.abs(ma);
  if (abs >= 1e9) return `${ma.toExponential(2)} Ma`;
  // ...existing logic...
}
```

**For extreme future timescales beyond ~10⁵⁰ Ma** — JavaScript floats lose precision. If you ever add black hole evaporation timescales (~10⁶⁷ years) or true heat death (~10¹⁰⁰⁰ years), you'd need `BigInt` or `big.js`. For the current dataset, regular floats are fine — only the render math needs fixing.

### Pragmatic Recommendation

Fix `toLog()` with the signed log approach — that unblocks Big Bang → Heat Death on log scale. The linear "looks broken" behavior at cosmic ranges is a feature. Don't fix it.

Don't reach for `BigInt` or `big.js` until you add entries beyond ~10⁵⁰ Ma. You don't have any yet.

### Test Cases to Verify Fix

| Preset | Expected behavior |
|---|---|
| Big Bang → Heat Death, linear | Everything geological = invisible sliver. Heat death dominates. Correct. |
| Big Bang → Heat Death, log | All events visible, proportional log spacing, no NaN/Infinity |
| Paleogene + Neogene + Quaternary, linear | Clean proportional blocks, readable tick labels |
| Now only | Single point, "Now" line visible |
| Heat death only | Single future point, negative Ma in scientific notation |
