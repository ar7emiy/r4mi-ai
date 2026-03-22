# r4mi-ai Frontend — Legacy UI Design Brief

The mock permit system must look like software built by a government contractor
in 2008 and never updated. This is intentional and critical to the demo.
The visual contrast between the legacy UI and the r4mi-ai overlay is part of the story.

---

## The Two Visual Layers

The frontend has two distinct visual identities that must never bleed into each other:

### Layer 1 — The Legacy Permit System
Everything inside the main work area. Looks old, dense, institutional.

### Layer 2 — r4mi-ai Sidebar
The sidebar panel (iframe injected by r4mi-loader.js): chat thread, record button, agents drawer.
Also: lightweight field source tags and per-field approval gate overlays written into the host form by r4mi-loader.js.
Looks modern, clean, minimal. Dark mode (`#0f1117` background). Uses a distinct accent color (`#6366f1` indigo).

The contrast between these two layers communicates the product's value without words.
Layer 2 never bleeds into Layer 1's visual design — they are deliberately jarring together.

---

## Layer 1: Legacy Permit System — Design Rules

### Colors
- Background: `#f0f0f0` (Windows XP grey)
- Content panels: `#ffffff`
- Header/nav bar: `#003478` (government navy blue)
- Header text: `#ffffff`
- Borders: `#999999` (hard 1px borders everywhere)
- Table row alternating: `#f5f5f5` / `#ffffff`
- Required field highlight: `#fffacd` (pale yellow)
- Submit button: `#2e6da4` with white text
- Error state: `#cc0000`

### Typography
- Primary font: `Arial, sans-serif` — no custom fonts
- Base size: 13px
- Labels: bold, uppercase, 11px
- No line-height greater than 1.4
- Dense. Information packed. No breathing room.

### Layout
- Fixed-width container: 1024px max, left-aligned
- Navigation: horizontal tab bar at top with beveled tab style
- Each tab: uppercase text, 12px, bordered
- Active tab: white background, no bottom border (classic browser tab illusion)
- Content area: left sidebar (200px) + main panel
- Left sidebar: vertical menu with 12–15 items, most of which do nothing in the demo
- Forms: two-column label/field layout, labels right-aligned to their fields
- Field widths: inconsistent — some too narrow, some too wide (authentic)

### Form Elements
- Input fields: 1px solid `#999` border, no border-radius, `#fff` background
- Dropdowns: native `<select>` styling — no custom dropdowns
- Checkboxes: native browser checkboxes
- Buttons: slightly beveled look, no border-radius
- Required indicator: red asterisk `*` after label text
- Field validation errors: red text directly below field, 11px

### Specific Components
**Application Inbox (table):**
- Dense HTML table with 1px borders on all cells
- Columns: App ID | Applicant | Address | Type | Submitted | Status
- Status values: "Pending Review", "In Progress", "Approved", "Referred"
- Row hover: `#e8f0fe`
- Clickable rows — cursor pointer

**GIS Lookup Screen:**
- Search bar at top: "Enter Parcel ID:" label + input + "Search" button
- Results in a bordered box below, monospace font for the data
- Include a faint map placeholder image (grey rectangle, "Map View" text centered)

**Policy Reference Screen:**
- Two tabs within the screen: "Wiki" and "PDF Viewer"
- Wiki tab: plain HTML text with section headers, dense paragraph text
- PDF Viewer tab: white background, rendered text in a scrollable box, page numbers visible
- Paragraphs are NOT highlighted by default — they only highlight during demonstration mode

**Application Form:**
- Long form — more fields than needed (creates authentic cognitive load)
- Group fields into sections with grey `<fieldset>` boxes and `<legend>` labels
- Section headers: "Applicant Information", "Property Details", "Assessment", "Decision"
- Decision section at bottom has a prominent text area for notes

### What NOT to Do
- No border-radius anywhere in Layer 1
- No box shadows
- No animations or transitions
- No icons (or only 16x16 pixel GIF-style icons)
- No hover effects except basic row highlights
- No Tailwind utility classes that make things look modern (no rounded-*, no shadow-*)

---

## Layer 2: r4mi-ai Overlay — Design Rules

### Colors
- Background: `#0f1117` (near black)
- Surface: `#1a1d27`
- Border: `#2d3149`
- Accent: `#6366f1` (indigo — the r4mi-ai brand color)
- Accent glow: `rgba(99, 102, 241, 0.3)`
- Text primary: `#e2e8f0`
- Text secondary: `#94a3b8`
- Success: `#22c55e`
- Warning: `#f59e0b`
- Error: `#ef4444`

### Typography
- Font: `Inter, system-ui, sans-serif`
- Clean, modern, readable
- Generous line-height: 1.6

### Tab Progression Bar
- Fixed to bottom of viewport, full width
- Height: 48px
- Background: `#0f1117` with top border `#2d3149`
- Left section: r4mi-ai logo/wordmark in indigo
- Center section: active agent pills (each pill shows agent name + status dot)
- Right section: notification badge when optimization opportunity detected
- Notification badge: pulsing indigo glow animation
- Do not cover any form submit buttons — ensure 48px bottom padding on main content

### Optimization Panel
- Slides in from the right as a drawer (400px wide)
- Does not cover the full screen — the legacy UI is still partially visible
- Header: "r4mi-ai detected a repetitive workflow" in indigo
- Clean card layout inside with clear sections

### Source Tags
- Small inline badges that appear next to auto-filled form fields
- Style: `#1a1d27` background, `#6366f1` border, `#94a3b8` text, 10px font
- Format: "from GIS API" / "from PDF §14.3" / "from Policy Index"
- Appear with a subtle fade-in animation

### Demonstration Mode Banner
- Full-width banner at top of screen (not blocking content)
- Red/orange: `#dc2626` background
- Text: "r4mi-ai is watching — navigate to the correct source"
- Subtle pulsing border on the entire viewport

### Agentverse Panel
- Opens as a full right-side panel (600px) or its own route `/agentverse`
- Card grid: 2 columns
- Each agent card: dark surface, agent name prominent, metadata below
- Trust badge: pill component — yellow/green/red based on trust level
- Run counter: subtle, secondary text
- Contribution bar: thin progress bar showing attribution %

---

## Mermaid Diagram Page (`/system`)

- Full dark background
- Diagram centered with padding
- Title: "r4mi-ai System Architecture" in white
- Accessible from a small "?" or "Architecture" link in the Tab Progression Bar
- Supplementary deep-dive — accessible from the Tab Progression Bar

---

## Responsive

The demo is recorded on a 1440px wide screen. No need for mobile responsiveness.
Design for 1440px. Test at 1440px. That's it.
