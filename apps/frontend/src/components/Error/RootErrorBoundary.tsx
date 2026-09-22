import { Button } from "@/components/ui/button"

import { ErrorLayout } from "./ErrorLayout"

type RootErrorBoundaryProps = {
  error: unknown
}

export function RootErrorBoundary({ error }: RootErrorBoundaryProps) {
  const description =
    error instanceof Error && error.message
      ? error.message
      : "An unexpected error occurred."

  return (
    <ErrorLayout
      title="Something went wrong"
      description={description}
      action={<Button onClick={() => window.location.reload()}>Reload</Button>}
    />
  )
}
