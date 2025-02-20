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
import { Settings, EpicenterInfo, RegionIntensityMap } from "@/types/types";
import { LoadingMapOverlay } from "@/components/ui/loading-map-overlay"

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
  ps_wave_update_interval: 10,
};

const DynamicMap = dynamic(() => import("@/components/map"), {
  ssr: false,
});

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

function PageContent() {
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [serverBaseTime, setServerBaseTime] = useState<number | null>(null);
  const [nowAppTime, setNowAppTime] = useState<number>(0);
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
  const rAFBaseRef = useRef<number | null>(null);
  const [mapAutoZoomEnabled, setMapAutoZoomEnabled] = useState(settings.map_auto_zoom);
  const [forceAutoZoomTrigger, setForceAutoZoomTrigger] = useState<number>(0);
  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);
  const prevMultiRef = useRef<Record<string, string[]>>({});
  const prevMergedRef = useRef<Record<string, string>>({});
  const isCancel = displayDataList[0]?.body?.isCanceled ?? false;
  const [version, setVersion] = useState<string>("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);

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

  const fetchServerTime = useCallback(async (handler: boolean = false) => {
    try {
      const response = await fetch("/api/nowtime");
      if (!response.ok) throw new Error("時刻取得に失敗");
      const data = await response.json();
      const serverTime = new Date(data.dateTime).getTime();
      setServerBaseTime(serverTime);
      if (handler) {
        toast.success("時計を補正しました。");
      }
    } catch (error) {
      console.error("時刻の取得に失敗", error);
      toast.error("時間の取得に失敗しました。");
    }
  }, []);

  useEffect(() => {
    fetchServerTime(false);
  }, [fetchServerTime]);

  useEffect(() => {
    if (serverBaseTime === null) return;
    rAFBaseRef.current = null;
    let animationFrameId: number;
    const updateTime = (timestamp: number) => {
      if (rAFBaseRef.current === null) {
        rAFBaseRef.current = timestamp;
      }
      const elapsed = timestamp - rAFBaseRef.current;
      setNowAppTime(serverBaseTime + elapsed);
      animationFrameId = requestAnimationFrame(updateTime);
    };
    animationFrameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [serverBaseTime]);

  useEffect(() => {
    if (settings.enable_kyoshin_monitor) return;
    if (!nowAppTime) return;
    const dateObj = new Date(nowAppTime);
    const formatted = dateObj.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setCurrentTime(formatted);
  }, [nowAppTime, settings.enable_kyoshin_monitor]);

  useEffect(() => {
    if (!nowAppTime) return;
    const timer = setInterval(() => {
      setNowAppTime(prev => prev + 1000);
    }, 1000);

    return () => clearInterval(timer);
  }, [nowAppTime]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchServerTime(false);
    }, 10 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchServerTime]);

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
      const response = await fetch("/testdata/testnow/miyagi.json");
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
      const response = await fetch("/testdata/testnow/test.json");
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
      const response = await fetch("/testdata/test/testmiyagi.json");
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
      toast.error("テストデータの読み込みに失敗しました。");
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
        const filtered = prev.filter((e) => e.startTime && now - e.startTime < 3 * 60 * 1000);
        const removed = prev.filter((e) => e.startTime && now - e.startTime >= 3 * 60 * 1000);

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

      setTimeout(() => {
        setDisplayDataList((prev) => prev.filter((x) => x.eventId !== data.eventId));
        setEpicenters((prev) => prev.filter((epi) => epi.eventId !== data.eventId));
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

  const showLegend =
    (settings.enable_map_intensity_fill && Object.keys(mergedRegionMap).length > 0) ||
    (settings.enable_map_warning_area && mergedWarningRegions.length > 0);

  const getHypocenterMethod = (
    earthquake: EewInformation.Latest.PublicCommonBody["earthquake"]
  ): string => {
    const { originTime, condition, hypocenter } = earthquake;
    const earthquakeCondition = condition || "不明";
    const accuracyEpicenters = hypocenter?.accuracy?.epicenters || [];

    if (earthquakeCondition === "仮定震源要素") {
      return "PLUM法";
    }

    if (accuracyEpicenters.length > 0) {
      const epicValInt = parseInt(accuracyEpicenters[0], 10);
      if (epicValInt === 1) {
        return originTime ? "IPF法 (1点)" : "レベル法";
      } else if (epicValInt === 2) {
        return "IPF法 (2点)";
      } else if (epicValInt === 3 || epicValInt === 4) {
        return "IPF法 (3点以上)";
      } else {
        return originTime ? "不明" : "レベル法";
      }
    }
    return originTime ? "不明" : "レベル法";
  };

  const handleClockSync = () => {
    fetchServerTime(true);
  };

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch("/api/version");
        if (!response.ok) throw new Error("バージョン情報の取得に失敗");
        const data = await response.json();
        setVersion(data.version);
      } catch (error) {
        console.error("バージョン取得失敗", error);
        toast.error("バージョン情報の取得に失敗しました")
      }
    };
    fetchVersion();
  }, []);

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
        onSyncClock={handleClockSync}
      />

      {version && (
        <div className="fixed bottom-0 left-0 z-50 text-xs">
          ver {version}
        </div>
      )}

      <main className="h-full w-full flex">
        <div className="flex-1 relative">
          <LoadingMapOverlay isVisible={!isMapLoaded} />
          {(settings.enable_map_intensity_fill || settings.enable_map_warning_area) && showLegend && (
            <div className="absolute z-50 right-4 bottom-4 bg-white/50 dark:bg-black/50 rounded-lg shadow-lg border">
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
                {settings.enable_map_intensity_fill &&
                  displayedShindoColors.map(({ level, bgcolor, color }) => (
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
          )}

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
            isCancel={isCancel}
            psWaveUpdateInterval={settings.ps_wave_update_interval}
            nowAppTime={nowAppTime}
            onMapLoad={() => setIsMapLoaded(true)}
          />
        </div>

        <div className="fixed bottom-4 left-4 shadow-lg bg-white/50 dark:bg-black/50 rounded-lg space-x-4 border">
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
            <Button variant="outline" onClick={handleTest2} className="hidden">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleTest3} className="hidden">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleSendAllTests} className="hidden">
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
          <Sidebar variant="sidebar" side="right" className="w-fit">
            <SidebarContent className="overflow-y-auto p-2">
              {(() => {
                const filteredDisplayDataList = settings.enable_low_accuracy_eew
                  ? displayDataList
                  : displayDataList.filter((data) => {
                      const body = data.body as EewInformation.Latest.PublicCommonBody;
                      const earthquake = body.earthquake;
                      if (!earthquake) return true;
                      const method = getHypocenterMethod(earthquake);
                      return !["PLUM法", "レベル法", "IPF法 (1点)"].includes(method);
                  });

                return filteredDisplayDataList.length > 0 ? (
                  filteredDisplayDataList.map((data) => (
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
                );
              })()}
            </SidebarContent>
          </Sidebar>
        </div>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <WebSocketProvider>
      <SidebarProvider>
        <PageContent />
      </SidebarProvider>
    </WebSocketProvider>
  );
}
