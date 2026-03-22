import { useState, useCallback } from 'react'

export type MessageType =
  | 'system'
  | 'user'
  | 'notification'
  | 'match'
  | 'replay'
  | 'spec'
  | 'approval'
  | 'agent-step'
  | 'error'

export interface ChatMessage {
  id: string
  type: MessageType
  text: string
  timestamp: number
  data?: Record<string, unknown>
}

let _nextId = 1

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'system',
      text: 'r4mi-ai is observing. Work normally — I\'ll notify you when I detect automation opportunities.',
      timestamp: Date.now(),
    },
  ])

  const addMessage = useCallback(
    (type: MessageType, text: string, data?: Record<string, unknown>) => {
      const msg: ChatMessage = {
        id: `msg-${_nextId++}`,
        type,
        text,
        timestamp: Date.now(),
        data,
      }
      setMessages((prev) => [...prev, msg])
      return msg
    },
    [],
  )

  const updateMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, ...patch, data: { ...m.data, ...patch.data } }
            : m,
        ),
      )
    },
    [],
  )

  const clear = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, addMessage, updateMessage, clear }
}
