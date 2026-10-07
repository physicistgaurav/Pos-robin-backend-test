import fs from "fs";
import path from "path";

const SOURCE_URL =
  "https://result.election.gov.np/JSONFiles/ElectionResultCentral2082.txt";

async function fetchPoliticalParties() {
  const res = await fetch(SOURCE_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch data: ${res.status}`);
  }

  const rawText = await res.text();
  const parsed = JSON.parse(rawText);

  // Use composite key: party name + symbol code
  const partyMap = new Map<string, any>();

  parsed.forEach((c: any) => {
    if (!c.PoliticalPartyName) return;

    const key = `${c.PoliticalPartyName}-${c.SYMBOLCODE}`;

    if (!partyMap.has(key)) {
      partyMap.set(key, {
        partyName: c.PoliticalPartyName,
        symbol: {
          code: c.SYMBOLCODE,
          name: c.SymbolName,
        },
      });
    }
  });

  const parties = Array.from(partyMap.values()).sort((a, b) =>
    a.partyName.localeCompare(b.partyName, "ne"),
  );

  const outputPath = path.join(
    process.cwd(),
    "data",
    "political-parties-2082.json",
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(parties, null, 2), "utf-8");

  console.log(`✅ Saved ${parties.length} unique political parties`);
}

fetchPoliticalParties().catch(console.error);
