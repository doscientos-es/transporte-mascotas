type SessionIdentity = { user: { id: string } } | null

export function sessionUserId(session: SessionIdentity) {
  return session?.user.id ?? null
}
