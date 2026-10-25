// Only exact frontend-generated errors may be localized. Unknown server prose passes through.
export const FRONTEND_ERROR_MESSAGES: readonly string[] = [
  "Something went wrong. Please try again.",
  "The service is temporarily unavailable. Please try again shortly.",
  "The service returned an unreadable response. Please try again.",
  "We could not complete this request. Please try again.",
  "This is taking longer than expected. Please try again.",
  "We could not reach the service. Please try again in a moment.",
  "The service returned prices for a different asset.",
  "The analysis did not match your plan. Please try again.",
  "The investment plan did not match your request. Please try again.",
  "The selected investment plan did not match your request. Please try again.",
  "This feature needs the updated server. Ask the team to deploy the selected-assets API.",
  "The service returned incomplete asset information. Please try again.",
  "The service returned incomplete price history. Please try again.",
  "The service returned incomplete analysis. Please try again.",
  "The service returned incomplete investment plan. Please try again.",
  "The service returned incomplete summary. Please try again.",
  "The service returned incomplete answer. Please try again.",
  "The service returned incomplete reminder. Please try again.",
]

const frontendErrors = new Set(FRONTEND_ERROR_MESSAGES)

export function localizeKnownError(message: string, t: (source: string) => string): string {
  return frontendErrors.has(message) ? t(message) : message
}
