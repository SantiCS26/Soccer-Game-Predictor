import { useState } from "react";
import "./App.css";

function poissonRandom(lambda) {
  let L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  while (p > L) {
    k++;
    p *= Math.random();
  }
  return k - 1;
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
  const [predictionResult, setPredictionResult] = useState("");

  const handlePredict = async () => {
    if (!teamA || !teamB) {
      alert("Please select both teams!");
      return;
    }

    if (teamA === teamB) {
      alert("Teams cannot be the same.");
      return;
    }

    const response = await fetch(
      `http://localhost:3000/predict?teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}`
    );

    const data = await response.json();
    console.log("Prediction result:", data);

    const teamAAwayGoals = data.teamA.response.goals.for.total.away;
    const teamAAwayGoalsAgainst = data.teamA.response.goals.against.total.away;
    const teamATotalGames = data.teamA.response.fixtures.played.total;

    const teamBHomeGoals = data.teamB.response.goals.for.total.home;
    const teamBHomeGoalsAgainst = data.teamB.response.goals.against.total.home;
    const teamBTotalGames = data.teamB.response.fixtures.played.total;
    
    const leagueAvgGoals = 2.7
    const homeAdvantage = 1.1;

    const teamACalc = (teamAAwayGoals / teamATotalGames) * (teamBHomeGoalsAgainst / teamBTotalGames) * leagueAvgGoals;
    const teamBCalc = (teamBHomeGoals / teamBTotalGames) * (teamAAwayGoalsAgainst / teamATotalGames) * leagueAvgGoals * homeAdvantage;

    const goalsTeamA = poissonRandom(teamACalc);
    const goalsTeamB = poissonRandom(teamBCalc);

    let resultText = "";
    if (goalsTeamA > goalsTeamB) {
      resultText = `Predicted Winner: ${teamA} (${goalsTeamA} - ${goalsTeamB})`;
    } else if (goalsTeamB > goalsTeamA) {
      resultText = `Predicted Winner: ${teamB} (${goalsTeamB} - ${goalsTeamA})`;
    } else {
      resultText = `Predicted Result: Draw (${goalsTeamA} - ${goalsTeamB})`;
    }

    setPredictionResult(resultText);
  };

  return (
    <div className="App" style={{
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "#f0f2f5",
    }}>
      <div style={{
        backgroundColor: "#fff",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: "400px",
        textAlign: "center",
      }}>
        <h2 style={{ marginBottom: "30px", color: "#333" }}>⚽ Soccer Match Predictor</h2>

        <div style={{ marginBottom: "20px", textAlign: "left" }}>
          <label style={{ fontWeight: "600", display: "block", marginBottom: "8px" }}>Away Team</label>
          <select 
            value={teamA} 
            onChange={(e) => setTeamA(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          >
            <option value="">-- Select Away Team --</option>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px", textAlign: "left" }}>
          <label style={{ fontWeight: "600", display: "block", marginBottom: "8px" }}>Home Team</label>
          <select 
            value={teamB} 
            onChange={(e) => setTeamB(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "16px",
            }}
          >
            <option value="">-- Select Home Team --</option>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={handlePredict} 
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#007bff",
            color: "#fff",
            fontSize: "16px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            transition: "background-color 0.3s",
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = "#0056b3"}
          onMouseOut={e => e.currentTarget.style.backgroundColor = "#007bff"}
        >
          Predict Match
        </button>

        {predictionResult && (
          <div style={{
            marginTop: "25px",
            padding: "15px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            border: "1px solid #ddd",
            fontWeight: "600",
            color: "#333",
          }}>
            {predictionResult}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
