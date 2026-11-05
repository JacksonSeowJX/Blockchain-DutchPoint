import { ThemeChoice } from "../hooks/useTheme";

/** A small drawn arrow for links that leave the site. */
export function ExternalIcon() {
  return (
    <svg className="icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      {theme === "dark" ? (
        <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.6 5.6 0 1 0 6.6 6.6Z" fill="currentColor" />
      ) : theme === "light" ? (
        <g stroke="currentColor" strokeWidth="1.4" fill="none">
          <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </g>
      ) : (
        <g>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
