interface MetObjectsResponse {
  objectIDs?: number[]
}

interface MetObjectResponse {
  objectID?: number
  isPublicDomain?: boolean
  primaryImageSmall?: string
}

const MET_API_BASE_URL = 'https://collectionapi.metmuseum.org/public/collection/v1'
const MET_MAX_OBJECT_LOOKUPS = 18
const MET_RECENT_OBJECT_MEMORY = 10

const recentMetObjectIds: number[] = []
let metObjectIdsPromise: Promise<number[]> | null = null

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Bilddaten konnten nicht gelesen werden'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('Bilddaten konnten nicht gelesen werden'))
    reader.readAsDataURL(blob)
  })
}

function rememberMetObjectId(objectId: number): void {
  recentMetObjectIds.unshift(objectId)
  while (recentMetObjectIds.length > MET_RECENT_OBJECT_MEMORY) {
    recentMetObjectIds.pop()
  }
}

function buildMetCandidatePool(objectIds: number[]): number[] {
  if (objectIds.length === 0) {
    return []
  }

  const recentIds = new Set(recentMetObjectIds)
  const pool = objectIds.filter((objectId) => !recentIds.has(objectId))
  return pool.length > 0 ? pool : objectIds
}

function pickRandomMetObjectIds(objectIds: number[], count: number): number[] {
  const pool = [...buildMetCandidatePool(objectIds)]

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }

  return pool.slice(0, count)
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Met-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchMetObjectIds(): Promise<number[]> {
  const response = await fetch(`${MET_API_BASE_URL}/objects`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Met-Objektliste konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as MetObjectsResponse
  return Array.isArray(payload.objectIDs) ? payload.objectIDs : []
}

async function fetchMetObject(objectId: number): Promise<MetObjectResponse> {
  const response = await fetch(`${MET_API_BASE_URL}/objects/${objectId}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Met-Objekt konnte nicht geladen werden (${response.status})`)
  }

  return (await response.json()) as MetObjectResponse
}

async function getMetObjectIds(): Promise<number[]> {
  if (!metObjectIdsPromise) {
    metObjectIdsPromise = fetchMetObjectIds().catch((error) => {
      metObjectIdsPromise = null
      throw error
    })
  }

  return metObjectIdsPromise
}

export async function fetchRandomMetMuseumImage(): Promise<string> {
  const objectIds = await getMetObjectIds()
  const candidateIds = pickRandomMetObjectIds(objectIds, MET_MAX_OBJECT_LOOKUPS)

  for (const objectId of candidateIds) {
    const objectRecord = await fetchMetObject(objectId)
    if (!objectRecord.isPublicDomain || !objectRecord.primaryImageSmall) {
      continue
    }

    rememberMetObjectId(objectId)
    return fetchImageAsDataUrl(objectRecord.primaryImageSmall)
  }

  throw new Error('Met-Bild konnte nicht gefunden werden')
}
