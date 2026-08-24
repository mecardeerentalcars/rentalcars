export function effectiveBookingCalendarEndAt(
  scheduledEndAt: string,
  bookingStatus: string,
  actualReturnAt: string | null | undefined,
) {
  if (bookingStatus === "completed" && actualReturnAt) return actualReturnAt;
  return scheduledEndAt;
}
