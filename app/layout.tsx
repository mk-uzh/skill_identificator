import type { Metadata, Viewport } from "next";
import { StudyBanner } from "@/components/StudyBanner";
import { Topbar } from "@/components/Topbar";
import { ProjectProvider } from "@/lib/project-context";
import { VisibilityProvider } from "@/lib/visibility-context";
import { STUDY_TITLE } from "@/lib/study-config";
import "./globals.css";

export const metadata: Metadata = {
  title: STUDY_TITLE,
  description: "Experimental study on AI-supported competence assessment in software teams",
};

// viewport-fit=cover lets the bottom bar respect the safe area of phones with a home bar.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProjectProvider>
          <VisibilityProvider>
            <Topbar />
            <StudyBanner />
            <main>{children}</main>
          </VisibilityProvider>
        </ProjectProvider>
      </body>
    </html>
  );
}
