export const quackKeys = {
  all: () => ["quacks"] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
  discussion: (id: string) => [...quackKeys.all(), "discussion", id] as const,
}
