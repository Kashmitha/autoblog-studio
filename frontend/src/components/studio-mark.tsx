/** Original folded-page / A monogram. A vector, not generated article imagery. */
export function StudioMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path d="M12 36 22 12h7L19 36h-7Z" fill="currentColor" />
      <path d="m28 12 9 24h-8l-6-16 5-8Z" fill="currentColor" opacity=".72" />
      <path d="M19 28h11l3 8H16l3-8Z" fill="currentColor" />
      <path d="m28 12 9 8h-6l-3-8Z" fill="currentColor" opacity=".45" />
    </svg>
  );
}
