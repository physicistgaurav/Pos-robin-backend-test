import fs from "fs";
import path from "path";

const INPUT_PATH = path.join(process.cwd(), "data", "candidates-2082.json");

function countCandidatesByParty() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(
      "❌ candidates-2082.json not found. Run the fetch script first.",
    );
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf-8");
  const candidates = JSON.parse(raw);

  const partyCount: Record<string, number> = {};

  for (const c of candidates) {
    const party = c.party?.trim() || "Independent / Unknown";

    partyCount[party] = (partyCount[party] || 0) + 1;
  }

  // Convert to sortable array
  const result = Object.entries(partyCount)
    .map(([party, count]) => ({ party, candidates: count }))
    .sort((a, b) => b.candidates - a.candidates);

  console.log("🗳️ Candidates by Political Party (Election 2082)\n");

  for (const r of result) {
    console.log(`${r.party}: ${r.candidates}`);
  }

  console.log("\n📊 Total candidates:", candidates.length);
}

countCandidatesByParty();
