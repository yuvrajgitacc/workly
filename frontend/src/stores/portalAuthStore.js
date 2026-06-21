import {create} from 'zustand'

export const usePortalAuthStore = create((set) => ({
  developer: null, 
  jwt: "", 
  tier: "free",
  company_name: "",
  
  setAuth: (d) => {
    if (!d) return
    set((state) => {
      const updatedDev = { ...state.developer, ...d }
      const updatedJwt = d.jwt_token || state.jwt || ""
      const updatedTier = d.tier || updatedDev.tier || "free"
      const updatedCompanyName = d.company_name || updatedDev.company_name || ""

      updatedDev.tier = updatedTier
      updatedDev.company_name = updatedCompanyName
      if (updatedJwt && !updatedDev.jwt_token) {
        updatedDev.jwt_token = updatedJwt
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("portal_dev", JSON.stringify(updatedDev))
        if (updatedJwt) {
          localStorage.setItem("portal_jwt", updatedJwt)
        }
      }

      return {
        developer: updatedDev,
        jwt: updatedJwt,
        tier: updatedTier,
        company_name: updatedCompanyName
      }
    })
  },
  
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("portal_jwt")
      localStorage.removeItem("portal_dev")
      window.location.href = "/developer/login"
    }
    set({developer: null, jwt: "", tier: "free"})
  },
  
  initFromStorage: () => {
    if (typeof window !== "undefined") {
      const jwt = localStorage.getItem("portal_jwt") || ""
      const dev = JSON.parse(localStorage.getItem("portal_dev") || "null")
      if (jwt && dev) {
        set({
          jwt, 
          developer: dev,
          tier: dev.tier || "free",
          company_name: dev.company_name || ""
        })
      }
    }
  }
}))
