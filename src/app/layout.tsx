import "../app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { type FC } from "react";
type RootLayoutProps = {
  children: React.ReactNode;
};

export const metadata = {
  title: "震-Quick",
  description: "緊急地震速報を、見やすく、リアルタイムに。",
};

const RootLayout: FC<RootLayoutProps> = (props) => {
  return (
   <html lang="ja" 
     suppressHydrationWarning
   >
      <body className="">
       <ThemeProvider attribute="class" defaultTheme="system">
          {props.children}
       </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
