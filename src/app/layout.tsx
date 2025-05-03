import "../app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { type FC } from "react";
import { Toaster } from "@/components/ui/sonner"

type RootLayoutProps = {
  children: React.ReactNode;
};

export const metadata = {
  title: "震Quick",
  description: "緊急地震速報を、見やすく、リアルタイムに。",
  openGraph: {
    title: "震Quick",
    description: "緊急地震速報を、見やすく、リアルタイムに。",
    url: "https://shin-quick.vercel.app",
    siteName: "震Quick",
    images: [
      {
        url: "https://shin-quick.vercel.app/thumbnail.png",
        width: 1200,
        height: 630,
        alt: "震Quickのサムネイル",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "震Quick",
    description: "緊急地震速報を、見やすく、リアルタイムに。",
    images: ["https://shin-quick.vercel.app/thumbnail.png"],
  },
};

const RootLayout: FC<RootLayoutProps> = (props) => {
  return (
   <html lang="ja" 
     suppressHydrationWarning
   >
      <body className="">
       <ThemeProvider attribute="class" defaultTheme="system">
          {props.children}
          <Toaster richColors expand={true} />
       </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
