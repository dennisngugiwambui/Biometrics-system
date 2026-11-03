import { ErrorScreen } from "@/components/shared/ErrorScreen"

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="We couldn’t find that page"
      message="The link may be out of date or mistyped, or the page has moved. Check the address, or head back to your dashboard."
    />
  )
}
