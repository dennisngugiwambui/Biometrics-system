/**
 * School Branding State Management using Zustand.
 *
 * Persists to localStorage and manages:
 * - Custom theme colors (3-5 hex strings)
 * - School name override for sidebar
 * - School logo (base64 data URL)
 * - Login page background image (base64 data URL)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SchoolBrandingState {
    /** Array of 3-5 hex color strings, e.g. ["#1a73e8", "#fbbc04", "#34a853"] */
    colors: string[];
    /** School name shown in sidebar – synced from API on first load */
    schoolName: string;
    /** Base64 data URL of the school logo */
    logoDataUrl: string | null;
    /** Base64 data URL of the login page background image */
    loginBgDataUrl: string | null;

    setColors: (colors: string[]) => void;
    setSchoolName: (name: string) => void;
    setLogo: (dataUrl: string | null) => void;
    setLoginBg: (dataUrl: string | null) => void;
    resetColors: () => void;
}

export const DEFAULT_SCHOOL_COLORS = [
    '#2563eb', // primary blue
    '#7c3aed', // secondary purple
    '#0ea5e9', // accent sky
    '#10b981', // success green
    '#f59e0b', // warning amber
];

export const useSchoolBrandingStore = create<SchoolBrandingState>()(
    persist(
        (set) => ({
            colors: DEFAULT_SCHOOL_COLORS,
            schoolName: 'SchoolAdmin',
            logoDataUrl: null,
            loginBgDataUrl: null,

            setColors: (colors) => set({ colors }),
            setSchoolName: (name) => set({ schoolName: name }),
            setLogo: (dataUrl) => set({ logoDataUrl: dataUrl }),
            setLoginBg: (dataUrl) => set({ loginBgDataUrl: dataUrl }),
            resetColors: () => set({ colors: DEFAULT_SCHOOL_COLORS }),
        }),
        {
            name: 'school-branding', // localStorage key
        }
    )
);
