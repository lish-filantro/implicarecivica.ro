import type { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import AlegeriClient from "./AlegeriClient";

export const metadata: Metadata = {
  title: "Alegeri Locale 2024 | Implicare Civică",
  description:
    "Analiza interactivă a diferențelor de voturi la alegerile locale din România, 9 iunie 2024. Cât de strâns s-a câștigat în fiecare localitate?",
};

async function loadJson(filename: string) {
  const filePath = path.join(process.cwd(), "public", "data", "alegeri-2024", filename);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export default async function AlegeriLocalePage() {
  const [summary, primariData, consiliuLocalData] = await Promise.all([
    loadJson("summary.json"),
    loadJson("primari.json"),
    loadJson("consiliu_local.json"),
  ]);

  return (
    <AlegeriClient
      summary={summary}
      primariData={primariData}
      consiliuLocalData={consiliuLocalData}
    />
  );
}
