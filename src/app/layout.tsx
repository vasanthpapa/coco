import './globals.css';

export const metadata = {
  title: 'COCO Analyzer',
  description: 'WhatsApp Data Analyzer',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}