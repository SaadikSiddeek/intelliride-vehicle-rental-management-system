// API reservation values are business wall-clock strings, not browser instants.
// An initial suggestion is only valid inside this selected reservation; never
// carry a prior booking's pickup forward or silently move a future reservation.
export function suggestedHandoverPickup(context) {
  const minute = value => typeof value === "string" ? value.slice(0,16).replace(" ","T") : "";
  const start = minute(context?.pickup_at), end = minute(context?.expected_return_at), current = minute(context?.server_now);
  const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  return [start,end,current].every(value => format.test(value)) && current >= start && current < end ? current : "";
}
