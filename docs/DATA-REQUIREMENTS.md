# Data requirements

> **Status: draft for discussion.** Everything the live demo shows is **SYNTHETIC EXAMPLE DATA**. No real WA Health data, and no real person, is in this repository.

This page lists what EDFlow WA would need from the WA Health **Emergency Department Data Collection (EDDC)** to run on real data. It is written so that the custodian can read it without having seen the demo. Field names, requirement status and code sets come from the *EDDC Data Specifications* July 2026 (Appendix B pp.7–16), the *Business Rules* July 2026 and the *Data Dictionary* 2026 ([SOURCES.md](SOURCES.md)). The field-by-field mapping with page numbers is in [DATA-DICTIONARY-MAPPING.md](DATA-DICTIONARY-MAPPING.md).

## 1. Purpose and unit of analysis

The demo follows **one ED attendance** (BR §6.3 p.6) from arrival to departure. Each attendance is drawn as one marker. The questions it helps people ask:

* How long are people waiting to be seen, by triage category, against the treatment time in BR Table 1?
* How does that differ by **presenting complaint**, by site, HSP and region, and by hour of the day?
* How long do people stay in the ED, and how do they leave (home, admitted, transferred, did not wait, referred at triage, virtual care completed)?
* How many people are in each ED right now, and how many have been there more than 4 hours?

## 2. Fields needed

Priority: **M** = needed for the picture; **S** = useful; **N** = not needed. "Req." is the Spec's own status. Spec # is the Appendix B field number.

### 2.1 Needed (M)

| Field | Spec # | Req. | Used for |
|---|---|---|---|
| `est_code` | 1 | M | Site. Only the 84 codes with Reports to EDDC = Y |
| `arrival_datetime` | 3 | M | Start of the wait and the stay |
| `triage_datetime` | 4 | M | Presentation Datetime = the earlier of arrival and triage (DD p.100; Q22) |
| `doctor_seen_datetime` | 5 | C | Commencement of clinical care |
| `nurse_seen` | 6 | C | Commencement of clinical care (Q6) |
| `discharge_datetime` | 7 | M | End of the stay |
| `triage_category` | 31 | M | Lane, colour and target |
| `presenting_complaint` | 40 | M | Complaint group (needs the code list, Q2) |
| `departure_status` | 32 | M | How people left |
| `departure_ready_datetime` | 42 | C | "Ready to leave" stage |

### 2.2 Useful (S)

| Field | Spec # | Req. | Used for |
|---|---|---|---|
| `sequence_number` | 2 | M | De-duplication only |
| `mode_of_arrival` | 35 | M | Ambulance / air / own way colouring |
| `visit_type` | 34 | M | WAVED visit types, return visits |
| `referral_source` | 36 | M | Click card; WAVED → ED link (Q30) |
| `destination_on_departure` | 33 | M | Click card; transfers (Q10, Q19) |
| `date_of_birth` | 23 | M | Age group only, computed then discarded (format Q28) |
| `bed_req_date_time` | 51 | C | Waiting for a bed (Q18) |
| `ward_ready_date` | 72 | C | Waiting for a bed (Q18) |
| `admission_datetime` | 8 | C | Admitted path |
| `short_stay_unit_admission_date` | 53 | C | SSU path (Q9) |
| `treat_doc_date`, `snr_doc_date` | 59, 60 | C | Fallback for Doctor Seen (DD p.30) |
| `fsy_code` (Feeder System) | 44 | M | Rules that differ by system (Q14) |

### 2.3 Not needed (N)

The following are not needed, and **should not be supplied**:
- names, addresses, phone numbers;
- Medicare, DVA, UMRN and account numbers;
- Aboriginal status;
- sex and gender;
- marital, employment and occupation fields;
- diagnosis and injury fields;
- methamphetamine flags;
- FDV indicator;
- clinical comments.

## 3. Reference data

| Item | Where from | Status |
|---|---|---|
| Sites that report to EDDC | Establishment List, May 2026 (v0.1) | Official; Q4, Q29 |
| HSP and region of each site | SLIP and the Central Referral Service page | **Not official**; Q13 |
| Coordinates | SLIP HEALTH-001 | Not official; 3 approximate (⚑ in the app) |
| Presenting complaint code list | EDIS APAC 21 | **Missing**; Q2 |
| Targets and thresholds | BR Table 1 (times); external sources (thresholds and 4 h / 6 h) | Q1 |
| Level / KPI scope of each site | Not supplied | Q23 |

## 4. File format for real mode

* One CSV file with a header row using the DD field names above (case-insensitive). Datetimes are `YYYY-MM-DD HH:MM:SS` (Spec); `DD/MM/YYYY HH:MM[:SS]` is also read.
* Run:

  ```
  node tools/build_data.mjs --in extract.csv --out data/real.json --real --start 2026-06-01 --days 28
  ```

  Then open the site with `?data=real.json` (a file name in `data/`). `data/real*.json` is git-ignored, and the build refuses to overwrite `data/synthetic.json`.
* Rows that cannot be used are counted and listed, never dropped silently:
  - unknown site;
  - unreadable arrival or discharge time;
  - discharge before arrival;
  - triage category 6–8.
* Times out of order are clamped into the stay and counted. Unknown codes are kept with the code as the label.

## 5. Privacy

* Real extracts must stay off GitHub. The output file holds no identifiers, only times relative to arrival, codes and an age group. Even so, it is unit-record data and should be treated as confidential.
* A public version on real data would need aggregation and small-number rules agreed with the custodian (Q20).

## 6. Volumes in the synthetic data

96,250 attendances over 30 days (from 30 May 2026) across 83 active sites. Volumes come from a made-up tier for each site (tertiary, metro, regional, district, small hospital, nursing post, virtual), set in `config/dimensions.json` → `model`. **They are not real volumes** (Q15).
