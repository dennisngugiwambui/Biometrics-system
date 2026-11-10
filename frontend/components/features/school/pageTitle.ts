/**
 * Browser-tab titles, one format everywhere:
 *
 *   "<Page> · <School name>"        e.g. "Attendance · Olkalou School"
 *   "<Page> · School Biometric"     before a school is known (sign-in pages)
 */

export const PRODUCT_NAME = "School Biometric"

// Most specific first; matched against the start of the path.
const ROUTES: Array<[RegExp, string]> = [
  [/^\/login\/?$/, "Sign in"],
  [/^\/register\/?$/, "Register your school"],
  [/^\/forgot-password\/?$/, "Forgot password"],
  [/^\/reset-password\/?$/, "Reset password"],
  [/^\/support\/[^/]+/, "Support ticket"],
  [/^\/support\/?$/, "Support"],

  [/^\/dashboard\/students\/new\/?$/, "New student"],
  [/^\/dashboard\/students\/roster/, "Student roster"],
  [/^\/dashboard\/students\/[^/]+\/edit/, "Edit student"],
  [/^\/dashboard\/students\/[^/]+/, "Student details"],
  [/^\/dashboard\/students/, "Students"],

  [/^\/dashboard\/teachers\/new\/?$/, "New teacher"],
  [/^\/dashboard\/teachers\/[^/]+\/edit/, "Edit teacher"],
  [/^\/dashboard\/teachers\/[^/]+/, "Teacher details"],
  [/^\/dashboard\/teachers/, "Teachers"],

  [/^\/dashboard\/devices\/new\/?$/, "Add device"],
  [/^\/dashboard\/devices\/[^/]+\/edit/, "Edit device"],
  [/^\/dashboard\/devices\/[^/]+/, "Device details"],
  [/^\/dashboard\/devices/, "Devices"],

  [/^\/dashboard\/device-groups\/new\/?$/, "New device group"],
  [/^\/dashboard\/device-groups\/[^/]+\/edit/, "Edit device group"],
  [/^\/dashboard\/device-groups/, "Device groups"],

  [/^\/dashboard\/settings\/notifications/, "Notification settings"],
  [/^\/dashboard\/settings/, "Settings"],
  [/^\/dashboard\/attendance/, "Attendance"],
  [/^\/dashboard\/presence/, "Presence"],
  [/^\/dashboard\/classes/, "Classes"],
  [/^\/dashboard\/enrollment/, "Enrollment"],
  [/^\/dashboard\/reports/, "Reports"],
  [/^\/dashboard\/notifications/, "Notifications"],
  [/^\/dashboard\/profile/, "My profile"],
  [/^\/dashboard\/help/, "Help & support"],
  [/^\/dashboard\/?$/, "Dashboard"],
]

export function pageTitle(pathname: string | null, schoolName?: string | null): string {
  const path = pathname || "/"
  const page = ROUTES.find(([re]) => re.test(path))?.[1]
  const school = schoolName && schoolName !== "SchoolAdmin" ? schoolName.trim() : ""
  const suffix = school || PRODUCT_NAME
  return page ? `${page} · ${suffix}` : school ? `${school} · ${PRODUCT_NAME}` : `${PRODUCT_NAME} Attendance`
}
