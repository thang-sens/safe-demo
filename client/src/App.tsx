import { useState } from "react";
import Login from "./components/Login";
import CreateCompany from "./components/CreateCompany";
import CompanyDashboard from "./components/CompanyDashboard";
import "./App.css";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<"create" | "dashboard">("create");

  return (
    <div className="App">
      <h1>Safe Multisig Management</h1>

      {!loggedIn ? (
        <Login onLogin={() => setLoggedIn(true)} />
      ) : (
        <div>
          {/* Navigation */}
          <nav className="navigation">
            <button
              onClick={() => setView("create")}
              className={view === "create" ? "nav-button active" : "nav-button"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Create Company
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={view === "dashboard" ? "nav-button active" : "nav-button"}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '8px' }}>
                <path d="M3 4H17M3 10H17M3 16H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Company Dashboard
            </button>
          </nav>

          {/* Content */}
          {view === "create" ? (
            <CreateCompany
              onSuccess={(company) => {
                console.log("Company created:", company);
                // Optionally switch to dashboard view
                // setView("dashboard");
              }}
            />
          ) : (
            <CompanyDashboard />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
