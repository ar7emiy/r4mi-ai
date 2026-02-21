export interface TrackedEvent {
  type: 'click' | 'input' | 'focus' | 'submit' | 'scroll'
  target_id?: string
  target_label?: string
  value?: string
  timestamp: string
}

class EventTracker {
  private sessionId: string | null = null
  private active = false
  private queue: TrackedEvent[] = []

  setSession(id: string) {
    this.sessionId = id
  }

  start() {
    this.active = true
    this.queue = []
  }

  stop() {
    this.active = false
  }

  isActive() {
    return this.active
  }

  getQueue() {
    return [...this.queue]
  }

  async track(event: Omit<TrackedEvent, 'timestamp'>) {
    if (!this.active || !this.sessionId) return

    const e: TrackedEvent = { ...event, timestamp: new Date().toISOString() }
    this.queue.push(e)

    await fetch(`/api/sessions/${this.sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'crm',
        action: event.type,
        details: [event.target_id, event.target_label, event.value].filter(Boolean).join(' | '),
      }),
    }).catch(() => {}) // fire and forget
  }
}

export const eventTracker = new EventTracker()
