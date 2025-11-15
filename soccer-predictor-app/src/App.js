import logo from './logo.svg';
import './App.css';
import { useState } from "react";

function App() {
  const teams = [
    "Barcelona",
    "Real Madrid",
    "Manchester City",
    "Liverpool",
    "Bayern Munich",
    "PSG"
  ];

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  const handlePredict = () => {
    if (!teamA || !teamB) {
      alert("Please select both teams!");
      return;
    }
    if (teamA === teamB) {
      alert("Teams cannot be the same.");
      return;
    }

    alert(`Predicting outcome of ${teamA} vs ${teamB}...`);
  };

  return (
    <div style={{
      maxWidth: "350px",
      margin: "50px auto",
      fontFamily: "Arial",
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
      <h2>Soccer Match Predictor</h2>

      <label>Team A</label>
      <select
        value={teamA}
        onChange={(e) => setTeamA(e.target.value)}
      >
        <option value="">-- Select Team A --</option>
        {teams.map((team) => (
          <option key={team} value={team}>{team}</option>
        ))}
      </select>

      <label>Team B</label>
      <select
        value={teamB}
        onChange={(e) => setTeamB(e.target.value)}
      >
        <option value="">-- Select Team B --</option>
        {teams.map((team) => (
          <option key={team} value={team}>{team}</option>
        ))}
      </select>

      <button
        onClick={handlePredict}
        style={{
          padding: "10px",
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          borderRadius: "6px"
        }}
      >
        Go
      </button>
    </div>
  );
}

export default App;

