import { EewInformation } from "@dmdata/telegram-json-types";

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
  homePosition: { center: [number, number]; zoom: number };
  enableKyoshinMonitor: boolean;
  onTimeUpdate?: (time: string) => void;
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
  nowAppTime: number | null;
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

// 強震モニタ用のProps
export interface KyoshinMonitorProps {
  enableKyoshinMonitor: boolean;
  isConnected: boolean;
  nowAppTime: number | null;
  onTimeUpdate?: (time: string) => void;
}

// P/S波用のProps
export interface PsWaveProps {
  epicenters: EpicenterInfo[];
  psWaveUpdateInterval: number;
  isCancel: boolean;
  ref: React.RefObject<L.Map | null> | null;
  nowAppTime: number | null;
}
