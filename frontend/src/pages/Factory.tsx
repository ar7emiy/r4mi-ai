import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useSessionStore, type PipelineStage } from '@/hooks/useSession'
import {
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  Zap,
  Eye,
  Search,
  Camera,
  FileCheck,
  Wrench,
  FlaskConical,
  Rocket,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

type StepDef = {
  stage: PipelineStage
  label: string
  icon: React.ReactNode
}

const STEPS: StepDef[] = [
  { stage: 'session_active', label: 'Observe', icon: <Eye className="h-3.5 w-3.5" /> },
  { stage: 'opportunity_detected', label: 'Detect', icon: <Search className="h-3.5 w-3.5" /> },
  { stage: 'capture_active', label: 'Capture', icon: <Camera className="h-3.5 w-3.5" /> },
  { stage: 'spec_ready', label: 'Spec', icon: <FileCheck className="h-3.5 w-3.5" /> },
  { stage: 'spec_approved', label: 'Build', icon: <Wrench className="h-3.5 w-3.5" /> },
  { stage: 'module_built', label: 'Test', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { stage: 'module_tested', label: 'Deploy', icon: <Rocket className="h-3.5 w-3.5" /> },
  { stage: 'shadow_mode', label: 'Live', icon: <Zap className="h-3.5 w-3.5" /> },
]

const STAGE_ORDER: PipelineStage[] = [
  'idle', 'session_active', 'opportunity_detected', 'capture_active',
  'spec_ready', 'spec_approved', 'module_built', 'module_tested', 'shadow_mode',
]

function stageIndex(s: PipelineStage) {
  return STAGE_ORDER.indexOf(s)
}

function StepIndicator({ step, currentStage }: { step: StepDef; currentStage: PipelineStage }) {
  const stepIdx = stageIndex(step.stage)
  const curIdx = stageIndex(currentStage)
  const done = curIdx > stepIdx
  const active = curIdx === stepIdx

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
          done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        ].join(' ')}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
      </div>
      <span className={['text-sm', done ? 'text-muted-foreground line-through' : active ? 'font-semibold text-foreground' : 'text-muted-foreground'].join(' ')}>
        {step.label}
      </span>
      {active && <ChevronRight className="h-3.5 w-3.5 text-primary ml-auto" />}
    </div>
  )
}

function StatePanel() {
  const { sessionId, captureId, opportunity, spec, module: mod, stage } = useSessionStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t bg-muted/30">
      <button
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <RefreshCw className="h-3 w-3" />
        State Snapshot
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="overflow-auto p-4 text-xs font-mono max-h-48">
          {JSON.stringify({ stage, sessionId, captureId, opportunity, spec, module: mod }, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function Factory() {
  const {
    stage, isLoading, error, ticketType,
    setTicketType, startSession, detectOpportunity,
    startCapture, closeCapture, approveSpec,
    buildModule, testModule, promoteModule, tuneModule, reset,
    sessionId, opportunity, spec, module: mod,
  } = useSessionStore()

  const [feedback, setFeedback] = useState('')

  const curIdx = stageIndex(stage)

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-semibold text-gray-900">Support Automation Factory</span>
        </div>
        <Badge variant="secondary" className="text-xs">MVP</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/crm">
            <Button variant="outline" size="sm" className="gap-1.5">
              Open CRM <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
          {stage !== 'idle' && (
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              Reset
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Pipeline stepper */}
        <aside className="flex w-48 shrink-0 flex-col border-r bg-white p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pipeline</p>
          {STEPS.map((step) => (
            <StepIndicator key={step.stage} step={step} currentStage={stage} />
          ))}
          <Separator className="my-4" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Progress</p>
            <Progress value={Math.round((Math.max(0, curIdx - 1) / (STAGE_ORDER.length - 2)) * 100)} className="h-1.5" />
            <p className="text-right">{Math.round((Math.max(0, curIdx - 1) / (STAGE_ORDER.length - 2)) * 100)}%</p>
          </div>
        </aside>

        {/* Right: Stage content */}
        <main className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* IDLE */}
          {stage === 'idle' && (
            <div className="mx-auto max-w-lg pt-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="rounded-2xl bg-primary/10 p-5">
                  <Zap className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h1 className="mb-2 text-2xl font-bold">Support Automation Factory</h1>
              <p className="mb-8 text-muted-foreground">
                Watch Gemini learn a support workflow and automate it — permanently.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Step 1: Start a Session</CardTitle>
                  <CardDescription>Select the workflow type to observe</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Workflow Type</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={ticketType}
                      onChange={(e) => setTicketType(e.target.value)}
                    >
                      <option value="billing_dispute">Billing Refund Request</option>
                      <option value="cancellation_request">Account Cancellation</option>
                    </select>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button className="w-full" onClick={startSession} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Start Session
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Then open the CRM and complete a {ticketType === 'billing_dispute' ? 'billing refund' : 'cancellation'} manually
                  </p>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* SESSION ACTIVE */}
          {stage === 'session_active' && (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Session active — <code className="font-mono">{sessionId}</code>
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observe the Workflow</CardTitle>
                  <CardDescription>
                    Open the CRM and manually complete a {ticketType === 'billing_dispute' ? 'Billing Refund' : 'Account Cancellation'}.
                    All interactions are silently tracked.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>Open the CRM below</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>Read the case file and fill out the form</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">3</span>Submit the form, then come back here</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">4</span>Click "Detect Opportunity"</li>
                  </ol>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Link to="/crm" className="w-full">
                    <Button variant="outline" className="w-full gap-2">
                      Open CRM <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button className="w-full" onClick={detectOpportunity} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Detect Opportunity
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* OPPORTUNITY DETECTED */}
          {stage === 'opportunity_detected' && opportunity && (
            <div className="mx-auto max-w-lg space-y-4">
              <Card className="border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{opportunity.name}</CardTitle>
                    <Badge variant={opportunity.complexity === 'high' ? 'destructive' : opportunity.complexity === 'medium' ? 'warning' : 'success'}>
                      {opportunity.complexity} complexity
                    </Badge>
                  </div>
                  <CardDescription>Automation opportunity detected</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Confidence</span>
                      <span className="text-primary font-semibold">{Math.round(opportunity.confidence * 100)}%</span>
                    </div>
                    <Progress value={opportunity.confidence * 100} className="h-2" />
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {opportunity.rationale}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button className="w-full" onClick={startCapture} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    Start Guided Capture
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Go to the CRM and repeat the workflow while capture is active
                  </p>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* CAPTURE ACTIVE */}
          {stage === 'capture_active' && (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  Capture in progress — recording your workflow
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Repeat the Workflow in CRM</CardTitle>
                  <CardDescription>
                    Every form interaction and navigation is being recorded to build the automation spec.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">1</span>Open the CRM</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">2</span>Work through the case file and fill the form</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700">3</span>Come back here and close the capture</li>
                  </ol>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Link to="/crm" className="w-full">
                    <Button variant="outline" className="w-full gap-2">
                      Go to CRM <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button className="w-full" onClick={closeCapture} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                    Close Capture + Generate Spec
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* SPEC READY */}
          {stage === 'spec_ready' && spec && (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p className="font-medium">Human Review Required</p>
                <p className="text-blue-700 text-xs mt-0.5">Gemini has generated an automation spec. Please review carefully before approving.</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Automation Spec v1</CardTitle>
                  <CardDescription className="font-mono text-xs">{spec.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
                    <p className="text-sm">{spec.trigger}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps ({spec.steps.length})</p>
                    <ol className="space-y-2">
                      {spec.steps.map((step) => (
                        <li key={step.index} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{step.index}</span>
                          <div className="flex-1">
                            <span className="font-medium">{step.action}</span>
                            <span className="text-muted-foreground"> → {step.target}</span>
                            {step.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{step.notes}</p>}
                          </div>
                          <Badge variant={step.automatable ? 'success' : 'warning'} className="shrink-0 text-xs">
                            {step.automatable ? 'auto' : 'manual'}
                          </Badge>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {spec.open_questions.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">Open Questions</p>
                        <ul className="space-y-1">
                          {spec.open_questions.map((q, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Success Criteria</p>
                    <p className="text-sm">{spec.success_criteria}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={approveSpec} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve Spec
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* SPEC APPROVED → BUILD */}
          {stage === 'spec_approved' && (
            <div className="mx-auto max-w-lg space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Spec approved — ready to build automation module
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Build Automation Module</CardTitle>
                  <CardDescription>Generate the executable automation module from the approved spec.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button className="w-full" onClick={buildModule} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                    Build Module
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* MODULE BUILT → TEST */}
          {stage === 'module_built' && mod && (
            <div className="mx-auto max-w-lg space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Module Built — Run Tests</CardTitle>
                  <CardDescription className="font-mono text-xs">{mod.id} · v{mod.version}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-md bg-muted p-3 text-xs font-mono max-h-40">{mod.code_stub}</pre>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={testModule} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                    Run Tests
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* MODULE TESTED → PROMOTE */}
          {stage === 'module_tested' && mod && (
            <div className="mx-auto max-w-lg space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mod.test_results.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{t.name}</span>
                      <Badge variant={t.result === 'pass' ? 'success' : 'warning'}>{t.result}</Badge>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SME Feedback (optional)</label>
                    <input
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="e.g. Policy threshold should route to manager approval"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                    {feedback && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => { tuneModule(feedback); setFeedback('') }}
                        disabled={isLoading}
                      >
                        Apply Feedback
                      </Button>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={promoteModule} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Promote to Shadow Mode
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* SHADOW MODE */}
          {stage === 'shadow_mode' && (
            <div className="mx-auto max-w-lg pt-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="rounded-2xl bg-emerald-100 p-5">
                  <Zap className="h-10 w-10 text-emerald-600" />
                </div>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-emerald-700">Automation Live in Shadow Mode</h2>
              <p className="mb-6 text-muted-foreground">
                Gemini is now handling this workflow automatically. All actions are logged for SME review before going fully live.
              </p>
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                The automation will observe the next 10 real tickets silently, flagging any exceptions for human review.
              </div>
              <Link to="/crm">
                <Button className="gap-2">
                  Watch Automation in CRM <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </main>
      </div>

      <StatePanel />
    </div>
  )
}
