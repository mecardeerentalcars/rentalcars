import VehicleDetailsClient from "./vehicle-details-client";

export default async function VehicleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailsClient vehicleId={id} />;
}
