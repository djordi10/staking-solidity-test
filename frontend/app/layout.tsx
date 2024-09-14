'use client'

import localFont from "next/font/local";
import "./globals.css";
import { useState, useEffect } from 'react'
import { WagmiProvider, createConfig, http } from "wagmi"
import { sepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConnectKitProvider, getDefaultConfig } from "connectkit"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const config = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(`https://ethereum-sepolia-rpc.publicnode.com`),
    },
    walletConnectProjectId: '0fd1ed41909f01747b0821798485d2de',
    appName: "Advanced Ethereum Staking App",
    appDescription: "Stake, govern, and earn rewards with Ethereum",
    appUrl: "https://your-app-url.com",
    appIcon: "https://your-app-icon-url.com",
  }),
)

const queryClient = new QueryClient()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <ConnectKitProvider>
              {mounted ? children : null}
            </ConnectKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
