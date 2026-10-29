# Open questions for the EDDC data custodian

These are the points the July 2026 EDDC documents and the May 2026 Establishment List do not settle, or where they disagree. Each says what the documents say (with printed page numbers), what the demo does for now, and why it matters. The numbers are stable: code, the app and other docs refer to them, so add new questions at the end rather than renumbering.

Abbreviations: **BR** Business Rules 2026, **DD** Data Dictionary 2026, **Spec** Data Specifications 2026, **List** Establishment List May 2026, **OBM manual** WA Health 2025-26 Outcome Based Management KPI Data Definition Manual (external, not read in full; see [RESEARCH-LOG.md](RESEARCH-LOG.md)).

## Answer these five first

These change the headline numbers on screen.

1. **Q1.** Which targets and thresholds should the demo show? None are in the EDDC documents.
2. **Q6.** What is the rule for commencement of clinical care: the earlier of Doctor Seen and Nurse Seen at every site, or Nurse Seen only at WACHS sites?
3. **Q2.** Can we have the presenting complaint code list (EDIS APAC 21) with its headings, so the complaint groups stop being placeholders?
4. **Q7.** Who is in the denominator for "seen within the recommended time"?
5. **Q11.** How should WAVED (0123) be counted in the wait and 4-hour measures?

## Questions

### Measures and targets

**Q1. Targets and performance thresholds.** BR §7.4 Table 1 (p.9) gives the treatment time for each triage category (2, 10, 30, 60, 120 min). It gives **no** performance thresholds. BR §12 (p.20) names the "WA Emergency Access Measures" and refers to MP 0111/19 Performance Management Policy, without saying what they are. The demo shows, marked as external and to be confirmed:
- thresholds of 100/80/75/70/70 % (HSP annual reports, OBM manual);
- 80 % of people discharged within 4 h, 80 % of people admitted within 6 h and 100 % within 12 h (WA Government statement of 26 April 2023; OAG report).
*Ask:* which targets and thresholds apply for 2026-27, and which document should we cite? *Why it matters:* every coloured threshold and every reference line on screen depends on it.

**Q3. ATS 1 target.** BR Table 1 (p.9) says ATS 1 = "Immediate (≤ 2 minutes)". DD p.98 and Spec field 31 say "Resuscitation: immediate (within seconds)". The demo uses 2 minutes. *Ask:* which applies when measuring? *Why:* minute-level rounding decides ATS 1 performance.

**Q6. Commencement of clinical care.**
- DD p.30 says Doctor Seen Datetime is the earlier of Treating and Senior Doctor Seen, and covers "a medical practitioner or other authorised clinician (nurse practitioner, nurse, mental health practitioner or other health professional)".
- DD p.66 says Nurse Seen "is used in the calculation of clinical care commencement for WACHS sites".
- The OBM manual §7.1.0 (external) defines the wait as commencement minus Presentation Datetime, and appears to take commencement as the earlier of the two times at all sites.
- Bunbury is a WACHS site that uses EDIS (DD p.39). It is not clear whether the DD p.66 "WACHS" rule follows the HSP or the system.

The demo uses the earlier of the two times at every site. *Ask:*
- which rule is right?
- is "WACHS" in DD p.66 about the HSP or about the webPAS system?
- are there placeholder clinician codes (for example ZZ-type codes) whose seen times should be ignored?

*Why:* this can move WACHS "seen on time" results by many points.

**Q7. Denominators for the seen measure.** BR §8.1 (p.12) says referred at triage is recorded as departure 8. DD p.98 says these people are triaged as "5 Non-urgent". People who did not wait (departure 4) have no commencement time. The demo leaves out people with no commencement time (so did not wait is out), people referred at triage, and WAVED. *Ask:* is that the official denominator? Are people who left at own risk (5) included? *Why:* ATS 5 performance changes noticeably depending on whether referrals at triage are counted.

**Q11. WAVED in the measures.** BR §9 (p.17) brings WAVED into scope as a designated virtual ED, and the List has 0123 WA Virtual Hospital with Reports to EDDC = Y. Departure 21 and visit types 26 and 27 apply only to WAVED. The demo shows WAVED as a separate virtual site and leaves it out of the 4-hour and seen measures. *Ask:*
- is WAVED in the seen-within-time, 4-hour and DNW measures?
- what counts as "seen" for a virtual consult?

*Why:* WAVED volume is large enough to change the statewide figures.

**Q22. Presentation Datetime.** DD p.100 says "the earlier of the Arrival Datetime and the Triage Datetime is used to derive Presentation Datetime, which is the datetime used as for reporting." The demo measures waits from arrival. In real mode, a triage time earlier than arrival is clamped to arrival and counted in the build report. *Ask:* should waits and length of stay start at Presentation Datetime? How common is triage before arrival (for example ambulance pre-triage)? *Why:* it shifts every wait.

**Q23. Which sites are in the KPI?** The OBM manual (external) appears to limit the seen-within-time KPI to EDs at Level 3B and above. The List has no role-delineation level. *Ask:* which of the 84 EDDC codes are in the KPI for 2026-27, and where is the level recorded? *Why:* the demo's statewide figures currently include all 83 active sites.

**Q18. Measuring access block.** The Spec has Bed Request Datetime (51), Departure Ready Datetime (42) and Ward Ready Datetime (72) (DD pp.15, 23, 106). The demo uses Departure Ready to draw the "ready to leave" ring. *Ask:*
- which time marks the start of waiting for a bed in WA reporting?
- are Ward Ready and Bed Request reliably filled at all sites, or only EDIS sites?

*Why:* the "waiting for a bed" view depends on it.

### Codes and definitions

**Q2. Presenting complaint code list.** DD p.69: X(5), "Permitted values: N/A", "In September 2020 all symptom codes are uniform with EDIS APAC 21 released." The only codes printed are:
- DD Table 1 (pp.58–59), for the methamphetamine flag: headings E0000, K…, R0000 and T0000 with their sub-codes;
- the DD p.57 worked example of chest pain, coded BEA00.

The demo confirms four groups (E, K, R, T), uses BEA00 as an example, and shows four placeholder groups (Injury, Abdominal, Breathing, Fever / infection) plus "Other / not yet mapped". *Ask:*
- can we have the APAC 21 code list, or at least the first-letter headings?
- is grouping on the first letter sound?
- is there an approved grouping for reporting?
- is there a map to the national SNOMED CT-AU ED presenting problem reference set?

*Why:* the presenting complaint view is half placeholder until this arrives.

**Q8. Departure Status code list and wording.**
- (a) Spec field 32 (p.9) includes **13** "Returned to (or transferred to) residential aged care". The DD list (pp.24–25) goes 1–11, 14, 20, 21, 22 and has no 13.
- (b) Code 4 is labelled "Did not wait to be attended by medical officer", but the DD guide (p.25) says "a health care professional".
- (c) The DD Albany example (p.25) uses "1 - Admitted to the hospital (SSU, HITH, ward)", although SSU and HITH have their own codes, 10 and 11.

*Ask:* is 13 valid? Which wording is current? Should SSU and HITH use 10 and 11? *Why:* departure groups drive the exit gates and the admitted measure.

**Q9. SSU and admitted reversals.** BR §8.6.1 (pp.14–15) says an SSU is a designated inpatient unit and "must not be used to avoid breaching a measured performance threshold". If an SSU admission is cancelled or reversed, BR says the departure status "must be corrected from 'Admitted' to record the actual outcome". DD departure code 20 "Admitted Reversal" seems to record the reversal instead. The demo counts 10 (SSU) as admitted and puts 20 in "Other". *Ask:*
- does an SSU admission count as "admitted" for the 6-hour measure?
- when is code 20 used if BR says the status is corrected?

*Why:* SSU use can change the 4-hour and 6-hour results.

**Q10. Destination on Departure content.** Spec field 33 is N(2) with values 1–12. DD p.27 says:
- for webPAS, the field "is only completed when a patient is transferred … the establishment code of the hospital will be populated in this field";
- for EDIS it captures the ward, and only "some EDIS sites" give the receiving hospital.

*Ask:* in the extract, is this a 1–12 code or a 4-digit establishment code, and does that depend on the system? *Why:* real-mode parsing and any "where people went" view depend on it.

**Q19. Transfer destination.** BR §8.4 (p.13) says "the destination health service must be recorded with a valid establishment code from the WA Health Establishment List". No Spec field holds a 4-digit destination establishment code (see Q10). BR §9.2.1 (p.18) also says a hospital receiving someone from WAVED must "select hospital as 'WA Virtual Emergency Department'". *Ask:* which fields carry the destination hospital and the referring hospital? *Why:* without them the demo cannot draw transfer flows between sites.

**Q25. Referred at triage is recorded as ATS 5.** DD p.98 example: a 15-year-old referred at triage from RPH to PCH is recorded with triage "5 Non-urgent" and departure 8. *Ask:*
- is ATS 5 required for every referral at triage, whatever the clinical urgency?
- should these attendances be left out of ATS 5 statistics?

*Why:* it inflates ATS 5 counts (see Q7).

**Q28. Date of Birth format.** Spec field 23 gives DD/MM/YYYY. DD p.18 gives YYYY-MM-DD. The real-mode loader reads both. *Ask:* which format does the extract use? *Why:* it prevents silent day/month swaps.

**Q16. Re-triage.** BR §7.3 (p.8) allows a second triage when the person's condition gets worse, but adds "This is not relevant to WACHS at this time". Only one Triage Category field exists (Spec 31). *Ask:* does the extract carry the first or the last triage category? *Why:* the target used depends on it.

### Sites and the Establishment List

**Q4. Peel Health Campus 0145 and 0645.** The List has Peel Health Campus under both 0145 and 0645 with Reports to EDDC = Y. 0645 reports to EDDC, MHDC and SANADC only, and is not in the List's Hospital Morbidity System codes table. SLIP uses 645. The demo treats 0645 as an alias of 0145 with no activity. *Ask:* which code does ED activity arrive under, and for which dates (Peel returned to public operation on 13 August 2024)? *Why:* the count of 84 codes and 83 sites depends on it.

**Q5. WAVED as a site.** 0123 "WA Virtual Hospital" is in the List with no HSP and no location. The demo places it under WACHS, based on the WACHS 2025-26 Service Agreement, at a placeholder point in Perth. *Ask:* which HSP should WAVED be reported under? *Why:* HSP totals.

**Q12. Nursing posts and formal designation.** BR §6.1 (p.6) says a facility "must be formally designated by the Department of Health as an ED". The EDDC list includes many small WACHS nursing posts. The demo shows them with small synthetic volumes. *Ask:*
- are all 84 codes designated EDs?
- is there a designation list or role-delineation level we can show?

*Why:* scope and Q23.

**Q13. HSP, region and location are not in the List.** The demo takes HSP, region and coordinates from SLIP (Landgate HEALTH-001 and HEALTH-002) and the Department's Central Referral Service page. Six HSPs are set by hand; see [ESTABLISHMENTS.md](ESTABLISHMENTS.md). The SLIP ED flag disagrees with the List in four places:
- 0123 and 4058 Jurien Bay are in the List but not flagged ED in SLIP;
- 102 Fremantle and 266 Wickham are flagged ED in SLIP but are not EDDC sites in the List.

*Ask:* is there an official site-to-HSP table, and which of the four differences is right? *Why:* map and HSP grouping.

**Q29. Establishment List edition.** The List supplied is May 2026, labelled v0.1. *Ask:* is there a later or final edition, and how should the demo be told about changes? *Why:* the site list is the backbone of the map.

### Data supply and use

**Q14. Feeder systems.** BR §4 (p.3) names EDIS, webPAS, Virtual Care Connect (VCC) and Midland webPAS. Spec field 44 Feeder System lists codes. DD p.39 places Bunbury on EDIS. *Ask:* can we have a site-to-feeder-system table? *Why:* rules differ by system (Q6, Q10).

**Q15. Volumes for realism.** The synthetic volumes come from tiers this project made up (see `config/dimensions.json` `model`). *Ask:* can aggregate monthly attendances by site and triage category be shared, so the synthetic data has a realistic shape? *Why:* the demo looks real, so its proportions should not mislead.

**Q17. Ambulance handover.** BR §7.5 (p.9) says that for ambulance arrivals "the ambulance handover and case number details are also required to be recorded". The Spec has Ambulance Number (71) but no handover time. *Ask:* is handover time collected anywhere, and could it be added? *Why:* ramping is a major part of ED access.

**Q20. Publishing rules.** *Ask:*
- does a synthetic demo that names real sites need a disclaimer or approval beyond the on-screen badge?
- what small-number suppression applies if the demo is ever used with real aggregates?

*Why:* safe public use.

**Q24. Data timing and corrections.** Spec §5.1 (p.3) says daily extracts cover the previous 90 days (EDIS 1:00 am, webPAS 6:30 am, Midland 6:45 am). Spec §5.2 says monthly webPAS full refreshes run on the 5th at 2:00 pm. BR §11 (p.19) allows corrections until the second month of the next quarter. *Ask:*
- which extract should real mode expect?
- can recent weeks be flagged as provisional?

*Why:* recent figures will change.

### Scope

**Q21. Treatment areas and streams.** The demo groups people into areas (Resus, Acute, Fast track, Mental health, Paediatric, Virtual) as a display device. DD p.93 Stream (Spec 78, optional) lists only a few values (for example COVID-19, Fast Track, FDV). *Ask:* is there a field or rule for the area of the ED where the person was treated? *Why:* the areas on screen are inferred, not data.

**Q26. Mental Health Observation Area.** BR §8.6.2 (p.15) says the MHOA "is not in scope for ED activity". If an MHOA admission is reversed, the ED episode continues. The demo has no MHOA stage. *Ask:* how does a transfer to an MHOA show in the extract (departure code, destination)? *Why:* time in the ED for people with mental health presentations.

**Q27. WAVED return visits.** BR §9.2.3 (p.18) says going from WAVED to an ED is not an unplanned return. Returning to WAVED within 48 hours with the same condition is. *Ask:* can the extract link a WAVED episode to the ED attendance that follows it? *Why:* it allows a WAVED-to-ED flow view.

**Q30. Referring hospital for WAVED referrals.** BR §9.2.1 (p.18) asks the receiving ED to record Referral Source "Other hospital" and "select hospital as 'WA Virtual Emergency Department'". Referral Source (Spec 36) has codes 1–7 and no hospital code. *Ask:* where is the referring hospital held, and can it be in the extract? *Why:* the WAVED-to-ED link (Q27).

## Closed by the documents

| Topic | Answer | Source |
|---|---|---|
| Which sites report | Reports to EDDC = Y in the List: 84 codes, 83 sites | List (May 2026); [ESTABLISHMENTS.md](ESTABLISHMENTS.md) |
| Treatment time per triage category | 2 / 10 / 30 / 60 / 120 min | BR §7.4 Table 1 p.9 |
| DOA, direct admission and inpatient categories | Triage 6, 7, 8; no treatment target | BR Table 2 p.9; DD p.98 |
| Length of stay | Arrival to discharge | BR §6.4 p.7; DD pp.13, 28 |
| Doctor Seen derivation | Earlier of Treating and Senior Doctor Seen | DD p.30 |
| Referred at triage recording | Departure 8, triage 5 | BR §8.1 p.12; DD p.98 |
| Departure 22 | Only for WAVED activity in EDIS | Spec field 32 p.9 |
| Feeder system extraction times | Daily, previous 90 days | Spec §5.1 p.3 |
| Field names and formats | One CSV in the Appendix B layout | Spec Appendix B pp.7–16 |
