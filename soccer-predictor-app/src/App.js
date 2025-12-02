import { useState } from "react";
import "./App.css";

function poissonRandom(lambda) {
  if (lambda <= 0) return 0;
  let L = Math.exp(-lambda);
  let p = 1;
  let k = 0;
  while (p > L) {
    p *= Math.random();
    k++;
  }
  return k - 1;
}

function simulateMatch(xgA, xgB, simulations = 1000) {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;

  for (let i = 0; i < simulations; i++) {
    const goalsA = poissonRandom(xgA);
    const goalsB = poissonRandom(xgB);

    if (goalsA > goalsB) winsA++;
    else if (goalsB > goalsA) winsB++;
    else draws++;
  }

  return {
    winA: (winsA / simulations) * 100,
    winB: (winsB / simulations) * 100,
    draw: (draws / simulations) * 100,
  };
}

function formBoost(formString) {
  if (!formString) return 1.0;

  const last5 = formString.slice(-5);
  let score = 0;

  for (const c of last5) {
    if (c === "W") score += 1;
    else if (c === "D") score += 0.5;
  }

  // up to 15% buffer/boost if team is going good
  return 1 + score * 0.03;
}

function App() {
  const teams = [
    "Arsenal",
    "Aston Villa",
    "Bournemouth",
    "Brighton",
    "Brentford",
    "Burnley",
    "Chelsea",
    "Crystal Palace",
    "Everton",
    "Fulham",
    "Liverpool",
    "Luton",
    "Manchester City",
    "Manchester United",
    "Newcastle",
    "Nottingham Forest",
    "Sheffield United",
    "Tottenham",
    "West Ham",
    "Wolves",
  ];

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePredict = async () => {
    setErrorMsg("");
    setPrediction(null);

    if (!teamA || !teamB) {
      alert("Please select both teams.");
      return;
    }
    if (teamA === teamB) {
      alert("Teams cannot be the same.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `http://localhost:3000/predict?teamA=${encodeURIComponent(
          teamA
        )}&teamB=${encodeURIComponent(teamB)}`
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const apiData = await response.json();
      if (!apiData.teamA?.response || !apiData.teamB?.response) {
        throw new Error("API returned incomplete data.");
      }

      const A = apiData.teamA.response;
      const B = apiData.teamB.response;

      const A_totalMatches = A.fixtures.played.total || 38;
      const B_totalMatches = B.fixtures.played.total || 38;

      const A_totalGF = A.goals.for.total.total;
      const A_totalGA = A.goals.against.total.total;
      const B_totalGF = B.goals.for.total.total;
      const B_totalGA = B.goals.against.total.total;

      const A_goalsPerMatch =
        (A_totalGF + A_totalGA) / Math.max(A_totalMatches, 1);
      const B_goalsPerMatch =
        (B_totalGF + B_totalGA) / Math.max(B_totalMatches, 1);

      let leagueAvgGoals =
        (A_goalsPerMatch + B_goalsPerMatch) / 2 || 2.7;

      if (!isFinite(leagueAvgGoals) || leagueAvgGoals <= 0) {
        leagueAvgGoals = 2.7;
      }

      const A_awayGF = A.goals.for.total.away;
      const A_awayGA = A.goals.against.total.away;
      const A_awayMatches = A.fixtures.played.away || A_totalMatches;

      const B_homeGF = B.goals.for.total.home;
      const B_homeGA = B.goals.against.total.home;
      const B_homeMatches = B.fixtures.played.home || B_totalMatches;

      const A_attackStrength =
        (A_awayGF / Math.max(A_awayMatches, 1)) / leagueAvgGoals;
      const A_defenseStrength =
        (A_awayGA / Math.max(A_awayMatches, 1)) / leagueAvgGoals;

      const B_attackStrength =
        (B_homeGF / Math.max(B_homeMatches, 1)) / leagueAvgGoals;
      const B_defenseStrength =
        (B_homeGA / Math.max(B_homeMatches, 1)) / leagueAvgGoals;

      let xgA = A_attackStrength * B_defenseStrength * leagueAvgGoals;
      let xgB =
        B_attackStrength * A_defenseStrength * leagueAvgGoals * 1.1;

      xgA *= formBoost(A.form);
      xgB *= formBoost(B.form);

      const overObjA = A.goals.for.under_over?.["2.5"];
      const overObjB = B.goals.for.under_over?.["2.5"];

      const overCountA = overObjA?.over ?? 0;
      const overCountB = overObjB?.over ?? 0;

      const probOverA =
        overCountA / Math.max(A_totalMatches, 1);
      const probOverB =
        overCountB / Math.max(B_totalMatches, 1);

      const volatility = 1 + (probOverA + probOverB) * 0.2;

      xgA *= volatility;
      xgB *= volatility;

      xgA = Math.min(Math.max(xgA, 0.1), 5);
      xgB = Math.min(Math.max(xgB, 0.1), 5);

      const { winA, winB, draw } = simulateMatch(xgA, xgB, 1000);

      let likelyOutcome;
      if (winA > winB && winA > draw) {
        likelyOutcome = `${teamA} win`;
      } else if (winB > winA && winB > draw) {
        likelyOutcome = `${teamB} win`;
      } else {
        likelyOutcome = "Draw";
      }

      setPrediction({
        teamA,
        teamB,
        xgA: xgA.toFixed(2),
        xgB: xgB.toFixed(2),
        winA: winA.toFixed(1),
        winB: winB.toFixed(1),
        draw: draw.toFixed(1),
        likelyOutcome,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="App"
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: 420,
          padding: 30,
          background: "white",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>
          Premier League Match Predictor
        </h2>

        {/* Team selectors */}
        <label style={{ display: "block", marginBottom: 8 }}>
          Team A (Away)
        </label>
        <select
          value={teamA}
          onChange={(e) => setTeamA(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 16,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        >
          <option value="">Select Team A</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label style={{ display: "block", marginBottom: 8 }}>
          Team B (Home)
        </label>
        <select
          value={teamB}
          onChange={(e) => setTeamB(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 20,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        >
          <option value="">Select Team B</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <button
          onClick={handlePredict}
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Calculating..." : "Predict Match"}
        </button>

        {errorMsg && (
          <p style={{ marginTop: 16, color: "red" }}>
            Error: {errorMsg}
          </p>
        )}

        {prediction && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ textAlign: "center", marginBottom: 10 }}>
              Prediction
            </h3>
            <p style={{ textAlign: "center", fontWeight: "bold" }}>
              Most likely outcome: {prediction.likelyOutcome}
            </p>

            <div style={{ marginTop: 16 }}>
              <p>
                <strong>Expected Goals (xG):</strong>
              </p>
              <p>
                {prediction.teamA}: {prediction.xgA}
              </p>
              <p>
                {prediction.teamB}: {prediction.xgB}
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              <p>
                <strong>Win Probabilities:</strong>
              </p>
              <p>
                {prediction.teamA} win: {prediction.winA}%
              </p>
              <p>Draw: {prediction.draw}%</p>
              <p>
                {prediction.teamB} win: {prediction.winB}%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
