# Data dictionary mapping

How each EDDC field is used by EDFlow WA. Field names are the **DD 2026 field names** (snake_case, as in "Field name:" on each DD page). The CSV that `tools/build_data.mjs` reads uses these names as column headers, matched case-insensitively. "Spec #" is the field number in the Data Specifications July 2026 Appendix B (pp.7–16).

Page numbers are printed footer numbers ([SOURCES.md](SOURCES.md)).

## 1. Fields read by the demo

| DD field name | Element | DD page | Spec # | Required? (Spec) | How the demo uses it |
|---|---|---|---|---|---|
| `est_code` | Establishment Code | 33 | 1 | Mandatory, NNNN | Site. Must be one of the 84 Reports to EDDC = Y codes ([ESTABLISHMENTS.md](ESTABLISHMENTS.md)). Codes without leading zeros are padded. Unknown codes are skipped and counted |
| `sequence_number` | Sequence Number | 86 | 2 | Mandatory | Not used (row identity only) |
| `arrival_datetime` | Arrival Datetime | 13 | 3 | Mandatory | Start of the wait and of the ED stay |
| `triage_datetime` | Triage Datetime | 100 | 4 | Mandatory | "Triaged" step in the click card. Presentation Datetime = earlier of arrival and triage (DD p.100; Q22) |
| `doctor_seen_datetime` | Doctor Seen Datetime | 30 | 5 | Conditional | Commencement of clinical care, with `nurse_seen` (below). If blank, derived as the earlier of `treat_doc_date` and `snr_doc_date`, as DD p.30 describes |
| `nurse_seen` | Nurse Seen Datetime | 66 | 6 | Conditional | Commencement = the earlier of Doctor Seen and Nurse Seen (OBM KPI manual 2025-26, external). DD p.66 mentions WACHS only (Q6) |
| `treat_doc_date`, `snr_doc_date` | Treating / Senior Doctor Seen Datetime | 95, 83 | 59, 60 | Conditional | Fallback for Doctor Seen only |
| `departure_ready_datetime` | Departure Ready Datetime | 23 | 42 | Conditional | Second ring ("ready to leave") |
| `discharge_datetime` | Discharge Datetime | 28 | 7 | Mandatory | End of the ED stay. Stays over 36 hours are capped for display and counted |
| `date_of_birth` | Date of Birth | 18 | 23 | Mandatory | Age group at arrival (0–14, 15–34, 35–64, 65–84, 85+), used only for the paediatric treatment area and filters. Spec gives DD/MM/YYYY, DD gives YYYY-MM-DD; both are read (Q28) |
| `triage_category` | Triage Category | 98 | 31 | Mandatory | Lane, colour, target. Values 6, 7, 8 are skipped (not ED waits) |
| `presenting_complaint` | Presenting Complaint | 69 | 40 | Mandatory, X(5) | Complaint group (§3 below) |
| `mode_of_arrival` | Mode of Arrival | 64 | 35 | Mandatory | Colour option and filter (grouped, §2) |
| `visit_type` | Visit Type | 103 | 34 | Mandatory | Filter; WAVED-only values 26, 27 |
| `referral_source` | Referral Source | 74 | 36 | Mandatory | Click card |
| `departure_status` | Departure Status | 24 | 32 | Mandatory | Exit gate and departure group (§2) |
| `destination_on_departure` | Destination on Departure | 27 | 33 | Mandatory | Click card |

Generated in the synthetic CSV but **not drawn**: `bed_req_date_time` (DD p.15, Spec 51), `ward_ready_date` (DD p.106, Spec 72), `admission_datetime` (DD p.7, Spec 8), `short_stay_unit_admission_date` (DD p.89, Spec 53). See Q18.

Not used (not needed for a wait-time view, or identifying): names, addresses, phone numbers, Medicare and DVA numbers, UMRN, account number, Aboriginal status, sex and gender, diagnosis, injury fields, methamphetamine flags, FDV indicator, clinical comments.

## 2. Code sets and display groups

Labels are copied from Spec Appendix B. Groups are the demo's own and are listed so they can be checked.

### Triage category (Spec 31; DD p.98; BR §7.4 Table 1 p.9)

| Code | Spec / DD label | BR target | External threshold (to be confirmed) |
|---|---|---|---|
| 1 | Resuscitation: immediate (within seconds) | ≤ 2 min | 100 % |
| 2 | Emergency: within 10 minutes | ≤ 10 min | 80 % |
| 3 | Urgent: within 30 minutes | ≤ 30 min | 75 % |
| 4 | Semi-urgent: within 60 minutes | ≤ 60 min | 70 % |
| 5 | Non-urgent: within 120 minutes | ≤ 120 min | 70 % |
| 6 / 7 / 8 | Dead on arrival / Direct Admission / Inpatient | N/A (BR Table 2) | not simulated |

### Departure status (Spec 32 p.9; DD pp.24–25)

| Code | Label (Spec) | Demo group | Gate |
|---|---|---|---|
| 1 | Admitted to a hospital ward | Admitted | ward |
| 2 | ED service event completed; departed under own care | Home | home |
| 3 | Transferred to another hospital for admission | Transferred | transfer |
| 4 | Did not wait to be attended by medical officer | Did not wait | leaves from the waiting lane |
| 5 | Left at own risk | Left at own risk | home |
| 6 | Died in ED | Other | (not drawn) |
| 7 | Dead on arrival, not treated in ED | Other | (not drawn) |
| 8 | Referred at Triage to other Health Care Service | Referred at triage | leaves from the waiting lane |
| 9 | Unknown | Other | home |
| 10 | Admitted to ED Short Stay Unit (SSU) | Admitted | ward |
| 11 | Admitted to Hospital in the Home (HITH) | Admitted | ward |
| 13 | Returned to (or transferred to) residential aged care | Home | home (Spec only, not in DD; Q8) |
| 14 | Returned to Hospital in the Home (HITH) care | Home | home |
| 20 | Admitted Reversal | Other | home (Q9) |
| 21 | Virtual Emergency Care Completed at Home | Virtual care completed | (WAVED) |
| 22 | Transfer to Hospital Emergency Department | Transferred | transfer. Spec: "currently only applicable to WAVED activity in the EDIS system" |

### Mode of arrival (Spec 35; DD p.64)

1 Private transport, 2 Public transport, 10 Taxi → **Own way**. 3 Ambulance → **Ambulance**. 6 Helicopter rescue, 7 Royal Flying Doctor Service → **Air (RFDS / helicopter)**. 5 Police/Correctional Services → **Police / correctional**. 4 Hospital transport, 8 Other, 9 Not Stated/Unknown → **Other**.

### Visit type, referral source, destination

Visit type (Spec 34; DD p.103): 1, 2, 3, 4, 7, 10, 12, 15, 16, 23, 26, 27, 28, 29 as labelled in `config/dimensions.json`. Referral source (Spec 36; DD p.74): 1–7. Destination (Spec 33; DD p.27): 1–12. Unknown codes in a real extract are kept with the code as the label and reported by the build.

## 3. Presenting complaint groups

**There is no presenting complaint code list in the EDDC documents.** DD p.69: format X(5), "Permitted values: N/A", "In September 2020 all symptom codes are uniform with EDIS APAC 21 released." The only codes printed are in the methamphetamine section: Table 1 "presenting complaint codes" (DD pp.58–59) and the worked examples (DD p.57).

| Group | Status | Codes used | Basis |
|---|---|---|---|
| Neurological | **confirmed heading** | K… (K0000, KB000) | DD Table 1 pp.58–59: "KB000 NEUROLOGICAL; ALTERED CONSCIOUS STATE" |
| Social / behavioural | **confirmed heading** | T… (T0000 and the T sub-codes in Table 1) | DD Table 1: "T0000 SOCIAL / BEHAVIOURAL" |
| Alcohol and other drug use | **confirmed heading** | E… (E0000, EFA00, EK000, EKA00, EKB00 …) | DD Table 1: "E0000 DRUG / ALCOHOL USE" |
| Poison / chemical exposure | **confirmed heading** | R… (R0000, RD000, RDA00, RHA00) | DD Table 1: "R0000 POISON / CHEMICAL EXPOSURE" |
| Chest pain | **example only** | BEA00 | DD p.57 worked examples: a person "presents to an ED with chest pain … code of BEA00". The B heading itself is not printed |
| Injury, Abdominal, Breathing, Fever / infection | **placeholder** | `#INJ0`, `#ABD0`, `#BRE0`, `#FEV0` | Invented. The `#` makes them impossible to confuse with a real 5-character code |
| Other / not yet mapped | **placeholder** | `#OTH0`, and any real code not matched above | Real data falls here until the code list is supplied (Q2) |

In real mode a code is grouped by its **first letter** for the four confirmed headings (E, K, R, T) and by the exact code BEA00 for chest pain. Everything else goes to "Other / not yet mapped". The chart marks unconfirmed groups with *.

Groups use neutral names. Self-harm sub-codes (for example EKBH2, EKBH4) are not shown as their own group (see [LANGUAGE-GUIDE.md](LANGUAGE-GUIDE.md)).

## 4. Derived values

| Derived | Rule | Source |
|---|---|---|
| Time to be seen | commencement − arrival, where commencement = earlier of Doctor Seen and Nurse Seen | BR §7.8 p.11; DD pp.30, 66; OBM KPI manual 2025-26 (external) |
| Seen within target | time to be seen ≤ BR target for the triage category. Denominator: attendances with a commencement time, excluding referred at triage (8) and WAVED (0123). Did not wait (4) has no commencement so is out | BR §7.4; Q7, Q11 |
| Time in the ED | discharge − arrival | BR §6.4 p.7 |
| Left within 4 hours | time in the ED ≤ 240 min, all physical attendances | external (Q1) |
| Admitted within 6 hours | departure 1, 10, 11 and time in the ED ≤ 360 min | external (Q1) |
| Stage (rings) | 0 rings: before commencement. 1 ring: commencement → departure ready. 2 rings: departure ready → discharge | display device |
| Region / HSP of a site | from SLIP and the CRS page, not from the List | [ESTABLISHMENTS.md](ESTABLISHMENTS.md); Q13 |
| Treatment area (Resus, Acute, Fast track, Mental health, Paediatric, Virtual) | from triage, complaint group, age and site | display device only. Not an EDDC field (the optional `stream` field, DD p.93, holds COVID-19 / Fast Track / FDV); Q21 |
