"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import SettingsDialog from "@/components/settings-dialog";
import { useTheme } from "next-themes";
import { Settings, LocateFixed, Gauge, FlaskConical } from "lucide-react";
import { WebSocketProvider, useWebSocket } from "@/components/websocket";
import { toast } from "sonner";
import EewDisplay from "@/components/eew-display";
import { EewInformation } from "@dmdata/telegram-json-types";

interface Settings {
  theme: "system" | "dark" | "light";
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
  enable_accuracy_info: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  enable_kyoshin_monitor: false,
  enable_dynamic_zoom: true,
  enable_low_accuracy_eew: false,
  enable_accuracy_info: false,
};

const DynamicMap = dynamic(() => import("@/components/map"), {
  ssr: false,
});

type EpicenterInfo = {
  eventId: string;
  lat: number;
  lng: number;
  icon: string;
  startTime: number;
  depthval: number;
};

function PageContent() {
  const [ShowSettings, setShowSettings] = useState<boolean>(false);
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState<string>("----/--/-- --:--:--");
  const mapRef = useRef<L.Map | null>(null);

  const {
    isConnected,
    receivedData,
    connectWebSocket,
    disconnectWebSocket,
    injectTestData,
  } = useWebSocket();

  const [displayData, setDisplayData] = useState<EewInformation.Latest.Main | null>(null);

  useEffect(() => {
    setDisplayData(receivedData as EewInformation.Latest.Main | null);
  }, [receivedData]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const isBrowser = typeof window !== "undefined";
    if (!isBrowser) return;

    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    const token = localStorage.getItem("dmdata_access_token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (settings.enable_kyoshin_monitor) {
      return;
    }

    const updateCurrentTime = () => {
      const now = new Date();
      const formattedTime = now.toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentTime(formattedTime);
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 1000);
    return () => clearInterval(interval);
  }, [settings.enable_kyoshin_monitor]);

  useEffect(() => {
    const isBrowser = typeof window !== "undefined";
    console.log("Running in:", isBrowser ? "Browser" : "Server");
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      if (typeof window !== "undefined") {
        localStorage.setItem("settings", JSON.stringify(updatedSettings));
      }
      return updatedSettings;
    });
  };

  const handleSettingChange = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    if (key === "theme") {
      if (value === "dark" || value === "light" || value === "system") {
        setTheme(value);
      }
    }
    updateSettings({ [key]: value });
  };

  const handleConnectWebSocket = () => {
    const token = localStorage.getItem("dmdata_access_token");
    if (!token) {
      toast.error("アカウントを認証してください。");
      return;
    }
    connectWebSocket(token);
  };

  const handleDisconnectAuthentication = () => {
    localStorage.removeItem("dmdata_access_token");
    setIsAuthenticated(false);
    toast.info("アカウントとの連携を解除しました。");
  };

  const handleWebSocketDisconnect = async () => {
    await disconnectWebSocket();
  };

  const setHomePosition = () => {
    if (mapRef.current) {
      mapRef.current.setView([35, 136], 5);
    }
  };

  const handleTimeUpdate = useCallback((newTime: string) => {
    setCurrentTime(newTime);
  }, []);

  const handleTest = async () => {
    try {
      const response = await fetch("/testdata7.json");
      if (!response.ok) {
        throw new Error(`テストデータの取得に失敗しました: ${response.statusText}`);
      }
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入に失敗しました:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEpicenters((prev) => {
        const now = Date.now();
        const filtered = prev.filter((e) => now - e.startTime < 3 * 60 * 1000);
        if (filtered.length === 0 && prev.length > 0) {
          if (mapRef.current) {
            mapRef.current.setView([35, 136], 5);
          }
          setDisplayData(null);
        }
        return filtered;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleEpicenterUpdate = useCallback(
    ({
      eventId,
      lat,
      lng,
      icon,
      depthval,
    }: {
      eventId: string;
      lat: number;
      lng: number;
      icon: string;
      depthval: number;
    }) => {
      if (!eventId) return;

      setEpicenters((prev) => {
        const existing = prev.find((p) => p.eventId === eventId);
        if (!existing) {
          const newEpi: EpicenterInfo = {
            eventId,
            lat,
            lng,
            icon,
            startTime: Date.now(),
            depthval,
          };
          const updated = [...prev, newEpi];
          return updated;
        } else {
          const updated = prev.map((p) => {
            if (p.eventId === eventId) {
              return { ...p, lat, lng, icon };
            }
            return p;
          });
          return updated;
        }
      });
    },
    []
  );

  return (
    <main className="h-full w-full">
      <DynamicMap
        ref={mapRef}
        homePosition={{ center: [35, 136], zoom: 5 }}
        enableKyoshinMonitor={settings.enable_kyoshin_monitor}
        onTimeUpdate={handleTimeUpdate}
        isConnected={isConnected}
        epicenters={epicenters}
      />

      <SettingsDialog
        showSettings={ShowSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        handleSettingChange={handleSettingChange}
        onConnectWebSocket={handleConnectWebSocket}
        isAuthenticated={isAuthenticated}
        onDisconnectAuthentication={handleDisconnectAuthentication}
        onDisconnectWebSocket={handleWebSocketDisconnect}
      />

      <div className="fixed bottom-4 left-4 shadow-lg bg-white dark:bg-black rounded-lg space-x-4 border">
        <div className="flex space-x-3 p-3 justify-start items-center">
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings />
          </Button>
          <Button variant="outline" onClick={() => setHomePosition()}>
            <LocateFixed />
          </Button>
          <Button variant="outline" onClick={handleTest} className="">
            <FlaskConical />
          </Button>
          <div className="flex flex-col">
            <p className="pr-1">{currentTime}</p>
            {isConnected && (
              <div className="flex items-center text-xs text-green-500 space-x-1 text-right">
                <Gauge size={16} />
                <p>DM-D.S.S</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <EewDisplay
        parsedData={displayData}
        isAccuracy={settings.enable_accuracy_info}
        isLowAccuracy={settings.enable_low_accuracy_eew}
        onEpicenterUpdate={handleEpicenterUpdate}
      />
    </main>
  );
}

export default function Page() {
  return (
    <WebSocketProvider>
      <PageContent />
    </WebSocketProvider>
  );
}
