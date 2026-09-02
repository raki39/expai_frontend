export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <>
      <h1>Fase 0A — painel</h1>
      <p className="sub">Acesso restrito.</p>

      <div className="card">
        <form method="post" action="/api/login">
          <label htmlFor="token" style={{ display: "block", marginBottom: 8 }}>
            Token do painel
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button type="submit">Entrar</button>
          {erro ? (
            <p className="bad" style={{ marginBottom: 0 }}>
              Token invalido.
            </p>
          ) : null}
        </form>
      </div>
    </>
  );
}
