export {};

for (const file of [".env", ".dev.vars"]) {
  if (process.env.DATABASE_URL) break;
  try {
    process.loadEnvFile(file);
  } catch {
    // DATABASE_URL can also be supplied by Railway or the current shell.
  }
}

const [{ getDb, getPool }, schema] = await Promise.all([import("./index"), import("./schema")]);
const { bookings, customers, vehicles } = schema;

const db = getDb();

const vehicleRows = [
  { name: "Maruti Swift", make: "Maruti Suzuki", registrationNumber: "KL 35 AB 1234", imageUrl: "/cars/swift.jpg", fuelType: "Petrol", transmission: "Manual", modelYear: 2023, dailyRate: 1500, odometerKm: 34218, allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 18, status: "rented" },
  { name: "Hyundai Creta", make: "Hyundai", registrationNumber: "KL 07 CP 9082", imageUrl: "/cars/creta.jpg", fuelType: "Diesel", transmission: "Automatic", modelYear: 2024, dailyRate: 2500, odometerKm: 21604, allowedKmPerDay: 120, extraKmRate: 15, mileageKmPerLitre: 17, status: "rented" },
  { name: "Toyota Innova", make: "Toyota", registrationNumber: "KL 39 M 4412", imageUrl: "/cars/innova.jpg", fuelType: "Diesel", transmission: "Manual", modelYear: 2022, dailyRate: 3200, odometerKm: 67102, allowedKmPerDay: 150, extraKmRate: 18, mileageKmPerLitre: 13, status: "rented" },
  { name: "Maruti Baleno", make: "Maruti Suzuki", registrationNumber: "KL 40 R 7270", imageUrl: "/cars/baleno.jpg", fuelType: "Petrol", transmission: "Automatic", modelYear: 2024, dailyRate: 1800, odometerKm: 18430, allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 20, status: "available" },
  { name: "Maruti Ertiga", make: "Maruti Suzuki", registrationNumber: "KL 08 BX 6601", imageUrl: "/cars/ertiga.jpg", fuelType: "Petrol", transmission: "Manual", modelYear: 2021, dailyRate: 2400, odometerKm: 76890, allowedKmPerDay: 140, extraKmRate: 15, mileageKmPerLitre: 16, status: "maintenance" },
] as const;

const customerRows = [
  { name: "Arun Kumar", phone: "+91 98765 43210", whatsappNumber: "+91 98765 43210", drivingLicence: "KL0820160012345", city: "Muvattupuzha" },
  { name: "Nikhil Jose", phone: "+91 97444 12890", whatsappNumber: "+91 97444 12890", drivingLicence: "KL0720140098172", city: "Kakkanad" },
  { name: "Fasil Rahman", phone: "+91 98950 76213", whatsappNumber: "+91 98950 76213", drivingLicence: "KL3920180067821", city: "Perumbavoor" },
  { name: "Sreejith Nair", phone: "+91 94472 11339", whatsappNumber: "+91 94472 11339", drivingLicence: "KL4020110029123", city: "Aluva" },
  { name: "Akhil Dev", phone: "+91 81290 44781", whatsappNumber: "+91 81290 44781", drivingLicence: "KL0820130088761", city: "Kothamangalam" },
] as const;

await db.transaction(async (tx) => {
  for (const vehicle of vehicleRows) {
    await tx
      .insert(vehicles)
      .values(vehicle)
      .onConflictDoUpdate({
        target: vehicles.registrationNumber,
        set: { ...vehicle, updatedAt: new Date() },
      });
  }

  for (const customer of customerRows) {
    await tx
      .insert(customers)
      .values(customer)
      .onConflictDoUpdate({ target: customers.phone, set: { ...customer, updatedAt: new Date() } });
  }

  const savedVehicles = await tx.select().from(vehicles);
  const savedCustomers = await tx.select().from(customers);
  const vehicleByPlate = new Map(savedVehicles.map((vehicle) => [vehicle.registrationNumber, vehicle]));
  const customerByPhone = new Map(savedCustomers.map((customer) => [customer.phone, customer]));

  const bookingRows = [
    { bookingNumber: "RNT-2048", plate: "KL 35 AB 1234", phone: "+91 98765 43210", startAt: "2026-08-16T10:00:00+05:30", endAt: "2026-08-21T18:00:00+05:30", rentalDays: 5, dailyRate: 1500, baseRentalAmount: 7500, advancePaid: 3000, startingKilometer: 34218, startingFuelRangeKm: 100, expectedReturnKilometer: 34718, status: "rented" },
    { bookingNumber: "RNT-2047", plate: "KL 07 CP 9082", phone: "+91 97444 12890", startAt: "2026-08-12T09:30:00+05:30", endAt: "2026-08-16T16:30:00+05:30", rentalDays: 4, dailyRate: 2500, baseRentalAmount: 10500, advancePaid: 8000, startingKilometer: 21200, startingFuelRangeKm: 180, expectedReturnKilometer: 21680, status: "rented" },
    { bookingNumber: "RNT-2041", plate: "KL 39 M 4412", phone: "+91 98950 76213", startAt: "2026-08-09T10:00:00+05:30", endAt: "2026-08-14T10:00:00+05:30", rentalDays: 5, dailyRate: 3200, baseRentalAmount: 16000, advancePaid: 10000, startingKilometer: 66700, startingFuelRangeKm: 220, expectedReturnKilometer: 67450, status: "rented" },
    { bookingNumber: "RNT-2039", plate: "KL 40 R 7270", phone: "+91 94472 11339", startAt: "2026-08-02T08:00:00+05:30", endAt: "2026-08-05T19:00:00+05:30", rentalDays: 3, dailyRate: 1800, baseRentalAmount: 5400, advancePaid: 5400, startingKilometer: 18000, startingFuelRangeKm: 120, expectedReturnKilometer: 18300, status: "completed" },
    { bookingNumber: "RNT-2033", plate: "KL 08 BX 6601", phone: "+91 81290 44781", startAt: "2026-07-27T13:00:00+05:30", endAt: "2026-07-31T13:00:00+05:30", rentalDays: 4, dailyRate: 2400, baseRentalAmount: 10200, advancePaid: 10200, startingKilometer: 76250, startingFuelRangeKm: 160, expectedReturnKilometer: 76810, status: "completed" },
  ];

  for (const booking of bookingRows) {
    const vehicle = vehicleByPlate.get(booking.plate);
    const customer = customerByPhone.get(booking.phone);
    if (!vehicle || !customer) throw new Error(`Missing seed relation for ${booking.bookingNumber}`);
    const values = {
      bookingNumber: booking.bookingNumber,
      requestedVehicleId: vehicle.id,
      vehicleId: vehicle.id,
      customerId: customer.id,
      startAt: new Date(booking.startAt),
      endAt: new Date(booking.endAt),
      rentalDays: booking.rentalDays,
      dailyRate: booking.dailyRate,
      baseRentalAmount: booking.baseRentalAmount,
      advancePaid: booking.advancePaid,
      startingKilometer: booking.startingKilometer,
      startingFuelRangeKm: booking.startingFuelRangeKm,
      expectedReturnKilometer: booking.expectedReturnKilometer,
      status: booking.status,
      handedOverAt: new Date(booking.startAt),
      completedAt: booking.status === "completed" ? new Date(booking.endAt) : null,
    };
    await tx
      .insert(bookings)
      .values(values)
      .onConflictDoUpdate({
        target: bookings.bookingNumber,
        set: { ...values, updatedAt: new Date() },
      });
  }
});

console.log("Seeded Mecardee vehicles, customers, and bookings.");
await getPool().end();
