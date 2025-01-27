"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OAuthDonePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token") || "";

    if (accessToken) {
      localStorage.setItem("dmdata_access_token", accessToken);
      localStorage.setItem("dmdata_refresh_token", refreshToken);
    }
    router.replace("/");
  }, [searchParams, router]);

  return (
    <h1>認証が完了しました。少々お待ちください...</h1>
  );
}
