import { useState, useEffect } from 'react'
import { ApplicationInbox } from './ApplicationInbox'
import { ApplicationForm } from './ApplicationForm'
import { GISLookup } from './GISLookup'
import { PolicyReference } from './PolicyReference'
import { CodeEnforcement } from './CodeEnforcement'
import { OwnerRegistry } from './OwnerRegistry'
import { UtilityCapacity } from './UtilityCapacity'
import { useR4miStore } from '../../store/r4mi.store'

type Tab =
  | 'inbox'
  | 'form'
  | 'gis'
  | 'policy'
  | 'code-enforcement'
  | 'owner-registry'
  | 'utilities'

const TAB_LABELS: Record<Tab, string> = {
  inbox: 'APPLICATION INBOX',
  form: 'APPLICATION FORM',
  gis: 'GIS PARCEL LOOKUP',
  policy: 'POLICY REFERENCE',
  'code-enforcement': 'CODE ENFORCEMENT',
  'owner-registry': 'OWNER REGISTRY',
  utilities: 'UTILITY CAPACITY',
}

export function LegacyPermitApp() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [brokenLink, setBrokenLink] = useState<string | null>(null)
  const navigateTo = useR4miStore((s) => s.navigateTo)
  const setNavigateTo = useR4miStore((s) => s.setNavigateTo)
  const activeApplicationId = useR4miStore((s) => s.activeApplicationId)
  const demoMode = useR4miStore((s) => s.demoMode)
  const setDemoMode = useR4miStore((s) => s.setDemoMode)

  // When the overlay requests navigation, switch the active tab and clear the request
  useEffect(() => {
    if (navigateTo) {
      setActiveTab(navigateTo as Tab)
      setNavigateTo(null)
    }
  }, [navigateTo])

  // Sync active application ID to body so r4mi-loader.js can read it
  useEffect(() => {
    if (activeApplicationId) {
      document.body.dataset.activeApplicationId = activeApplicationId
    } else {
      delete document.body.dataset.activeApplicationId
    }
  }, [activeApplicationId])

  // Listen for r4mi:show-me from loader — navigate to policy tab and enter teach-me mode
  useEffect(() => {
    function onShowMe(e: Event) {
      const detail = (e as CustomEvent).detail
      const tab = (detail?.targetTab ?? 'policy') as Tab
      setActiveTab(tab)
      setDemoMode(true)
    }
    window.addEventListener('r4mi:show-me', onShowMe)
    return () => window.removeEventListener('r4mi:show-me', onShowMe)
  }, [setDemoMode])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f0f0',
        position: 'relative',
      }}
    >
      {/* Government nav bar */}
      <div
        style={{
          background: '#003478',
          color: '#fff',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          onClick={() => setActiveTab('inbox')}
          style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'Arial', cursor: 'pointer', textDecoration: 'underline' }}
          title="Return to Application Inbox"
        >
          MUNICIPAL PERMIT PROCESSING SYSTEM
        </span>
        <span style={{ fontSize: 11, color: '#aac4e8' }}>v4.2.1 — City of Riverdale</span>
      </div>

      {/* Tab bar */}
      <div
        style={{
          background: '#d4d4d4',
          borderBottom: '2px solid #003478',
          display: 'flex',
          padding: '4px 8px 0',
          gap: 2,
        }}
      >
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontFamily: 'Arial',
              fontWeight: 'bold',
              letterSpacing: 0.5,
              background: activeTab === tab ? '#fff' : '#c0c0c0',
              border: '1px solid #999',
              borderBottom: activeTab === tab ? '1px solid #fff' : '1px solid #999',
              cursor: 'pointer',
              color: '#000',
              marginBottom: activeTab === tab ? -2 : 0,
              position: 'relative',
              zIndex: activeTab === tab ? 1 : 0,
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', minHeight: 500 }}>
        {/* Left sidebar */}
        <div
          style={{
            width: 200,
            background: '#e8e8e8',
            borderRight: '1px solid #999',
            padding: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 'bold',
              color: '#003478',
              padding: '4px 0',
              borderBottom: '1px solid #999',
              marginBottom: 4,
            }}
          >
            QUICK LINKS
          </div>
          {[
            'My Queue',
            'Search Applications',
            'New Application',
            'Reports',
            'Fee Calculator',
            'Parcel Search',
            'Violation Log',
            'Policy Manual',
            'Contacts',
            'Help',
          ].map((item) => (
            <div
              key={item}
              onClick={() => setBrokenLink(item)}
              style={{
                fontSize: 12,
                padding: '3px 4px',
                color: '#003478',
                cursor: 'pointer',
                fontFamily: 'Arial',
                textDecoration: 'underline',
              }}
            >
              &rsaquo; {item}
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, padding: 16, background: '#fff' }}>
          {activeTab === 'inbox' && (
            <ApplicationInbox onSelectApp={() => setActiveTab('form')} />
          )}
          {activeTab === 'form' && <ApplicationForm />}
          {activeTab === 'gis' && <GISLookup />}
          {activeTab === 'policy' && <PolicyReference />}
          {activeTab === 'code-enforcement' && <CodeEnforcement />}
          {activeTab === 'owner-registry' && <OwnerRegistry />}
          {activeTab === 'utilities' && <UtilityCapacity />}
        </div>
      </div>

      {/* 2008-style broken page modal */}
      {brokenLink && (
        <div
          onClick={() => setBrokenLink(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              background: 'linear-gradient(180deg, #0a246a 0%, #a6b8d4 3%, #d6e4f7 6%, #ffffff 6%)',
              border: '2px solid #0a246a',
              fontFamily: 'Times New Roman, serif',
              boxShadow: '4px 4px 0 #000',
            }}
          >
            {/* Title bar */}
            <div style={{
              background: 'linear-gradient(90deg, #0a246a, #3a6ea5)',
              color: '#fff',
              padding: '3px 6px',
              fontSize: 12,
              fontFamily: 'Arial',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Windows Internet Explorer</span>
              <button onClick={() => setBrokenLink(null)} style={{
                background: '#c0392b', color: '#fff', border: '1px solid #7f0000',
                width: 16, height: 16, fontSize: 10, cursor: 'pointer', fontWeight: 'bold',
                lineHeight: '14px', padding: 0,
              }}>&#x2715;</button>
            </div>

            {/* Address bar */}
            <div style={{
              background: '#f0f0f0', borderBottom: '1px solid #aaa',
              padding: '3px 8px', fontSize: 11, fontFamily: 'Arial',
              color: '#555', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ color: '#888' }}>Address:</span>
              <span style={{
                background: '#fff', border: '1px inset #aaa',
                padding: '1px 4px', flex: 1, fontSize: 11,
              }}>
                http://cityofriverdale-permits.gov/mpps/{brokenLink.toLowerCase().replace(/ /g, '_')}.asp
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ fontSize: 48, lineHeight: 1 }}>&#x1F6AB;</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#c0392b', marginBottom: 4 }}>
                    Internet Explorer cannot display the webpage
                  </div>
                  <div style={{ fontSize: 13, color: '#333', marginBottom: 8 }}>
                    Most likely causes:
                  </div>
                  <ul style={{ fontSize: 12, color: '#333', margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                    <li>You are not connected to the Internet.</li>
                    <li>The website is encountering problems.</li>
                    <li><b>{brokenLink}</b> module was not migrated in the 2008 upgrade.</li>
                    <li>There might be a typing error in the address.</li>
                  </ul>
                </div>
              </div>

              <div style={{
                background: '#ffffcc', border: '1px solid #cccc00',
                padding: '6px 10px', fontSize: 11, color: '#555', marginBottom: 12,
              }}>
                &#x26A0;&#xFE0F; &nbsp;This page requires <b>Internet Explorer 6.0</b> or higher with ActiveX enabled.<br />
                Contact IT helpdesk ext. <b>4722</b> for access issues.
              </div>

              <div style={{ fontSize: 10, color: '#888', borderTop: '1px solid #ddd', paddingTop: 8, fontFamily: 'Arial' }}>
                HTTP 404 — Page Not Found &nbsp;|&nbsp; City of Riverdale MPPS v4.2.1 &nbsp;|&nbsp;
                <span style={{ color: '#0000ee', cursor: 'pointer', textDecoration: 'underline' }}>Send Error Report</span>
                &nbsp;|&nbsp;
                <span style={{ color: '#0000ee', cursor: 'pointer', textDecoration: 'underline' }}>Try Again Later</span>
              </div>

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  onClick={() => setBrokenLink(null)}
                  style={{
                    background: 'linear-gradient(180deg, #f5f5f5, #d4d4d4)',
                    border: '1px solid #aaa', padding: '3px 20px',
                    fontSize: 12, fontFamily: 'Arial', cursor: 'pointer',
                    boxShadow: '1px 1px 0 #fff inset',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
