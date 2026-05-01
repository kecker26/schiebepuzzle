async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    if (payload?.error) return payload.error
  } catch {
    // ignore body parsing failure
  }

  return `Fehler (${response.status})`
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  return (await response.json()) as T
}

export async function requestOk(url: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
}
