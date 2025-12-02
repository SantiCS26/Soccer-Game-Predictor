import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import NodeCache from "node-cache";
import fetch from "node-fetch";

dotenv.config();
const app = express();
app.use(cors());

const API_BASE = "https://v3.football.api-sports.io";


function getCurrentSeason() {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}
const DEFAULT_LEAGUE = 39;
const DEFAULT_SEASON = getCurrentSeason();

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 120
});

function safeNumber(val, fallback = 0) {
  if (val === undefined || val === null) return fallback;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  while (p > L) {
    p *= Math.random();
    k++;
  }
  return k - 1;
}

function simulateMatch(lambdaA, lambdaB, sims = 8000) {
  let aWins = 0, bWins = 0, draws = 0;
  let sumA = 0, sumB = 0;
  const scoreCounts = new Map();

  for (let i = 0; i < sims; i++) {
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

  const topScorelines = [...scoreCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([score, count]) => ({
      score,
      probability: (count / sims) * 100
    }));

  return {
    winA: (aWins / sims) * 100,
    winB: (bWins / sims) * 100,
    draw: (draws / sims) * 100,
    avgGoalsA: sumA / sims,
    avgGoalsB: sumB / sims,
    topScorelines
  };
}

async function apiCall(url) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("Missing API_FOOTBALL_KEY");

  const resp = await fetch(url, { headers: { "x-apisports-key": key } });
  const data = await resp.json();
  
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }
  return data;
}

async function cachedFetch(cacheKey, ttlSec, builder) {
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const data = await builder();
  cache.set(cacheKey, data, ttlSec);
  return data;
}

async function getTeamList() {
  return cachedFetch(
    "teams",
    21600,
    () => apiCall(`${API_BASE}/teams?league=${DEFAULT_LEAGUE}&season=${DEFAULT_SEASON}`)
  );
}

app.get("/fixtures", async (req, res) => {
  try {
    const fixtures = await cachedFetch(
      "fixtures",
      300,
      () =>
        apiCall(`${API_BASE}/fixtures?league=${DEFAULT_LEAGUE}&season=${DEFAULT_SEASON}&next=50`)
    );

    res.json({ fixtures: fixtures.response });
  } catch (err) {
    res.status(500).json({ error: "Could not load fixtures", details: err.message });
  }
});

function buildXG(statsA, statsB, marketTotal) {
  const A = statsA.response;
  const B = statsB.response;

  let lambdaA_raw =
    1.1 *
    (0.7 * safeNumber(A.goals.for.average.home) +
      0.3 * safeNumber(B.goals.against.average.away));

  let lambdaB_raw =
    0.9 *
    (0.7 * safeNumber(B.goals.for.average.away) +
      0.3 * safeNumber(A.goals.against.average.home));

  lambdaA_raw = Math.max(0.05, Math.min(lambdaA_raw, 4.5));
  lambdaB_raw = Math.max(0.05, Math.min(lambdaB_raw, 4.5));

  const baseTotal = lambdaA_raw + lambdaB_raw;

  let targetTotal;
  if (marketTotal && !isNaN(marketTotal)) {
    targetTotal = parseFloat(marketTotal);
  } else {
    const totalA =
      safeNumber(A.goals.for.average.total) +
      safeNumber(A.goals.against.average.total);
    const totalB =
      safeNumber(B.goals.for.average.total) +
      safeNumber(B.goals.against.average.total);
    targetTotal = (totalA + totalB) / 2;
  }

  const scale = Math.max(0.4, Math.min(targetTotal / baseTotal, 2.5));

  return {
    lambdaA: lambdaA_raw * scale,
    lambdaB: lambdaB_raw * scale
  };
}

app.get("/predict", async (req, res) => {
  try {
    const { teamAName, teamBName, marketTotal } = req.query;
    if (!teamAName || !teamBName) {
      return res.status(400).json({ error: "Missing team names" });
    }

    const teams = await getTeamList();
    const teamA = teams.response.find(
      (t) => t.team.name.toLowerCase() === teamAName.toLowerCase()
    );
    const teamB = teams.response.find(
      (t) => t.team.name.toLowerCase() === teamBName.toLowerCase()
    );

    if (!teamA || !teamB) {
      return res.status(404).json({ error: "Team not found in current season" });
    }

    const statsA = await cachedFetch(
      `stats_${teamA.team.id}`,
      3600,
      () =>
        apiCall(
          `${API_BASE}/teams/statistics?team=${teamA.team.id}&season=${DEFAULT_SEASON}&league=${DEFAULT_LEAGUE}`
        )
    );

    const statsB = await cachedFetch(
      `stats_${teamB.team.id}`,
      3600,
      () =>
        apiCall(
          `${API_BASE}/teams/statistics?team=${teamB.team.id}&season=${DEFAULT_SEASON}&league=${DEFAULT_LEAGUE}`
        )
    );

    const playersA = await cachedFetch(
      `players_${teamA.team.id}`,
      600,
      () =>
        apiCall(
          `${API_BASE}/players?team=${teamA.team.id}&season=${DEFAULT_SEASON}`
        )
    );

    const playersB = await cachedFetch(
      `players_${teamB.team.id}`,
      600,
      () =>
        apiCall(
          `${API_BASE}/players?team=${teamB.team.id}&season=${DEFAULT_SEASON}`
        )
    );

    const xg = buildXG(statsA, statsB, marketTotal);

    const sim = simulateMatch(xg.lambdaA, xg.lambdaB);

    const topScorersA = playersA.response
      .filter((p) => p.statistics[0].goals.total > 0)
      .sort(
        (a, b) =>
          b.statistics[0].goals.total - a.statistics[0].goals.total
      )
      .slice(0, 3);

    const topScorersB = playersB.response
      .filter((p) => p.statistics[0].goals.total > 0)
      .sort(
        (a, b) =>
          b.statistics[0].goals.total - a.statistics[0].goals.total
      )
      .slice(0, 3);

    res.json({
      teamA: { name: teamAName, id: teamA.team.id },
      teamB: { name: teamBName, id: teamB.team.id },
      xg,
      sim,
      topScorersA,
      topScorersB
    });

  } catch (err) {
    res.status(500).json({ error: "Prediction error", details: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
