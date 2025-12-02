import { useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3000";

const premierLeagueTeams = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
  "Burnley", "Chelsea", "Crystal Palace", "Everton", "Fulham",
  "Liverpool", "Luton", "Manchester City", "Manchester United",
  "Newcastle", "Nottingham Forest", "Sheffield Utd", "Tottenham",
  "West Ham", "Wolves",
];

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function formatGoals(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
}

function App() {
  const [teamA, setTeamA] = useState("Arsenal");
  const [teamB, setTeamB] = useState("Chelsea");

  const [marketTotal, setMarketTotal] = useState("");
  const [useMarketTotal, setUseMarketTotal] = useState(false);

  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const handlePredict = async (e) => {
    e?.preventDefault();
    if (!teamA || !teamB || teamA === teamB) {
      setPredictionError("Please select two different teams.");
      return;
    }

    try {
      setLoadingPrediction(true);
      setPredictionError("");
      setPrediction(null);

      const params = new URLSearchParams({
        teamAName: teamA,
        teamBName: teamB,
      });

      if (useMarketTotal && marketTotal) {
        params.append("marketTotal", marketTotal);
      }

      const resp = await fetch(`${API_BASE}/predict?${params.toString()}`);
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setPrediction(data);
    } catch (err) {
      console.error("Prediction error", err);
      setPredictionError(err.message || "Prediction failed");
    } finally {
      setLoadingPrediction(false);
    }
  };

  function renderPredictionSummary() {
    if (!prediction) return null;
    if (!prediction.model || !prediction.simulation) {
      return <div style={{ color: "red" }}>Bad prediction response</div>;
    }

    const { model, simulation, topScorersA, topScorersB } = prediction;

    return (
      <div className="prediction-box">
        <h2>Results</h2>

        <p><strong>Expected Goals (xG):</strong></p>
        <p>Home (λA): {model.lambdaA.toFixed(2)}</p>
        <p>Away (λB): {model.lambdaB.toFixed(2)}</p>

        <p><strong>Win Probabilities:</strong></p>
        <p>Home: {simulation.winA.toFixed(1)}%</p>
        <p>Away: {simulation.winB.toFixed(1)}%</p>
        <p>Draw: {simulation.draw.toFixed(1)}%</p>

        <p><strong>Most Likely Scores:</strong></p>
        <ul>
          {simulation.topScorelines.map((s, i) => (
            <li key={i}>{s.score} — {s.probability.toFixed(2)}%</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderTopScorers = () => {
    if (!prediction) return null;

    const { topScorersA, topScorersB, teamA: tA, teamB: tB } = prediction;

    return (
      <div className="card"
        style={{
          marginTop: "16px",
          padding: "16px 20px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          background: "#ffffff",
        }}>
        <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
          Players Most Likely to Score
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginTop: "12px",
        }}>
          {/* Team A */}
          <div style={{
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "12px 14px",
            background: "#f9fafb",
          }}>
            <h3>{tA?.name || teamA}</h3>
            {topScorersA?.length ? (
              <ul style={{ paddingLeft: "18px" }}>
                {topScorersA.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>{" "}
                    <span style={{ color: "#64748b" }}>
                      ({p.position}, {p.goals} goals / {p.appearances} apps)
                    </span>
                    <div style={{ fontSize: "0.8rem" }}>
                      Chance to score: {formatPercent(p.probability)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#9ca3af" }}>Not enough data</div>
            )}
          </div>

          {/* Team B */}
          <div style={{
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            padding: "12px 14px",
            background: "#f9fafb",
          }}>
            <h3>{tB?.name || teamB}</h3>
            {topScorersB?.length ? (
              <ul style={{ paddingLeft: "18px" }}>
                {topScorersB.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>{" "}
                    <span style={{ color: "#64748b" }}>
                      ({p.position}, {p.goals} goals / {p.appearances} apps)
                    </span>
                    <div style={{ fontSize: "0.8rem" }}>
                      Chance to score: {formatPercent(p.probability)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#9ca3af" }}>Not enough data</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #111827)",
        padding: "24px 12px 32px",
      }}>
      <div style={{
        maxWidth: "1080px",
        margin: "0 auto",
        background: "#f3f4f6",
        borderRadius: "16px",
        padding: "20px 20px 24px",
        boxShadow: "0 18px 60px rgba(15,23,42,0.35)",
      }}>
        <header style={{
          marginBottom: "16px",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "10px",
        }}>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>
            Soccer Game Predictor
          </h1>
          <p style={{
            margin: "4px 0 0",
            fontSize: "0.9rem",
            color: "#6b7280",
          }}>
            Uses API-Football stats + a Poisson Monte Carlo model
          </p>
        </header>

        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "20px",
        }}>
          <div>
            <form
              onSubmit={handlePredict}
              className="card"
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
              <h2 style={{ marginTop: 0 }}>Match Setup</h2>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
              }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}>
                    Home Team
                  </label>
                  <select
                    value={teamA}
                    onChange={(e) => setTeamA(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                    }}>
                    {premierLeagueTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}>
                    Away Team
                  </label>
                  <select
                    value={teamB}
                    onChange={(e) => setTeamB(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                    }}>
                    {premierLeagueTeams.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#f1f5f9",
                border: "1px dashed #cbd5f5",
              }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}>
                  <input
                    type="checkbox"
                    checked={useMarketTotal}
                    onChange={(e) => setUseMarketTotal(e.target.checked)}
                  />
                  Use market total goals line
                </label>

                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Enter bookmaker total"
                  value={marketTotal}
                  onChange={(e) => setMarketTotal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                  }}
                />

                <p style={{
                  margin: "6px 0 0",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                }}>
                  If empty, model uses historical averages
                </p>
              </div>

              {predictionError && (
                <div style={{
                  marginTop: "10px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "#fee2e2",
                  color: "#b91c1c",
                }}>
                  {predictionError}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingPrediction}
                style={{
                  marginTop: "12px",
                  padding: "10px 16px",
                  borderRadius: "999px",
                  border: "none",
                  background: loadingPrediction ? "#9ca3af" : "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: loadingPrediction ? "wait" : "pointer",
                }}>
                {loadingPrediction ? "Running simulation..." : "Predict Match"}
              </button>
            </form>

            {renderPredictionSummary()}
            {renderTopScorers()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
