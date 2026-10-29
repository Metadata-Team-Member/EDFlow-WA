# Research log

Times are Australia/Perth (AWST, UTC+8). All work happened on Thursday 29 October 2026. Steps were not timestamped one by one, so they are grouped in order.

## Brief

Build a sibling to OutpatientFlow WA for the **Emergency Department Data Collection (EDDC)**. It should focus on **wait time by triage category and presenting complaint**. The sites are the establishments with **Reports to EDDC = Y** in the Establishment List. It should be a "beautiful simulation" in the same style, and come with written questions for the EDDC custodian.

## 1. Reading the supplied documents

* The project's user supplied four PDFs: Business Rules (32 pp.), Data Dictionary (119 pp.) and Data Specifications (23 pp.), all July 2026, and the Establishment List, May 2026 (36 pp.). They were converted with `pdftotext` (layout and plain modes) and read in full. They are **not committed**; see [SOURCES.md](SOURCES.md).
* Page numbers: the printed footer number is used throughout. In the text extracts the footer comes *after* the page content. The BR numbering is offset by 4 from the PDF page index (BR p.9 = PDF page 13).

## 2. Which sites report to EDDC

* The Establishment List is a wide table split across pages. It has a "Reports to" block with EDDC, HMDC, NADC, ESWLDC, MHDC and SANADC columns. `tools/extract_establishment_list.py` reads it from the `pdftotext -layout` output by column position.
* **Result: 84 establishment codes with Reports to EDDC = Y, covering 83 sites.** 0145 and 0645 are both Peel Health Campus.
* Checks:
  1. A second, independent parse of the same table (row-by-row from the plain-text extract) gave the same 84 codes.
  2. The same method gives 125 sites for NADC. That matches the count already confirmed in OutpatientFlow WA.
  3. A cross-check against the SLIP "ED" flag (Landgate HEALTH-001) matched 81 sites. The four differences are listed in [ESTABLISHMENTS.md](ESTABLISHMENTS.md) and raised as Q13.
* HSP, region and coordinates are not in the List. They came from SLIP and the Department's Central Referral Service page, as in OutpatientFlow WA (see ESTABLISHMENTS.md, "What is official and what is not").

## 3. Triage targets

* BR §7.4 Table 1 (p.9) gives treatment times: ATS 1 ≤ 2 min, 2 ≤ 10, 3 ≤ 30, 4 ≤ 60, 5 ≤ 120. DD p.98 and Spec 31 describe ATS 1 as "within seconds" (Q3).
* **No performance thresholds or access targets are in the EDDC documents.** BR §12 (p.20) only names the WA Emergency Access Measures. Searched for public sources:
  * EMHS annual report "Access to emergency services": thresholds 100 / 80 / 75 / 70 / 70 %.
  * Office of the Auditor General, *Quality and Utilisation of ED Data*: the emergency access measures applying from December 2023. It also notes that the seen-within-recommended-times indicator had not been audited since 2012.
  * WA Government media statement, 26 April 2023: 80 % of discharged people within 4 h, 80 % of admitted people within 6 h, 100 % within 12 h.
  * WA Health WEAT page: 90 % within 4 h (2016). Historical only; not used on screen.
* These are shown as **external, to be confirmed** (Q1).

## 4. Commencement of clinical care: how the rule changed

1. **First version:** time to be seen = Doctor Seen Datetime − arrival. Doctor Seen covers "a medical practitioner or other authorised clinician (nurse practitioner, nurse, …)" (DD p.30).
2. **Second version:** DD p.66 says Nurse Seen "is used in the calculation of clinical care commencement for WACHS sites". So the earlier of Doctor Seen and Nurse Seen was used at WACHS sites only.
3. **Final version:** a search led to the WA Health **2025-26 OBM KPI Data Definition Manual**, §7.1.0 "Percentage of emergency department patients seen within recommended times". The search-engine extract describes:
   * wait = commencement of clinical care − Presentation Datetime;
   * commencement as the earlier of the doctor-seen and nurse-seen times;
   * exclusions: null commencement and negative waits;
   * scope: EDs at Level 3B and above.

   The rule was changed to the **earlier of the two times at every site**. The generator, `tools/build_data.mjs`, the real-mode test and the on-screen notes were all updated.
4. **The OBM manual PDF could not be read in full.** `curl` failed with a TLS error, and the fetch tool returned HTTP 500 (the same behaviour as health.wa.gov.au PDFs in the OutpatientFlow work). It is cited as "not read in full", and the difference from DD p.66 is open question **Q6**.
5. Later, a fallback was added for extracts with no `doctor_seen_datetime` column: Doctor Seen is derived as DD p.30 describes, the earlier of `treat_doc_date` and `snr_doc_date`.

## 5. Presenting complaint

* DD p.69: X(5), "Permitted values: N/A", "uniform with EDIS APAC 21". **There is no code list in the documents.**
* The only codes printed are in the methamphetamine section. Table 1 (DD pp.58–59) lists E (drug / alcohol use), K (neurological), R (poison / chemical exposure) and T (social / behavioural) codes. The worked examples (DD p.57) use BEA00 for chest pain.
* The demo has four confirmed groups (E, K, R, T), BEA00 as an example, and placeholder groups whose codes start with `#` so they cannot be mistaken for real codes. Raised as Q2.
* Searched for a public APAC 21 / EDIS symptom code list. Found none that could be read and cited; the search results only point back to the DD's Table 1 codes. Nothing from search summaries is used.
* The search did turn up two related national resources. Neither is used, because neither is the WA code set:
  * the Australian Digital Health Agency's SNOMED CT-AU *Emergency department diagnosis in presenting problem* reference set;
  * the IHACPA EPD short list, which is for diagnosis, not complaint.

## 6. Other findings that became questions

Listed in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md):
* Departure 13 is in the Spec but not in the DD.
* Departure 4 has different wording in its label and its guide.
* The Albany example (Q8).
* SSU reversal versus code 20 (Q9).
* The Destination field holds an establishment code in webPAS (Q10, Q19).
* Referred at triage is recorded as ATS 5 (Q25).
* Date of birth has two formats (Q28).
* The WAVED referring hospital (Q30).

## 7. Build and checks

* The seeded generator produces 96,250 synthetic attendances over 30 days. All 83 active sites have data; 0645 is an alias with none. ATS split: 928 / 12,349 / 31,979 / 37,058 / 13,936.
* `npm run test:real` checks the real-mode loader on a small hand-made CSV. All checks pass.
* Browser checks with Playwright (Chrome) at 1440×900 and 390×844 covered: no console errors, Play, the 7-step tour, and that nothing overlaps.
