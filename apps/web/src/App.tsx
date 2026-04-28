import { createRoot } from "react-dom/client";
import "./styles.css";

const connections = ["Telegram", "OpenClaw", "Codex", "Database", "Worker", "Repos"];

function App() {
  return (
    <main className="shell">
      <nav className="sidebar" aria-label="Primary">
        <strong>Auto Forge</strong>
        <a href="#onboarding">Onboarding</a>
        <a href="#queue">Queue</a>
        <a href="#logs">Logs</a>
      </nav>
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Controller Setup</h1>
            <p>Connect the required services before running Forge tasks.</p>
          </div>
          <span className="status">Phase 1 foundation</span>
        </header>
        <section className="status-grid" aria-label="Connection status">
          {connections.map((name) => (
            <article className="status-row" key={name}>
              <div>
                <h2>{name}</h2>
                <p>Not configured</p>
              </div>
              <span className="state">Pending</span>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(<App />);
