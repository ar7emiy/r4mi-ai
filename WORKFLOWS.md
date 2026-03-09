# r4mi-ai — Permit Workflow Specifications

Five workflows designed for the mock legacy municipal permit system.
Each workflow defines: screens visited, fields filled, stub data, and a deliberately
designed inefficiency that r4mi-ai will detect and distill.

---

## Workflow 1: Residential Fence Variance

**Permit type:** Fence height variance (residential)
**Complexity:** Low — the entry-level demo workflow, shown first
**Designed inefficiency:** Tech navigates to GIS screen to get the zone classification,
then navigates BACK to the application form to enter it manually — a round trip that
the agent eliminates by pulling zone data inline during form load.

### Screens visited (in order)
1. **Application Inbox** — select pending application
2. **GIS Parcel Lookup** — enter parcel ID, retrieve zone
3. **Application Form** — fill permit fields including manually typed zone
4. **Policy Reference** — look up max fence height for zone R-2
5. **Application Form** — return, enter policy value, submit

### Stub Application Data
```json
{
  "application_id": "PRM-2024-0041",
  "applicant": "Margaret Hollis",
  "address": "412 Birchwood Lane",
  "parcel_id": "R2-0041-BW",
  "request": "Install 7ft wooden fence along rear property line",
  "submitted": "2024-03-12"
}
```

### Stub GIS Result (screen 2)
```
Parcel ID: R2-0041-BW
Zone Classification: R-2 (Single Family Residential)
Lot Size: 8,400 sq ft
Setback (rear): 5 ft
Last Updated: 2024-01-15
```

### Stub Policy Text (screen 4 — buried in paragraph)
> Section 14.3 — Residential Fencing Standards
> In zones classified R-1 through R-3, fencing along rear and side property lines
> shall not exceed six feet (6') in height without variance approval from the
> Planning Commission. Front yard fencing is limited to four feet (4'). Fences
> constructed of natural wood, vinyl, or decorative metal are permitted. Chain-link
> fencing is prohibited in front yards within all residential zones.

### Application Form Fields (screen 3 + 5)
| Field | Value | Source |
|-------|-------|--------|
| Applicant Name | Margaret Hollis | Pre-filled |
| Parcel ID | R2-0041-BW | Pre-filled |
| Zone Classification | R-2 | **Manual — copied from GIS screen** |
| Fence Height Requested | 7 ft | Applicant |
| Max Permitted Height | 6 ft | **Manual — copied from policy text** |
| Variance Required | Yes | Derived |
| Decision | Refer to Planning Commission | Tech judgment |
| Notes | Exceeds R-2 max by 1ft. Variance required per §14.3 | Tech typed |

### Distilled Agent Version
Agent loads zone from GIS API call on form load (no navigation).
Agent reads §14.3 from policy index by zone key (no manual lookup).
Tech only confirms the variance decision — 2 screens instead of 5.

---

## Workflow 2: ADU Addition Permit

**Permit type:** Accessory Dwelling Unit construction
**Complexity:** Medium — requires two separate system checks before deciding
**Designed inefficiency:** Tech checks sewer capacity in one system, water capacity
in a second system, then manually adds both numbers in their head to assess total
utility load. Agent performs both checks and calculates load automatically.

### Screens visited (in order)
1. **Application Inbox** — select pending application
2. **GIS Parcel Lookup** — confirm zone allows ADU
3. **Sewer Capacity System** — check available sewer capacity for the block
4. **Water Capacity System** — check available water capacity for the block
5. **Application Form** — fill all fields, manually derive total utility assessment
6. **Fee Schedule** — look up ADU permit fee by square footage
7. **Application Form** — enter fee, submit

### Stub Application Data
```json
{
  "application_id": "PRM-2024-0089",
  "applicant": "David Okonkwo",
  "address": "87 Elm Street",
  "parcel_id": "R3-0089-EL",
  "request": "Construct 650 sq ft detached ADU in rear yard",
  "submitted": "2024-03-18"
}
```

### Stub GIS Result
```
Parcel ID: R3-0089-EL
Zone Classification: R-3 (Multi-Family Residential)
ADU Permitted: Yes (per SB-9 compliance update 2023)
Lot Size: 12,200 sq ft
```

### Stub Sewer Capacity (screen 3)
```
Block: ELM-ST-800-900
Current Load: 67% capacity
Available Units: 4 EDU remaining
Last Assessment: 2024-02-01
```

### Stub Water Capacity (screen 4)
```
Block: ELM-ST-800-900
Current Load: 71% capacity
Available Units: 3 EDU remaining
Last Assessment: 2024-02-01
```

### Stub Fee Schedule Entry (screen 6 — buried in table)
```
ADU Permits — Fee Schedule (Effective Jan 1 2024)
Under 500 sq ft:     $1,840
500–750 sq ft:       $2,310
751–1000 sq ft:      $2,780
Over 1000 sq ft:     $3,450 + $0.85/sq ft over 1000
```

### Application Form Fields
| Field | Value | Source |
|-------|-------|--------|
| ADU Size | 650 sq ft | Applicant |
| Zone | R-3 | GIS lookup |
| ADU Permitted in Zone | Yes | GIS lookup |
| Sewer EDU Available | 4 | Manual — Sewer system |
| Water EDU Available | 3 | Manual — Water system |
| Total Utility Headroom | 3 EDU (lower of two) | **Manual calculation** |
| Utility Assessment | Approved | Tech judgment |
| Permit Fee | $2,310 | **Manual — fee schedule lookup** |
| Decision | Approved | Tech judgment |

### Distilled Agent Version
Agent queries sewer + water APIs in parallel, takes lower value automatically.
Agent calculates fee from size input using fee table lookup.
3 screens instead of 7.

---

## Workflow 3: Commercial Signage Permit

**Permit type:** Exterior sign installation (commercial)
**Complexity:** Medium — policy rule requires a calculation, not just a lookup
**Designed inefficiency:** Tech reads the sign area formula from the policy doc,
manually measures the building frontage from a GIS diagram, then does the
square footage calculation on paper (or in their head) before entering the result.
Agent reads frontage from GIS data directly and calculates max sign area inline.

### Screens visited (in order)
1. **Application Inbox** — select pending application
2. **GIS Parcel Lookup** — retrieve building frontage measurement
3. **Policy Reference** — find sign area formula for C-1 zone
4. **Calculator / scratch work** — tech does math manually (show this explicitly)
5. **Application Form** — enter results, submit

### Stub Application Data
```json
{
  "application_id": "PRM-2024-0103",
  "applicant": "Sunrise Bakery LLC",
  "address": "2201 Commerce Drive, Unit 4",
  "parcel_id": "C1-0103-CD",
  "request": "Install illuminated exterior sign, 24 sq ft, above entrance",
  "submitted": "2024-03-20"
}
```

### Stub GIS Result
```
Parcel ID: C1-0103-CD
Zone: C-1 (Neighborhood Commercial)
Building Frontage: 38 linear feet
Parcel Frontage: 45 linear feet
```

### Stub Policy Text (screen 3 — buried in paragraph)
> Section 22.7 — Commercial Signage Standards
> In C-1 and C-2 zones, total sign area for any single business shall not exceed
> one square foot of sign area per linear foot of building frontage, up to a maximum
> of fifty (50) square feet. Illuminated signs are permitted in C-1 zones provided
> they do not exceed 800 lumens of external illumination facing the public right-of-way.
> Roof signs and rotating signs are prohibited in all commercial zones.

### Application Form Fields
| Field | Value | Source |
|-------|-------|--------|
| Zone | C-1 | GIS |
| Building Frontage | 38 ft | **Manual — GIS diagram** |
| Max Sign Area Formula | 1 sq ft per linear ft | **Manual — policy §22.7** |
| Max Permitted Sign Area | 38 sq ft | **Manual calculation** |
| Requested Sign Area | 24 sq ft | Applicant |
| Within Limit | Yes | Derived |
| Illuminated | Yes | Applicant |
| Lumen Compliance | Unverified (applicant to certify) | Standard note |
| Decision | Approved with certification condition | Tech judgment |

### Distilled Agent Version
Agent reads frontage from GIS API.
Agent applies formula from policy index by zone.
Calculates max area, compares to requested, sets decision.
Tech only confirms the lumen certification condition — 2 screens instead of 5.

---

## Workflow 4: Demolition Permit

**Permit type:** Full structure demolition
**Complexity:** High — requires violation check AND a hazmat screening flag
**Designed inefficiency:** Tech checks violation history in the code enforcement
system, then separately checks a hazmat registry in a completely different screen,
then manually cross-references the construction year to determine if asbestos
survey is required (pre-1980 = required). Three separate lookups, all manual.
Agent chains all three automatically.

### Screens visited (in order)
1. **Application Inbox** — select pending application
2. **GIS Parcel Lookup** — confirm structure details + construction year
3. **Code Enforcement System** — check open violations on parcel
4. **Hazmat Registry** — check if structure is flagged
5. **Policy Reference** — look up asbestos survey requirement rule
6. **Application Form** — fill all fields, add conditions, submit

### Stub Application Data
```json
{
  "application_id": "PRM-2024-0117",
  "applicant": "Redstone Development Group",
  "address": "559 Industrial Parkway",
  "parcel_id": "I1-0117-IP",
  "request": "Full demolition of existing warehouse structure",
  "submitted": "2024-03-22"
}
```

### Stub GIS Result
```
Parcel ID: I1-0117-IP
Zone: I-1 (Light Industrial)
Structure Type: Warehouse
Year Built: 1974
Square Footage: 18,400 sq ft
Stories: 1
```

### Stub Code Enforcement Result (screen 3)
```
Parcel: I1-0117-IP
Open Violations: 2
  - CE-2023-0441: Unsecured entry points (issued 2023-11-03, unresolved)
  - CE-2022-0189: Illegal dumping on premises (issued 2022-06-14, unresolved)
Resolved Violations: 4
```

### Stub Hazmat Registry (screen 4)
```
Parcel: I1-0117-IP
Hazmat Flag: None on record
Last Survey: No survey on file
```

### Stub Policy Text (screen 5)
> Section 31.2 — Demolition Requirements
> All structures constructed prior to January 1, 1980 shall require a certified
> asbestos and lead paint survey conducted by a licensed environmental assessor
> prior to issuance of a demolition permit. Survey results must be submitted with
> the permit application. Open code enforcement violations must be resolved or
> a compliance agreement executed prior to permit issuance.

### Application Form Fields
| Field | Value | Source |
|-------|-------|--------|
| Year Built | 1974 | GIS |
| Pre-1980 Structure | Yes | **Manual derivation** |
| Asbestos Survey Required | Yes | **Manual — policy §31.2** |
| Open Violations | 2 | Code enforcement |
| Violations Must Be Resolved | Yes | **Manual — policy §31.2** |
| Hazmat Registry Flag | None | Hazmat registry |
| Decision | Conditional — survey + violation compliance required | Tech judgment |
| Conditions | Submit asbestos survey; execute CE compliance agreement | Tech typed |

### Distilled Agent Version
Agent checks GIS year, code enforcement, and hazmat registry in parallel.
Agent applies pre-1980 rule and violation rule from policy index automatically.
Generates conditions text from templates.
Tech only reviews and confirms conditions — 2 screens instead of 6.

---

## Workflow 5: Short-Term Rental Registration

**Permit type:** STR (Airbnb-style) operating permit
**Complexity:** High — requires owner-occupancy verification + fee calculation based on unit count
**Designed inefficiency:** Tech looks up the property owner in a separate owner
registry to verify owner-occupancy, then manually checks if the applicant name
matches, then calculates the annual registration fee from a tiered schedule based
on number of bedrooms. All manual cross-referencing.

### Screens visited (in order)
1. **Application Inbox** — select pending application
2. **Owner Registry** — look up property owner by parcel ID
3. **Application Form** — manually compare owner name to applicant name
4. **GIS Parcel Lookup** — retrieve bedroom count
5. **Fee Schedule** — look up STR fee by bedroom count
6. **Application Form** — enter fee, owner-occupancy status, submit

### Stub Application Data
```json
{
  "application_id": "PRM-2024-0134",
  "applicant": "Patricia Nwosu",
  "address": "34 Lakeview Terrace, Unit 2",
  "parcel_id": "R2-0134-LV",
  "request": "Short-term rental operating permit, primary residence",
  "submitted": "2024-03-25"
}
```

### Stub Owner Registry Result (screen 2)
```
Parcel: R2-0134-LV
Recorded Owner: Patricia A. Nwosu
Owner Address on File: 34 Lakeview Terrace, Unit 2
Owner-Occupied: Matches application address — Yes
```

### Stub GIS Result (screen 4)
```
Parcel: R2-0134-LV
Zone: R-2
Unit Type: Condominium
Bedrooms: 3
Year Built: 2011
```

### Stub Fee Schedule (screen 5 — in a table with 12 rows)
```
Short-Term Rental Registration — Annual Fee Schedule
Studio / 1BR:     $285
2BR:              $410
3BR:              $535
4BR:              $660
5BR+:             $785
Non-owner occupied: additional $500 surcharge
```

### Application Form Fields
| Field | Value | Source |
|-------|-------|--------|
| Applicant | Patricia Nwosu | Pre-filled |
| Recorded Owner | Patricia A. Nwosu | **Manual — owner registry** |
| Owner-Occupancy Match | Yes | **Manual comparison** |
| Bedrooms | 3 | **Manual — GIS lookup** |
| Base Registration Fee | $535 | **Manual — fee schedule** |
| Non-Owner Surcharge | $0 | Derived |
| Total Fee | $535 | Manual calculation |
| Decision | Approved | Tech judgment |

### Distilled Agent Version
Agent queries owner registry and GIS in parallel.
Compares owner name to applicant automatically (fuzzy match).
Calculates fee from bedroom count using fee table.
Tech only confirms final approval — 2 screens instead of 6.

---

## Summary Table

| # | Workflow | Screens (manual) | Screens (agent) | Key Inefficiency |
|---|----------|:-:|:-:|------------------|
| 1 | Fence Variance | 5 | 2 | Round-trip to GIS for zone |
| 2 | ADU Addition | 7 | 3 | Two utility checks + manual math |
| 3 | Commercial Signage | 5 | 2 | Manual formula + calculation |
| 4 | Demolition Permit | 6 | 2 | Three parallel lookups, manual chain |
| 5 | STR Registration | 6 | 2 | Owner match + fee calc, manual |

---

## Seed Data Files to Create

Claude Code should generate these under `backend/seed/`:

- `applications.json` — all 5 stub applications
- `gis_results.json` — keyed by parcel_id
- `code_enforcement.json` — keyed by parcel_id
- `owner_registry.json` — keyed by parcel_id
- `hazmat_registry.json` — keyed by parcel_id
- `sewer_capacity.json` — keyed by block
- `water_capacity.json` — keyed by block
- `policy_sections.txt` — all policy text blocks, labelled by section
- `fee_schedules.json` — all fee tables structured for lookup

Each stub API endpoint in `backend/routers/stubs.py` reads from these files.
No database required for stub data — JSON files are sufficient and easier to demo with.
