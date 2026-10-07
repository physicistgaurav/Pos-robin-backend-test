import fs from "fs";
import path from "path";

const SOURCE_URL =
  "https://result.election.gov.np/JSONFiles/ElectionResultCentral2082.txt";

async function fetchCandidateData() {
  const res = await fetch(SOURCE_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch data: ${res.status}`);
  }

  const rawText = await res.text();

  // Source already contains JSON text
  const parsed = JSON.parse(rawText);

  const candidates = parsed.map((c: any) => {
    // Handle CTZDIST inconsistency (number vs string)
    const citizenshipDistrictCode =
      typeof c.CTZDIST === "number" ? c.CTZDIST : null;

    const citizenshipDistrictName =
      typeof c.CTZDIST === "string" ? c.CTZDIST : null;

    return {
      // Core identity
      candidateId: c.CandidateID,
      name: c.CandidateName,
      age: c.AGE_YR,
      gender: c.Gender,

      // Party & symbol
      party: c.PoliticalPartyName,
      symbol: {
        code: c.SYMBOLCODE,
        name: c.SymbolName,
      },

      // Location & constituency
      district: c.DistrictName,
      province: c.StateName,
      stateId: c.STATE_ID,
      constituency: c.ConstName,
      constituencyId: c.SCConstID,

      // Election data
      votes: c.TotalVoteReceived,
      status: c.E_STATUS,
      round: c.R,

      // Personal details
      dob: c.DOB,
      fatherName: c.FATHER_NAME,
      spouseName: c.SPOUCE_NAME,
      qualification: c.QUALIFICATION,
      institution: c.NAMEOFINST,
      experience: c.EXPERIENCE,
      otherDetails: c.OTHERDETAILS,
      address: c.ADDRESS,

      // Citizenship
      citizenshipDistrictCode,
      citizenshipDistrictName,

      // Candidate image
      image: c.CandidateID
        ? `https://result.election.gov.np/Images/Candidate/${c.CandidateID}.jpg`
        : null,
    };
  });

  const outputPath = path.join(process.cwd(), "data", "candidates-2082.json");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(candidates, null, 2), "utf-8");

  console.log(`✅ Saved ${candidates.length} candidates to ${outputPath}`);
}

fetchCandidateData().catch(console.error);
