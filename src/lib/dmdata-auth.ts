"use client";

export type DMDATAAuthMode = "oauth" | "apiKey";

export interface DMDATAConnectionAuth {
  mode: DMDATAAuthMode;
  authorizationHeader: string;
}

export const DMDATA_ACCESS_TOKEN_KEY = "dmdata_access_token";
export const DMDATA_REFRESH_TOKEN_KEY = "dmdata_refresh_token";
export const DMDATA_API_KEY_STORAGE_KEY = "dmdata_api_key";
export const DMDATA_AUTH_MODE_STORAGE_KEY = "dmdata_auth_mode";

const DEFAULT_DMDATA_AUTH_MODE: DMDATAAuthMode = "oauth";

const hasWindow = () => typeof window !== "undefined";

export const getStoredDMDATAAuthMode = (): DMDATAAuthMode => {
  if (!hasWindow()) {
    return DEFAULT_DMDATA_AUTH_MODE;
  }

  const storedMode = localStorage.getItem(DMDATA_AUTH_MODE_STORAGE_KEY);
  return storedMode === "apiKey" ? "apiKey" : DEFAULT_DMDATA_AUTH_MODE;
};

export const setStoredDMDATAAuthMode = (mode: DMDATAAuthMode) => {
  if (!hasWindow()) {
    return;
  }

  localStorage.setItem(DMDATA_AUTH_MODE_STORAGE_KEY, mode);
};

export const getStoredDMDATAOAuthToken = (): string => {
  if (!hasWindow()) {
    return "";
  }

  return localStorage.getItem(DMDATA_ACCESS_TOKEN_KEY) || "";
};

export const clearStoredDMDATAOAuthTokens = () => {
  if (!hasWindow()) {
    return;
  }

  localStorage.removeItem(DMDATA_ACCESS_TOKEN_KEY);
  localStorage.removeItem(DMDATA_REFRESH_TOKEN_KEY);
};

export const getStoredDMDATAApiKey = (): string => {
  if (!hasWindow()) {
    return "";
  }

  return localStorage.getItem(DMDATA_API_KEY_STORAGE_KEY) || "";
};

export const setStoredDMDATAApiKey = (apiKey: string) => {
  if (!hasWindow()) {
    return;
  }

  const trimmedApiKey = apiKey.trim();

  if (trimmedApiKey) {
    localStorage.setItem(DMDATA_API_KEY_STORAGE_KEY, trimmedApiKey);
    return;
  }

  localStorage.removeItem(DMDATA_API_KEY_STORAGE_KEY);
};

export const buildDMDATAApiKeyAuthorizationHeader = (apiKey: string): string => {
  return `Basic ${btoa(`${apiKey}:`)}`;
};

export const getStoredDMDATAConnectionAuth = (): DMDATAConnectionAuth | null => {
  const mode = getStoredDMDATAAuthMode();

  if (mode === "oauth") {
    const accessToken = getStoredDMDATAOAuthToken();

    if (!accessToken) {
      return null;
    }

    return {
      mode,
      authorizationHeader: `Bearer ${accessToken}`,
    };
  }

  const apiKey = getStoredDMDATAApiKey();

  if (!apiKey) {
    return null;
  }

  return {
    mode,
    authorizationHeader: buildDMDATAApiKeyAuthorizationHeader(apiKey),
  };
};

export const hasStoredDMDATACredentials = (): boolean => {
  return Boolean(getStoredDMDATAOAuthToken() || getStoredDMDATAApiKey());
};
