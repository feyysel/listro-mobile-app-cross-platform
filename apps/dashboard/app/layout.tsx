import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Listro Operations',
  description: 'Premium shoe care operations dashboard',
};

const themeScript = `
(function () {
  try {
    var preference = localStorage.getItem('listro-theme') || 'system';
    var dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (error) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
