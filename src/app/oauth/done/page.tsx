"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import {
  DMDATA_ACCESS_TOKEN_KEY,
  DMDATA_AUTH_MODE_STORAGE_KEY,
  DMDATA_REFRESH_TOKEN_KEY,
} from "@/lib/dmdata-auth";

function OAuthDoneContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token") || "";

    if (accessToken) {
      localStorage.setItem(DMDATA_ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(DMDATA_REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(DMDATA_AUTH_MODE_STORAGE_KEY, "oauth");
    }
    router.replace("/");
  }, [searchParams, router]);

  return (
    <h1>認証が完了しました。少々お待ちください...</h1>
  );
}

export default function OAuthDonePage() {
  return (
    <Suspense fallback={<h1>Loading...</h1>}>
      <OAuthDoneContent />
    </Suspense>
  );
}
