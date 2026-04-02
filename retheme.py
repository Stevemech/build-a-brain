import re

with open("src/App.tsx", "r") as f:
    src = f.read()

# ── 1. Hero section background gradient (dark purple → soft warm lavender) ──
src = src.replace(
    "background: \"radial-gradient(ellipse 80% 60% at 50% 40%, #2a0a4e 0%, #150d30 35%, #0a0818 70%)\"",
    "background: \"radial-gradient(ellipse 80% 60% at 50% 40%, #ede9fe 0%, #f5f3ff 40%, #faf9f7 75%)\""
)

# ── 2. Hero fade-to-bg at bottom ──
src = src.replace(
    "style={{ background: \"linear-gradient(to bottom, transparent, #0a0818)\" }}",
    "style={{ background: \"linear-gradient(to bottom, transparent, #faf9f7)\" }}"
)

# ── 3. Hero text color overrides (light text → dark text) ──
# "MOVE YOUR CURSOR TO ROTATE THE BRAIN" hint text
src = src.replace(
    "color: \"rgba(255,255,255,0.25)\"",
    "color: \"rgba(44,41,37,0.3)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.3)\"",
    "color: \"rgba(44,41,37,0.3)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.4)\"",
    "color: \"rgba(44,41,37,0.35)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.5)\"",
    "color: \"rgba(44,41,37,0.4)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.6)\"",
    "color: \"rgba(44,41,37,0.5)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.7)\"",
    "color: \"rgba(44,41,37,0.6)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.8)\"",
    "color: \"rgba(44,41,37,0.7)\""
)
src = src.replace(
    "color: \"rgba(255,255,255,0.9)\"",
    "color: \"rgba(44,41,37,0.8)\""
)
src = src.replace(
    "color: \"white\"",
    "color: \"var(--color-text)\""
)
src = src.replace(
    "color: \"#fff\"",
    "color: \"var(--color-text)\""
)

# ── 4. Dark hardcoded surface backgrounds → light equivalents ──
src = src.replace("background: \"#1a1735\"", "background: \"var(--color-surface-2)\"")
src = src.replace("background: \"#110f24\"", "background: \"var(--color-surface)\"")
src = src.replace("background: \"#0a0818\"", "background: \"var(--color-bg)\"")
src = src.replace("fill=\"#1a1735\"", "fill=\"#F3F1EE\"")
src = src.replace("stroke=\"#2a2650\"", "stroke=\"#E4E0DA\"")
src = src.replace("stroke=\"#0a0818\"", "stroke=\"#FAF9F7\"")
src = src.replace("stroke=\"#2a265022\"", "stroke=\"#E4E0DA22\"")

# ── 5. The brain SVG inner-fill references ──
src = src.replace("fill=\"#0a0818\"", "fill=\"#FAF9F7\"")
src = src.replace("fill=\"#110f24\"", "fill=\"#FFFFFF\"")

# ── 6. Separator borderRight using var(--color-bg) ──
# already using CSS var so will auto-update

# ── 7. Section background ──
src = src.replace(
    "style={{ background: \"var(--color-bg)\", minHeight: \"100vh\" }}",
    "style={{ background: \"var(--color-bg)\", minHeight: \"100vh\" }}"
)

# ── 8. Hero radial glow pulses (purple glow on dark) → muted on light ──
src = src.replace(
    "background: \"radial-gradient(circle, #8b5cf6, transparent)\"",
    "background: \"radial-gradient(circle, #7C3AED40, transparent)\""
)
src = src.replace(
    "background: \"radial-gradient(circle, #8b5cf6 40%, transparent 80%)\"",
    "background: \"radial-gradient(circle, #7C3AED30 40%, transparent 80%)\""
)

# ── 9. Pathway connector positive/negative change badges ──
src = src.replace(
    "background: isPositive ? \"#10b98115\" : \"#a78bfa15\"",
    "background: isPositive ? \"#d1fae5\" : \"#ede9fe\""
)
src = src.replace(
    "background: isPositive ? \"#10b98118\" : \"#ef444418\"",
    "background: isPositive ? \"#d1fae5\" : \"#fee2e2\""
)

# ── 10. Stage card tooltip/extra panels dark backgrounds ──
src = src.replace("background: \"var(--color-surface-2)\", color: \"var(--color-text-dim)\"",
                  "background: \"var(--color-surface-2)\", color: \"var(--color-text-dim)\"")

# ── 11. Distortion/warning band ──
src = src.replace(
    "background: \"#ef444418\", border: \"1px solid #ef444430\", color: \"#f87171\"",
    "background: \"#fee2e2\", border: \"1px solid #fca5a5\", color: \"#b91c1c\""
)

# ── 12. Brain SVG neck/base arc strokes ──
src = src.replace("stroke=\"#2a265022\"", "stroke=\"#D1CAC080\"")

# ── 13. Tab bar background (dark pill) → light pill ──
# The tab bar uses inline background on the wrapper
src = src.replace(
    "background: \"#1a1735\",",
    "background: \"var(--color-surface-2)\","
)

# ── 14. Hero title — make the "Brain" split white/purple work on light bg ──
# Currently text-white for Build-A and text-accent for Brain
# Change to text-[color-text] for Build-A- and keep accent for Brain
src = src.replace(
    "className=\"text-white font-bold\"",
    "className=\"font-bold\" style={{ color: 'var(--color-text)' }}"
)

# ── 15. Particle color in CSS already updated in index.css ──
# The inline star/dot particles in hero JSX use inline bg color
src = src.replace(
    "backgroundColor: \"rgba(139,92,246,",
    "backgroundColor: \"rgba(124,58,237,"
)
src = src.replace(
    "background: \"rgba(139,92,246,",
    "background: \"rgba(124,58,237,"
)

# ── 16. PSYC 203 badge — currently dark ──
# It uses inline styles, find and update
src = src.replace(
    "background: \"#1a173580\"",
    "background: \"var(--color-surface-2)\""
)
src = src.replace(
    "background: \"#1a1735\"",
    "background: \"var(--color-surface-2)\""
)

# ── 17. Stage waveform SVG mid-line color ──
src = src.replace(
    "stroke=\"var(--color-border)\"",
    "stroke=\"var(--color-border)\""
)

print("Done. Writing back...")

with open("src/App.tsx", "w") as f:
    f.write(src)

print("Written.")
