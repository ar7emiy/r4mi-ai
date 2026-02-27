const USER_ID = 'demo_user'

const EVENT_TYPE_MAP: Record<string, string> = {
  click: 'click',
  input: 'input',
  focus: 'click',
  submit: 'click',
  scroll: 'navigate',
}

class EventTracker {
  private sessionId: string | null = null
  private screenName: string = 'PERMIT_FORM'
  private active = false
  private eventCount = 0

  setSession(id: string) {
    this.sessionId = id
  }

  setScreen(name: string) {
    this.screenName = name
  }

  start() {
    this.active = true
    this.eventCount = 0
  }

  stop() {
    this.active = false
  }

  isActive() {
    return this.active
  }

  getEventCount() {
    return this.eventCount
  }

  async track(event: {
    type: 'click' | 'input' | 'focus' | 'submit' | 'scroll'
    target_id?: string
    target_label?: string
    value?: string
  }) {
    if (!this.sessionId) return
    this.eventCount++

    const selector = event.target_id
      ? `#${event.target_id}`
      : event.target_label
        ? `[aria-label="${event.target_label}"]`
        : 'unknown'

    await fetch('/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId,
        user_id: USER_ID,
        timestamp: new Date().toISOString(),
        event_type: EVENT_TYPE_MAP[event.type] ?? event.type,
        screen_name: this.screenName,
        element_selector: selector,
        element_value: event.value ?? null,
        backend_call: null,
        screenshot_b64: null,
      }),
    }).catch(() => {}) // fire and forget
  }

  async trackScreenSwitch(screenName: string) {
    if (!this.sessionId) return
    this.screenName = screenName

    await fetch('/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId,
        user_id: USER_ID,
        timestamp: new Date().toISOString(),
        event_type: 'screen_switch',
        screen_name: screenName,
        element_selector: 'body',
        element_value: null,
        backend_call: null,
        screenshot_b64: null,
      }),
    }).catch(() => {})
  }
}

export const eventTracker = new EventTracker()
