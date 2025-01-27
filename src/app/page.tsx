"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import SettingsDialog from "@/components/settings-dialog";
import { useTheme } from "next-themes";
import { Map } from "leaflet";
import { Settings, LocateFixed, Gauge } from "lucide-react";
import { WebSocketProvider, useWebSocket } from "@/components/websocket";
import { toast } from "sonner";

const DynamicMap = dynamic(() => import("@/components/map"), {
  ssr: false,
});

interface Settings {
  theme: "system" | "dark" | "light";
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  enable_kyoshin_monitor: false,
  enable_dynamic_zoom: true,
  enable_low_accuracy_eew: false,
};

function PageContent() {
  const [ShowSettings, setShowSettings] = useState<boolean>(false);
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState<string>("----/--/-- --:--:--");
  const mapRef = useRef<Map | null>(null);
  const { isConnected, receivedData, connectWebSocket, disconnectWebSocket } = useWebSocket();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
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

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      localStorage.setItem("settings", JSON.stringify(updatedSettings));
      return updatedSettings;
    });
  };

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
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
      toast.error("アカウントを認証してください");
      return;
    }
    connectWebSocket(token);
  };

  const handleDisconnectAuthentication = () => {
    localStorage.removeItem("dmdata_access_token");
    setIsAuthenticated(false);
    toast.info("アカウントとの連携を解除しました");
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

  return (
    <main className="h-full w-full">
      <DynamicMap
        ref={mapRef}
        homePosition={{ center: [35, 136], zoom: 5 }}
        enableKyoshinMonitor={settings.enable_kyoshin_monitor}
        onTimeUpdate={handleTimeUpdate}
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

      <div className="fixed bottom-4 left-4 shadow-lg bg-white dark:bg-black rounded-2xl space-x-4 border">
        <div className="flex space-x-3 p-3 justify-start items-center">
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings />
          </Button>
          <Button variant="outline" onClick={() => setHomePosition()}>
            <LocateFixed />
          </Button>
          <div className="flex flex-col">
            <p className="pr-1">{currentTime}</p>
            {isConnected && (
              <div className="flex items-center text-xs text-gray-500 space-x-1 text-right">
                <Gauge size={16} />
                <p>DM-D.S.S</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {receivedData && (
        <div className="fixed bottom-4 right-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-lg max-w-md overflow-auto">
          <h2 className="text-lg font-bold">Received Data</h2>
          <pre className="text-sm whitespace-pre-wrap">
            {JSON.stringify(receivedData, null, 2)}
          </pre>
        </div>
      )}
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
