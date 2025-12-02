import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3000";

const premierLeagueTeams = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
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
  "Sheffield Utd",
  "Tottenham",
  "West Ham",
  "Wolves",
];

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function formatGoals(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
}

function groupFixturesByDate(fixtures) {
  const byDate = {};
  fixtures.forEach((f) => {
    if (!f.date) return;
    const d = new Date(f.date);
    const key = d.toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(f);
  });
  const sortedDates = Object.keys(byDate).sort();
  return sortedDates.map((date) => ({
    date,
    fixtures: byDate[date].sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
    ),
  }));
}

function App() {
  const [teamA, setTeamA] = useState("Arsenal");
  const [teamB, setTeamB] = useState("Chelsea");
  const [marketTotal, setMarketTotal] = useState("");
  const [useMarketTotal, setUseMarketTotal] = useState(false);

  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const [fixtures, setFixtures] = useState([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState("");

  useEffect(() => {
    async function loadFixtures() {
      try {
        setFixturesLoading(true);
        setFixturesError("");
        const resp = await fetch(
          `${API_BASE}/fixtures?league=39&season=2023&next=50`
        );
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        setFixtures(data.fixtures || []);
      } catch (err) {
        console.error("Error loading fixtures", err);
        setFixturesError(
          "Could not load upcoming fixtures (check server/API key)."
        );
      } finally {
        setFixturesLoading(false);
      }
    }
    loadFixtures();
  }, []);

  const groupedFixtures = useMemo(
    () => groupFixturesByDate(fixtures),
    [fixtures]
  );

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

  const handleFixtureClick = (fixture) => {
    if (!fixture) return;
    if (fixture.homeTeam && fixture.awayTeam) {
      setTeamA(fixture.homeTeam);
      setTeamB(fixture.awayTeam);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderPredictionSummary = () => {
    if (!prediction) return null;

    const { model, simulation, teamA: tA, teamB: tB } = prediction;
    const teamAName = tA?.name || teamA;
    const teamBName = tB?.name || teamB;

    return (
      <div
        className="card"
        style={{
          marginTop: "16px",
          padding: "16px 20px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Prediction Summary</h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
          Based on team attack/defence stats, historical goal totals and an
          optional market total
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "6px" }}>Expected Goals</h3>
            <div style={{ fontSize: "0.95rem" }}>
              <div>
                <strong>{teamAName}:</strong> {formatGoals(model.lambdaA)} goals
              </div>
              <div>
                <strong>{teamBName}:</strong> {formatGoals(model.lambdaB)} goals
              </div>
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "0.85rem",
                  color: "#64748b",
                }}
              >
                Total: {formatGoals(model.lambdaA + model.lambdaB)} goals
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "6px" }}>
              Result Probabilities
            </h3>
            <div style={{ fontSize: "0.95rem" }}>
              <div>
                <strong>{teamAName} win:</strong>{" "}
                {formatPercent(simulation.winA)}
              </div>
              <div>
                <strong>Draw:</strong> {formatPercent(simulation.draw)}
              </div>
              <div>
                <strong>{teamBName} win:</strong>{" "}
                {formatPercent(simulation.winB)}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "6px" }}>
              Most Likely Scores
            </h3>
            <ul
              style={{ margin: 0, paddingLeft: "18px", fontSize: "0.9rem" }}
            >
              {simulation.topScorelines.map((item) => (
                <li key={item.score}>
                  {item.score} &nbsp;–&nbsp;
                  {formatPercent(item.probability)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderTopScorers = () => {
    if (!prediction) return null;
    const { topScorersA, topScorersB, teamA: tA, teamB: tB } = prediction;
    if (
      (!topScorersA || !topScorersA.length) &&
      (!topScorersB || !topScorersB.length)
    ) {
      return null;
    }

    return (
      <div
        className="card"
        style={{
          marginTop: "16px",
          padding: "16px 20px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          background: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
          Players Most Likely to Score
        </h2>
        <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#6b7280" }}>
          Probabilities are derived from each player's share of team goals and
          the predicted team expected goals for this match
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "12px 14px",
              background: "#f9fafb",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
              {tA?.name || teamA}
            </h3>
            {topScorersA && topScorersA.length ? (
              <ul
                style={{ margin: 0, paddingLeft: "18px", fontSize: "0.9rem" }}
              >
                {topScorersA.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>{" "}
                    <span style={{ color: "#64748b" }}>
                      ({p.position}, {p.goals} goals / {p.appearances} apps)
                    </span>
                    <div style={{ fontSize: "0.8rem", marginTop: "2px" }}>
                      Chance to score: {formatPercent(p.probability)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                Not enough data to estimate
              </div>
            )}
          </div>

          <div
            style={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "12px 14px",
              background: "#f9fafb",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
              {tB?.name || teamB}
            </h3>
            {topScorersB && topScorersB.length ? (
              <ul
                style={{ margin: 0, paddingLeft: "18px", fontSize: "0.9rem" }}
              >
                {topScorersB.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>{" "}
                    <span style={{ color: "#64748b" }}>
                      ({p.position}, {p.goals} goals / {p.appearances} apps)
                    </span>
                    <div style={{ fontSize: "0.8rem", marginTop: "2px" }}>
                      Chance to score: {formatPercent(p.probability)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                Not enough data to estimate.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFixtures = () => {
    return (
      <div
        className="card"
        style={{
          marginTop: "24px",
          padding: "16px 20px",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "8px",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
            Upcoming Fixtures
          </h2>
          {fixturesLoading && (
            <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Loading...
            </span>
          )}
        </div>
        {fixturesError && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 10px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.85rem",
            }}
          >
            {fixturesError}
          </div>
        )}
        {!fixturesLoading &&
          !fixturesError &&
          groupedFixtures.length === 0 && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#9ca3af",
                marginTop: "4px",
              }}
            >
              No upcoming matches found for this league/season
            </div>
          )}

        <div
          style={{ marginTop: "8px", maxHeight: "360px", overflowY: "auto" }}
        >
          {groupedFixtures.map((group) => {
            const niceDate = new Date(group.date).toLocaleDateString(
              undefined,
              {
                weekday: "short",
                month: "short",
                day: "numeric",
              }
            );
            return (
              <div key={group.date} style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#4b5563",
                    marginBottom: "4px",
                  }}
                >
                  {niceDate}
                </div>
                {group.fixtures.map((f) => {
                  const time =
                    f.timestamp &&
                    new Date(f.timestamp * 1000).toLocaleTimeString(
                      undefined,
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    );
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFixtureClick(f)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        padding: "6px 8px",
                        marginBottom: "4px",
                        background: "#f9fafb",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span>
                        {f.homeTeam} vs {f.awayTeam}
                      </span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "#6b7280",
                        }}
                      >
                        {time || f.status || ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="App"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #111827)",
        padding: "24px 12px 32px",
        color: "#111827",
        fontFamily:
          "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          background: "#f3f4f6",
          borderRadius: "16px",
          padding: "20px 20px 24px",
          boxShadow: "0 18px 60px rgba(15,23,42,0.35)",
        }}
      >
        <header
          style={{
            marginBottom: "16px",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "10px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Soccer Game Predictor
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.9rem",
              color: "#6b7280",
            }}
          >
            Uses API-Football stats + a Poisson Monte Carlo model to estimate
            scorelines, match odds, and likely goal scorers
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: "20px",
          }}
        >
          <div>
            <form
              onSubmit={handlePredict}
              className="card"
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "12px" }}>
                Match Setup
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <label
                    htmlFor="teamA"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#6b7280",
                      marginBottom: "4px",
                    }}
                  >
                    Home Team
                  </label>
                  <select
                    id="teamA"
                    value={teamA}
                    onChange={(e) => setTeamA(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                    }}
                  >
                    <option value="">Select team</option>
                    {premierLeagueTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="teamB"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#6b7280",
                      marginBottom: "4px",
                    }}
                  >
                    Away Team
                  </label>
                  <select
                    id="teamB"
                    value={teamB}
                    onChange={(e) => setTeamB(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      background: "#f9fafb",
                    }}
                  >
                    <option value="">Select team</option>
                    {premierLeagueTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginBottom: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "#f1f5f9",
                  border: "1px dashed #cbd5f5",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.85rem",
                    color: "#0f172a",
                    marginBottom: "6px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useMarketTotal}
                    onChange={(e) => setUseMarketTotal(e.target.checked)}
                  />
                  Use market total goals line to calibrate model (e.g. 2.5, 3.0,
                  5.5)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Enter bookmaker total (optional)"
                  value={marketTotal}
                  onChange={(e) => setMarketTotal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                  }}
                />
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "0.75rem",
                    color: "#6b7280",
                  }}
                >
                  If left empty, the model uses each team's historical goals
                  for + against to set the expected total
                </p>
              </div>

              {predictionError && (
                <div
                  style={{
                    marginBottom: "10px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: "0.85rem",
                  }}
                >
                  {predictionError}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingPrediction}
                style={{
                  marginTop: "4px",
                  padding: "10px 16px",
                  borderRadius: "999px",
                  border: "none",
                  background: loadingPrediction ? "#9ca3af" : "#2563eb",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: loadingPrediction ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {loadingPrediction ? "Running simulation..." : "Predict Match"}
              </button>
            </form>

            {renderPredictionSummary()}
            {renderTopScorers()}
          </div>

          <div>{renderFixtures()}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
