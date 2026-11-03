import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Register your school",
  description:
    "Register your school on Shulepoa Attendance and start fingerprint clock-in for students and teachers, with instant parent SMS alerts and PDF reports.",
  alternates: { canonical: "/register" },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
