import assert from "node:assert/strict";
import test from "node:test";
import { redactViewerData } from "../lib/viewer-demo";

test("viewer demo payload removes live identity and financial values without mutating source", () => {
  const source = {
    ok: true,
    rentals: [{
      id: "RNT-1042",
      databaseId: "11111111-1111-4111-8111-111111111111",
      customer: "Live Customer",
      phone: "9876543210",
      city: "Secret Place",
      vehicle: "Live Car",
      plate: "KL-01-AA-1234",
      rate: 2500,
      balance: 4200,
      status: "active",
    }],
    vehicles: [{
      id: "22222222-2222-4222-8222-222222222222",
      name: "Live Vehicle",
      registrationNumber: "KL-02-BB-5678",
      odometerKm: 78901,
      status: "available",
    }],
    customers: [{
      id: "33333333-3333-4333-8333-333333333333",
      name: "Private Person",
      phone: "9123456789",
      fullLicence: "KL0120230012345",
      spent: 99000,
    }],
    vehicleProfiles: {
      vehicle: {
        documents: [{ documentNumber: "INS-SECRET", notes: "Private note" }],
        maintenance: [{ amount: 12345, description: "Private service note" }],
      },
    },
    metrics: { totalCars: 12, collectedMonth: 150000, monthlyCollected: [{ amount: 25000 }] },
  };

  const result = redactViewerData(source);
  const serialized = JSON.stringify(result);

  for (const secret of ["Live Customer", "9876543210", "Secret Place", "Live Car", "KL-01-AA-1234", "Live Vehicle", "KL-02-BB-5678", "Private Person", "9123456789", "KL0120230012345", "INS-SECRET", "Private note", "Private service note"]) {
    assert.equal(serialized.includes(secret), false, `${secret} should not appear in Viewer data`);
  }

  assert.equal(result.rentals[0].customer, "Demo Customer");
  assert.equal(result.rentals[0].rate, 0);
  assert.equal(result.rentals[0].status, "active");
  assert.equal(result.vehicles[0].id, source.vehicles[0].id);
  assert.equal(result.customers[0].id, source.customers[0].id);
  assert.equal(result.metrics.totalCars, 0);
  assert.equal(result.metrics.collectedMonth, 0);
  assert.equal(source.rentals[0].customer, "Live Customer");
  assert.equal(source.metrics.collectedMonth, 150000);
});
