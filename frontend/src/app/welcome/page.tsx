import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "AutoBlog Studio — Ideas into impact",
  description:
    "Your independent publishing command center. Shape useful articles, choose real photographs and publish to Blogger with intention.",
  robots: { index: true, follow: true },
};
export default function Welcome() {
  return <Landing />;
}
