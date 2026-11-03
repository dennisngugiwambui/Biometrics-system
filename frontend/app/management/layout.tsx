import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Platform console",
  robots: { index: false, follow: false },
}

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return children
}
