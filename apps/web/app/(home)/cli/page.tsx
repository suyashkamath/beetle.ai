import { Metadata } from "next";
import CliClient from "./cli-client";

export const metadata: Metadata = {
  title: "Beetle CLI | AI Code Reviews in Terminal",
  description:
    "AI code reviews in terminal, VS Code, Cursor, and more. Catch defects before they hit your PR. Install with npm i -g @beetleai_dev/beetle.",
  openGraph: {
    title: "Beetle CLI | AI Code Reviews in Terminal",
    description:
      "AI code reviews in terminal, VS Code, Cursor, and more. Catch defects before they hit your PR. Install with npm i -g @beetleai_dev/beetle.",
  },
};

export default function CliPage() {
  return <CliClient />;
}