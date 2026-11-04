import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AutoBlog Studio · Your publishing workspace",
  description:
    "Plan, review and publish useful articles. An editorial workspace for responsible Blogger automation.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
