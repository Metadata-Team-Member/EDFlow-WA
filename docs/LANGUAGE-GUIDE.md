# Language guide

EDFlow WA is built to be shown to the EDDC data custodian and to ED teams. Its wording should be plain, respectful and consistent with WA Health and EDDC terms. This guide records the choices so they can be checked, changed or reused. It follows the same principles as OutpatientFlow WA.

**All data is SYNTHETIC.** Nothing on screen describes a real person or a real attendance.

## 1. Principles

1. **Describe attendances and events, not people's bodies or character.** One marker = one ED attendance. All markers have the same shape and size, with a leaf sprout. Size never encodes anything.
2. **Person-first and non-judgemental.** "People waiting to be seen", "people who did not wait", "a person with a mental health presentation". Not "DNWs", "bed blockers", "frequent flyers" or "psych patients".
3. **Use official words** from the EDDC Business Rules, Data Dictionary and Data Specifications (July 2026) where they exist. Official code labels are kept as written (see §3).
4. **Australian English**, at a plain government reading level, with short sentences.
5. **No transparency for importance.** Filtered-out sites are drawn in solid grey, never faded. Markers only fade while they appear or leave.
6. **Neutral wording for mental health, alcohol and other drugs, and self-harm** (§4).
7. **Aboriginal status, sex, gender and diagnosis are not shown or used.**

## 2. How each visual encoding is described

| What you see | Interface wording | What it is *not* |
|---|---|---|
| A marker | "One marker = one ED attendance" | A person's body, health or worth |
| No ring | Waiting to be seen (before commencement of clinical care) | |
| One ring | In care (clinical care has started) | A measure of how sick someone is |
| Two rings | Ready to leave (Departure Ready Datetime recorded) | |
| Colour | Set by "Colour markers by": triage category, presenting complaint group, HSP or mode of arrival | A characteristic of the person |
| Red outline, concerned face | Waiting past the triage target (BR Table 1) | A judgement of the person or the staff |
| Amber outline | In the ED more than 4 hours | |
| Moving right inside an HSP block | Time since arrival, with a dashed amber line at 4 hours | |
| Small "o" mouth with a label | "did not wait" or "referred at triage" | Fault. The reasons are not recorded and are not assumed |
| Quiet exit, no label | Departure statuses grouped as "Other", including died in ED and admitted reversal | See §4 |

## 3. Terms used

| Used | Source or reason |
|---|---|
| attendance, ED attendance | BR §6.3 p.6 |
| triage category; ATS 1–5 with the Spec labels (Resuscitation, Emergency, Urgent, Semi-urgent, Non-urgent) | Spec field 31; DD p.98 |
| seen within the triage target / recommended time | Plain form of BR §7.4 treatment time and the external KPI name |
| commencement of clinical care | DD pp.30, 66 |
| presenting complaint | DD p.69 |
| did not wait; left at own risk; referred at triage; admitted; transferred | Departure Status labels (Spec 32), shortened |
| virtual care completed at home | Departure 21 (WAVED) |
| Health Service Provider (HSP) | Official |
| WA Virtual Emergency Department (WAVED) | BR §9 |
| Reports to EDDC | The Establishment List column that defines the sites |
| treatment area (Resus, Acute, Fast track, Mental health, Paediatric, Virtual) | Display device only, not an EDDC field (Q21) |

## 4. Sensitive topics

* **Presenting complaint groups** use neutral headings close to DD Table 1: "Alcohol and other drug use", "Poison / chemical exposure", "Social / behavioural". The demo has no group for self-harm. Self-harm sub-codes in Table 1 are not drawn out, labelled or counted on their own.
* **Mental health** is "Mental health" as a treatment area only. It is never used to label a person.
* **Deaths** (departure 6) and **dead on arrival** (7, triage 6) get no animation or label. A marker leaves quietly. Triage 6 is not simulated.
* **Methamphetamine flags, FDV indicator, human intent of injury** are not read or shown.
* **Police / correctional** is shown as a mode of arrival (Spec 35) without comment.

## 5. Terms avoided

| Avoid | Use instead | Why |
|---|---|---|
| bed block(er), boarder, ramped patient | people waiting for a bed; ready to be admitted | Blames the person for a system delay |
| frequent flyer, regular, heavy user | (not shown) | Labels people |
| DNW (as a noun for people), absconder, no-show | did not wait; left at own risk | Implies fault |
| psych patient, mental, crazy, drunk, junkie, addict, OD | mental health presentation; alcohol and other drug use; poison / chemical exposure | Stigmatising |
| suicide attempt, self-harmer | (not shown) | No such group in the demo |
| elderly, the aged | older people, or the age group | Be specific |
| bigger/larger/heavier marker, grows, shrinks | rings, outlines, position | Size is never used |
| faded / dimmed (for less important) | grey (filtered out) | Transparency does not mean importance |

### Words that still appear, and why

* **alpha, opacity, fade** in code: they control markers appearing and leaving, and the intro overlay. They never rank importance.
* **larger metro sites** in a `js/scene.js` comment: about which site names fit on the map.
* **weights** in the generator: statistical sampling weights.
* Official labels such as "Died in ED", "Dead on arrival, not treated in ED", "Did not wait to be attended by medical officer" in `config/dimensions.json`: kept as written so real extracts match.

## 6. Where the wording lives

`index.html` (intro, notes, "What the measures mean"), `js/ui.js` (legend, KPI and click card), `js/tour.js` (tour), `js/scene.js` (moment labels), `js/charts.js` (chart titles and notes), `config/dimensions.json` (code labels and groups).
