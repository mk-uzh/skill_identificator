import type { Metadata } from "next";
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
        <header className="topbar">
          <div className="topbar__inner">
            <span className="topbar__brand">DevSkill</span>
            <span className="topbar__meta">Team Skill Matrix Study · University of Zurich</span>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
