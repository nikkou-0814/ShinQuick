import { EewInformation } from "@dmdata/telegram-json-types";
import { MapRef } from "react-map-gl/maplibre";
import { Feature } from "geojson";

// 設定の型
export interface Settings {
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
  ps_wave_update_interval: number;
  enable_intensity_filter: boolean;
  intensity_filter_value: string;
}

// EEW表示用コンポーネントに渡すprops
export interface EewDisplayProps {
  parsedData: EewInformation.Latest.Main | null;
  isAccuracy?: boolean;
  isLowAccuracy?: boolean;
  onEpicenterUpdate?: (info: {
    eventId: string;
    serialNo: string;
    lat: number;
    lng: number;
    icon: string;
    depthval: number;
    originTime: number;
  }) => void;
  onRegionIntensityUpdate?: (regionMap: Record<string, string>) => void;
  onWarningRegionUpdate?: (warningRegions: { code: string; name: string }[]) => void;
}

// 震源アイコンなどで使う情報
export interface EpicenterInfo {
  eventId: string;
  lat: number;
  lng: number;
  icon: string;
  startTime?: number;
  originTime: number;
  depthval: number;
}

// EEWの細分化地域の予想震度マップ
export type RegionIntensityMap = Record<string, string>;

// マップコンポーネントのProps
export interface MapProps {
  enableKyoshinMonitor: boolean;
  isConnected: boolean;
  epicenters: EpicenterInfo[];
  regionIntensityMap: RegionIntensityMap;
  enableMapIntensityFill: boolean;
  enableDynamicZoom: boolean;
  mapAutoZoom: boolean;
  mapResolution: "10m" | "50m" | "110m";
  onAutoZoomChange?: (value: boolean) => void;
  forceAutoZoomTrigger?: number;
  enableMapWarningArea: boolean;
  warningRegionCodes: string[];
  isCancel: boolean;
  psWaveUpdateInterval: number;
  nowAppTimeRef: React.RefObject<number>;
  onMapLoad?: () => void;
}

// 設定ダイアログ用のProps
export interface SettingsDialogProps {
  showSettings: boolean;
  setShowSettings: (value: boolean) => void;
  settings: Settings;
  handleSettingChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onConnectWebSocket: () => void;
  isAuthenticated: boolean;
  onDisconnectAuthentication: () => void;
  onDisconnectWebSocket: () => Promise<void>;
  isConnected: boolean;
  onSyncClock: () => void;
}

// WebSocketコンテキストで扱う型
export interface WebSocketContextType {
  isConnected: boolean;
  receivedData: EewInformation.Latest.Main | null;
  connectWebSocket: (token: string, enableDrillTestInfo: boolean) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  injectTestData: (data: { body: string }) => void;
  passedIntensityFilterRef: React.RefObject<Set<string>>;
}

// 強震モニタ用データ
export interface KmoniData {
  realTimeData?: {
    intensity?: string;
    timestamp?: string;
  };
  psWave?: {
    items?: Array<{
      latitude: string;
      longitude: string;
      pRadius: string;
      sRadius: string;
    }>;
  };
}

// 走時表からP/S波を割り出す
export interface TravelTableRow {
  p: number;
  s: number;
  depth: number;
  distance: number;
}

// 強震モニタ用のベースProps
export interface BaseKyoshinMonitorProps {
  enableKyoshinMonitor: boolean;
  isConnected: boolean;
  nowAppTimeRef: React.RefObject<number>;
}

// P/S波用のProps
export interface PsWaveProps {
  epicenters: EpicenterInfo[];
  psWaveUpdateInterval: number;
  isCancel: boolean;
  ref: React.ForwardedRef<MapRef>;
  nowAppTimeRef: React.RefObject<number>;
}

// 細分化地域のプロパティ用型
export interface SaibunProperties {
  code?: string | number;
  computedFillColor?: string;
  computedFillOpacity?: number;
  [key: string]: unknown;
}

// 強震モニタ観測点用型
export interface SiteListData {
  items: [number, number][];
}

// 強震モニタ用のProps
export type KyoshinMonitorProps = Omit<BaseKyoshinMonitorProps, "nowAppTime"> & {
  nowAppTimeRef: React.RefObject<number>;
};

export interface SaibunFeatureWithBbox {
  feature: Feature;
  bbox: [number, number, number, number];
}

// 時計表示用のProps
export interface ClockDisplayProps {
  nowAppTimeRef: React.RefObject<number>;
  KyoshinMonitor: boolean;
}

export interface ModifiedPsWaveProps extends Omit<PsWaveProps, "nowAppTime"> {
  nowAppTimeRef: React.RefObject<number>;
  isMapMoving?: boolean;
}