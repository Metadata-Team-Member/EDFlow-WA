# Contributing

Thanks for helping refine EDFlow WA. It is a prototype for discussion with the EDDC data custodian, so accuracy and clear sourcing matter more than features.

## How to make a change

1. **Branch and pull request.** Never push straight to `main`. Create a branch (`git switch -c fix/q6-seen-rule`), push it, and open a pull request. GitHub Pages publishes `main`, so anything merged is live.
2. **Keep each change focused.** One idea per pull request: for example "answer Q2: add the complaint code list", not a rewrite. Describe the concept and the source in the PR description.
3. **Cite the source.** Any rule, code or target must name its document and printed page (for example "DD 2026 p.66" or "BR §7.4 p.9"). If something is assumed, say so in the code and in [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md).
4. **Closing an open question:** move it to "Closed by the documents" (or note the answer under it), keep its number, and update every place that cites it. Find them with `grep -rn "Q6\|question 6" .`.
5. **Rebuild and test** before you push:

   ```bash
   npm run data        # if config/dimensions.json or the generator changed
   npm run test:real   # the real-mode loader test must pass
   npm run serve       # check http://localhost:8941 on a desktop and a phone-sized window
   ```

   Check that there are no console errors, that Play and the tour work, and that nothing overlaps at about 1440 px and 390 px wide.

## Rules

* **Never commit truncated text.** If a tool or an AI assistant gives you a file with a line like `[...]`, `…truncated…` or "rest unchanged", do not commit it. Rewrite the full content. Check with `git diff` before every commit.
* **No real data.** Never commit an EDDC extract, a `data/real*.json` file or anything with identifiers. Never commit the source PDFs; quote only short cited excerpts.
* **No force-push** to `main`, and no rewriting of shared history.
* **Language:** follow [docs/LANGUAGE-GUIDE.md](docs/LANGUAGE-GUIDE.md). That means person-first and neutral wording, no body-size encoding, no transparency to mean "less important", and the official EDDC terms.
* **Keep it static:** plain HTML, CSS and JavaScript, no build step, no CDN, no tracking.
* **Synthetic badge:** the "SYNTHETIC EXAMPLE DATA · not real WA Health data" badge must stay whenever the synthetic file is loaded.

## Where things live

| Change | File |
|---|---|
| Code labels, targets, complaint groups, volume model | `config/dimensions.json`, then `npm run data` |
| How synthetic attendances are generated | `tools/generate_synthetic.mjs` |
| How a CSV is read (real mode) | `tools/build_data.mjs`, plus `tools/test_real_mode.mjs` |
| Measures (seen on time, 4 h, DNW) | `js/data.js` |
| Scene and animation | `js/scene.js`, `js/sprites.js` |
| Charts / tour / controls | `js/charts.js` / `js/tour.js` / `js/ui.js` |
| Sites | `tools/build_establishments.mjs` (then `npm run establishments`) |
