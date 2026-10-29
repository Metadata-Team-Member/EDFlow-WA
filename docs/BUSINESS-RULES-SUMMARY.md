# Business rules summary

A short, cited summary of the parts of the *Emergency Department Patient Activity Data Business Rules* (**BR**, July 2026) and the *EDDC Data Dictionary 2026* (**DD**) that shape the demo. Page numbers are the printed footer numbers (see [SOURCES.md](SOURCES.md)). Quotes are short and for checking only. The full documents are the authority.

"Demo" says what EDFlow WA does with each rule. "Q" points to [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## 1. Scope and counting

| # | Rule | Source | Demo |
|---|---|---|---|
| 1 | All ED services in public hospitals and contracted health entities (CHEs) are in scope, including physical attendances, Emergency Virtual Care (EVC) and virtual triage. People directly admitted without triage or ED care are out of scope. | BR §4 p.3 | All 84 EDDC codes are in the site list. WAVED (0123) is drawn as a statewide virtual site. |
| 2 | Approved information systems: EDIS, ED webPAS, WAVED Virtual Care Connect (VCC) and Midland webPAS. | BR §4 p.3 | Feeder system is not shown (Q14). |
| 3 | An ED must be formally designated by the Department of Health to qualify for ED activity recording, counting and funding. | BR §6.1 p.6 | Nursing posts in the List are shown, with a small volume (Q12). |
| 4 | An attendance = registered in an approved system **or** triaged. It includes people who leave before treatment, people who leave before treatment is complete, people advised of other options, DOA certified by an ED clinician, and EVC. It excludes people not triaged or registered, clerical-only pre-arranged admissions, and people only waiting for transit. | BR §6.3 pp.6–7 | Every marker is one attendance. Did not wait and referred at triage are included. |
| 5 | Episode of care: from attending to physically departing the ED (for virtual care, to completion of virtual care). | BR §6.4 p.7 | Time in the ED = arrival → discharge datetime. |
| 6 | Counted activity needs a triage category, registration, treatment by an authorised clinician and at least one valid discharge diagnosis, except Did Not Wait. | BR §6.5 p.7 | Diagnosis is not simulated (out of scope for a wait-time demo). |

## 2. Times and triage

| # | Rule | Source | Demo |
|---|---|---|---|
| 7 | **Arrival**: when the person first attends the ED. For St John WA ambulance arrivals: when the person enters the ED or is first received by the triage or ED clinician. | BR §7.2 p.8; DD p.13 | The wait clock starts at arrival (Q22). |
| 8 | **Triage time**: when triage commenced; not changed retrospectively. Re-triage on deterioration is allowed but "not relevant to WACHS at this time". | BR §7.3 p.8 | One triage category per attendance; no re-triage (Q16). |
| 9 | **ATS treatment time targets**: ATS 1 ≤ 2 min, ATS 2 ≤ 10, ATS 3 ≤ 30, ATS 4 ≤ 60, ATS 5 ≤ 120 ("Adapted from ACEM"). | BR §7.4 Table 1 p.9 | Lane targets, red outline, "seen within target" KPI and chart. |
| 10 | Optional administrative triage categories: DOA, Direct Admission, Inpatient. No treatment time target. | BR §7.4 Table 2 p.9; DD p.98 (codes 6, 7, 8) | Not simulated. In real mode, rows with triage 6, 7 or 8 are skipped and counted in the build report. |
| 11 | DD labels ATS 1 "Resuscitation: immediate (within seconds)". | DD p.98; Spec field 31 p.8 | The 2-minute BR figure is used (Q3). |
| 12 | Presentation Datetime = the earlier of arrival and triage datetime, "the datetime used … for reporting". | DD p.100 | See Q22. Triage before arrival is clamped to arrival in real mode. |
| 13 | Ambulance arrivals need the ambulance handover and case number recorded; the case number as soon as possible. | BR §7.5, §7.5.1 p.9 | Mode of arrival only. No handover time field exists in the Spec (Q17). |
| 14 | Unplanned re-attendance within 24 hours: new episode with an unplanned return visit type if discharged home or to SSU; continue the earlier episode if care was interrupted or the person left temporarily. | BR §7.6.3 p.10 | Visit type 3 is generated at a small rate. Not linked to earlier attendances. |
| 15 | A presenting complaint / initial diagnosis must be recorded. | BR §7.7 p.10; DD p.69 | Complaint group filter and chart (Q2). |

## 3. Commencement of clinical care ("seen")

| # | Rule | Source | Demo |
|---|---|---|---|
| 16 | Clinical care can be commenced by a medical practitioner or other authorised clinician (nurse practitioner, nurse, mental health practitioner or other health professional) under an established clinical pathway. Placing someone in a cubicle or taking observations before a decision does not count. | BR §7.8 p.11 | "Seen" = commencement of clinical care. |
| 17 | In EDIS, the placeholders "ZZ_CLINICIAN_CARE_COMMENCED" and "ZZ_NURSE_INITIATED_PATHWAY" record the start in the Treating Doctor or Senior Doctor fields. | BR §7.8 p.11; Spec fields 67–68 (types ZZCC, ZZNIP) pp.14–15 | Not modelled separately (Q6). |
| 18 | Doctor Seen Datetime is the earliest time a doctor or other authorised clinician commenced care. Nurse Seen Datetime is used for clinical care commencement at WACHS sites. | DD pp.30, 66 | The demo takes the **earlier of Doctor Seen and Nurse Seen** at every site, as in the WA Health 2025-26 OBM KPI manual (external, Q6). |

## 4. Leaving the ED

| # | Rule | Source | Demo |
|---|---|---|---|
| 19 | **Referred at triage** (departure 8): triaged and registered, then referred elsewhere before any ED care. Distinct from transfer (3), which needs ED care to have started. | BR §8.1 p.12; DD p.24 | Leaves from the waiting lane with a "referred at triage" label. Not in the seen-on-time denominator (Q7). |
| 20 | **Did not wait** (departure 4): triaged and registered, left before clinical care. No commencement time and no principal diagnosis are recorded. Discharge time = when the person left, or when they were noticed to be absent. | BR §8.2 p.12 | Leaves from the waiting lane. No seen time. Not in the seen-on-time denominator (Q7). |
| 21 | **Left at own risk** (departure 5): after care started and before it was completed. A valid principal diagnosis is required. If the person returns, the same episode continues. | BR §8.3 p.13 | Leaves through the home gate with an outline label. |
| 22 | **Transfer** (departure 3): to another hospital without first being admitted. The destination must be a valid establishment code from the Establishment List. | BR §8.4 p.13 | Transfer gate. Destination code not modelled (Q19). |
| 23 | **Died in ED**: departure 6, destination 5 Mortuary, discharge = time certified. **DOA**: triage 6, departure 7, destination 5, visit type 10. | BR §8.5 pp.13–14; DD p.98 | Rare; not shown as moving markers. |
| 24 | **Admission time** = when the person physically left the ED for an SSU, ward or theatre at the same hospital. The decision to admit must be documented with date and time. | BR §8.6 p.14 | Admitted markers leave at discharge datetime. The second ring starts at Departure Ready Datetime (DD p.23); bed request and ward ready are generated but not drawn (Q18). |
| 25 | **SSU**: a designated inpatient unit, physically separate, stays ≤ 24 hours, not an overflow area. "The SSU must not be used to avoid breaching a measured performance threshold." If an SSU admission is reversed, the departure status and end time are corrected. | BR §8.6.1 pp.14–15; DD p.24 (code 20) | SSU (10) counts as admitted. Reversal (20) is grouped as "other" (Q9). |
| 26 | Mental Health Observation Area is **not in scope** for ED activity; a reversed MHOA admission continues the ED episode. | BR §8.6.2 p.15 | No MHOA stage (Q26). |
| 27 | A person still in the ED waiting for a bed must not be admitted to a virtual ward. | BR §8.6.3 p.16 | Waiting for a bed stays in the ED block. |

## 5. Emergency Virtual Care and WAVED

| # | Rule | Source | Demo |
|---|---|---|---|
| 28 | EVC is in scope for national reporting only when all five criteria are met (equivalent to face to face, mutually responsive, audio-visual, condition visible, delivered by an emergency service clinician). | BR §9 p.17 | WAVED is the only virtual site. |
| 29 | When WAVED sends someone to an ED, the receiving ED creates a **new** episode with Referral Source "Other hospital" and hospital "WA Virtual Emergency Department". | BR §9.2.1 p.18 | Not linked. Referral source 6 "Other hospital" appears on inter-hospital arrivals only (Q11). |
| 30 | WAVED consult outcomes map to EDDC departure statuses (21 virtual care completed at home, 22 transfer to another hospital ED). | BR §9.2.2 p.18; DD p.24 | WAVED markers leave by "virtual care completed" or "transfer". |
| 31 | WAVED → ED is **not** an unplanned return. A return to WAVED within 48 hours with the same condition **is** an unplanned return. | BR §9.2.3 p.18 | Not linked (Q27). |
| 32 | WAVED waits are not in the seen-on-time measure in this demo. | (demo choice) | Q11. |

## 6. Data management and performance

| # | Rule | Source | Demo |
|---|---|---|---|
| 33 | AECC end classes use diagnosis, age group, visit type, episode end status, triage category and transport mode. DNW with a diagnosis gets an error class. | BR §10.1 p.19 | Not modelled. |
| 34 | Corrections to the previous quarter must be made by the 2nd month of the current quarter (e.g. July–September by 30 November). | BR §11 p.19 | The README notes that recent data can still change (Q24). |
| 35 | WA Emergency Access Measures are monitored indicators; see MP 0111/19 Performance Management Policy. **No figures are given.** | BR §12 p.20 | The 4-hour line, 6-hour admitted and 12-hour figures are external (Q1). |
| 36 | Daily extracts with the previous 90 days of activity: EDIS 1:00 am, webPAS 6:30 am, Midland webPAS 6:45 am; webPAS monthly full refresh on the 5th at 2 pm. | Spec §5.1–5.2 p.3 | Real mode expects one CSV in the Spec Appendix B layout (Q24). |
