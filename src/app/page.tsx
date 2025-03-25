"use client";

import dynamic from "next/dynamic";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
import { EewInformation } from "@dmdata/telegram-json-types";
import { Sidebar } from "@/components/sidebar";
import { MobileEewPanel } from "@/components/mobile-eew-panel";
import { Settings, EpicenterInfo, RegionIntensityMap } from "@/types/types";
import { LoadingMapOverlay } from "@/components/ui/loading-map-overlay";
import { MapRef } from "react-map-gl/maplibre";
import { ClockDisplay } from "@/components/clock-display"
import { getJapanHomePosition } from "@/utils/home-position";

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
  enable_intensity_filter: false,
  intensity_filter_value: "3",
};

const DynamicMap = dynamic(() => import("@/components/map"), {
  ssr: false,
});

const INTENSITY_ORDER = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5-",
  "5+",
  "6-",
  "6+",
  "7",
];

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
  const mapRef = useRef<MapRef | null>(null);
  const [displayDataList, setDisplayDataList] = useState<
    EewInformation.Latest.Main[]
  >([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const allRegionMapsRef = useRef<Record<string, RegionIntensityMap>>({});
  const [mergedRegionMap, setMergedRegionMap] = useState<RegionIntensityMap>({});
  const allWarningRegionsRef = useRef<
    Record<string, { code: string; name: string }[]>
  >({});
  const [mergedWarningRegions, setMergedWarningRegions] = useState<
    { code: string; name: string }[]
  >([]);
  const {
    isConnected,
    receivedData,
    connectWebSocket,
    disconnectWebSocket,
    injectTestData,
    passedIntensityFilterRef,
  } = useWebSocket();

  const canceledRemoveScheduledRef = useRef<Set<string>>(new Set());
  const nowAppTimeRef = useRef<number>(0);
  const rAFBaseRef = useRef<number | null>(null);
  const [mapAutoZoomEnabled, setMapAutoZoomEnabled] = useState(
    settings.map_auto_zoom
  );
  const [forceAutoZoomTrigger, setForceAutoZoomTrigger] = useState<number>(0);
  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);
  const prevMultiRef = useRef<Record<string, string[]>>({});
  const prevMergedRef = useRef<Record<string, string>>({});
  const isCancel = displayDataList[0]?.body?.isCanceled ?? false;
  const [version, setVersion] = useState<string>("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    // 初回判定
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const shindoColors = useMemo(
    () => [
      { level: "震度7", bgcolor: "#5F0CA2", color: "white" },
      { level: "震度6強", bgcolor: "#930A7A", color: "white" },
      { level: "震度6弱", bgcolor: "#A50C6B", color: "white" },
      { level: "震度5強", bgcolor: "#C31B1B", color: "white" },
      { level: "震度5弱", bgcolor: "#E52A18", color: "white" },
      { level: "震度4", bgcolor: "#FF9939", color: "black" },
      { level: "震度3", bgcolor: "#F6CB51", color: "black" },
      { level: "震度2", bgcolor: "#4CD0A7", color: "black" },
      { level: "震度1", bgcolor: "#2B8EB2", color: "white" },
    ],
    []
  );

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
      nowAppTimeRef.current = serverBaseTime + elapsed;
      animationFrameId = requestAnimationFrame(updateTime);
    };
    animationFrameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [serverBaseTime]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchServerTime(false);
    }, 10 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchServerTime]);

  useEffect(() => {
    setMapAutoZoomEnabled(settings.map_auto_zoom);
  }, [settings.map_auto_zoom]);

  const getIntensityRank = useCallback((intensity: string): number => {
    const intensityMap: Record<string, number> = {
      "0": 0,
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
      "5-": 5,
      "5+": 6,
      "6-": 7,
      "6+": 8,
      "7": 9,
      "不明": -1,
    };
    return intensityMap[intensity] ?? -1;
  }, []);

  const getMaxIntensity = useCallback(
    (data: EewInformation.Latest.Main): string => {
      const { body } = data;
      if (!body || body.isCanceled || !("intensity" in body)) {
        return "不明";
      }

      const intensityData = (body as EewInformation.Latest.PublicCommonBody).intensity;
      if (!intensityData || !intensityData.forecastMaxInt) {
        return "不明";
      }

      const { from = "不明", to = "不明" } = intensityData.forecastMaxInt;
      if (to === "over") {
        return from;
      }
      return to;
    },
    []
  );

  const shouldDisplayEarthquake = useCallback(
    (data: EewInformation.Latest.Main): boolean => {
      // すでに条件を満たしたイベントは表示する
      if (passedIntensityFilterRef.current.has(data.eventId)) {
        return true;
      }

      if (!settings.enable_intensity_filter) {
        return true;
      }

      if (data.body?.isCanceled) {
        return true;
      }

      const maxIntensity = getMaxIntensity(data);
      const intensityRank = getIntensityRank(maxIntensity);
      const filterRank = getIntensityRank(settings.intensity_filter_value);

      if (intensityRank === -1) {
        return true;
      }

      const display = intensityRank >= filterRank;

      if (display) {
        passedIntensityFilterRef.current.add(data.eventId);
      }

      return display;
    },
    [
      settings.enable_intensity_filter,
      settings.intensity_filter_value,
      getIntensityRank,
      getMaxIntensity,
      passedIntensityFilterRef, 
    ]
  );

  useEffect(() => {
    if (receivedData) {
      const newData = receivedData as EewInformation.Latest.Main;

      if (shouldDisplayEarthquake(newData)) {
        setDisplayDataList((prevList) => {
          const filtered = prevList.filter(
            (data) => data.eventId !== newData.eventId
          );
          return [newData, ...filtered];
        });
        setForceAutoZoomTrigger(Date.now());
      }
    }
  }, [receivedData, shouldDisplayEarthquake]);

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
      const { longitude, latitude, zoom } = getJapanHomePosition();
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: zoom,
        duration: 1000,
      });
    }
  };

  const handleTest = async () => {
    try {
      const response = await fetch("/testdata/testdata9.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleTest2 = async () => {
    try {
      const response = await fetch("/testdata/testdata3.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleTest3 = async () => {
    try {
      const response = await fetch("/testdata/testdata4.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
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

  // 地域震度情報の更新処理
  const onRegionIntensityUpdate = useCallback(
    (regionMap: Record<string, string>, eventId: string) => {
      // イベントIDごとの地域震度マップを更新
      if (Object.keys(regionMap).length === 0) {
        delete allRegionMapsRef.current[eventId];
      } else {
        allRegionMapsRef.current[eventId] = regionMap;
      }

      // 最大震度を計算するための一時マップ
      const merged: Record<string, string> = {};
      const multi: Record<string, string[]> = {};
      
      // 各地域コードごとに全イベントの震度を収集
      for (const [, map] of Object.entries(allRegionMapsRef.current)) {
        for (const [code, intensity] of Object.entries(map)) {
          if (!multi[code]) {
            multi[code] = [];
          }
          multi[code].push(intensity);
        }
      }

      // 各地域コードごとに最大震度を計算
      for (const [code, intensities] of Object.entries(multi)) {
        let maxRank = -1;
        let maxIntensity = "0";

        for (const val of intensities) {
          const idx = INTENSITY_ORDER.indexOf(val);
          if (idx > maxRank) {
            maxRank = idx;
            maxIntensity = val;
          }
        }
        
        merged[code] = maxIntensity;
      }

      // 前回の値と比較して変更があれば状態を更新
      const multiStr = JSON.stringify(multi);
      if (JSON.stringify(prevMultiRef.current) !== multiStr) {
        prevMultiRef.current = multi;
      }

      const mergedStr = JSON.stringify(merged);
      if (JSON.stringify(prevMergedRef.current) !== mergedStr) {
        setMergedRegionMap(merged);
        prevMergedRef.current = merged;
      }
    },
    []
  );

  // 警報地域の更新処理
  const onWarningRegionUpdate = useCallback(
    (warningRegions: { code: string; name: string }[], eventId: string) => {
      // イベントIDごとの警報地域を更新
      if (!warningRegions || warningRegions.length === 0) {
        delete allWarningRegionsRef.current[eventId];
      } else {
        allWarningRegionsRef.current[eventId] = warningRegions;
      }
      
      // 全イベントの警報地域をフラット化
      const merged = Object.values(allWarningRegionsRef.current).flat();
      
      // 重複を除去
      const uniqueCodes = new Set<string>();
      const unique: { code: string; name: string }[] = [];
      
      for (const region of merged) {
        if (!uniqueCodes.has(region.code)) {
          uniqueCodes.add(region.code);
          unique.push(region);
        }
      }
      
      // 状態を更新
      setMergedWarningRegions(unique);
    },
    []
  );

  // 震源情報のクリーンアップ処理
  useEffect(() => {
    // 更新間隔を動的に調整
    const intervalTime =
      settings.enable_dynamic_zoom && mapAutoZoomEnabled ? 2000 : 10000;

    const timer = setInterval(() => {
      setEpicenters((prev) => {
        const now = Date.now();
        const timeThreshold = 3 * 60 * 1000;
        const filtered: EpicenterInfo[] = [];
        const removed: EpicenterInfo[] = [];
        
        for (const e of prev) {
          if (e.startTime && now - e.startTime < timeThreshold) {
            filtered.push(e);
          } else {
            removed.push(e);
          }
        }

        // 削除された震源の関連データをクリーンアップ
        if (removed.length > 0) {
          requestAnimationFrame(() => {
            for (const e of removed) {
              onRegionIntensityUpdate({}, e.eventId);
              onWarningRegionUpdate([], e.eventId);
            }

            if (filtered.length === 0 && prev.length > 0) {
              setDisplayDataList([]);
            }
          });
        }
        
        return filtered;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [
    onRegionIntensityUpdate,
    onWarningRegionUpdate,
    settings.enable_dynamic_zoom,
    mapAutoZoomEnabled,
  ]);

  // キャンセルされた地震情報の処理
  useEffect(() => {
    const canceledEvents: string[] = [];
    
    for (const data of displayDataList) {
      if (!data.body?.isCanceled) continue;
      if (canceledRemoveScheduledRef.current.has(data.eventId)) continue;
      canceledRemoveScheduledRef.current.add(data.eventId);
      canceledEvents.push(data.eventId);
    }
    
    // キャンセルされたイベントがあれば処理をスケジュール
    if (canceledEvents.length > 0) {
      const timeoutId = setTimeout(() => {
        setDisplayDataList((prev) =>
          prev.filter((x) => !canceledEvents.includes(x.eventId))
        );
        
        setEpicenters((prev) =>
          prev.filter((epi) => !canceledEvents.includes(epi.eventId))
        );
        
        // 関連データのクリーンアップ
        for (const eventId of canceledEvents) {
          onRegionIntensityUpdate({}, eventId);
          onWarningRegionUpdate([], eventId);
          canceledRemoveScheduledRef.current.delete(eventId);
        }
      }, 10000);
      
      // クリーンアップ関数
      return () => clearTimeout(timeoutId);
    }
  }, [displayDataList, onRegionIntensityUpdate, onWarningRegionUpdate]);

  // 震源情報の更新処理
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
        const existingIndex = prev.findIndex((p) => p.eventId === eventId);

        if (existingIndex === -1) {
          const newEpi: EpicenterInfo = {
            eventId,
            lat,
            lng,
            icon,
            startTime: Date.now(),
            originTime,
            depthval,
          };
          
          // 自動ズームをトリガー
          requestAnimationFrame(() => {
            setForceAutoZoomTrigger(Date.now());
          });
          return [...prev, newEpi];
        } 
        else {
          const newEpicenters = [...prev];
          const p = newEpicenters[existingIndex];
          
          // 位置が変わった場合のみ自動ズームをトリガー
          if (p.lat !== lat || p.lng !== lng) {
            requestAnimationFrame(() => {
              setForceAutoZoomTrigger(Date.now());
            });
          }
          newEpicenters[existingIndex] = {
            ...p,
            lat,
            lng,
            icon,
            depthval,
            originTime,
          };
          
          return newEpicenters;
        }
      });
    },
    []
  );

  // 地域震度マップのフィルタリング
  const filteredMergedRegionMap = useMemo(() => {
    // 警報地域が無効の場合はフィルタリングしない
    if (!settings.enable_map_warning_area) return mergedRegionMap;
    
    // 警報地域のコードをSetに変換して高速検索
    const warningCodes = new Set(mergedWarningRegions.map((r) => r.code));
    
    // 警報地域以外の地域のみを含む新しいマップを作成
    const result: RegionIntensityMap = {};

    for (const [code, intensity] of Object.entries(mergedRegionMap)) {
      if (!warningCodes.has(code)) {
        result[code] = intensity;
      }
    }
    
    return result;
  }, [mergedRegionMap, mergedWarningRegions, settings.enable_map_warning_area]);

  // 表示する震度
  const displayedIntensitySet = useMemo(() => {
    return new Set(Object.values(filteredMergedRegionMap));
  }, [filteredMergedRegionMap]);

  // 表示する震度色
  const displayedShindoColors = useMemo(() => {
    if (displayedIntensitySet.size === 0) return [];
    return shindoColors.filter(({ level }) => {
      const intensity = levelToIntensity[level];
      return displayedIntensitySet.has(intensity);
    });
  }, [displayedIntensitySet, shindoColors]);

  const showLegend =
    (settings.enable_map_intensity_fill &&
      Object.keys(mergedRegionMap).length > 0) ||
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
        if (!response.ok)
          throw new Error("バージョン情報の取得に失敗");
        const data = await response.json();
        setVersion(data.version);
      } catch (error) {
        console.error("バージョン取得失敗", error);
        toast.error("バージョン情報の取得に失敗しました");
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
          {(settings.enable_map_intensity_fill ||
            settings.enable_map_warning_area) &&
            showLegend && (
              <div className="absolute z-50 right-4 bottom-4 bg-white/50 dark:bg-black/50 rounded-lg shadow-lg border">
                <h3 className="text-center font-bold mb-2 px-3 pt-3">
                  地図の凡例
                </h3>
                <div className="border-t my-2 w-full"></div>
                <div className="space-y-1.5 px-3 pb-3">
                  {settings.enable_map_warning_area &&
                    mergedWarningRegions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-full rounded shadow-sm text-left p-1"
                          style={{
                            backgroundColor: "red",
                            color: "white",
                          }}
                        >
                          <span className="text-xs font-medium">
                            警報地域
                          </span>
                        </div>
                      </div>
                    )}
                  {settings.enable_map_intensity_fill &&
                    displayedShindoColors.map(({ level, bgcolor, color }) => (
                      <div key={level} className="flex items-center gap-2">
                        <div
                          className="w-full rounded shadow-sm text-left p-1"
                          style={{
                            backgroundColor: bgcolor,
                            color: color,
                          }}
                        >
                          <span className="text-xs font-medium">
                            {level}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          <DynamicMap
            ref={mapRef}
            enableKyoshinMonitor={settings.enable_kyoshin_monitor}
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
            nowAppTimeRef={nowAppTimeRef}
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
            <Button variant="outline" onClick={handleTest2} className="">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleTest3} className="">
              <FlaskConical />
            </Button>
            <Button variant="outline" onClick={handleSendAllTests} className="hidden">
              複数
            </Button>
            <div className="flex flex-col">
              <ClockDisplay
                nowAppTimeRef={nowAppTimeRef}
                KyoshinMonitor={settings.enable_kyoshin_monitor}
              />
              {isConnected && (
                <div className="flex items-center text-xs text-green-500 space-x-1 text-right">
                  <Send size={16} />
                  <p>DM-D.S.S</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isMobile ? (
          <Sidebar
            displayDataList={displayDataList}
            settings={settings}
            onEpicenterUpdate={handleEpicenterUpdate}
            onRegionIntensityUpdate={onRegionIntensityUpdate}
            onWarningRegionUpdate={onWarningRegionUpdate}
            getHypocenterMethod={getHypocenterMethod}
          />
        ) : (
          <MobileEewPanel
            parsedData={displayDataList.length > 0 ? displayDataList[0] : null}
            isAccuracy={settings.enable_accuracy_info}
            isLowAccuracy={settings.enable_low_accuracy_eew}
            onEpicenterUpdate={handleEpicenterUpdate}
            onRegionIntensityUpdate={(regionMap) => onRegionIntensityUpdate(regionMap, displayDataList[0]?.eventId || "")}
            onWarningRegionUpdate={(regions) => onWarningRegionUpdate(regions, displayDataList[0]?.eventId || "")}
          />
        )}
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
