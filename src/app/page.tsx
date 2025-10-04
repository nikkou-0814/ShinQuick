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
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { WebSocketProvider, useWebSocket } from "@/components/websocket";
import { toast } from "sonner";
import DMDATAEewDisplay from "@/components/dmdata/dmdata-eew-display";
import { EewInformation } from "@dmdata/telegram-json-types";
import { DMDATAMobileEewPanel } from "@/components/dmdata/dmdata-mobile-eew-panel";
import { Settings, EpicenterInfo, RegionIntensityMap, AXISEewInformation } from "@/types/types";
import { LoadingMapOverlay } from "@/components/ui/loading-map-overlay";
import { MapRef } from "react-map-gl/maplibre";
import { ClockDisplay } from "@/components/clock-display"
import { getJapanHomePosition } from "@/utils/home-position";
import { AXISMobileEewPanel } from "@/components/axis/axis-mobile-eew-panel";
import AXISEewDisplay from "@/components/axis/axis-eew-display";

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
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
  leftPanelSize: 75,
  rightPanelSize: 25,
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
  const [DMDATAdisplayDataList, setDMDATADisplayDataList] = useState<
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
    isDMDATAConnected,
    DMDATAreceivedData,
    connectDMDATAWebSocket,
    disconnectDMDATAWebSocket,
    injectdmdataTestData,
    injectaxisTestData,
    passedIntensityFilterRef,
    isAXISConnected,
    connectAXISWebSocket,
    disconnectAXISWebSocket,
    displayDataList,
    axisDisplayDataList,
    setAxisDisplayDataList,
    setDisplayDataList,
  } = useWebSocket();

  const [axisToken, setAxisToken] = useState<string>("");
  const canceledTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nonCanceledTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const axisCanceledTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const axisNonCanceledTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nowAppTimeRef = useRef<number>(0);
  const rAFBaseRef = useRef<number | null>(null);
  const [mapAutoZoomEnabled, setMapAutoZoomEnabled] = useState(
    settings.map_auto_zoom
  );
  const [forceAutoZoomTrigger, setForceAutoZoomTrigger] = useState<number>(0);
  const [epicenters, setEpicenters] = useState<EpicenterInfo[]>([]);
  const prevMultiRef = useRef<Record<string, string[]>>({});
  const prevMergedRef = useRef<Record<string, string>>({});
  const isCancel = DMDATAdisplayDataList[0]?.body?.isCanceled ?? false;
  const [version, setVersion] = useState<string>("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [panelSizesLoaded, setPanelSizesLoaded] = useState<boolean>(false);
  const [panelKey, setPanelKey] = useState(0);
  const isDev = process.env.NEXT_PUBLIC_IS_DEV === "true";
  const [expanded, setExpanded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    // 初回判定
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsMobile]);

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

      const forecastMaxInt = intensityData.forecastMaxInt;
      const maxInt = forecastMaxInt && 'to' in forecastMaxInt
        ? (forecastMaxInt.to === "over" 
            ? (forecastMaxInt as { from?: string }).from || "0" 
            : (forecastMaxInt as { to?: string }).to || "0")
        : "0";
      return maxInt;
    },
    []
  );

  const shouldDMDATADisplayEarthquake = useCallback(
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

  const dmdataPageSerialRef = useRef<Record<string, number>>({});
  const shouldProcessPageDMDATAData = useCallback((data: EewInformation.Latest.Main): boolean => {
    const eventId = data.eventId;
    const serialNo = parseInt(data.serialNo || '0', 10);
    const isCanceled = data.body?.isCanceled || false;
    const currentLatestSerial = dmdataPageSerialRef.current[eventId] || 0;
    
    if (isCanceled) {
      return true;
    }
    
    if (serialNo > currentLatestSerial) {
      dmdataPageSerialRef.current[eventId] = serialNo;
      return true;
    }
    
    if (serialNo < currentLatestSerial) {
      return false;
    }
    
    return false;
  }, []);

  useEffect(() => {
    if (DMDATAreceivedData) {
      const newData = DMDATAreceivedData as EewInformation.Latest.Main;

      if (!shouldProcessPageDMDATAData(newData)) {
        return;
      }

      if (shouldDMDATADisplayEarthquake(newData)) {
        setDMDATADisplayDataList((prevList) => {
          const filtered = prevList.filter(
            (data) => data.eventId !== newData.eventId
          );
          return [newData, ...filtered];
        });
        setForceAutoZoomTrigger(Date.now());
      }
    }
  }, [DMDATAreceivedData, shouldDMDATADisplayEarthquake, shouldProcessPageDMDATAData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const DMDATAtoken = localStorage.getItem("dmdata_access_token");
      if (DMDATAtoken) {
        setIsAuthenticated(true);
      }
      
      const savedAxisToken = localStorage.getItem("axis_access_token");
      if (savedAxisToken) {
        setAxisToken(savedAxisToken);
      }
      
      setPanelSizesLoaded(true);
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      if (typeof window !== "undefined") {
        localStorage.setItem("settings", JSON.stringify(updatedSettings));
      }
      return updatedSettings;
    });
  }, []);

  const handlePanelResize = useCallback((sizes: number[]) => {
    if (sizes.length === 2) {
      updateSettings({ leftPanelSize: sizes[0], rightPanelSize: sizes[1] });
    }
  }, [updateSettings]);

  const resetPanelSizes = () => {
    updateSettings({
      leftPanelSize: DEFAULT_SETTINGS.leftPanelSize,
      rightPanelSize: DEFAULT_SETTINGS.rightPanelSize,
    });
    setPanelKey(prev => prev + 1);
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

  const handleConnectDMDATAWebSocket = () => {
    const DMDATAtoken = localStorage.getItem("dmdata_access_token");
    if (!DMDATAtoken) {
      toast.error("アカウントを認証してください。");
      return;
    }
    connectDMDATAWebSocket(DMDATAtoken, settings.enable_drill_test_info);
  };

  const handleDisconnectAuthentication = () => {
    localStorage.removeItem("dmdata_access_token");
    setIsAuthenticated(false);
    toast.info("アカウントとの連携を解除しました。");
  };

  const handleDMDATAWebSocketDisconnect = async () => {
    await disconnectDMDATAWebSocket();
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
      const response = await fetch("/testdata/testaxis.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectaxisTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの挿入に失敗しました。");
    }
  };

  const handleTest2 = async () => {
    try {
      const response = await fetch("/testdata/testdata.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectdmdataTestData(testData);
    } catch (error) {
      console.error("テストデータの挿入失敗:", error);
      toast.error("テストデータの読み込みに失敗しました。");
    }
  };

  const handleTest3 = async () => {
    try {
      const response = await fetch("/testdata/testdata7.json");
      if (!response.ok)
        throw new Error(`テストデータ取得失敗: ${response.statusText}`);
      const testData = await response.json();
      injectdmdataTestData(testData);
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
        await injectdmdataTestData(testData);
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

  // DMDATAクリーンアップ処理
  useEffect(() => {
    Object.keys(canceledTimersRef.current).forEach((eventId) => {
      const stillExist = DMDATAdisplayDataList.some(
        (d) => d.eventId === eventId && d.body?.isCanceled
      );
      if (!stillExist) {
        clearTimeout(canceledTimersRef.current[eventId]);
        delete canceledTimersRef.current[eventId];
      }
    });

    DMDATAdisplayDataList.forEach((data) => {
      if (!data.body?.isCanceled) return;
      const eventId = data.eventId;
      if (canceledTimersRef.current[eventId]) return;

      canceledTimersRef.current[eventId] = setTimeout(() => {
        setDMDATADisplayDataList((prev) => prev.filter((x) => x.eventId !== eventId));
        setDisplayDataList((prev) => prev.filter((x) => x.eventId !== eventId));
        setEpicenters((prev) => prev.filter((epi) => epi.eventId !== eventId));
        onRegionIntensityUpdate({}, eventId);
        onWarningRegionUpdate([], eventId);
        delete canceledTimersRef.current[eventId];
        
        if (Object.keys(canceledTimersRef.current).length === 0 && 
            Object.keys(nonCanceledTimersRef.current).length === 0 && 
            Object.keys(axisCanceledTimersRef.current).length === 0 && 
            Object.keys(axisNonCanceledTimersRef.current).length === 0) {
          setMapAutoZoomEnabled(true);
        }
      }, 10000);
    });
  }, [DMDATAdisplayDataList, onRegionIntensityUpdate, onWarningRegionUpdate, setDMDATADisplayDataList, setDisplayDataList, setMapAutoZoomEnabled]);

  useEffect(() => {
    Object.keys(nonCanceledTimersRef.current).forEach((eventId) => {
      const target = DMDATAdisplayDataList.find((d) => d.eventId === eventId);
      if (!target || target.body?.isCanceled) {
        clearTimeout(nonCanceledTimersRef.current[eventId]);
        delete nonCanceledTimersRef.current[eventId];
      }
    });

    DMDATAdisplayDataList.forEach((data) => {
      if (data.body?.isCanceled) return;
      const eventId = data.eventId;
      if (nonCanceledTimersRef.current[eventId]) return;
      const body = data.body as EewInformation.Latest.PublicCommonBody;
      const removalTime = body.isLastInfo ? 3 * 60 * 1000 : 5 * 60 * 1000;

      nonCanceledTimersRef.current[eventId] = setTimeout(() => {
        setDMDATADisplayDataList((prev) => prev.filter((x) => x.eventId !== eventId));
        setDisplayDataList((prev) => prev.filter((x) => x.eventId !== eventId));
        setEpicenters((prev) => prev.filter((epi) => epi.eventId !== eventId));
        onRegionIntensityUpdate({}, eventId);
        onWarningRegionUpdate([], eventId);
        delete nonCanceledTimersRef.current[eventId];
        
        if (Object.keys(canceledTimersRef.current).length === 0 && 
            Object.keys(nonCanceledTimersRef.current).length === 0 && 
            Object.keys(axisCanceledTimersRef.current).length === 0 && 
            Object.keys(axisNonCanceledTimersRef.current).length === 0) {
          setMapAutoZoomEnabled(true);
        }
      }, removalTime);
    });
  }, [DMDATAdisplayDataList, onRegionIntensityUpdate, onWarningRegionUpdate, setDMDATADisplayDataList, setDisplayDataList, setMapAutoZoomEnabled]);

  // AXIS震源情報のクリーンアップ処理
  useEffect(() => {
    Object.keys(axisCanceledTimersRef.current).forEach((eventId) => {
      const stillExist = axisDisplayDataList.some(
        (d) => d.EventID === eventId && d.Flag.is_cancel
      );
      if (!stillExist) {
        clearTimeout(axisCanceledTimersRef.current[eventId]);
        delete axisCanceledTimersRef.current[eventId];
      }
    });

    axisDisplayDataList.forEach((data) => {
      if (!data.Flag.is_cancel) return;
      const eventId = data.EventID;
      if (axisCanceledTimersRef.current[eventId]) return;

      axisCanceledTimersRef.current[eventId] = setTimeout(() => {
        setAxisDisplayDataList((prev) => prev.filter((x) => x.EventID !== eventId));
        setEpicenters((prev) => prev.filter((epi) => epi.eventId !== eventId));
        onRegionIntensityUpdate({}, eventId);
        onWarningRegionUpdate([], eventId);
        delete axisCanceledTimersRef.current[eventId];
        
        if (Object.keys(canceledTimersRef.current).length === 0 && 
            Object.keys(nonCanceledTimersRef.current).length === 0 && 
            Object.keys(axisCanceledTimersRef.current).length === 0 && 
            Object.keys(axisNonCanceledTimersRef.current).length === 0) {
          setMapAutoZoomEnabled(true);
        }
      }, 10000);
    });
  }, [axisDisplayDataList, onRegionIntensityUpdate, onWarningRegionUpdate, setAxisDisplayDataList, setMapAutoZoomEnabled]);

  useEffect(() => {
    Object.keys(axisNonCanceledTimersRef.current).forEach((eventId) => {
      const target = axisDisplayDataList.find((d) => d.EventID === eventId);
      if (!target || target.Flag.is_cancel) {
        clearTimeout(axisNonCanceledTimersRef.current[eventId]);
        delete axisNonCanceledTimersRef.current[eventId];
      }
    });

    axisDisplayDataList.forEach((data) => {
      if (data.Flag.is_cancel) return;
      const eventId = data.EventID;
      if (axisNonCanceledTimersRef.current[eventId]) return;

      const isFinal = data.Flag.is_final;
      const removalTime = isFinal ? 3 * 60 * 1000 : 5 * 60 * 1000;

      axisNonCanceledTimersRef.current[eventId] = setTimeout(() => {
        setAxisDisplayDataList((prev) => prev.filter((x) => x.EventID !== eventId));
        setEpicenters((prev) => prev.filter((epi) => epi.eventId !== eventId));
        onRegionIntensityUpdate({}, eventId);
        onWarningRegionUpdate([], eventId);
        delete axisNonCanceledTimersRef.current[eventId];
        
        if (Object.keys(canceledTimersRef.current).length === 0 && 
            Object.keys(nonCanceledTimersRef.current).length === 0 && 
            Object.keys(axisCanceledTimersRef.current).length === 0 && 
            Object.keys(axisNonCanceledTimersRef.current).length === 0) {
          setMapAutoZoomEnabled(true);
        }
      }, removalTime);
    });
  }, [axisDisplayDataList, onRegionIntensityUpdate, onWarningRegionUpdate, setAxisDisplayDataList, setMapAutoZoomEnabled]);

  // 震源情報の更新処理
  const handleEpicenterUpdate = useCallback(
    ({
      eventId,
      lat,
      lng,
      icon,
      depthval,
      originTime,
      isCancel,
    }: {
      eventId: string;
      lat: number;
      lng: number;
      icon: string;
      depthval: number;
      originTime: number;
      isCancel: boolean;
    }) => {
      setEpicenters((prev) => {
        const existingIndex = prev.findIndex((p) => p.eventId === eventId);
  
        if (existingIndex === -1) {
          const newEpi: EpicenterInfo = {
            eventId,
            lat,
            lng,
            icon,
            depthval,
            originTime,
            startTime: Date.now(),
            isCancel,
          };
  
          // 自動ズームのトリガーをかける
          requestAnimationFrame(() => {
            setForceAutoZoomTrigger(Date.now());
          });
  
          return [...prev, newEpi];
        } else {
          const newEpicenters = [...prev];
          const old = newEpicenters[existingIndex];

          if (
            old.lat === lat &&
            old.lng === lng &&
            old.icon === icon &&
            old.depthval === depthval &&
            old.originTime === originTime &&
            old.isCancel === isCancel
          ) {
            return prev;
          }
          newEpicenters[existingIndex] = {
            ...old,
            lat,
            lng,
            icon,
            depthval,
            originTime,
            isCancel,
          };
          requestAnimationFrame(() => {
            setForceAutoZoomTrigger(Date.now());
          });
          return newEpicenters;
        }
      });
    },
    [setEpicenters, setForceAutoZoomTrigger]
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

  const handleAxisTokenChange = (token: string) => {
    setAxisToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("axis_access_token", token);
    }
  };

  const handleConnectAXISWebSocket = () => {
    if (!axisToken) {
      toast.error("AXISトークンを入力してください。");
      return;
    }
    connectAXISWebSocket(axisToken);
  };

  const handleAXISWebSocketDisconnect = async () => {
    await disconnectAXISWebSocket();
  };

  const renderEewDisplay = () => {
    const filterEnabled = settings.enable_intensity_filter;
    const threshold = settings.intensity_filter_value;
    const thresholdIdx = INTENSITY_ORDER.indexOf(threshold);
    
    // DMDATAの最大震度を抽出
    const filteredDmd = filterEnabled
      ? displayDataList.filter((data) => {
          const body = data.body as EewInformation.Latest.PublicCommonBody;
          const forecastMaxInt = body.intensity?.forecastMaxInt || {};
          const maxInt = forecastMaxInt && 'to' in forecastMaxInt
            ? (forecastMaxInt.to === "over" 
              ? (forecastMaxInt as { from?: string }).from || "0" 
              : (forecastMaxInt as { to?: string }).to || "0")
            : "0";
          const scale = maxInt;
          return INTENSITY_ORDER.indexOf(scale) >= thresholdIdx;
        })
      : displayDataList;
    
    // AXISの最大震度を抽出
    const filteredAxis = filterEnabled
      ? axisDisplayDataList.filter((data) => {
          return INTENSITY_ORDER.indexOf(data.Intensity) >= thresholdIdx;
        })
      : axisDisplayDataList;
    
    const allEvents: Array<{
      id: string, 
      type: 'dmdata' | 'axis', 
      data: EewInformation.Latest.Main | AXISEewInformation,
      timestamp: number
    }> = [
      ...filteredDmd.map(data => ({
        id: data.eventId,
        type: 'dmdata' as const,
        data,
        timestamp: 'reportTime' in data.body ? new Date(data.body.reportTime as string).getTime() : 0,
        serialNo: parseInt(data.serialNo || '0', 10)
      })),
      ...filteredAxis.map(data => ({
        id: data.EventID,
        type: 'axis' as const,
        data,
        timestamp: new Date(data.ReportDateTime).getTime() || 0,
        serialNo: data.Serial
      }))
    ];
    
    allEvents.sort((a, b) => {
      if (a.id !== b.id) {
        return b.timestamp - a.timestamp;
      }
      if ('serialNo' in a && 'serialNo' in b) {
        return (b.serialNo as number) - (a.serialNo as number);
      }
      return b.timestamp - a.timestamp;
    });

    const hasDMDATA = filteredDmd.length > 0;
    const hasAXIS  = filteredAxis.length > 0;
    
    if (!hasDMDATA && !hasAXIS) {
      return (
        <div className="w-full h-full min-h-screen flex justify-center items-center">
          <h1 className="text-xl">緊急地震速報受信待機中</h1>
        </div>
      );
    }

    return (
      <div className="w-full h-full min-h-screen">
        {allEvents.map((event) => (
          <div key={`${event.type}-${event.id}`}>
            {event.type === 'dmdata' ? (
              isMobile ? (
                <DMDATAMobileEewPanel
                  parsedData={event.data as EewInformation.Latest.Main}
                  isAccuracy={settings.enable_accuracy_info}
                  isLowAccuracy={settings.enable_low_accuracy_eew}
                  onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                  onRegionIntensityUpdate={(regionMap) =>
                    onRegionIntensityUpdate(regionMap, event.id)
                  }
                  onWarningRegionUpdate={(regions) =>
                    onWarningRegionUpdate(regions, event.id)
                  }
                />
              ) : (
                <DMDATAEewDisplay
                  parsedData={event.data as EewInformation.Latest.Main}
                  isAccuracy={settings.enable_accuracy_info}
                  isLowAccuracy={settings.enable_low_accuracy_eew}
                  onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                  onRegionIntensityUpdate={(regionMap) =>
                    onRegionIntensityUpdate(regionMap, event.id)
                  }
                  onWarningRegionUpdate={(regions) =>
                    onWarningRegionUpdate(regions, event.id)
                  }
                />
              )
            ) : (
              isMobile ? (
                <AXISMobileEewPanel
                  parsedData={event.data as AXISEewInformation}
                  isLowAccuracy={settings.enable_low_accuracy_eew}
                  onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                  onRegionIntensityUpdate={(regionMap) =>
                    onRegionIntensityUpdate(regionMap, event.id)
                  }
                  onWarningRegionUpdate={(regions) =>
                    onWarningRegionUpdate(regions, event.id)
                  }
                />
              ) : (
                <AXISEewDisplay
                  parsedData={event.data as AXISEewInformation}
                  isLowAccuracy={settings.enable_low_accuracy_eew}
                  onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                  onRegionIntensityUpdate={(regionMap) =>
                    onRegionIntensityUpdate(regionMap, event.id)
                  }
                  onWarningRegionUpdate={(regions) =>
                    onWarningRegionUpdate(regions, event.id)
                  }
                />
              )
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <SettingsDialog
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        handleSettingChange={handleSettingChange}
        isDMDATAConnected={isDMDATAConnected}
        onConnectDMDATAWebSocket={handleConnectDMDATAWebSocket}
        isAuthenticated={isAuthenticated}
        onDisconnectAuthentication={handleDisconnectAuthentication}
        onDisconnectDMDATAWebSocket={handleDMDATAWebSocketDisconnect}
        onSyncClock={handleClockSync}
        onResetPanelSizes={resetPanelSizes}
        isAXISConnected={isAXISConnected}
        onConnectAXISWebSocket={handleConnectAXISWebSocket}
        onDisconnectAXISWebSocket={handleAXISWebSocketDisconnect}
        axisToken={axisToken}
        onAxisTokenChange={handleAxisTokenChange}
      />

      {version && (
        <div className="fixed bottom-0 left-0 z-50 text-xs">
          ver {version}
        </div>
      )}

      <main className="h-full w-full flex flex-col">
        {isMobile && (
          <LoadingMapOverlay isVisible={!isMapLoaded} />
        )}
        {panelSizesLoaded && (
          <ResizablePanelGroup key={`panel-${panelKey}`} direction="horizontal" className="h-full" onLayout={handlePanelResize}>
            <ResizablePanel defaultSize={settings.leftPanelSize} minSize={50} className="relative">
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
            </ResizablePanel>
            
            {!isMobile ? (
              <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={settings.rightPanelSize} minSize={0} maxSize={40} className="relative">
                <div className="h-full max-h-screen overflow-y-auto">
                  {renderEewDisplay()}
                </div>
              </ResizablePanel>
            </>
            ) : (
              <div className="fixed top-0 left-0 right-0 z-40 max-h-[80vh] overflow-x-auto whitespace-nowrap">
                {DMDATAdisplayDataList.map((data) => (
                  <div key={`dmdata-${data.eventId}`} className="inline-block align-top w-[95%]">
                    <DMDATAMobileEewPanel
                      parsedData={data}
                      isAccuracy={settings.enable_accuracy_info}
                      isLowAccuracy={settings.enable_low_accuracy_eew}
                      onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                      onRegionIntensityUpdate={(regionMap) =>
                        onRegionIntensityUpdate(regionMap, data.eventId)
                      }
                      onWarningRegionUpdate={(regions) =>
                        onWarningRegionUpdate(regions, data.eventId)
                      }
                    />
                  </div>
                ))}
                
                {axisDisplayDataList.map((data) => (
                  <div key={`axis-${data.EventID}`} className="inline-block align-top w-[95%]">
                    <AXISMobileEewPanel
                      parsedData={data}
                      isLowAccuracy={settings.enable_low_accuracy_eew}
                      onEpicenterUpdate={(epi) => handleEpicenterUpdate(epi)}
                      onRegionIntensityUpdate={(regionMap) =>
                        onRegionIntensityUpdate(regionMap, data.EventID)
                      }
                      onWarningRegionUpdate={(regions) =>
                        onWarningRegionUpdate(regions, data.EventID)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </ResizablePanelGroup>
        )}
        
        {hasMounted && (
          <div className="fixed bottom-4 left-4 shadow-lg bg-white/50 dark:bg-black/50 rounded-lg border z-50">
            <div className={`flex ${isMobile ? 'flex-col' : 'space-x-3'} p-3 items-start`}>
              {isMobile ? (
                <>
                  <div className="ml-1 mb-1 justify-start space-y-1">
                    <div className="flex items-center space-x-1">
                      {isDMDATAConnected && (
                        <div className="flex items-center text-xs text-green-500 space-x-1">
                          <Send size={12} />
                          <p className="text-xs">DM-D.S.S</p>
                        </div>
                      )}
                      {isAXISConnected && (
                        <div className="flex items-center text-xs text-blue-500 space-x-1">
                          <Send size={12} />
                          <p className="text-xs">AXIS</p>
                        </div>
                      )}
                    </div>
                    <ClockDisplay
                      nowAppTimeRef={nowAppTimeRef}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                    >
                      <SettingsIcon className="h-4 w-4" />
                      設定
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={setHomePosition}
                    >
                      <LocateFixed className="h-4 w-4" />
                      ホーム
                    </Button>
                    {isDev && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded(!expanded)}
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>

                  {expanded && isDev && (
                    <div className="flex space-x-2 mb-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTest}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTest2}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTest3}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendAllTests}
                      >
                        複数
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex space-x-3 justify-start items-center">
                    <Button variant="outline" onClick={() => setShowSettings(true)}>
                      <SettingsIcon />
                    </Button>
                    <Button variant="outline" onClick={setHomePosition}>
                      <LocateFixed />
                    </Button>
                    {isDev && (
                      <>
                        <Button variant="outline" onClick={handleTest}>
                          <FlaskConical />
                        </Button>
                        <Button variant="outline" onClick={handleTest2}>
                          <FlaskConical />
                        </Button>
                        <Button variant="outline" onClick={handleTest3}>
                          <FlaskConical />
                        </Button>
                        <Button variant="outline" onClick={handleSendAllTests}>
                          複数
                        </Button>
                      </>
                    )}
                    <div className="flex flex-col">
                      <ClockDisplay
                        nowAppTimeRef={nowAppTimeRef}
                      />
                      <div className="flex items-center space-x-1">
                        {isDMDATAConnected && (
                          <div className="flex items-center text-xs text-green-500 space-x-1 text-right">
                            <Send size={16} />
                            <p>DM-D.S.S</p>
                          </div>
                        )}
                        {isAXISConnected && (
                          <div className="flex items-center text-xs text-blue-500 space-x-1 text-right">
                            <Send size={16} />
                            <p>AXIS</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
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
