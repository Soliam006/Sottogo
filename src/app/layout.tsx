import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata: Metadata = {
  title: "Voyago · Vive, organiza y recuerda tus viajes",
  description:
    "Un espacio digital colaborativo donde gastos, lugares, fotos e itinerario de un viaje quedan conectados entre sí.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#101013" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <ToastProvider>
            {configured ? <SessionProvider>{children}</SessionProvider> : <SetupNotice />}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
