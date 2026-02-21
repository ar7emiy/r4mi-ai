import type { Scenario } from '@/pages/CRM'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Props {
  scenario: Scenario
  activeFieldId: string | null
}

export default function CaseFile({ scenario, activeFieldId }: Props) {
  if (scenario === 'billing_refund') return <BillingRefundCase activeFieldId={activeFieldId} />
  return <AccountCancellationCase activeFieldId={activeFieldId} />
}

/* ─── Billing Refund Case ──────────────────────────────────────────────────── */

function BillingRefundCase({ activeFieldId }: { activeFieldId: string | null }) {
  return (
    <div className="p-5 font-mono text-xs leading-relaxed text-gray-800 space-y-5">

      {/* Header */}
      <section className={cn(
        "transition-colors duration-500",
        activeFieldId === 'billing_period' && "bg-blue-100 ring-2 ring-blue-400 p-2 -m-2 rounded"
      )}>
        <p className="text-sm font-bold tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
          CUSTOMER ACCOUNT SUMMARY
        </p>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <tr>
              <td className="pr-4 text-gray-500 w-1/3">Account #:</td>
              <td className="font-semibold">BS-2024-8847</td>
              <td className="px-4 text-gray-500">Status:</td>
              <td className="text-amber-700 font-semibold">ACTIVE (Review Hold)</td>
            </tr>
            <tr>
              <td className="text-gray-500">Customer:</td>
              <td className="font-semibold">Santos, Maria L.</td>
              <td className="px-4 text-gray-500">Plan:</td>
              <td>Business Premium Plus</td>
            </tr>
            <tr>
              <td className="text-gray-500">Address:</td>
              <td>1847 Meridian Blvd<br />Austin, TX 78702</td>
              <td className="px-4 text-gray-500">Member since:</td>
              <td>Mar 2021</td>
            </tr>
            <tr>
              <td className="text-gray-500">Phone:</td>
              <td>(512) 555-0184</td>
              <td className="px-4 text-gray-500">Last stmt:</td>
              <td className="font-semibold">$847.33</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Current cycle */}
      <section className={cn(
        "rounded border border-dashed border-gray-300 p-3 transition-colors duration-500",
        activeFieldId === 'refund_amount' && "bg-blue-100 border-blue-400 border-solid border-2"
      )}>
        <p className="font-bold mb-2">BILLING CYCLE: Oct 15 – Nov 14, 2024</p>
        <table className="w-full text-xs">
          <tbody>
            <tr><td className="text-gray-500 pr-4">Previous Balance:</td><td className="text-right">$0.00</td></tr>
            <tr><td className="text-gray-500">New Charges:</td><td className="text-right">+$847.33</td></tr>
            <tr><td className="text-gray-500">Payments / Credits:</td><td className="text-right">-$599.00 &nbsp;<span className="text-gray-400">(partial pmt, 11/02)</span></td></tr>
            <tr className="border-t border-gray-200 mt-1">
              <td className="text-red-700 font-bold pt-1">Disputed Amount:</td>
              <td className="text-right font-bold text-red-700 pt-1">+$248.33 &nbsp;⚠</td>
            </tr>
            <tr><td className="font-bold">AMOUNT DUE:</td><td className="text-right font-bold">$248.33 &nbsp;<span className="text-gray-400 font-normal text-xs">DUE: Dec 2, 2024</span></td></tr>
          </tbody>
        </table>
      </section>

      {/* Charge detail */}
      <section>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">CHARGE DETAIL</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1 font-medium">Item</th>
              <th className="text-right font-medium">Qty</th>
              <th className="text-right font-medium">Rate</th>
              <th className="text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1">Business Premium – Monthly</td>
              <td className="text-right">1</td>
              <td className="text-right">$599.00</td>
              <td className="text-right">$599.00</td>
            </tr>
            <tr className="border-b border-gray-100 bg-red-50">
              <td className="py-1 text-red-800">Data Overage (GB consumed) <span className="text-gray-400">*</span></td>
              <td className="text-right">82</td>
              <td className="text-right">$0.85/GB</td>
              <td className="text-right text-red-700">$69.70</td>
            </tr>
            <tr className="border-b border-gray-100 bg-red-50">
              <td className="py-1 text-red-800">API Call Overage (per K) <span className="text-gray-400">*</span></td>
              <td className="text-right">178</td>
              <td className="text-right">$0.35/K</td>
              <td className="text-right text-red-700">$62.30</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1">Late Fee (Oct 2024 stmt)</td>
              <td className="text-right">1</td>
              <td className="text-right">$45.00</td>
              <td className="text-right">$45.00</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1 text-gray-400">Tax &amp; Regulatory (est.)</td>
              <td className="text-right text-gray-400">–</td>
              <td className="text-right text-gray-400">–</td>
              <td className="text-right">$71.33</td>
            </tr>
            <tr className="font-bold">
              <td className="pt-2">TOTAL</td>
              <td colSpan={2}></td>
              <td className="text-right pt-2">$847.33</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-gray-400 text-xs">* Overages flagged for billing review — see notes below</p>
      </section>

      {/* Prior contact */}
      <section>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">PRIOR CONTACT LOG</p>

        <div className="space-y-3">
          <div>
            <p className="text-gray-500">11/18/2024 — Inbound call, 14 min — <span className="font-semibold">Agent: Raj P.</span></p>
            <p className="pl-2 border-l-2 border-gray-200 ml-2 mt-1 text-gray-700">
              CX reported overage charges appear incorrect per normal usage patterns. "Our API usage was the same as prior months, this doesn't add up."
              Dispute noted, ref# 2024-R-00847 issued, sent to billing review queue.
            </p>
          </div>

          <div>
            <p className="text-gray-500">11/22/2024 — Email follow-up (ticket #48291)</p>
            <p className="pl-2 border-l-2 border-gray-200 ml-2 mt-1 text-gray-700">
              CX still awaiting resolution, 4 days past initial contact. Escalated to Tier 2 per SLA policy (&gt;3 day open dispute).
            </p>
          </div>

          <div className={cn(
            "transition-colors duration-500 rounded p-1",
            activeFieldId === 'eligibility_status' && "bg-blue-100 ring-2 ring-blue-400"
          )}>
            <p className="text-gray-500">11/25/2024 — Internal billing review complete</p>
            <p className="pl-2 border-l-2 border-green-300 ml-2 mt-1 text-green-800 bg-green-50 p-2 rounded">
              ROOT CAUSE CONFIRMED: API counter malfunction during scheduled maintenance window Oct 14–18.
              Approx 120,000 API calls erroneously counted. System error verified by Billing Ops.
              Approval given to process correction.
            </p>
          </div>
        </div>
      </section>

      {/* Policy reference */}
      <section className={cn(
        "bg-blue-50 rounded border border-blue-200 p-3 transition-colors duration-500",
        activeFieldId === 'routing_decision' && "bg-blue-100 ring-2 ring-blue-400"
      )}>
        <p className="font-bold text-blue-900 mb-2">POLICY REFERENCE — Section 4.2b (Billing Corrections)</p>
        <div className="text-blue-800 space-y-1">
          <p>"Charges resulting from verified system errors are eligible for full credit. Agent authorization thresholds:</p>
          <ul className="pl-4 space-y-0.5">
            <li>• <strong>Auto-approve:</strong> up to $500 (no supervisor required)</li>
            <li>• <strong>$500–$2,000:</strong> Team Lead approval required</li>
            <li>• <strong>&gt;$2,000:</strong> Finance Director sign-off</li>
          </ul>
          <p>Customer must be notified within 5 business days of dispute filing.</p>
          <p>Refund processed 7–10 business days."</p>
        </div>
      </section>

      {/* Payment history */}
      <section>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">12-MONTH PAYMENT HISTORY</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-1 font-medium">Period</th>
              <th className="text-right font-medium">Billed</th>
              <th className="text-right font-medium">Paid</th>
              <th className="text-right font-medium">Balance</th>
              <th className="text-right font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Dec 2023', '$599.00', '$599.00', '$0.00', '—'],
              ['Jan 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Feb 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Mar 2024', '$620.50', '$620.50', '$0.00', '—'],
              ['Apr 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['May 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Jun 2024', '$643.80', '$643.80', '$0.00', '—'],
              ['Jul 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Aug 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Sep 2024', '$599.00', '$599.00', '$0.00', '—'],
              ['Oct 2024', '$599.00', '$599.00', '$0.00', '—'],
            ].map(([period, billed, paid, bal, flag]) => (
              <tr key={period} className="border-b border-gray-50">
                <td className="py-0.5">{period}</td>
                <td className="text-right">{billed}</td>
                <td className="text-right">{paid}</td>
                <td className="text-right">{bal}</td>
                <td className="text-right text-gray-400">{flag}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-200 bg-amber-50 font-semibold">
              <td className="py-1">Nov 2024</td>
              <td className="text-right">$847.33</td>
              <td className="text-right">$599.00</td>
              <td className="text-right text-red-700">$248.33</td>
              <td className="text-right text-amber-700">DISPUTE</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-gray-500">Account standing: GOOD (3 yr 8 mo tenure) · Late payments: 1 (current dispute pending)</p>
      </section>

      {/* Supporting Documents (Unstructured Data) */}
      <section className="space-y-4 pt-5 border-t border-double border-gray-400">
        <p className="text-sm font-bold tracking-widest text-gray-900 flex items-center gap-2">
          INTERNAL SUPPORTING DOCUMENTS <Badge variant="outline" className="text-[10px] uppercase">Unstructured</Badge>
        </p>

        <div className="rounded border bg-gray-50 p-4">
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">RAW_API_LOG_DUMP.txt</p>
          <pre className="text-[10px] text-gray-600 font-mono leading-tight whitespace-pre-wrap">
            {`2024-10-14 02:14:05.184 DEBUG [rate-limit-svc] node-4: maintenance_flag=true
2024-10-14 02:14:05.185 WARN  [rate-limit-svc] counter_sync_error: offset mismatch +120
2024-10-14 02:14:05.186 DEBUG [rate-limit-svc] recording_double_increment: true
2024-10-15 11:22:11.002 INFO  [billing-proxy] user=BS-2024-8847 api_call=success
... truncated 14,000 lines ...
2024-10-18 23:59:59.999 DEBUG [rate-limit-svc] node-4: maintenance_flag=false
Total anomaly count during window: 120,441 increments.`}
          </pre>
        </div>

        <div className="rounded border bg-gray-50 p-4">
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">L1_CHAT_TRANSCRIPT_48291.md</p>
          <div className="text-[11px] text-gray-700 italic space-y-2">
            <p><strong>Agent Raj P:</strong> Hello Maria, how can I help you today?</p>
            <p><strong>CX Maria:</strong> Hi, my bill is way too high. I see $132 in overages but we didn't use the API more than usual. In fact we were on a break that week.</p>
            <p><strong>Agent Raj P:</strong> I see. Let me check the logs. Hmm, it says here node-4 spiked. Were you doing any testing?</p>
            <p><strong>CX Maria:</strong> No, we didn't touch anything. It looks like a system bug on your end. Can you please check if there was a maintenance then?</p>
            <p><strong>Agent Raj P:</strong> I'll open a ticket for the billing team. They will investigate if there was a counter issue. Hold on...</p>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ─── Account Cancellation Case ─────────────────────────────────────────────── */

function AccountCancellationCase({ activeFieldId }: { activeFieldId: string | null }) {
  return (
    <div className="p-5 font-mono text-xs leading-relaxed text-gray-800 space-y-5">

      <section className={cn(
        "transition-colors duration-500",
        activeFieldId === 'account_tier' && "bg-blue-100 ring-2 ring-blue-400 p-2 -m-2 rounded"
      )}>
        <p className="text-sm font-bold tracking-widest text-gray-900 border-b border-gray-300 pb-1 mb-3">
          CUSTOMER PROFILE — CANCELLATION REQUEST
        </p>
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="pr-4 text-gray-500 w-1/3">Account #:</td>
              <td className="font-semibold">AC-2025-3391</td>
              <td className="px-4 text-gray-500">Tier:</td>
              <td className="font-semibold">Enterprise Pro</td>
            </tr>
            <tr>
              <td className="text-gray-500">Customer:</td>
              <td className="font-semibold">Chen, James K.</td>
              <td className="px-4 text-gray-500">Status:</td>
              <td className="text-red-700 font-semibold">CANCELLATION PENDING</td>
            </tr>
            <tr>
              <td className="text-gray-500">Company:</td>
              <td>Nexaflow Inc.</td>
              <td className="px-4 text-gray-500">ARR:</td>
              <td className="font-semibold">$28,800</td>
            </tr>
            <tr>
              <td className="text-gray-500">Member since:</td>
              <td>Aug 2019 <span className="text-gray-400">(5 yr 6 mo)</span></td>
              <td className="px-4 text-gray-500">CSM:</td>
              <td>Diana R.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={cn(
        "rounded border border-dashed border-gray-300 p-3 transition-colors duration-500",
        activeFieldId === 'remaining_contract_term' && "bg-blue-100 border-blue-400 border-solid border-2"
      )}>
        <p className="font-bold mb-2">CONTRACT TERMS (current)</p>
        <table className="w-full text-xs">
          <tbody>
            <tr><td className="text-gray-500 pr-4">Contract ID:</td><td>CTR-2024-NX-047</td></tr>
            <tr><td className="text-gray-500">Start Date:</td><td>Jan 1, 2024</td></tr>
            <tr><td className="text-gray-500">End Date:</td><td className="font-semibold">Dec 31, 2025 (24-month term)</td></tr>
            <tr><td className="text-gray-500">Remaining Term:</td><td className="font-semibold text-amber-700">~10 months (Mar – Dec 2026)</td></tr>
            <tr><td className="text-gray-500">Monthly Rate:</td><td>$2,400/mo (Enterprise Pro annual)</td></tr>
          </tbody>
        </table>
      </section>

      <section className={cn(
        "bg-amber-50 rounded border border-amber-200 p-3 transition-colors duration-500",
        activeFieldId === 'early_termination_fee' && "bg-blue-100 ring-2 ring-blue-400"
      )}>
        <p className="font-bold text-amber-900 mb-2">EARLY TERMINATION FEE (ETF) SCHEDULE</p>
        <p className="text-amber-800 mb-2">Per contract clause 8.3:</p>
        <ul className="pl-4 space-y-0.5 text-amber-800">
          <li>• 0–6 months remaining: 100% of remaining MRR</li>
          <li className="font-bold text-amber-900">• 7–12 months remaining: 75% of remaining MRR  ← APPLIES</li>
          <li>• 13–18 months remaining: 50% of remaining MRR</li>
          <li>• 19+ months remaining: 25% of remaining MRR</li>
        </ul>
        <p className="mt-2 font-bold text-amber-900">Calculated ETF: 10 mo × $2,400 × 0.75 = $18,000.00</p>
      </section>

      <section>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">2024 PAYMENT HISTORY</p>
        <table className="w-full text-xs">
          <tbody>
            <tr><td>Jan–Jun 2024:</td><td className="text-right">$2,400/mo × 6 = $14,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr><td>Jul 2024:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr className="text-amber-700"><td>Aug 2024:</td><td className="text-right">$2,400</td><td className="text-right">✓ Paid <span className="text-xs">(late, 12 days)</span></td></tr>
            <tr><td>Sep 2024:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr><td>Oct 2024:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr><td>Nov 2024:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr><td>Dec 2024:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr><td>Jan 2025:</td><td className="text-right">$2,400</td><td className="text-right text-green-700">✓ Paid</td></tr>
            <tr className="text-muted-foreground"><td>Feb 2025:</td><td className="text-right">$2,400</td><td className="text-right">PENDING</td></tr>
          </tbody>
        </table>
        <p className="mt-1 text-gray-500">Note: 1 late payment (Aug 2024). Otherwise consistent 5+ year history.</p>
      </section>

      <section>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">CHURN INDICATORS / CONTACT LOG</p>
        <div className="space-y-3">
          <div>
            <p className="text-gray-500">12/10/2024 — QBR call — CSM: Diana R.</p>
            <p className="pl-2 border-l-2 border-gray-200 ml-2 mt-1 text-gray-700">
              CX expressed frustration with API rate limits on Enterprise tier. Mentioned competitor evaluation (unnamed). No action taken at time.
            </p>
          </div>
          <div>
            <p className="text-gray-500">01/15/2025 — Inbound cancellation request — Agent: Marcus T.</p>
            <p className="pl-2 border-l-2 border-red-200 ml-2 mt-1 text-gray-700">
              CX requested cancellation. States: "We've moved to an alternative that better fits our stack." Not willing to disclose competitor. Asked about ETF.
            </p>
          </div>
          <div>
            <p className="text-gray-500">01/16/2025 — Retention call — CSM: Diana R.</p>
            <p className="pl-2 border-l-2 border-amber-200 ml-2 mt-1 text-gray-700">
              Offered: 20% discount for 6-month extension. CX declined.<br />
              Offered: Feature unlock (advanced API). CX declined. "Decision is final."<br />
              Escalated to retention manager.
            </p>
          </div>
          <div>
            <p className="text-gray-500">01/17/2025 — Retention Manager: Sofia B.</p>
            <p className="pl-2 border-l-2 border-red-300 ml-2 mt-1 text-red-800 bg-red-50 p-2 rounded">
              Attempted full-waiver offer if extended 3 months. CX declined all offers. "Decision is final."
              Proceeding with cancellation. ETF dispute pending — CX claims "not informed of auto-renewal."
            </p>
          </div>
        </div>
      </section>

      <section className={cn(
        "bg-blue-50 rounded border border-blue-200 p-3 transition-colors duration-500",
        activeFieldId === 'fee_waiver_applied' && "bg-blue-100 ring-2 ring-blue-400"
      )}>
        <p className="font-bold text-blue-900 mb-2">POLICY — ETF WAIVER CONDITIONS (Section 9.1)</p>
        <p className="text-blue-800 mb-1">Full ETF waiver allowed if:</p>
        <ul className="pl-4 text-blue-800 space-y-0.5">
          <li>a) Documented service quality failures (&gt;3 P1 incidents)</li>
          <li>b) Contract miscommunication (mgr discretion, requires VP approval)</li>
          <li>c) Strategic account retention (C-suite approval)</li>
        </ul>
        <p className="mt-2 text-blue-800">Partial waiver (25–50%): Mgr discretion, tenure &gt;3yr ✓</p>
        <p className="text-blue-700 font-semibold mt-1">Account tenure: 5yr 6mo — qualifies for partial waiver consideration</p>
        <p className="text-blue-700">P1 incidents in contract period: 0 &nbsp;|&nbsp; Retention offers made: 3 (all declined)</p>
      </section>

      {/* Supporting Documents (Unstructured Data) */}
      <section className="space-y-4 pt-5 border-t border-double border-gray-400">
        <p className="text-sm font-bold tracking-widest text-gray-900 flex items-center gap-2">
          INTERNAL SUPPORTING DOCUMENTS <Badge variant="outline" className="text-[10px] uppercase">Unstructured</Badge>
        </p>

        <div className="rounded border bg-gray-50 p-4">
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">USAGE_ANALYTICS_REPORT.json</p>
          <pre className="text-[10px] text-gray-600 font-mono leading-tight whitespace-pre-wrap">
            {`{
  "account_id": "AC-2025-3391",
  "period": "2024-Q4",
  "active_users": 142,
  "api_health_score": 0.88,
  "incidents": [
    {"date": "2024-11-02", "type": "P3", "desc": "Latency spike"},
    {"date": "2024-12-10", "type": "P2", "desc": "Auth timeout"}
  ],
  "churn_risk_probability": 0.74,
  "primary_churn_reason": "Price/Value ratio"
}`}
          </pre>
        </div>

        <div className="rounded border bg-gray-50 p-4">
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">INTERNAL_SLACK_THREAD_#RETENTION.txt</p>
          <div className="text-[11px] text-gray-700 italic space-y-2">
            <p><strong>@diana_csm:</strong> Hey @sofia_b, Nexaflow is definitely leaving. They're upset about the Enterprise Pro rate limits we introduced in Jan.</p>
            <p><strong>@sofia_b:</strong> Can we offer them a custom rate limit? They've been with us for 5 years.</p>
            <p><strong>@diana_csm:</strong> I tried. James (their VP) says they already signed with a competitor. He's also disputing the ETF because he claims the auto-renewal email went to their spam.</p>
            <p><strong>@sofia_b:</strong> Hmm, checking policy... we can probably do a 50% waiver given the tenure, but let's stick to full ETF first to see if they budge on the 3-month extension.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
