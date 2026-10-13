import { useQuery } from "@tanstack/react-query"

import { authSessionQueryOptions } from "@/features/auth/api/authSessionQueryOptions"
import { profileQueryOptions } from "@/features/auth/api/profile"

export function useSession() {
  const { data, isPending, error } = useQuery(authSessionQueryOptions())
  const profile = useQuery(profileQueryOptions(data?.user.id ?? ""))
  return {
    user: data?.user
      ? {
          ...data.user,
          ...(profile.data
            ? { name: profile.data.name, username: profile.data.username ?? "" }
            : {}),
        }
      : null,
    isPending,
    error: error ?? null,
  }
}
