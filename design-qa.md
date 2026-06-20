**Comparison Target**
- Source visual truth: `C:\Users\kerts\AppData\Local\Temp\codex-clipboard-5fb86a58-7092-46b9-812e-1ab388b0ff64.png`
- Implementation screenshots: `C:\Users\kerts\AppData\Local\Temp\start-state-series-desktop-clean.png`, `C:\Users\kerts\AppData\Local\Temp\start-state-series-mobile-card.png`, `C:\Users\kerts\AppData\Local\Temp\start-state-series-mobile-lower.png`
- Combined comparison: `C:\Users\kerts\AppData\Local\Temp\start-state-series-comparison.png`
- Viewports: 1280x720 desktop and 480x840 responsive view
- State: gallery detail for the city motif, two expanded neutral start-state series

**Full-View Comparison Evidence**
- The source shows the former repeated full-size run cards. The implementation groups each shared start board into one bordered series card with one preview and one practice action.
- Series 1 and Series 2 remain visually distinct while using the same hierarchy as the existing challenge-series cards.

**Focused Region Comparison Evidence**
- The mobile header capture verifies the series title, run count, status badge, collapse control, shared board and single practice action.
- The mobile lower capture verifies compact run rows for practice and origin, including time, net moves, assistance mode and series-best markers.

**Findings**
- No actionable P0, P1 or P2 differences remain.
- Fonts and typography: existing app families, weights and uppercase kickers are reused consistently.
- Spacing and layout rhythm: the card, shared-start panel and run list keep the established challenge-card gaps, radii and padding at both checked viewports.
- Colors and visual tokens: the existing yellow start-state relation color and image-theme tokens are preserved.
- Image quality and asset fidelity: the real stored start-board preview and existing Lucide icons are reused without substitutes.
- Copy and content: each series exposes one shared action and lists all associated runs below it; the action becomes `Vorlage herausfordern` as soon as a clean eligible run exists.

**Patches Made Since Previous QA Pass**
- Replaced repeated per-run cards with one collapsible card per start-state series.
- Added one shared practice replay in `practice` mode.
- Promoted a later clean practice run to the shared challenge-template action.
- Added compact best-value-sorted run rows and responsive styling.
- Updated keyboard smoke coverage and project documentation.

**Implementation Checklist**
- [x] One card per start-state series
- [x] One shared start-board preview and practice action
- [x] Compact associated-run rows
- [x] Collapse interaction and accessible labels
- [x] Desktop and mobile visual verification

**Follow-up Polish**
- No blocking follow-up polish identified.

final result: passed
