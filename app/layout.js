import "./globals.css";

export const metadata = {
  title: "VIEWMYWORK — Client spaces, beautifully shared",
  description: "A calm client portal for sharing work and files."
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
