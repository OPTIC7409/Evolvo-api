/**
 * Evolvo API - Root Page
 * 
 * This page provides basic API information.
 * All actual functionality is in the /api routes.
 */

export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      background: "#0a0a0a",
      color: "#fafafa",
    }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Evolvo API</h1>
      <p style={{ color: "#888" }}>Backend services for the Evolvo AI app builder</p>
      <div style={{ marginTop: "2rem", color: "#666" }}>
        <p>Available endpoints:</p>
        <ul style={{ marginTop: "0.5rem", listStyle: "none", padding: 0 }}>
          <li style={{ marginBottom: "0.25rem" }}>POST /api/auth/[...nextauth]</li>
          <li style={{ marginBottom: "0.25rem" }}>GET/POST /api/projects</li>
          <li style={{ marginBottom: "0.25rem" }}>POST /api/sandbox/chat</li>
          <li style={{ marginBottom: "0.25rem" }}>POST /api/stripe/webhooks</li>
          <li style={{ marginBottom: "0.25rem" }}>GET /api/user/subscription</li>
          <li style={{ marginBottom: "0.25rem" }}>POST /api/docker/provision</li>
          <li style={{ marginBottom: "0.25rem" }}>POST /api/security/scan</li>
        </ul>
      </div>
    </main>
  );
}
