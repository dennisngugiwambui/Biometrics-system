/**
 * Platform owner session for the /management console — kept apart from the
 * school sign-in (useAuthStore) so the two never share a token.
 * sessionStorage: closing the browser signs the owner out.
 */

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface PlatformAuthState {
  token: string | null
  email: string | null
  fullName: string | null
  mustChangePassword: boolean
  hasHydrated: boolean
  signIn: (s: { token: string; email: string; fullName: string; mustChangePassword: boolean }) => void
  passwordChanged: () => void
  signOut: () => void
  setHasHydrated: () => void
}

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      fullName: null,
      mustChangePassword: false,
      hasHydrated: false,
      signIn: ({ token, email, fullName, mustChangePassword }) => set({ token, email, fullName, mustChangePassword }),
      passwordChanged: () => set({ mustChangePassword: false }),
      signOut: () => set({ token: null, email: null, fullName: null, mustChangePassword: false }),
      setHasHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "shulepoa-platform-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ token, email, fullName, mustChangePassword }) => ({ token, email, fullName, mustChangePassword }),
      // Runs when sessionStorage has been read — possibly while the store is still
      // being created, so it must go through the state it is given.
      onRehydrateStorage: () => (state) => state?.setHasHydrated(),
    },
  ),
)
