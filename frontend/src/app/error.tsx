"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Something interrupted the workspace</h1>
      <p>Your saved work remains in the database.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
