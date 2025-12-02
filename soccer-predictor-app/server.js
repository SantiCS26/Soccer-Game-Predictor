import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());

const API_BASE = "https://v3.football.api-sports.io";
const DEFAULT_LEAGUE = 39;
const DEFAULT_SEASON = 2023;

function getTeamIdByName(name, teamsData) {
  if (!teamsData || !Array.isArray(teamsData.response)) return null;
  const teamObj = teamsData.response.find(
    (item) => item.team.name.toLowerCase() === name.toLowerCase()
  );
  return teamObj ? teamObj.team.id : null;
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : fallback;
}

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  while (p > L) {
    k++;
    p *= Math.random();
  }
  return k - 1;
}

function simulateMatch(lambdaA, lambdaB, simulations = 8000) {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let sumA = 0;
  let sumB = 0;
  const scoreCounts = new Map();

  for (let i = 0; i < simulations; i++) {
    const gA = poissonSample(lambdaA);
    const gB = poissonSample(lambdaB);
    sumA += gA;
    sumB += gB;

    if (gA > gB) aWins++;
    else if (gB > gA) bWins++;
    else draws++;

    const key = `${gA}-${gB}`;
    scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
  }

  const topScorelines = Array.from(scoreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([score, count]) => ({
      score,
      probability: (count / simulations) * 100,
    }));

  return {
    winA: (aWins / simulations) * 100,
    winB: (bWins / simulations) * 100,
    draw: (draws / simulations) * 100,
    avgGoalsA: sumA / simulations,
    avgGoalsB: sumB / simulations,
    topScorelines,
  };
}

function buildExpectedGoals(teamStatsA, teamStatsB, marketTotal) {
  const A = teamStatsA.response;
  const B = teamStatsB.response;

  const homeAttackAvg =
    safeNumber(A.goals?.for?.average?.home) ||
    safeNumber(A.goals?.for?.average?.total);
  const awayAttackAvg =
    safeNumber(B.goals?.for?.average?.away) ||
    safeNumber(B.goals?.for?.average?.total);

  const homeDefenceHomeConceded =
    safeNumber(A.goals?.against?.average?.home) ||
    safeNumber(A.goals?.against?.average?.total);
  const awayDefenceAwayConceded =
    safeNumber(B.goals?.against?.average?.away) ||
    safeNumber(B.goals?.against?.average?.total);

  let lambdaA_raw =
    1.1 * (0.7 * homeAttackAvg + 0.3 * awayDefenceAwayConceded); 
  let lambdaB_raw =
    0.9 * (0.7 * awayAttackAvg + 0.3 * homeDefenceHomeConceded); 

  lambdaA_raw = Math.max(0.05, Math.min(lambdaA_raw, 4.5));
  lambdaB_raw = Math.max(0.05, Math.min(lambdaB_raw, 4.5));

  const avgTotalA =
    safeNumber(A.goals?.for?.average?.total) +
    safeNumber(A.goals?.against?.average?.total);
  const avgTotalB =
    safeNumber(B.goals?.for?.average?.total) +
    safeNumber(B.goals?.against?.average?.total);
  let historicalMatchTotal = (avgTotalA + avgTotalB) / 2;

  if (!Number.isFinite(historicalMatchTotal) || historicalMatchTotal <= 0) {
    historicalMatchTotal = lambdaA_raw + lambdaB_raw;
  }

  const baseTotal = lambdaA_raw + lambdaB_raw || 0.1;
  let targetTotal = historicalMatchTotal;

  if (marketTotal && !Number.isNaN(Number(marketTotal))) {
    targetTotal = Number(marketTotal);
  }

  let scaleFactor = targetTotal / baseTotal;
  scaleFactor = Math.max(0.4, Math.min(scaleFactor, 2.5));

  const lambdaA = lambdaA_raw * scaleFactor;
  const lambdaB = lambdaB_raw * scaleFactor;

  return {
    lambdaA,
    lambdaB,
    lambdaA_raw,
    lambdaB_raw,
    baseTotal,
    targetTotal,
    scaleFactor,
  };
}

function computeTopScorers(playersData, teamStats, teamExpectedGoals, limit = 3) {
  if (!playersData || !Array.isArray(playersData.response)) return [];
  const totalTeamGoals = safeNumber(teamStats.response.goals?.for?.total?.total);
  if (totalTeamGoals <= 0 || teamExpectedGoals <= 0) return [];

  const players = [];

  for (const item of playersData.response) {
    const player = item.player;
    const stats = Array.isArray(item.statistics) ? item.statistics[0] : null;
    if (!stats) continue;

    const goals = safeNumber(stats.goals?.total);
    const appearances = safeNumber(stats.games?.appearences, 0);
    if (goals <= 0 || appearances <= 0) continue;

    const share = goals / totalTeamGoals;
    const lambdaPlayer = teamExpectedGoals * share;
    const prob = 1 - Math.exp(-lambdaPlayer);

    players.push({
      name: player?.name || "Unknown",
      position: stats.games?.position || "N/A",
      goals,
      appearances,
      probability: prob * 100,
    });
  }

  return players
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

app.get("/fixtures", async (req, res) => {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_FOOTBALL_KEY in .env" });
    }

    const league = req.query.league || DEFAULT_LEAGUE;
    const season = req.query.season || DEFAULT_SEASON;
    const next = req.query.next || 50;

    const resp = await fetch(
      `${API_BASE}/fixtures?league=${league}&season=${season}&next=${next}`,
      {
        headers: { "x-apisports-key": apiKey },
      }
    );
    const data = await resp.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return res
        .status(400)
        .json({ error: "API error", details: data.errors });
    }

    const fixtures = (data.response || []).map((f) => ({
      id: f.fixture?.id,
      date: f.fixture?.date,
      timestamp: f.fixture?.timestamp,
      status: f.fixture?.status?.short,
      venue: f.fixture?.venue?.name,
      homeTeam: f.teams?.home?.name,
      awayTeam: f.teams?.away?.name,
      league: data.parameters?.league,
      season: data.parameters?.season,
    }));

    res.json({ fixtures });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API error", details: err.message });
  }
});

app.get("/predict", async (req, res) => {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_FOOTBALL_KEY in .env" });
    }

    const { teamAName, teamBName, marketTotal } = req.query;

    if (!teamAName || !teamBName) {
      return res
        .status(400)
        .json({ error: "teamAName and teamBName are required" });
    }

    const leaguesResp = await fetch(
      `${API_BASE}/teams?league=${DEFAULT_LEAGUE}&season=${DEFAULT_SEASON}`,
      {
        headers: { "x-apisports-key": apiKey },
      }
    );
    const teamsData = await leaguesResp.json();

    const teamAId = getTeamIdByName(teamAName, teamsData);
    const teamBId = getTeamIdByName(teamBName, teamsData);

    if (!teamAId || !teamBId) {
      return res.status(404).json({
        error: "Team not found in API for current league/season",
        details: { teamAId, teamBId },
      });
    }

    const [statsAResp, statsBResp] = await Promise.all([
      fetch(
        `${API_BASE}/teams/statistics?team=${teamAId}&season=${DEFAULT_SEASON}&league=${DEFAULT_LEAGUE}`,
        { headers: { "x-apisports-key": apiKey } }
      ),
      fetch(
        `${API_BASE}/teams/statistics?team=${teamBId}&season=${DEFAULT_SEASON}&league=${DEFAULT_LEAGUE}`,
        { headers: { "x-apisports-key": apiKey } }
      ),
    ]);

    const [statsA, statsB] = await Promise.all([
      statsAResp.json(),
      statsBResp.json(),
    ]);

    const xgModel = buildExpectedGoals(statsA, statsB, marketTotal);
    const simulation = simulateMatch(xgModel.lambdaA, xgModel.lambdaB, 8000);

    const [playersAResp, playersBResp] = await Promise.all([
      fetch(
        `${API_BASE}/players?team=${teamAId}&season=${DEFAULT_SEASON}`,
        { headers: { "x-apisports-key": apiKey } }
      ),
      fetch(
        `${API_BASE}/players?team=${teamBId}&season=${DEFAULT_SEASON}`,
        { headers: { "x-apisports-key": apiKey } }
      ),
    ]);

    const [playersA, playersB] = await Promise.all([
      playersAResp.json(),
      playersBResp.json(),
    ]);

    const topScorersA = computeTopScorers(
      playersA,
      statsA,
      xgModel.lambdaA,
      3
    );
    const topScorersB = computeTopScorers(
      playersB,
      statsB,
      xgModel.lambdaB,
      3
    );

    res.json({
      teamA: {
        name: teamAName,
        id: teamAId,
        stats: statsA,
      },
      teamB: {
        name: teamBName,
        id: teamBId,
        stats: statsB,
      },
      model: xgModel,
      simulation,
      topScorersA,
      topScorersB,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
