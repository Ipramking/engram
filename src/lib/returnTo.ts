// Where to go after signing in, e.g. back to an OAuth consent page that sent the user to log in.
const KEY = 'engram.returnTo'

export function setReturnTo(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* private mode */
  }
}

/** Returns and clears the saved path; only same-site paths are honoured. */
export function takeReturnTo(fallback = '/dashboard') {
  try {
    const v = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return v && v.startsWith('/') && !v.startsWith('//') ? v : fallback
  } catch {
    return fallback
  }
}
