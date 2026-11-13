export const API_FAILURE_EVENT = "intelliride:api-failure";
export function apiFailure(error) {
  const status = error?.response?.status;
  if (status === 503 && error?.response?.data?.error_code === "IMAGE_PROCESSING_UNAVAILABLE") return { title: "Image uploads unavailable", message: "Image uploads are temporarily unavailable. Contact your administrator." };
  if (status === 413) return { title: "Upload too large", message: "The upload exceeds the service limit. Use a smaller file and try again." };
  if (status === 419) return { title: "Session verification required", message: "Please sign in again before submitting this form." };
  if (status === 401) return { title: "Session expired", message: "Please sign in again to continue." };
  if (status === 403) return { title: "Access denied", message: "Your account does not have permission for this action. Contact your administrator if you need access." };
  if (status === 404) return { title: "Page or record unavailable", message: "The requested resource is unavailable. Refresh the page or contact your administrator." };
  if (status >= 500) return { title: "Service temporarily unavailable", message: "We could not complete this request. Please try again. If it continues, contact your administrator." };
  if (!status) return { title: "Connection problem", message: "Unable to reach the service. Check your connection and try again." };
  return null;
}
