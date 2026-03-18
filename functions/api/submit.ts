/**
 * POST /api/submit — UAP Sighting Report Submission
 *
 * Cloudflare Pages Function.
 * Validates the payload, generates a unique key, and stores it in Workers KV.
 *
 * KV binding: UAP_SUBMISSIONS (configured in wrangler.toml / dashboard)
 * Key format: sub:<timestamp>:<random-id>
 */

interface Env {
  UAP_SUBMISSIONS: KVNamespace
}

interface SubmissionPayload {
  date: string
  location: string
  shape: string
  title: string
  description: string
  duration?: string
  observers?: number
  contactEmail?: string
}

const REQUIRED_FIELDS: (keyof SubmissionPayload)[] = [
  'date',
  'location',
  'shape',
  'title',
  'description'
]

const MAX_FIELD_LENGTH = 10000
const MAX_TITLE_LENGTH = 200
const MAX_OBSERVERS = 10000

const ERROR_MISSING_FIELDS = 'Missing required fields: date, location, shape, title, description'
const ERROR_METHOD_NOT_ALLOWED = 'Method not allowed'
const ERROR_INVALID_JSON = 'Invalid JSON body'
const ERROR_TITLE_TOO_LONG = 'Title must be under 200 characters'
const ERROR_DESCRIPTION_TOO_LONG = 'Description must be under 10,000 characters'
const ERROR_INVALID_OBSERVERS = 'Observers must be a number between 1 and 10,000'
const ERROR_KV_NOT_BOUND = 'Storage not configured'
const ERROR_INTERNAL = 'Internal server error'

function generateId (): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `${timestamp}:${random}`
}

function validatePayload (body: Record<string, unknown>): SubmissionPayload | string {
  for (const field of REQUIRED_FIELDS) {
    const value = body[field]
    if (typeof value !== 'string' || value.trim().length === 0) {
      return ERROR_MISSING_FIELDS
    }
  }

  const title = (body.title as string).trim()
  if (title.length > MAX_TITLE_LENGTH) {
    return ERROR_TITLE_TOO_LONG
  }

  const description = (body.description as string).trim()
  if (description.length > MAX_FIELD_LENGTH) {
    return ERROR_DESCRIPTION_TOO_LONG
  }

  if (body.observers !== undefined && body.observers !== null) {
    const observers = Number(body.observers)
    if (isNaN(observers) || observers < 1 || observers > MAX_OBSERVERS) {
      return ERROR_INVALID_OBSERVERS
    }
  }

  return {
    date: (body.date as string).trim(),
    location: (body.location as string).trim(),
    shape: (body.shape as string).trim(),
    title,
    description,
    ...(body.duration && typeof body.duration === 'string' && { duration: body.duration.trim() }),
    ...(body.observers !== undefined && { observers: Number(body.observers) }),
    ...(body.contactEmail && typeof body.contactEmail === 'string' && { contactEmail: body.contactEmail.trim() })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.UAP_SUBMISSIONS) {
    return Response.json(
      { success: false, error: ERROR_KV_NOT_BOUND },
      { status: 500 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json(
      { success: false, error: ERROR_INVALID_JSON },
      { status: 400 }
    )
  }

  const result = validatePayload(body)
  if (typeof result === 'string') {
    return Response.json(
      { success: false, error: result },
      { status: 400 }
    )
  }

  const key = `sub:${generateId()}`
  const record = {
    ...result,
    submittedAt: new Date().toISOString(),
    ip: request.headers.get('cf-connecting-ip') || undefined,
    country: request.headers.get('cf-ipcountry') || undefined
  }

  try {
    await env.UAP_SUBMISSIONS.put(key, JSON.stringify(record))
  } catch {
    return Response.json(
      { success: false, error: ERROR_INTERNAL },
      { status: 500 }
    )
  }

  return Response.json({ success: true, id: key })
}

export const onRequestGet: PagesFunction = async () => {
  return Response.json(
    { error: ERROR_METHOD_NOT_ALLOWED },
    { status: 405 }
  )
}
