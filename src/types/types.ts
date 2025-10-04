import { EewInformation } from "@dmdata/telegram-json-types";
import { MapRef } from "react-map-gl/maplibre";
import { Feature } from "geojson";

// 設定の型
export interface Settings {
  theme: "system" | "dark" | "light";
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
  leftPanelSize: number;
  rightPanelSize: number;
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
    isCancel: boolean;
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
  isCancel: boolean;
}

// EEWの細分化地域の予想震度マップ
export type RegionIntensityMap = Record<string, string>;

// マップコンポーネントのProps
export interface MapProps {
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
  onConnectDMDATAWebSocket: () => void;
  isAuthenticated: boolean;
  onDisconnectAuthentication: () => void;
  onDisconnectDMDATAWebSocket: () => Promise<void>;
  isDMDATAConnected: boolean;
  onSyncClock: () => void;
  onResetPanelSizes: () => void;
  // AXIS関連の追加
  isAXISConnected: boolean;
  onConnectAXISWebSocket: () => void;
  onDisconnectAXISWebSocket: () => Promise<void>;
  axisToken: string;
  onAxisTokenChange: (token: string) => void;
}

// WebSocketコンテキストで扱う型
export interface WebSocketContextType {
  isDMDATAConnected: boolean;
  DMDATAreceivedData: EewInformation.Latest.Main | null;
  connectDMDATAWebSocket: (DMDATAtoken: string, enableDrillTestInfo: boolean) => Promise<void>;
  disconnectDMDATAWebSocket: () => Promise<void>;
  injectdmdataTestData: (data: { body: string }) => void;
  injectaxisTestData: (data: AXISEewInformation) => void;
  passedIntensityFilterRef: React.RefObject<Set<string>>;
  isAXISConnected: boolean;
  AXISreceivedData: AXISEewInformation | null;
  connectAXISWebSocket: (AXIStoken: string) => Promise<void>;
  disconnectAXISWebSocket: () => Promise<void>;
  displayDataList: EewInformation.Latest.Main[];
  axisDisplayDataList: AXISEewInformation[];
  setAxisDisplayDataList: React.Dispatch<React.SetStateAction<AXISEewInformation[]>>;
  setDisplayDataList: React.Dispatch<React.SetStateAction<EewInformation.Latest.Main[]>>;
}

// 強震モニタ用データ
// 走時表からP/S波を割り出す
export interface TravelTableRow {
  p: number;
  s: number;
  depth: number;
  distance: number;
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

export interface SaibunFeatureWithBbox {
  feature: Feature;
  bbox: [number, number, number, number];
}

// 時計表示用のProps
export interface ClockDisplayProps {
  nowAppTimeRef: React.RefObject<number>;
}

export interface ModifiedPsWaveProps extends Omit<PsWaveProps, "nowAppTime"> {
  nowAppTimeRef: React.RefObject<number>;
  isMapMoving?: boolean;
}

export interface SchemaCheck {
  _schema: {
    type: string;
    version: string;
  };
  type: string;
}

export type AXISEewInformation = {
  Title: string;
  OriginDateTime: string;
  ReportDateTime: string;
  EventID: string;
  Serial: number;
  Hypocenter: {
    Code: number;
    Name: string;
    Coordinate: [number, number];
    Depth: string;
    Description: string;
  };
  Intensity: string;
  Magnitude: string;
  Flag: {
    is_final: boolean;
    is_cancel: boolean;
    is_training: boolean;
  };
  Forecast: AXISForecastRegion[];
  Text: string;
};

type AXISForecastRegion = {
  Code: number;
  Name: string;
  Intensity: {
    From: string;
    To: string;
    Description: string;
  };
};

export interface SettingItemProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  vertical?: boolean;
}
