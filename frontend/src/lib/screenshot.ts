import html2canvas from 'html2canvas-pro'

export async function captureElement(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    useCORS: true,
    logging: false,
    scale: 1,
  })
  return canvas.toDataURL('image/png').split(',')[1]
}

export async function postScreenshot(sessionId: string, base64: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshot_base64: base64,
      timestamp: new Date().toISOString(),
    }),
  })
}
