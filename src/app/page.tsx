"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import SettingsDialog from "@/components/settings-dialog";
import { useTheme } from "next-themes";
import {
  Settings as SettingsIcon,
  LocateFixed,
  Send,
  FlaskConical,
} from "lucide-react";
import { WebSocketProvider, useWebSocket } from "@/components/websocket";
import { toast } from "sonner";
import EewDisplay from "@/components/eew-display";
import { EewInformation } from "@dmdata/telegram-json-types";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
} from "@/components/ui/sidebar";

interface Settings {
  theme: "system" | "dark" | "light";
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
  enable_accuracy_info: boolean;
  enable_drill_test_info: boolean;
  enable_map_intensity_fill: boolean;
  world_map_resolution: "10m" | "50m" | "110m";
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  enable_kyoshin_monitor: false,
  enable_dynamic_zoom: true,
  enable_low_accuracy_eew: false,
  enable_accuracy_info: false,
  enable_drill_test_info: false,
  enable_map_intensity_fill: true,
  world_map_resolution: "50m"
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

const INTENSITY_ORDER = ["0", "1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];

type RegionIntensityMap = Record<string, string>;

function PageContent() {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState<string>("----/--/-- --:--:--");
  const mapRef = useRef<L.Map | null>(null);
  const [displayDataList, setDisplayDataList] = useState<EewInformation.Latest.Main[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const allRegionMapsRef = useRef<Record<string, RegionIntensityMap>>({});
  const [mergedRegionMap, setMergedRegionMap] = useState<RegionIntensityMap>({});
  const [, setMultiRegionMap] = useState<Record<string, string[]>>({});
  const {
    isConnected,
    receivedData,
    connectWebSocket,
    disconnectWebSocket,
    injectTestData,
  } = useWebSocket();

  const canceledRemoveScheduledRef = useRef<Set<string>>(new Set());
  const [mapAutoZoomEnabled, setMapAutoZoomEnabled] = useState(true);
  const [forceAutoZoomTrigger, setForceAutoZoomTrigger] = useState<number>(0);


  useEffect(() => {
    if (receivedData) {
      const newData = receivedData as EewInformation.Latest.Main;
      setDisplayDataList((prevList) => {
        const filtered = prevList.filter((data) => data.eventId !== newData.eventId);
        return [newData, ...filtered];
      });
    }
  }, [receivedData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const token = localStorage.getItem("dmdata_access_token");
      if (token) {
        setIsAuthenticated(true);
      }
    }
  }, []);

  useEffect(() => {
    if (settings.enable_kyoshin_monitor) return;
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
    connectWebSocket(token, settings.enable_drill_test_info);
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
      const response = await fetch("/testdata/testdata3.json");
      if (!response.ok) throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleTest2 = async () => {
    try {
      const response = await fetch("/testdata/ishikawa2.json");
      if (!response.ok) throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleTest3 = async () => {
    try {
      const response = await fetch("/testdata/testdata6.json");
      if (!response.ok) throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);

  const onRegionIntensityUpdate = useCallback(
    (regionMap: Record<string, string>, eventId: string) => {
      if (Object.keys(regionMap).length === 0) {
        delete allRegionMapsRef.current[eventId];
      } else {
        allRegionMapsRef.current[eventId] = regionMap;
      }
      const merged: Record<string, string> = {};
      const multi: Record<string, string[]> = {};

      Object.entries(allRegionMapsRef.current).forEach(([, map]) => {
        Object.entries(map).forEach(([code, intensity]) => {
          if (!multi[code]) {
            multi[code] = [];
          }
          multi[code].push(intensity);
        });
      });

      Object.entries(multi).forEach(([code, intensities]) => {
        let maxRank = -1;
        let maxIntensity = "0";
        intensities.forEach((val) => {
          const idx = INTENSITY_ORDER.indexOf(val);
          if (idx > maxRank) {
            maxRank = idx;
            maxIntensity = val;
          }
        });
        merged[code] = maxIntensity;
      });

      setMultiRegionMap((prev) => {
        return JSON.stringify(prev) !== JSON.stringify(multi) ? multi : prev;
      });
      setMergedRegionMap((prev) => {
        return JSON.stringify(prev) !== JSON.stringify(merged) ? merged : prev;
      });
    },
    []
  );

  useEffect(() => {
    const intervalTime = (settings.enable_dynamic_zoom && mapAutoZoomEnabled) ? 2000 : 10000;
    
    const timer = setInterval(() => {
      setEpicenters((prev) => {
        const now = Date.now();
        const filtered = prev.filter(e => now - e.startTime < 3 * 60 * 1000);
        const removed = prev.filter(e => now - e.startTime >= 3 * 60 * 1000);
  
        removed.forEach(e => {
          onRegionIntensityUpdate({}, e.eventId);
        });
  
        if (filtered.length === 0 && prev.length > 0) {
          setDisplayDataList([]);
        }
        return filtered;
      });
    }, intervalTime);
  
    return () => clearInterval(timer);
  }, [displayDataList, onRegionIntensityUpdate, settings.enable_dynamic_zoom, mapAutoZoomEnabled]);  

  useEffect(() => {
    displayDataList.forEach((data) => {
      if (!data.body?.isCanceled) return;
      if (canceledRemoveScheduledRef.current.has(data.eventId)) return;

      canceledRemoveScheduledRef.current.add(data.eventId);

      setTimeout(() => {
        setDisplayDataList((prev) =>
          prev.filter((x) => x.eventId !== data.eventId)
        );
        onRegionIntensityUpdate({}, data.eventId);

        canceledRemoveScheduledRef.current.delete(data.eventId);
      }, 10000);
    });
  }, [displayDataList, onRegionIntensityUpdate]);

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
          setForceAutoZoomTrigger(Date.now());
          return [...prev, newEpi];
        } else {
          return prev.map((p) =>
            p.eventId === eventId
              ? (() => {
                  setForceAutoZoomTrigger(Date.now());
                  return { ...p, lat, lng, icon, depthval };
                })()
              : p
          );
        }
      });
    },
    []
  );

  const [originDt, setOriginDt] = useState<Date | null>(null);

  return (
    <>
      <SettingsDialog
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        handleSettingChange={handleSettingChange}
        onConnectWebSocket={handleConnectWebSocket}
        isAuthenticated={isAuthenticated}
        onDisconnectAuthentication={handleDisconnectAuthentication}
        onDisconnectWebSocket={handleWebSocketDisconnect}
      />

      <main className="h-full w-full flex">
        <div className="flex-1 relative">
          <DynamicMap
            ref={mapRef}
            homePosition={{ center: [35, 136], zoom: 5 }}
            enableKyoshinMonitor={settings.enable_kyoshin_monitor}
            onTimeUpdate={handleTimeUpdate}
            isConnected={isConnected}
            epicenters={epicenters}
            originDt={originDt}
            regionIntensityMap={mergedRegionMap}
            enableMapIntensityFill={settings.enable_map_intensity_fill}
            enableDynamicZoom={settings.enable_dynamic_zoom}
            mapResolution={settings.world_map_resolution}
            onAutoZoomChange={setMapAutoZoomEnabled}
            forceAutoZoomTrigger={forceAutoZoomTrigger} 
          />
        </div>

        <div className="fixed bottom-4 left-4 shadow-lg bg-white dark:bg-black rounded-lg space-x-4 border">
          <div className="flex space-x-3 p-3 justify-start items-center">
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <SettingsIcon />
            </Button>
            <Button variant="outline" onClick={setHomePosition}>
              <LocateFixed />
            </Button>
            <Button variant="outline" onClick={handleTest} className="">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleTest2} className="">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleTest3} className="">
              <FlaskConical />
            </Button>
            <div className="flex flex-col">
              <p className="pr-1">{currentTime}</p>
              {isConnected && (
                <div className="flex items-center text-xs text-green-500 space-x-1 text-right">
                  <Send size={16} />
                  <p>DM-D.S.S</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-[400px]">
          <SidebarProvider>
            <Sidebar variant="sidebar" side="right" className="w-fit">
              <SidebarContent className="overflow-y-auto p-2">
                {displayDataList && displayDataList.length > 0 ? (
                  displayDataList.map((data) => (
                    <EewDisplay
                      key={data.eventId}
                      parsedData={data}
                      isAccuracy={settings.enable_accuracy_info}
                      isLowAccuracy={settings.enable_low_accuracy_eew}
                      onEpicenterUpdate={handleEpicenterUpdate}
                      onOriginDtUpdate={setOriginDt}
                      onRegionIntensityUpdate={(regionMap) =>
                        onRegionIntensityUpdate(regionMap, data.eventId)
                      }
                    />
                  ))
                ) : (
                  <div className="w-[385px] h-full flex justify-center items-center">
                    <h1 className="text-xl">
                      緊急地震速報受信待機中
                    </h1>
                  </div>
                )}
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        </div>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <WebSocketProvider>
      <PageContent />
    </WebSocketProvider>
  );
}
