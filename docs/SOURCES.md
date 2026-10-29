# Sources

EDFlow WA is a synthetic demo. The *structure* (field names, code sets, targets and establishments) comes from the sources below. No real attendance data was used.

The PDFs were supplied by the project owner and are **not** in this repository. Short excerpts are quoted for checking only.

## 1. Official WA Health documents (supplied)

| Short name | Document | Printed pages | Used for |
|---|---|---|---|
| **BR** | *Emergency Department Patient Activity Data Business Rules*, July 2026 (Department of Health WA, related document under MP 0164/21 Patient Activity Data Policy) | 32 PDF pages | Counting rules, ATS treatment time targets (§7.4 Table 1), departure rules, SSU, WAVED, corrections |
| **DD** | *Emergency Department Data Collection Data Dictionary*, July 2026 (footer "Data Dictionary 2026") | 119 PDF pages | Field definitions, permitted values, examples, presenting complaint examples (Table 1) |
| **Spec** | *Emergency Department Data Collection Data Specifications*, July 2026 | 23 PDF pages | Submission schedule (§5), the 81-field data element listing (Appendix B) |
| **EL** | *WA Health Establishment List*, May 2026 | 36 PDF pages | The **Reports to EDDC** column: which establishments are in scope (84 codes, 83 sites) |

**Page numbers.** Every page reference in this repository (for example "DD p.98" or "BR §7.4 p.9") is the number **printed in the document footer**, not the PDF page index. In the BR, DD and Spec the cover and contents pages are unnumbered, so the printed number is usually 3 or 4 less than the PDF page index (BR p.9 = PDF page 13).

### 1.1 Key excerpts

* **ATS targets.** BR §7.4 Table 1 (p.9), "Australasian Triage Scale … Treatment Time Target": ATS 1 "Less than or equal to 2 minutes", ATS 2 "… 10 minutes", ATS 3 "… 30 minutes", ATS 4 "… 60 minutes", ATS 5 "… 120 minutes". Table 2 "Optional Administrative Triage Categories": DOA, Direct Admission, Inpatient, all "N/A".
* **DD wording differs for ATS 1.** DD Triage Category (p.98) and Spec field 31 (p.8): "1 Resuscitation: immediate (within seconds)" (open question 3).
* **Presentation Datetime.** DD Triage Datetime (p.100): "The earlier of the Arrival Datetime and the Triage Datetime is used to derive Presentation Datetime, which is the datetime used as for reporting."
* **Nurse Seen.** DD Nurse Seen Datetime (p.66) says it is used in the calculation of clinical care commencement for WACHS sites.
* **Presenting complaint.** DD p.69: Format X(5), "Permitted values: N/A", "In September 2020 all symptom codes are uniform with EDIS APAC 21 released."
* **Feeder systems.** DD p.39: "EDIS is used by Bunbury Hospital and all metropolitan hospitals excluding St John of God Midland Public Hospital (SJOGM). All rural hospitals except for Bunbury Hospital currently use webPAS ED module."
* **WA Emergency Access Measures.** BR §12 (p.20) names them as monitored indicators under MP 0111/19 but gives **no target figures**.

## 2. Public sources (external, used only where the EDDC documents are silent)

These were **not** supplied by the custodian. They are marked "external, to be confirmed" in the interface.

| Source | Used for | Status |
|---|---|---|
| WA Department of Health, *2025-26 OBM KPI Data Definition Manual*, §7.1.0 "Percentage of emergency department patients seen within recommended times" ([link](https://www.health.wa.gov.au/~/media/Corp/Policy-Frameworks/Outcome-Based-Management/Outcome-Based-Management-Policy/Supporting-Information/2025-26-OBM-KPI-Data-Definition-Manual.pdf)) | Commencement of care = "the earlier of [Doctor Seen Datetime] or [Nurse Seen Datetime]"; wait = commencement − Presentation date/time; scope = sites with a Level 3B emergency service or above | Read from a search-engine extract on 29 Oct 2026. The PDF could not be downloaded from the box (TLS error) so it was **not read in full** |
| East Metropolitan Health Service annual report, "Access to emergency services" ([link](https://annualreport.emhs.health.wa.gov.au/performance/access-to-emergency-services/index.html)) | Seen-on-time thresholds by triage category: 100 / 80 / 75 / 70 / 70 % | Drawn as "external threshold" ticks |
| WA Health, *WA Emergency Access Target* ([link](https://www.health.wa.gov.au/Improving-WA-Health/Emergency-access-reform)) | WEAT: 90 % of all patients within 4 hours (2016) | Historical reference only |
| Office of the Auditor General WA, *Quality and Utilisation of Emergency Department Data* ([link](https://audit.wa.gov.au/reports-and-publications/reports/quality-and-utilisation-of-emergency-department-data/)) | Emergency access measures from December 2023: 80 % of discharged attendances within 4 hours, 80 % of admitted within 6 hours, 100 % within 12 hours | Used for the 4-hour line, the 6-hour admitted KPI and the 12-hour display cap |
| WA Government media statement, 26 April 2023 ([link](https://www.wa.gov.au/government/media-statements/McGowan%20Labor%20Government/ED-reforms-to-include-alternative-care-pathways-and-new-targets-20230426)) | Confirms the 80 % / 4 h discharged and 80 % / 6 h admitted targets | Supporting |

## 3. Reference data for the map

| Source | Used for |
|---|---|
| **SLIP** public Health MapServer (`public-services.slip.wa.gov.au/.../SLIP_Public_Services/Health/MapServer`), health establishment layer | Site positions, HSP for most sites, cross-check of the EDDC list ([ESTABLISHMENTS.md](ESTABLISHMENTS.md)) |
| SLIP "Health Districts (HEALTH-002)" polygons, same service | The 10 health regions and 34 districts on the map and the Perth inset, simplified by `tools/build_geo.py` |

`tools/fetch_reference.mjs` downloads the public reference data into `data/reference/raw/` (git-ignored); `tools/build_geo.py` simplifies it.

## 4. Not used

* No real EDDC extract, no hospital dashboards, no patient-level data.
* The presenting complaint (EDIS APAC 21) code list was **not** available. Only the codes printed in the DD were used ([DATA-DICTIONARY-MAPPING.md](DATA-DICTIONARY-MAPPING.md) §3).
