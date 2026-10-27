import type { Metadata } from "next";
import { StudyBanner } from "@/components/StudyBanner";
import { Topbar } from "@/components/Topbar";
import { VisibilityProvider } from "@/lib/visibility-context";
import { STUDY_TITLE } from "@/lib/study-config";
import "./globals.css";

export const metadata: Metadata = {
  title: STUDY_TITLE,
  description: "Experimental study on AI-supported competence assessment in software teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VisibilityProvider>
          <Topbar />
          <main>{children}</main>
        </VisibilityProvider>
      </body>
    </html>
  );
}
