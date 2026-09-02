const hiddenTextKeys = new Set([
  "description",
  "documentNumber",
  "docs",
  "fullLicence",
  "licence",
  "note",
  "notes",
  "text",
]);

const hiddenPhoneKeys = new Set(["phone", "whatsappNumber"]);
const hiddenPlaceKeys = new Set(["city", "guestOwnerPlace", "place"]);
const hiddenPlateKeys = new Set(["originalPlate", "plate", "registrationNumber", "requestedPlate"]);
const hiddenVehicleKeys = new Set(["active", "originalVehicle", "requestedVehicle", "vehicle"]);
const hiddenUserKeys = new Set(["createdBy", "receivedBy", "restoredBy"]);

function isPrivateNumberKey(key: string, path: string[]) {
  if (path[0] === "metrics") return true;
  return /advance|amount|balance|business|charge|collected|deposit|discount|expense|financial|fuel|income|kilometer|km|odometer|paid|pending|price|rate|revenue|spent|subtotal|total/i.test(key);
}

function demoString(key: string, parent: Record<string, unknown>) {
  if (hiddenPhoneKeys.has(key)) return "••••••••••";
  if (hiddenPlaceKeys.has(key)) return "Hidden";
  if (hiddenPlateKeys.has(key)) return "DEMO-0000";
  if (hiddenVehicleKeys.has(key)) return "Demo Vehicle";
  if (hiddenUserKeys.has(key)) return "Demo User";
  if (hiddenTextKeys.has(key) || /condition|description|documentNumber|licen[cs]e|note|odometer|remark/i.test(key)) return "Hidden in demo mode";
  if (key === "customer") return "Demo Customer";
  if (key === "guestOwnerName") return "Demo Owner";
  if (key === "initials") return "DC";
  if (key === "image" || key === "imageUrl") return "/cars/swift.jpg";
  if (key === "bookingNumber") return "DEMO-BOOKING";
  if (key === "expenseNumber") return "DEMO-EXPENSE";
  if (key === "paymentNumber") return "DEMO-PAYMENT";
  if (key === "rental") return "DEMO-RENTAL";
  if (key === "id" && "databaseId" in parent) return "DEMO-RENTAL";
  if (key === "id" && "receivedAt" in parent && "method" in parent) return "DEMO-PAYMENT";
  if (key === "id" && "rawDate" in parent && "category" in parent) return "DEMO-EXPENSE";
  if (key === "title") return "Demo reminder";
  if (key === "make" || key === "brand" || key === "model" || key === "size") return "Demo";
  if (key === "name") {
    return "registrationNumber" in parent || "plate" in parent || "dailyRate" in parent
      ? "Demo Vehicle"
      : "Demo Customer";
  }
  return null;
}

function redactValue(value: unknown, path: string[]): unknown {
  if (Array.isArray(value)) return value.map((item, index) => redactValue(item, [...path, String(index)]));
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(source)) {
    const nextPath = [...path, key];
    if (typeof child === "string") {
      result[key] = demoString(key, source) ?? child;
    } else if (typeof child === "number" && isPrivateNumberKey(key, nextPath)) {
      result[key] = 0;
    } else {
      result[key] = redactValue(child, nextPath);
    }
  }

  return result;
}

/**
 * Produces a detached, shape-compatible payload for Viewer/demo accounts.
 * Live identifiers needed for read-only navigation are preserved, while PII,
 * vehicle identity, free text, kilometer readings and financial values are not.
 */
export function redactViewerData<T>(value: T): T {
  return redactValue(value, []) as T;
}
