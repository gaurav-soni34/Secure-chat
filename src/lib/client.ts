
import { treaty } from "@elysiajs/eden"
import type { App } from "../app/api/[[...slugs]]/route"

// Determine the API base URL
const getApiUrl = () => {
  // In production (deployed), use the same origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // Server-side rendering - use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

const apiUrl = getApiUrl()

export const client = treaty<App>(apiUrl, {
  fetch: {
    credentials: 'include', // Send cookies with all requests
  }
}).api
