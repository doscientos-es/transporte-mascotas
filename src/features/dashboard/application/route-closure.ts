export type RouteClosureContact = { name: string; phone: string }
export type RouteClosureResult = {
  closedAt: string
  missingEmails: RouteClosureContact[]
  sent: number | null
  failedRecipients: Array<{ name: string; email: string }>
}
