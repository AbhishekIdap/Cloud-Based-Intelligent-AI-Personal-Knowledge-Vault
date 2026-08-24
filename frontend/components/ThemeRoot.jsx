"use client";

import { useAuth } from "../lib/auth-context";

export default function ThemeRoot({ children }) {
  const { user } = useAuth();
  const theme = user?.theme || "light";
  return (
    <div id="lifegraph-root" data-theme={theme}>
      {children}
    </div>
  );
}
