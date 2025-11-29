import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());

function getTeamIdByName(name, teamsData) {
    const teamObj = teamsData.response.find(item => item.team.name.toLowerCase() === name.toLowerCase());
    return teamObj ? teamObj.team.id : null;
}

app.get("/predict", async (req, res) => {
  let { teamA, teamB } = req.query;

  if (!teamA || !teamB) return res.status(400).json({ error: "Missing teams" });

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not set" });

  try {
    const respLeague = await fetch(
      `https://v3.football.api-sports.io/teams?league=39&season=2023`,
      { headers: { "x-apisports-key": apiKey } }
    );
    const teamsData = await respLeague.json();

    teamA = getTeamIdByName(teamA, teamsData);
    teamB = getTeamIdByName(teamB, teamsData);

    const respA = await fetch(
      `https://v3.football.api-sports.io/teams/statistics?team=${teamA}&season=2023&league=39`,
      { headers: { "x-apisports-key": apiKey } }
    );
    const dataA = await respA.json();

    const respB = await fetch(
      `https://v3.football.api-sports.io/teams/statistics?team=${teamB}&season=2023&league=39`,
      { headers: { "x-apisports-key": apiKey } }
    );
    const dataB = await respB.json();

    res.json({ leagues: teamsData, teamA: dataA, teamB: dataB });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API error", details: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
