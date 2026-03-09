import { useState } from 'react'
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
  const demoMode = useR4miStore((s) => s.demoMode)

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 48px)',
        background: '#f0f0f0',
        outline: demoMode ? '3px solid #dc2626' : 'none',
        position: 'relative',
      }}
    >
      {demoMode && (
        <div
          style={{
            background: '#dc2626',
            color: '#fff',
            textAlign: 'center',
            padding: '6px 0',
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 1,
          }}
        >
          r4mi-ai IS WATCHING — NAVIGATE TO THE CORRECT SOURCE
        </div>
      )}

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
        <span style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'Arial' }}>
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
              style={{
                fontSize: 12,
                padding: '3px 4px',
                color: '#003478',
                cursor: 'pointer',
                fontFamily: 'Arial',
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
    </div>
  )
}
