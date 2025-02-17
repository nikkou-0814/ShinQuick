"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  map_auto_zoom: boolean;
  enable_low_accuracy_eew: boolean;
  enable_accuracy_info: boolean;
  enable_drill_test_info: boolean;
  enable_map_intensity_fill: boolean;
  enable_map_warning_area: boolean;
  world_map_resolution: "10m" | "50m" | "110m";
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  enable_kyoshin_monitor: false,
  enable_dynamic_zoom: true,
  map_auto_zoom: true,
  enable_low_accuracy_eew: false,
  enable_accuracy_info: false,
  enable_drill_test_info: false,
  enable_map_intensity_fill: true,
  enable_map_warning_area: false,
  world_map_resolution: "50m",
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
  originTime: number;
  depthval: number;
};

const INTENSITY_ORDER = ["0", "1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"];

const levelToIntensity: Record<string, string> = {
  "不明": "不明",
  "震度1": "1",
  "震度2": "2",
  "震度3": "3",
  "震度4": "4",
  "震度5弱": "5-",
  "震度5強": "5+",
  "震度6弱": "6-",
  "震度6強": "6+",
  "震度7": "7",
};

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
  const allWarningRegionsRef = useRef<Record<string, { code: string; name: string }[]>>({});
  const [mergedWarningRegions, setMergedWarningRegions] = useState<{ code: string; name: string }[]>([]);
  const { isConnected, receivedData, connectWebSocket, disconnectWebSocket, injectTestData } = useWebSocket();
  const canceledRemoveScheduledRef = useRef<Set<string>>(new Set());
  const [mapAutoZoomEnabled, setMapAutoZoomEnabled] = useState(settings.map_auto_zoom);
  const [forceAutoZoomTrigger, setForceAutoZoomTrigger] = useState<number>(0);
  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);
  const prevMultiRef = useRef<Record<string, string[]>>({});
  const prevMergedRef = useRef<Record<string, string>>({});

  const shindoColors = useMemo(() => [
    { level: "震度7", bgcolor: "#5F0CA2", color: "white" },
    { level: "震度6強", bgcolor: "#930A7A", color: "white" },
    { level: "震度6弱", bgcolor: "#A50C6B", color: "white" },
    { level: "震度5強", bgcolor: "#C31B1B", color: "white" },
    { level: "震度5弱", bgcolor: "#E52A18", color: "white" },
    { level: "震度4", bgcolor: "#FF9939", color: "black" },
    { level: "震度3", bgcolor: "#F6CB51", color: "black" },
    { level: "震度2", bgcolor: "#4CD0A7", color: "black" },
    { level: "震度1", bgcolor: "#2B8EB2", color: "white" },
  ], []);

  useEffect(() => {
    setMapAutoZoomEnabled(settings.map_auto_zoom);
  }, [settings.map_auto_zoom]);

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

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === "theme") {
      if (value === "dark" || value === "light" || value === "system") {
        setTheme(value);
      }
    }
    updateSettings({ [key]: value });
  };

  const handleTimeUpdate = useCallback((newTime: string) => {
    setCurrentTime(newTime);
  }, []);

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

  const handleTest = async () => {
    try {
      const response = await fetch("/testdata/testdata.json");
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
      const response = await fetch("/testdata/testnow/miyagi.json");
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
      const response = await fetch("/testdata/testnow/test3.json");
      if (!response.ok) throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleSendAllTests = async () => {
    const urls = [
      "/testdata/test/testtokachi.json",
      "/testdata/test/testmiyagi.json",
      "/testdata/test/testnagano.json",
      "/testdata/test/testwakayama.json",
      "/testdata/test/testhyuganada.json",
      "/testdata/test/testokinawa.json",
      "/testdata/test/testishigaki.json",
    ];

    try {
      for (const url of urls) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`テストデータ取得失敗: ${response.statusText}`);
        }
        const testData = await response.json();
        await injectTestData(testData);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      toast.success("全てのテストデータを送信しました。");
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗したよ。");
    }
  };
  
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

      if (JSON.stringify(prevMultiRef.current) !== JSON.stringify(multi)) {
        setMultiRegionMap(multi);
        prevMultiRef.current = multi;
      }
  
      if (JSON.stringify(prevMergedRef.current) !== JSON.stringify(merged)) {
        setMergedRegionMap(merged);
        prevMergedRef.current = merged;
      }
    },
    []
  );  

  const onWarningRegionUpdate = useCallback(
    (warningRegions: { code: string; name: string }[], eventId: string) => {
      if (!warningRegions || warningRegions.length === 0) {
        delete allWarningRegionsRef.current[eventId];
      } else {
        allWarningRegionsRef.current[eventId] = warningRegions;
      }
      const merged = Object.values(allWarningRegionsRef.current).flat();

      const unique = merged.reduce((acc, region) => {
        if (!acc.find((r) => r.code === region.code)) {
          acc.push(region);
        }
        return acc;
      }, [] as { code: string; name: string }[]);
      setMergedWarningRegions(unique);
    },
    []
  );

  useEffect(() => {
    const intervalTime = settings.enable_dynamic_zoom && mapAutoZoomEnabled ? 2000 : 10000;

    const timer = setInterval(() => {
      setEpicenters((prev) => {
        const now = Date.now();
        const filtered = prev.filter((e) => now - e.startTime < 3 * 60 * 1000);
        const removed = prev.filter((e) => now - e.startTime >= 3 * 60 * 1000);

        removed.forEach((e) => {
          onRegionIntensityUpdate({}, e.eventId);
          onWarningRegionUpdate([], e.eventId);
        });

        if (filtered.length === 0 && prev.length > 0) {
          setDisplayDataList([]);
        }
        return filtered;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [
    displayDataList,
    onRegionIntensityUpdate,
    onWarningRegionUpdate,
    settings.enable_dynamic_zoom,
    mapAutoZoomEnabled,
  ]);

  useEffect(() => {
    displayDataList.forEach((data) => {
      if (!data.body?.isCanceled) return;
      if (canceledRemoveScheduledRef.current.has(data.eventId)) return;

      canceledRemoveScheduledRef.current.add(data.eventId);

      setTimeout(() => {
        setDisplayDataList((prev) => prev.filter((x) => x.eventId !== data.eventId));
        onRegionIntensityUpdate({}, data.eventId);
        onWarningRegionUpdate([], data.eventId);

        canceledRemoveScheduledRef.current.delete(data.eventId);
      }, 10000);
    });
  }, [displayDataList, onRegionIntensityUpdate, onWarningRegionUpdate]);

  const handleEpicenterUpdate = useCallback(
    ({
      eventId,
      lat,
      lng,
      icon,
      depthval,
      originTime,
    }: {
      eventId: string;
      lat: number;
      lng: number;
      icon: string;
      depthval: number;
      originTime: number;
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
            originTime,
            depthval,
          };
          setForceAutoZoomTrigger(Date.now());
          return [...prev, newEpi];
        } else {
          return prev.map((p) =>
            p.eventId === eventId
              ? (() => {
                  setForceAutoZoomTrigger(Date.now());
                  return {
                    ...p,
                    lat,
                    lng,
                    icon,
                    depthval,
                    originTime: originTime,
                  };
                })()
              : p
          );
        }
      });
    },
    []
  );

  const filteredMergedRegionMap = useMemo(() => {
    if (!settings.enable_map_warning_area) return mergedRegionMap;
    const warningCodes = new Set(mergedWarningRegions.map((r) => r.code));
    const result: RegionIntensityMap = {};
    for (const code in mergedRegionMap) {
      if (!warningCodes.has(code)) {
        result[code] = mergedRegionMap[code];
      }
    }
    return result;
  }, [mergedRegionMap, mergedWarningRegions, settings.enable_map_warning_area]);

  const displayedIntensitySet = useMemo(() => {
    return new Set(Object.values(filteredMergedRegionMap));
  }, [filteredMergedRegionMap]);

  const displayedShindoColors = useMemo(() => {
    return shindoColors.filter(({ level }) => {
      const intensity = levelToIntensity[level];
      return displayedIntensitySet.has(intensity);
    });
  }, [displayedIntensitySet, shindoColors]);

  return (
    <>
      <SettingsDialog
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        handleSettingChange={handleSettingChange}
        isConnected={isConnected}
        onConnectWebSocket={handleConnectWebSocket}
        isAuthenticated={isAuthenticated}
        onDisconnectAuthentication={handleDisconnectAuthentication}
        onDisconnectWebSocket={handleWebSocketDisconnect}
      />

      <main className="h-full w-full flex">
        <div className="flex-1 relative">
          <div
            className={`absolute z-50 right-4 bottom-4 bg-white/50 dark:bg-black/50 rounded-lg shadow-lg border ${
              Object.keys(mergedRegionMap).length > 0 || mergedWarningRegions.length > 0
                ? "visible"
                : "hidden"
            }`}
          >
            <h3 className="text-center font-bold mb-2 px-3 pt-3">地図の凡例</h3>
            <div className="border-t my-2 w-full"></div>
            <div className="space-y-1.5 px-3 pb-3">
              {settings.enable_map_warning_area && mergedWarningRegions.length > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-full rounded shadow-sm text-left p-1"
                    style={{ backgroundColor: "red", color: "white" }}
                  >
                    <span className="text-xs font-medium">警報地域</span>
                  </div>
                </div>
              )}
              {displayedShindoColors.map(({ level, bgcolor, color }) => (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className="w-full rounded shadow-sm text-left p-1"
                    style={{ backgroundColor: bgcolor, color: color }}
                  >
                    <span className="text-xs font-medium">{level}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DynamicMap
            ref={mapRef}
            homePosition={{ center: [35, 136], zoom: 5 }}
            enableKyoshinMonitor={settings.enable_kyoshin_monitor}
            onTimeUpdate={handleTimeUpdate}
            isConnected={isConnected}
            epicenters={epicenters}
            regionIntensityMap={mergedRegionMap}
            enableMapIntensityFill={settings.enable_map_intensity_fill}
            enableDynamicZoom={settings.enable_dynamic_zoom}
            mapAutoZoom={mapAutoZoomEnabled}
            mapResolution={settings.world_map_resolution}
            onAutoZoomChange={setMapAutoZoomEnabled}
            forceAutoZoomTrigger={forceAutoZoomTrigger}
            enableMapWarningArea={settings.enable_map_warning_area}
            warningRegionCodes={mergedWarningRegions.map((r) => r.code)}
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
            <Button variant="outline" onClick={handleSendAllTests} className="">
              複数
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
                      onRegionIntensityUpdate={(regionMap) =>
                        onRegionIntensityUpdate(regionMap, data.eventId)
                      }
                      onWarningRegionUpdate={(regions) =>
                        onWarningRegionUpdate(regions, data.eventId)
                      }
                    />
                  ))
                ) : (
                  <div className="w-[385px] h-full flex justify-center items-center">
                    <h1 className="text-xl">緊急地震速報受信待機中</h1>
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
