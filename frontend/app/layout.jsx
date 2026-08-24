import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import ThemeRoot from "../components/ThemeRoot";

export const metadata = {
  title: "LifeGraph",
  description: "Every file, note, and memory — organized automatically.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ThemeRoot>{children}</ThemeRoot>
        </AuthProvider>
      </body>
    </html>
  );
}
