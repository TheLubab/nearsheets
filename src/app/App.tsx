import { WorkbookEditor } from "../features/spreadsheet/components/WorkbookEditor";
import { env } from "../config/env";

/**
 * Application shell for the first milestone. It mounts the spreadsheet editor
 * and shows the selected NEAR network from validated configuration. No wallet
 * or treasury adapter is active yet; local editing works without either.
 */
export function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__mark" aria-hidden="true" />
          <div>
            <h1>Trezu Sheets</h1>
            <p>Plan and reconcile community finances in a spreadsheet.</p>
          </div>
        </div>
        <span className="app-shell__badge" title="Selected NEAR network">
          NEAR {env.VITE_NEAR_NETWORK}
        </span>
      </header>
      <main className="app-shell__main">
        <WorkbookEditor />
      </main>
    </div>
  );
}