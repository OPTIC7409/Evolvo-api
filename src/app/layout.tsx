/**
 * Minimal Next.js Layout for API-only application
 * 
 * This layout exists only to satisfy Next.js requirements.
 * All actual functionality is in the API routes.
 */

export const metadata = {
  title: "Evolvo API",
  description: "Backend API services for Evolvo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
