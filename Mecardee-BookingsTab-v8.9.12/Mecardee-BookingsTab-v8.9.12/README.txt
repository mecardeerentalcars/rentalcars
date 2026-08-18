Mecardee v8.9.12 — Dedicated Bookings Tab

WHAT THIS PATCH ADDS

1. New sidebar tab:
   Dashboard
   Rentals
   Bookings
   Vehicles
   Customers
   Payments
   Accounts
   Reports
   Settings

2. Bookings badge
   - Shows the number of bookings still waiting to start / upcoming.

3. Bookings page summary
   - Today
   - Upcoming
   - Active
   - Completed
   - Cancelled

4. List View
   - Search by booking number, customer, phone, vehicle or registration.
   - Filter by vehicle.
   - Filter by status.
   - Filter by From / To dates.
   - Compact rows show vehicle, customer, pickup, return, amount, advance and status.
   - Actions: View, Edit (waiting bookings), WhatsApp, Start rental.

5. Calendar View
   - Month calendar.
   - A booking is shown on every date covered by its booking period.
   - Click a calendar booking to open it.

6. Booking edit
   - Pickup date/time.
   - Return date/time.
   - Rental days.
   - Daily rate.
   - Before saving, the server checks that the vehicle does not overlap another Booked or Rented record.

7. Start-rental safety
   - Start Rental is enabled only when:
     a) booking status is Booked,
     b) pickup time has arrived,
     c) live vehicle status is Available.

8. History visibility
   - Active/rented, completed and cancelled database booking records are available in the Bookings tab.
   - Cancelled bookings remain history records and do not block future dates.

DATABASE
- No migration is required.
- Existing tables and records are preserved.

APPLY

1. Extract this ZIP.
2. Open PowerShell.
3. Run:

   Set-ExecutionPolicy -Scope Process Bypass
   & "<extracted folder>\Apply-Mecardee-BookingsTab-v8.9.12.ps1" -ProjectPath "E:\rent a car mecardee"

The installer:
- backs up every changed file,
- applies the patch,
- runs npx tsc --noEmit,
- runs npm run build,
- automatically restores the old files if validation/build fails.

After a successful build, push to main using your normal Git commands.
