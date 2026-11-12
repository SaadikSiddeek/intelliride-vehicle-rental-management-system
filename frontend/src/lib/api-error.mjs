export const API_FAILURE_EVENT = "intelliride:api-failure";
export function apiFailure(error) {
  const status = error?.response?.status;
  if (status === 401) return { title: "Session expired", message: "Please sign in again to continue." };
  if (status === 403) return { title: "Access denied", message: "Your account does not have permission for this action. Contact your administrator if you need access." };
  if (status === 404) return { title: "Page or record unavailable", message: "The requested resource is unavailable. Refresh the page or contact your administrator." };
  if (status >= 500) return { title: "Service temporarily unavailable", message: "We could not complete this request. Please try again. If it continues, contact your administrator." };
  if (!status) return { title: "Connection problem", message: "Unable to reach the service. Check your connection and try again." };
  return null;
}
