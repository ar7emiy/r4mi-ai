import { useState } from 'react'
import { useR4miStore } from '../../store/r4mi.store'

const WIKI_SECTIONS = [
  {
    id: 'section-14-3',
    title: 'Section 14.3 — Residential Fencing Standards',
    content: `In zones classified R-1 through R-3, fencing along rear and side property lines shall not exceed six feet (6') in height without variance approval from the Planning Commission. Front yard fencing is limited to four feet (4'). Fences constructed of natural wood, vinyl, or decorative metal are permitted. Chain-link fencing is prohibited in front yards within all residential zones.

Maximum Heights by Zone:
  • R-1: Rear/side 6ft | Front 4ft
  • R-2: Rear/side 6ft | Front 4ft
  • R-3: Rear/side 6ft | Front 4ft

Variance threshold: any fence exceeding zone maximum requires Planning Commission approval.`,
  },
  {
    id: 'section-22-7',
    title: 'Section 22.7 — Commercial Signage Standards',
    content: `In C-1 and C-2 zones, total sign area for any single business shall not exceed one square foot of sign area per linear foot of building frontage, up to a maximum of fifty (50) square feet. Illuminated signs are permitted in C-1 zones provided they do not exceed 800 lumens of external illumination facing the public right-of-way. Roof signs and rotating signs are prohibited in all commercial zones.`,
  },
  {
    id: 'section-31-2',
    title: 'Section 31.2 — Demolition Requirements',
    content: `All structures constructed prior to January 1, 1980 shall require a certified asbestos and lead paint survey conducted by a licensed environmental assessor prior to issuance of a demolition permit. Survey results must be submitted with the permit application. Open code enforcement violations must be resolved or a compliance agreement executed prior to permit issuance.`,
  },
  {
    id: 'section-8-4',
    title: 'Section 8.4 — Accessory Dwelling Units',
    content: `Accessory Dwelling Units (ADUs) are permitted in R-2 and R-3 zones subject to utility capacity confirmation. Applicants must demonstrate sufficient sewer and water capacity as measured in Equivalent Dwelling Units (EDU). The binding capacity figure is the lower of available sewer EDU and available water EDU.`,
  },
  {
    id: 'section-19-1',
    title: 'Section 19.1 — Short-Term Rental Registration',
    content: `Short-term rental (STR) permits are available exclusively to owner-occupants. The applicant name must match the recorded property owner on file with the County Assessor's Office.`,
  },
]

export function PolicyReference() {
  const [activeTab, setActiveTab] = useState<'wiki' | 'pdf'>('wiki')
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null)
  const demoMode = useR4miStore((s) => s.demoMode)
  const setDemoMode = useR4miStore((s) => s.setDemoMode)

  function handlePDFParagraphClick(sectionId: string, content: string) {
    if (!demoMode) return
    setHighlightedSection(sectionId)
    // Signal correction source selection
    window.dispatchEvent(
      new CustomEvent('r4mi:source-selected', {
        detail: { source_type: 'pdf', section: sectionId, content },
      }),
    )
    setDemoMode(false)
  }

  return (
    <div>
      <div style={sectionHeader}>POLICY REFERENCE MANUAL</div>

      {/* Inner tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid #999' }}>
        {(['wiki', 'pdf'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '3px 16px',
              fontSize: 11,
              fontWeight: 'bold',
              fontFamily: 'Arial',
              background: activeTab === t ? '#fff' : '#e0e0e0',
              border: '1px solid #999',
              borderBottom: activeTab === t ? '1px solid #fff' : '1px solid #999',
              cursor: 'pointer',
              marginBottom: activeTab === t ? -1 : 0,
              textTransform: 'uppercase',
            }}
          >
            {t === 'wiki' ? 'Wiki' : 'PDF Viewer'}
          </button>
        ))}
      </div>

      {activeTab === 'wiki' && (
        <div>
          {WIKI_SECTIONS.map((section) => (
            <div key={section.id} style={{ marginBottom: 20 }}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: '#003478',
                  marginBottom: 6,
                  borderBottom: '1px solid #ccc',
                  paddingBottom: 2,
                }}
              >
                {section.title}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.4,
                  fontFamily: 'Arial',
                  whiteSpace: 'pre-line',
                }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'pdf' && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #ccc',
            padding: 20,
            maxHeight: 500,
            overflowY: 'auto',
            fontFamily: 'Arial',
          }}
        >
          <div
            style={{ textAlign: 'center', color: '#888', fontSize: 11, marginBottom: 16 }}
          >
            MUNICIPAL CODE — Chapter 14: Land Use and Zoning Regulations | Page 4 of 128
          </div>

          {WIKI_SECTIONS.map((section, i) => (
            <div
              key={section.id}
              onClick={() => handlePDFParagraphClick(section.id, section.content)}
              style={{
                marginBottom: 24,
                padding: 8,
                cursor: demoMode ? 'pointer' : 'default',
                background:
                  highlightedSection === section.id
                    ? '#fffacd'
                    : demoMode
                      ? '#fafff8'
                      : '#fff',
                border:
                  highlightedSection === section.id
                    ? '2px solid #6366f1'
                    : demoMode
                      ? '1px dashed #6366f1'
                      : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                §{14 + i}.{i + 1}
              </div>
              <h4
                style={{
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: '#000',
                  marginBottom: 6,
                }}
              >
                {section.title}
              </h4>
              <p style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {section.content}
              </p>
              {highlightedSection === section.id && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: '#6366f1',
                    fontWeight: 'bold',
                  }}
                >
                  ✓ Selected as knowledge source
                </div>
              )}
            </div>
          ))}

          <div style={{ textAlign: 'center', color: '#888', fontSize: 11, marginTop: 16 }}>
            — Page 4 —
          </div>
        </div>
      )}
    </div>
  )
}

const sectionHeader: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  color: '#003478',
  marginBottom: 10,
  borderBottom: '2px solid #003478',
  paddingBottom: 4,
}
