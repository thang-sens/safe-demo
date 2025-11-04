import { useState, useEffect } from "react";
import Login from "./components/Login";
import CreateCompany from "./components/CreateCompany";
import CompanyDashboard from "./components/CompanyDashboard";
import { initWeb3Auth, restoreSession, logout } from "./lib/web3auth";
import "./App.css";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<"create" | "dashboard">("create");
  const [isInitializing, setIsInitializing] = useState(true);

  // 🔄 Restore session on app mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Initialize Web3Auth
        await initWeb3Auth();

        // Try to restore existing session
        const existingSession = await restoreSession();
        if (existingSession) {
          console.log("✅ Session restored successfully!");
          setLoggedIn(true);
        } else {
          console.log("ℹ️ No session to restore, user needs to login");
        }
      } catch (error) {
        console.error("Failed to initialize Web3Auth:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      setLoggedIn(false);
      setView("create"); // Reset to create view
      console.log("✅ Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Show loading state while checking for session
  if (isInitializing) {
    return (
      <div className="App">
        <h1>Safe Multisig Management</h1>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Safe Multisig Management</h1>

      {!loggedIn ? (
        <Login onLogin={() => setLoggedIn(true)} />
      ) : (
        <div>
          {/* Header with logout button */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "20px",
              paddingRight: "20px",
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#c82333")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#dc3545")
              }
            >
              Logout
            </button>
          </div>

          {/* Navigation */}
          <nav className="navigation">
            <button
              onClick={() => setView("create")}
              className={view === "create" ? "nav-button active" : "nav-button"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                style={{ marginRight: "8px" }}
              >
                <path
                  d="M10 4V16M4 10H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Create Company
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={
                view === "dashboard" ? "nav-button active" : "nav-button"
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                style={{ marginRight: "8px" }}
              >
                <path
                  d="M3 4H17M3 10H17M3 16H17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
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
