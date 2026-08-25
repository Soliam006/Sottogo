import { TripProvider } from "@/components/providers/TripProvider";
import { TripShell } from "@/components/layout/TripShell";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <TripProvider tripId={tripId}>
      <TripShell>{children}</TripShell>
    </TripProvider>
  );
}
