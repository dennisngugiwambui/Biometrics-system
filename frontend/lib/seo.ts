/** Search-engine facts shared by the root layout, landing page, sitemap and share image. */

export const SITE_URL = "https://attedance.shulepoa.co.ke"
export const SITE_NAME = "Shulepoa Attendance"

export const SITE_TITLE = "Shulepoa Attendance — Biometric School Attendance System in Kenya"
export const SITE_DESCRIPTION =
  "Fingerprint attendance for Kenyan schools. Students and teachers clock in on ZKTeco devices, parents get an " +
  "instant SMS, and you get live registers and PDF reports."

export const SITE_KEYWORDS = [
  "Shulepoa",
  "Shulepoa attendance",
  "shulepoa.co.ke",
  "biometric attendance system Kenya",
  "school attendance system Kenya",
  "fingerprint attendance for schools",
  "student attendance system",
  "school biometric system",
  "ZKTeco school attendance",
  "teacher attendance system",
  "school clock in system",
  "parent SMS attendance alerts",
  "boarding school attendance",
  "CBC school management Kenya",
  "online school attendance register",
]

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Shulepoa Attendance?",
    a: "Shulepoa Attendance is an online biometric attendance system for schools in Kenya. Students and staff clock in with a fingerprint on a ZKTeco device, and the school sees who is in, who is late and who is absent in real time.",
  },
  {
    q: "Which fingerprint devices does Shulepoa work with?",
    a: "Shulepoa works with ZKTeco fingerprint and face terminals. Devices connect to the cloud over the school's internet (ADMS / push mode), so there is no school server or fixed IP address to set up.",
  },
  {
    q: "Do parents get notified when their child arrives?",
    a: "Yes. When a student clocks in or out, Shulepoa can send the parent an SMS so they know their child arrived at school safely.",
  },
  {
    q: "Can we track teacher attendance too?",
    a: "Yes. Teachers and staff are enrolled the same way as students, and their arrival and departure times appear in the same live dashboard and reports.",
  },
  {
    q: "What reports does Shulepoa produce?",
    a: "Daily and date-range attendance registers by class and stream, late-comer and absentee lists, and per-student history — all exportable as printable PDF reports.",
  },
  {
    q: "Do we need to install anything?",
    a: "No. Shulepoa runs in the browser on computers, tablets and phones, and can be installed to the home screen as an app. Only the fingerprint device sits at the school gate.",
  },
]
