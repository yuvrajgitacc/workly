const rawBase = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || "http://127.0.0.1:8000/api/v1";
const BASE = rawBase.replace("/api/v1", "/api/developer");

function getJwt() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("portal_jwt") || ""
  }
  return ""
}

async function req(method, path, body=null, auth=true) {
  const headers = {};
  headers["Content-Type"] = "application/json";
  if (auth && getJwt() && getJwt() !== "undefined") {
    headers["Authorization"] = `Bearer ${String(getJwt()).replace(/[^\x20-\x7E]/g, "")}`;
  }
  
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  
  const data = await res.json()
  
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.clear()
      window.location.href = "/developer/login"
    }
    throw new Error("Session expired")
  }
  if (!data.success) {
    throw new Error(data.error || "Request failed")
  }
  return data.data
}

// Auth
export const portalAuth = {
  register: (b) => req("POST","/auth/register",b,false),
  login: async (email,password) => {
    const d = await req("POST","/auth/login", {email,password},false)
    if (typeof window !== "undefined") {
      localStorage.setItem("portal_jwt",d.jwt_token)
      localStorage.setItem("portal_dev", JSON.stringify(d))
    }
    return d
  },
  googleLogin: async (credential) => {
    const d = await req("POST","/auth/login-google", { credential }, false)
    if (typeof window !== "undefined") {
      localStorage.setItem("portal_jwt", d.jwt_token)
      localStorage.setItem("portal_dev", JSON.stringify(d))
    }
    return d
  },
  githubLogin: async (code) => {
    const d = await req("POST","/auth/login-github", { code }, false)
    if (typeof window !== "undefined") {
      localStorage.setItem("portal_jwt", d.jwt_token)
      localStorage.setItem("portal_dev", JSON.stringify(d))
    }
    return d
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("portal_jwt")
      localStorage.removeItem("portal_dev")
      window.location.href="/developer/login"
    }
  },
  getMe: () => req("GET","/auth/me"),
  updateProfile: (b) => req("PATCH", "/auth/profile", b)
}

// Keys
export const portalKeys = {
  list: () => req("GET","/keys"),
  generate: (b) => req("POST","/keys/generate",b),
  rotate: (id) => req("POST",`/keys/${id}/rotate`),
  revoke: (id) => req("DELETE",`/keys/${id}`),
  rename: (id,b) => req("PATCH",`/keys/${id}`,b),
  getUsage: async (id,period) => {
    const data = await req("GET",`/keys/${id}/usage?period=${period}`)
    const bd = data?.daily_breakdown || {}
    return Object.entries(bd).map(([date, calls]) => ({ date, calls }))
  }
}

// Usage
export const portalUsage = {
  summary: () => req("GET","/usage/summary"),
  timeline: async (days) => (await req("GET",`/usage/timeline?days=${days}`)).timeline,
  endpoints: async (period) => (await req("GET",`/usage/endpoints?period=${period}`)).endpoints,
  history: (months) => req("GET",`/usage/history?months=${months}`)
}

// Billing
export const portalBilling = {
  plans: () => req("GET","/billing/plans",null,false),
  subscribe: (plan) => req("POST","/billing/subscribe",{plan}),
  verifyPayment: (b) => req("POST","/billing/verify-payment",b),
  current: () => req("GET","/billing/current"),
  cancel: () => req("POST","/billing/cancel")
}

// Webhooks
export const portalWebhooks = {
  list: () => req("GET","/webhooks"),
  create: (b) => req("POST","/webhooks",b),
  delete: (id) => req("DELETE",`/webhooks/${id}`),
  update: (id,b) => req("PATCH",`/webhooks/${id}`,b),
  test: (id) => req("POST",`/webhooks/${id}/test`),
  logs: (id) => req("GET",`/webhooks/${id}/logs`)
}

// Embed
export const portalEmbed = {
  list: () => req("GET","/embed/tokens"),
  create: (b) => req("POST","/embed/tokens",b),
  revoke: (id) => req("DELETE",`/embed/tokens/${id}`)
}
