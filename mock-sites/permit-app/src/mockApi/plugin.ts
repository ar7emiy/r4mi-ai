import type { Plugin, Connect } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Resolve the mockData directory relative to this file
const __filename = fileURLToPath(import.meta.url)
const DATA_DIR = resolve(dirname(__filename), '..', 'mockData')

function loadJson<T = unknown>(filename: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8')) as T
}

function loadText(filename: string): string {
  return readFileSync(resolve(DATA_DIR, filename), 'utf-8')
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve_, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve_(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

interface Application {
  application_id: string
  applicant: string
  address: string
  parcel_id: string
  permit_type: string
  request: string
  submitted: string
  status?: string
}

// In-memory mutable state
const submittedAppIds = new Set<string>()
const userCreatedApps: Application[] = []
let userAppCounter = 0

function parsePolicy(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  let currentKey: string | null = null
  let currentLines: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('==== ') && line.endsWith(' ====')) {
      if (currentKey) sections[currentKey] = currentLines.join('\n').trim()
      currentKey = line
        .replace(/^=+\s*/, '')
        .replace(/\s*=+$/, '')
        .replace(/ — /g, '_')
        .toLowerCase()
        .replace(/\s+/g, '_')
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentKey) sections[currentKey] = currentLines.join('\n').trim()
  return sections
}

export function permitMockApiPlugin(): Plugin {
  return {
    name: 'permit-mock-api',
    configureServer(server) {
      server.middlewares.use(buildMiddleware(server.config.logger))
    },
  }
}

function buildMiddleware(logger: { error: (s: string) => void }) {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/stubs/')) return next()

        try {
          const path = url.split('?')[0]

          // GET/POST /api/stubs/applications
          if (path === '/api/stubs/applications') {
            if (req.method === 'GET') {
              const seeded = loadJson<Application[]>('applications.json')
              const merged = [...seeded, ...userCreatedApps].map((a) =>
                submittedAppIds.has(a.application_id) ? { ...a, status: 'Submitted' } : a,
              )
              return send(res, 200, merged)
            }
            if (req.method === 'POST') {
              const raw = await readBody(req)
              const body = raw ? JSON.parse(raw) : {}
              userAppCounter += 1
              const today = new Date().toISOString().slice(0, 10)
              const year = new Date().getFullYear()
              const appNumber = 1000 + userAppCounter
              const appId = `PRM-${year}-${String(appNumber).padStart(4, '0')}`
              const parcelId = body.parcel_id || `USR-${appNumber}-XX`
              const newApp: Application = {
                application_id: appId,
                applicant: body.applicant ?? '',
                address: body.address ?? '',
                parcel_id: parcelId,
                permit_type: body.permit_type ?? '',
                request: body.request ?? '',
                submitted: today,
                status: 'Pending Review',
              }
              userCreatedApps.push(newApp)
              return send(res, 200, newApp)
            }
          }

          // POST /api/stubs/applications/:id/submit
          const submitMatch = path.match(/^\/api\/stubs\/applications\/([^\/]+)\/submit$/)
          if (submitMatch && req.method === 'POST') {
            submittedAppIds.add(decodeURIComponent(submitMatch[1]))
            return send(res, 200, { status: 'ok', application_id: submitMatch[1] })
          }

          // GET /api/stubs/applications/:id
          const appMatch = path.match(/^\/api\/stubs\/applications\/([^\/]+)$/)
          if (appMatch && req.method === 'GET') {
            const id = decodeURIComponent(appMatch[1])
            const apps = loadJson<Application[]>('applications.json')
            const merged = [...apps, ...userCreatedApps]
            const found = merged.find((a) => a.application_id === id)
            if (!found) return send(res, 404, { detail: 'Application not found' })
            return send(
              res,
              200,
              submittedAppIds.has(id) ? { ...found, status: 'Submitted' } : found,
            )
          }

          // GET /api/stubs/gis/:parcel_id
          const gisMatch = path.match(/^\/api\/stubs\/gis\/([^\/]+)$/)
          if (gisMatch && req.method === 'GET') {
            const parcelId = decodeURIComponent(gisMatch[1])
            const data = loadJson<Record<string, unknown>>('gis_results.json')
            const result = data[parcelId]
            if (!result) {
              return send(res, 200, {
                parcel_id: parcelId,
                zone_classification: 'R-2',
                zone_description: 'Single Family Residential',
                lot_size_sqft: null,
                setback_rear_ft: 5,
                year_built: null,
                stories: null,
                last_updated: new Date().toISOString().slice(0, 10),
                _note: 'Default zone — parcel not found in GIS registry',
              })
            }
            return send(res, 200, result)
          }

          // GET /api/stubs/code-enforcement/:parcel_id
          const ceMatch = path.match(/^\/api\/stubs\/code-enforcement\/([^\/]+)$/)
          if (ceMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('code_enforcement.json')
            const result = data[decodeURIComponent(ceMatch[1])]
            if (!result) return send(res, 404, { detail: 'Parcel not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/owner-registry/:parcel_id
          const orMatch = path.match(/^\/api\/stubs\/owner-registry\/([^\/]+)$/)
          if (orMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('owner_registry.json')
            const result = data[decodeURIComponent(orMatch[1])]
            if (!result) return send(res, 404, { detail: 'Parcel not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/hazmat/:parcel_id
          const hzMatch = path.match(/^\/api\/stubs\/hazmat\/([^\/]+)$/)
          if (hzMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('hazmat_registry.json')
            const result = data[decodeURIComponent(hzMatch[1])]
            if (!result) return send(res, 404, { detail: 'Parcel not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/sewer/:block
          const sewerMatch = path.match(/^\/api\/stubs\/sewer\/([^\/]+)$/)
          if (sewerMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('sewer_capacity.json')
            const result = data[decodeURIComponent(sewerMatch[1])]
            if (!result) return send(res, 404, { detail: 'Block not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/water/:block
          const waterMatch = path.match(/^\/api\/stubs\/water\/([^\/]+)$/)
          if (waterMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('water_capacity.json')
            const result = data[decodeURIComponent(waterMatch[1])]
            if (!result) return send(res, 404, { detail: 'Block not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/fee-schedules and /api/stubs/fee-schedules/:permit_type
          if (path === '/api/stubs/fee-schedules' && req.method === 'GET') {
            return send(res, 200, loadJson('fee_schedules.json'))
          }
          const feeMatch = path.match(/^\/api\/stubs\/fee-schedules\/([^\/]+)$/)
          if (feeMatch && req.method === 'GET') {
            const data = loadJson<Record<string, unknown>>('fee_schedules.json')
            const result = data[decodeURIComponent(feeMatch[1])]
            if (!result) return send(res, 404, { detail: 'Fee schedule not found' })
            return send(res, 200, result)
          }

          // GET /api/stubs/policy and /api/stubs/policy/:section
          if (path === '/api/stubs/policy' && req.method === 'GET') {
            return send(res, 200, parsePolicy(loadText('policy_sections.txt')))
          }
          const polMatch = path.match(/^\/api\/stubs\/policy\/([^\/]+)$/)
          if (polMatch && req.method === 'GET') {
            const section = decodeURIComponent(polMatch[1])
            const policy = parsePolicy(loadText('policy_sections.txt'))
            if (policy[section]) return send(res, 200, { section, text: policy[section] })
            for (const [key, text] of Object.entries(policy)) {
              if (key.toLowerCase().includes(section.toLowerCase())) {
                return send(res, 200, { section: key, text })
              }
            }
            return send(res, 404, { detail: 'Policy section not found' })
          }

          // Fall through — unknown stubs path
          return send(res, 404, { detail: `Unknown stub path: ${path}` })
        } catch (err) {
          logger.error(`[permit-mock-api] ${err}`)
          return send(res, 500, { detail: String(err) })
        }
      }
  return middleware
}
