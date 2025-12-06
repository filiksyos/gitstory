import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitStory - GitHub Repository Timelapse",
  description: "Create timelapse videos showing the evolution of your GitHub repositories across branches",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}