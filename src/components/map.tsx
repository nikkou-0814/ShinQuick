"use client";

import React, {
  forwardRef,
  useEffect,
  useCallback,
  useState,
  useRef
} from "react";
import { MapContainer, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import L, { LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { FeatureCollection } from "geojson";

import rawCountriesData10 from "../../public/mapdata/10mCountries.json";
import rawCountriesData50 from "../../public/mapdata/50mCountries.json";
import rawCountriesData110 from "../../public/mapdata/110mCountries.json";
import rawSaibunData from "../../public/mapdata/Saibun.json";
import rawCitiesData from "../../public/mapdata/Cities.json";

type EpicenterInfo = {
  eventId: string;
  lat: number;
  lng: number;
  icon: string;
  startTime?: number;
  originTime: number;
  depthval: number;
};

const SaibunData = rawSaibunData as FeatureCollection;
const CitiesData = rawCitiesData as FeatureCollection;

const colorList: Record<string, string> = {
  a: "#00000000",
  b: "#00000000",
  c: "#00000000",
  d: "#0000FF",
  e: "#0033FF",
  f: "#0066FF",
  g: "#0099FF",
  h: "#00CCFF",
  i: "#00FF99",
  j: "#00FF66",
  k: "#44FF00",
  l: "#88FF00",
  m: "#CCFF00",
  n: "#FFFF00",
  o: "#FFCC00",
  p: "#FF9900",
  q: "#FF6600",
  r: "#FF3300",
  s: "#FF0000",
  t: "#CC0000",
  u: "#990000",
  v: "#660000",
  w: "#330000",
  x: "#331A1A",
  y: "#663333",
  z: "#993333",
};

function ConvertStringToColor(ch: string): string {
  return colorList[ch.toLowerCase()] || "#b00201";
}

const intensityFillColors: Record<string, string> = {
  "0": "#62626B",
  "1": "#2B8EB2",
  "2": "#4CD0A7",
  "3": "#F6CB51",
  "4": "#FF9939",
  "5-": "#E52A18",
  "5+": "#C31B1B",
  "6-": "#A50C6B",
  "6+": "#930A7A",
  "7": "#5F0CA2",
  "不明": "#62626B",
};

type PsWaveItem = {
  latitude: string;
  longitude: string;
  pRadius: string;
  sRadius: string;
};

type HypoInfoItem = {
  reportTime: string;
  regionCode: string;
  regionName: string;
  longitude: string;
  isCancel: string;
  depthval: string;
  calcintensity: string;
  isFinal: string;
  isTraining: string;
  latitude: string;
  originTime: string;
  magnitude: string;
  reportNum: string;
  reportId: string;
};

type KyoshinMonitorJson = {
  realTimeData?: {
    intensity: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  psWave: {
    items?: PsWaveItem[];
  } | null;
  hypoInfo: {
    items?: HypoInfoItem[];
  } | null;
  estShindo: null | unknown;
  [key: string]: unknown;
};

if (typeof window !== "undefined") {
  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).mergeOptions({
    smoothWheelZoom: true,
    smoothSensitivity: 5,
  });

  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).SmoothWheelZoom = L.Handler.extend({
    addHooks: function () {
      L.DomEvent.on(this._map._container, "wheel", this._onWheelScroll, this);
    },
    removeHooks: function () {
      L.DomEvent.off(this._map._container, "wheel", this._onWheelScroll, this);
    },
    _onWheelScroll: function (e: WheelEvent) {
      if (!this._isWheeling) {
        this._onWheelStart(e);
      }
      this._onWheeling(e);
    },
    _onWheelStart: function (e: WheelEvent) {
      const map = this._map;
      this._isWheeling = true;
      this._wheelMousePosition = map.mouseEventToContainerPoint(e);
      this._centerPoint = map.getSize()._divideBy(2);
      this._startLatLng = map.containerPointToLatLng(this._centerPoint);
      this._wheelStartLatLng = map.containerPointToLatLng(this._wheelMousePosition);
      this._startZoom = map.getZoom();
      this._moved = false;
      this._zooming = true;

      map._stop();
      if (map._panAnim) {
        map._panAnim.stop();
      }

      this._goalZoom = map.getZoom();
      this._prevCenter = map.getCenter();
      this._prevZoom = map.getZoom();

      this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    },
    _onWheeling: function (e: WheelEvent) {
      const map = this._map;
      this._goalZoom =
        this._goalZoom +
        L.DomEvent.getWheelDelta(e) * 0.003 * map.options.smoothSensitivity;

      if (this._goalZoom < map.getMinZoom() || this._goalZoom > map.getMaxZoom()) {
        this._goalZoom = map._limitZoom(this._goalZoom);
      }
      this._wheelMousePosition = map.mouseEventToContainerPoint(e);

      clearTimeout(this._timeoutId);
      this._timeoutId = setTimeout(this._onWheelEnd.bind(this), 200);

      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
    },
    _onWheelEnd: function () {
      this._isWheeling = false;
      cancelAnimationFrame(this._zoomAnimationId);
      this._map._moveEnd(true);
    },
    _updateWheelZoom: function () {
      const map = this._map;
      if (!map.getCenter().equals(this._prevCenter) || map.getZoom() !== this._prevZoom) {
        return;
      }

      this._zoom = map.getZoom() + (this._goalZoom - map.getZoom()) * 0.3;
      this._zoom = Math.floor(this._zoom * 100) / 100;

      const delta = this._wheelMousePosition.subtract(this._centerPoint);
      if (delta.x === 0 && delta.y === 0) return;

      if (map.options.smoothWheelZoom === "center") {
        this._center = this._startLatLng;
      } else {
        this._center = map.unproject(
          map.project(this._wheelStartLatLng, this._zoom).subtract(delta),
          this._zoom
        );
      }

      if (!this._moved) {
        map._moveStart(true, false);
        this._moved = true;
      }

      map._move(this._center, this._zoom);
      this._prevCenter = map.getCenter();
      this._prevZoom = map.getZoom();

      this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    },
  });

  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).addInitHook(
    "addHandler",
    "smoothWheelZoom",
    (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).SmoothWheelZoom
  );
}

async function importTable(): Promise<Array<{ p: number; s: number; depth: number; distance: number }>> {
  const res = await fetch("/tjma2001.txt");
  const text = await res.text();
  const lines = text.trim().split("\n").map(line => line.trim().replace(/\s+/g, " "));
  return lines.map(line => {
    const s = line.split(" ");
    return {
      p: parseFloat(s[1]),
      s: parseFloat(s[3]),
      depth: parseInt(s[4], 10),
      distance: parseInt(s[5], 10),
    };
  });
}

function getValue(
  table: Array<{ p: number; s: number; depth: number; distance: number }>,
  depth: number,
  time: number
): [number, number] {
  if (depth > 700 || time > 2000) {
    console.log("しきい値超え", { depth, time });
    return [NaN, NaN];
  }


  const values = table.filter(x => x.depth === depth);
  console.log("対象のテーブルの行", values);
  if (values.length === 0) {
    console.log("該当するレコードがありません");
    return [NaN, NaN];
  }

  // P波
  const pCandidatesBefore = values.filter(x => x.p <= time);
  const pCandidatesAfter = values.filter(x => x.p >= time);
  console.log("P波の候補(前)", pCandidatesBefore);
  console.log("P波の候補(後)", pCandidatesAfter);
  const p1 = pCandidatesBefore[pCandidatesBefore.length - 1];
  const p2 = pCandidatesAfter[0];
  if (!p1 || !p2) {
    console.log("P波候補が足りません", { p1, p2 });
    return [NaN, NaN];
  }
  console.log("P波の補間に使う値", { p1, p2 });
  const pDistance = ((time - p1.p) / (p2.p - p1.p)) * (p2.distance - p1.distance) + p1.distance;
  console.log("計算したP波の距離", pDistance);

  // S波
  const sCandidatesBefore = values.filter(x => x.s <= time);
  const sCandidatesAfter = values.filter(x => x.s >= time);
  console.log("S波の候補(前)", sCandidatesBefore);
  console.log("S波の候補(後)", sCandidatesAfter);
  const s1 = sCandidatesBefore[sCandidatesBefore.length - 1];
  const s2 = sCandidatesAfter[0];
  if (!s1 || !s2) {
    console.log("S波候補が足りません", { s1, s2 });
    return [pDistance, NaN];
  }
  console.log("S波の補間に使う値", { s1, s2 });
  const sDistance = ((time - s1.s) / (s2.s - s1.s)) * (s2.distance - s1.distance) + s1.distance;
  console.log("計算したS波の距離", sDistance);

  return [pDistance, sDistance];
}

function UserInteractionDetector({
  onUserInteractionStart,
  onUserInteractionEnd,
}: {
  onUserInteractionStart: () => void;
  onUserInteractionEnd: () => void;
}) {
  useMapEvents({
    dragstart: onUserInteractionStart,
    zoomstart: onUserInteractionStart,
    dragend: onUserInteractionEnd,
    zoomend: onUserInteractionEnd,
  });
  return null;
}

function KyoshinMonitor({
  enableKyoshinMonitor,
  onTimeUpdate,
  isConnected,
  autoZoomEnabled,
}: {
  enableKyoshinMonitor: boolean;
  onTimeUpdate?: (time: string) => void;
  isConnected: boolean;
  autoZoomEnabled: boolean;
}) {
  const map = useMap();
  const [pointList, setPointList] = useState<Array<[number, number]>>([]);
  const [kmoniData, setKmoniData] = useState<KyoshinMonitorJson | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(map.getZoom());
  const layerRef = useRef<LayerGroup | null>(null);
  const waveLayerRef = useRef<LayerGroup | null>(null);
  const kyoshinMonitorAutoZoomViewRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);

  useMapEvents({
    zoomend: () => {
      setZoomLevel(map.getZoom());
    },
  });

  const getRadiusForZoom = (zoom: number): number => {
    if (zoom > 10) return 12;
    if (zoom > 9) return 10;
    if (zoom > 8) return 8;
    if (zoom > 7) return 6;
    if (zoom > 6) return 3;
    if (zoom > 5) return 1.5;
    return 0.3;
  };

  // SiteList
  useEffect(() => {
    if (!enableKyoshinMonitor) return;

    const fetchSiteList = async () => {
      try {
        const res = await fetch(
          "https://weather-kyoshin.east.edge.storage-yahoo.jp/SiteList/sitelist.json"
        );
        if (!res.ok) {
          console.warn("SiteList fetch error:", res.status, res.statusText);
          return;
        }
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          setPointList(data.items);
        } else {
          console.warn("Unknown SiteList Format", data);
        }
      } catch (err) {
        console.error("fetchSiteList error:", err);
      }
    };

    fetchSiteList();
  }, [enableKyoshinMonitor]);

  // KyoshinMonitor
  useEffect(() => {
    if (!enableKyoshinMonitor) {
      if (layerRef.current) {
        layerRef.current.clearLayers();
        map.removeLayer(layerRef.current);
      }
      if (waveLayerRef.current) {
        waveLayerRef.current.clearLayers();
        map.removeLayer(waveLayerRef.current);
      }
      return;
    }
    let isMounted = true;

    const fetchKyoshinMonitorData = async () => {
      try {
        const date = new Date();
        date.setSeconds(date.getSeconds() - 2);
        const nowTime =
          date.getFullYear().toString() +
          ("0" + (date.getMonth() + 1)).slice(-2) +
          ("0" + date.getDate()).slice(-2) +
          ("0" + date.getHours()).slice(-2) +
          ("0" + date.getMinutes()).slice(-2) +
          ("0" + date.getSeconds()).slice(-2);

        const nowDay =
          date.getFullYear().toString() +
          ("0" + (date.getMonth() + 1)).slice(-2) +
          ("0" + date.getDate()).slice(-2);

        const url = `https://weather-kyoshin.east.edge.storage-yahoo.jp/RealTimeData/${nowDay}/${nowTime}.json`;

        const res = await fetch(url);
        if (!res.ok) {
          console.warn("RealTimeData fetch error:", res.status, res.statusText);
          return;
        }
        const data: KyoshinMonitorJson = await res.json();
        if (isMounted) {
          setKmoniData(data);
          if (onTimeUpdate) {
            if (data.realTimeData?.timestamp) {
              onTimeUpdate(data.realTimeData.timestamp);
            } else {
              const fallbackTime = new Date().toLocaleString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              onTimeUpdate(fallbackTime);
            }
          }
        }
      } catch (err) {
        console.error("KyoshinMonitor fetch error:", err);
      }
    };

    fetchKyoshinMonitorData();
    const intervalId = setInterval(fetchKyoshinMonitorData, 1000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      if (waveLayerRef.current) {
        map.removeLayer(waveLayerRef.current);
      }
    };
  }, [map, enableKyoshinMonitor, onTimeUpdate]);

  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    if (!kmoniData?.realTimeData?.intensity) return;
    if (pointList.length === 0) return;

    if (!layerRef.current) {
      layerRef.current = L.layerGroup();
    }
    layerRef.current.clearLayers();

    const radiusForZoom = getRadiusForZoom(zoomLevel);
    const intensityStr = kmoniData.realTimeData.intensity;

    pointList.forEach((pt, idx) => {
      const [lat, lng] = pt;
      const char = intensityStr.charAt(idx) || "a";
      const circle = L.circleMarker([lat, lng], {
        radius: radiusForZoom,
        color: ConvertStringToColor(char),
        fillOpacity: 1,
      });
      layerRef.current?.addLayer(circle);
    });

    layerRef.current.addTo(map);
  }, [map, kmoniData, zoomLevel, pointList, enableKyoshinMonitor]);

  // P/S波 震源 自動ズーム
  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    if (isConnected) {
      if (waveLayerRef.current) {
        waveLayerRef.current.clearLayers();
        map.removeLayer(waveLayerRef.current);
      }
      return;
    }

    if (!kmoniData?.psWave?.items || kmoniData.psWave.items.length === 0) {
      if (waveLayerRef.current) {
        waveLayerRef.current.clearLayers();
      }
      return;
    }
    if (!waveLayerRef.current) {
      waveLayerRef.current = L.layerGroup();
    }
    waveLayerRef.current.clearLayers();

    const epicenterIcon = L.icon({
      iconUrl: "/shingen.png",
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      className: "blink",
    });

    kmoniData.psWave.items.forEach((item) => {
      const latStr = item.latitude;
      const lngStr = item.longitude;
      const pRadius = parseFloat(item.pRadius);
      const sRadius = parseFloat(item.sRadius);

      const latVal =
        (latStr.startsWith("N") ? 1 : -1) * parseFloat(latStr.slice(1));
      const lngVal =
        (lngStr.startsWith("E") ? 1 : -1) * parseFloat(lngStr.slice(1));

      const epicenterMarker = L.marker([latVal, lngVal], {
        icon: epicenterIcon,
      });
      waveLayerRef.current?.addLayer(epicenterMarker);

      const pCircle = L.circle([latVal, lngVal], {
        radius: pRadius * 1000,
              color: "#0000ff",
              weight: 3,
              opacity: 1,
              fillOpacity: 0,
        pane: "psWavePane",
      });
      waveLayerRef.current?.addLayer(pCircle);

      const sCircle = L.circle([latVal, lngVal], {
        radius: sRadius * 1000,
        color: "#ff0000",
        weight: 6,
        opacity: 1,
        fillColor: "#ff0000",
        fillOpacity: 0.2,
        pane: "psWavePane",
      });
      waveLayerRef.current?.addLayer(sCircle);
    });

    waveLayerRef.current.addTo(map);

    if (autoZoomEnabled) {
      const epicenterPositions = kmoniData.psWave.items.map((item) => {
        const latVal = (item.latitude.startsWith("N") ? 1 : -1) * parseFloat(item.latitude.slice(1));
        const lngVal = (item.longitude.startsWith("E") ? 1 : -1) * parseFloat(item.longitude.slice(1));
        return [latVal, lngVal] as [number, number];
      });

      if (epicenterPositions.length > 0) {
        if (epicenterPositions.length === 1) {
          map.setView(epicenterPositions[0], 8);
          kyoshinMonitorAutoZoomViewRef.current = {
            center: new L.LatLng(epicenterPositions[0][0], epicenterPositions[0][1]),
            zoom: 8,
          };
        } else {
          const bounds: L.LatLngBounds = L.latLngBounds(epicenterPositions);
          map.fitBounds(bounds, { maxZoom: 10 });
          map.once("moveend", () => {
            kyoshinMonitorAutoZoomViewRef.current = {
              center: map.getCenter(),
              zoom: map.getZoom(),
            };
          });
        }
      }
    }
  }, [enableKyoshinMonitor, kmoniData, map, isConnected, autoZoomEnabled]);

  useEffect(() => {
    if (autoZoomEnabled && kyoshinMonitorAutoZoomViewRef.current) {
      const { center, zoom } = kyoshinMonitorAutoZoomViewRef.current;
      map.setView(center, zoom);
    }
  }, [autoZoomEnabled, map]);

  return null;
}

function MapInner({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
  homePosition: { center: [number, number]; zoom: number };
}): null {
  const map = useMap();

  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });

  useEffect(() => {
    if (!map) return;
    map.options.scrollWheelZoom = false;
    (map.options as L.MapOptions & { smoothWheelZoom?: boolean }).smoothWheelZoom = true;
    (map.options as L.MapOptions & { smoothSensitivity?: number }).smoothSensitivity = 5;
  }, [map]);

  return null;
}

function CreatePsWavePane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("psWavePane")) {
      map.createPane("psWavePane");
      map.getPane("psWavePane")!.style.zIndex = "1000";
    }
  }, [map]);
  return null;
}

interface MapProps {
  homePosition: { center: [number, number]; zoom: number };
  enableKyoshinMonitor: boolean;
  onTimeUpdate?: (time: string) => void;
  isConnected: boolean;
  epicenters: EpicenterInfo[];
  originDt?: Date | null;
  regionIntensityMap: Record<string, string>;
  enableMapIntensityFill: boolean;
  enableDynamicZoom: boolean;
  mapAutoZoom: boolean;
  mapResolution: "10m" | "50m" | "110m";
  onAutoZoomChange?: (value: boolean) => void;
  forceAutoZoomTrigger?: number;
  enableMapWarningArea: boolean;
  warningRegionCodes: string[];
}

const Map = forwardRef<L.Map, MapProps>(
  (
    {
      homePosition,
      enableKyoshinMonitor,
      onTimeUpdate,
      isConnected,
      epicenters,
      regionIntensityMap,
      enableMapIntensityFill,
      enableDynamicZoom,
      mapAutoZoom,
      mapResolution,
      onAutoZoomChange,
      forceAutoZoomTrigger,
      enableMapWarningArea,
      warningRegionCodes,
    },
    ref
  ) => {
    const [currentZoom, setCurrentZoom] = useState(homePosition.zoom);
    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme || "light";
    const countriesData =
      mapResolution === "10m"
        ? {
            type: "FeatureCollection" as const,
            features: (rawCountriesData10 as { geometries: GeoJSON.Geometry[] }).geometries.map(
              (geometry: GeoJSON.Geometry) => ({
                type: "Feature",
                geometry,
                properties: {},
              })
            ),
          }
        : mapResolution === "50m"
        ? (rawCountriesData50 as unknown as FeatureCollection)
        : (rawCountriesData110 as unknown as FeatureCollection);  
    const [autoZoomEnabled, setAutoZoomEnabled] = useState(
      enableDynamicZoom ? mapAutoZoom : false
    );
    const autoZoomTimeoutRef = useRef<number | null>(null);
    const autoZoomViewRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);
    const autoZoomActionTimeoutRef = useRef<number | null>(null);
    const [travelTable, setTravelTable] = useState<Array<{ p: number; s: number; depth: number; distance: number }>>([]);
    const epicenterLayerRef = useRef<LayerGroup | null>(null);
    const waveCirclesLayerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
      if (!enableDynamicZoom) {
        setAutoZoomEnabled(false);
      } else {
        setAutoZoomEnabled(mapAutoZoom);
      }
    }, [enableDynamicZoom, mapAutoZoom]);

    useEffect(() => {
      const mapInstance = (ref as React.MutableRefObject<L.Map | null>).current;
      if (!mapInstance) return;
      if (!mapInstance.getPane("psWavePane")) {
        mapInstance.createPane("psWavePane");
        mapInstance.getPane("psWavePane")!.style.zIndex = "1000";
      }
    }, [ref]);    

    useEffect(() => {
      if (forceAutoZoomTrigger && enableDynamicZoom) {
        setAutoZoomEnabled(true);
        if (onAutoZoomChange) {
          onAutoZoomChange(true);
        }
      }
    }, [forceAutoZoomTrigger, onAutoZoomChange, enableDynamicZoom]);

    useEffect(() => {
      return () => {
        if (autoZoomTimeoutRef.current) {
          clearTimeout(autoZoomTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (onAutoZoomChange) {
        onAutoZoomChange(autoZoomEnabled);
      }
    }, [autoZoomEnabled, onAutoZoomChange]);
    
    const handleUserInteractionStart = useCallback(() => {
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
      }
      if (enableDynamicZoom) {
        setAutoZoomEnabled(false);
      }
    }, [enableDynamicZoom]);
    
    const handleUserInteractionEnd = useCallback(() => {
      if (autoZoomTimeoutRef.current) {
        clearTimeout(autoZoomTimeoutRef.current);
      }
      if (enableDynamicZoom) {
        autoZoomTimeoutRef.current = window.setTimeout(() => {
          setAutoZoomEnabled(true);
          if (onAutoZoomChange) {
            onAutoZoomChange(true);
          }
        }, 10000);
      }
    }, [enableDynamicZoom, onAutoZoomChange]);

    useEffect(() => {
      if (typeof window !== "undefined") {
        const mapElement = document.querySelector(".leaflet-container");
        if (mapElement) {
          (mapElement as HTMLElement).style.backgroundColor =
            theme === "dark" ? "#18181C" : "#AAD3DF";
        }
      }
    }, [theme]);

    useEffect(() => {
      importTable()
        .then(table => setTravelTable(table))
        .catch(err => console.error("走時表の読み込み失敗", err));
    }, []);

    // 円を更新
    useEffect(() => {
      if (!(ref as React.MutableRefObject<L.Map | null>).current) return;
      const mapInstance = (ref as React.MutableRefObject<L.Map | null>).current;

      if (!waveCirclesLayerRef.current && mapInstance) {
        waveCirclesLayerRef.current = L.layerGroup().addTo(mapInstance);
      }

      const intervalId = setInterval(() => {
        if (!travelTable || travelTable.length === 0 || epicenters.length === 0) {
          waveCirclesLayerRef.current?.clearLayers();
          return;
        }

        waveCirclesLayerRef.current?.clearLayers();

        epicenters.forEach((epi) => {
          const elapsedTime = (Date.now() - epi.originTime) / 1000;
          const [pDistance, sDistance] = getValue(travelTable, epi.depthval, elapsedTime);

          if (!isNaN(pDistance)) {
            L.circle([epi.lat, epi.lng], {
              radius: pDistance * 1000,
              color: "#0000ff",
              weight: 3,
              opacity: 1,
              fillOpacity: 0,
              pane: "psWavePane",
            }).addTo(waveCirclesLayerRef.current!);
          }

          if (!isNaN(sDistance)) {
            L.circle([epi.lat, epi.lng], {
              radius: sDistance * 1000,
              color: "#ff0000",
              weight: 6,
              opacity: 1,
              fillColor: "#ff0000",
              fillOpacity: 0.2,
              pane: "psWavePane",
            }).addTo(waveCirclesLayerRef.current!);
          }
        });
      }, 10);

      return () => clearInterval(intervalId);
    }, [epicenters, travelTable, ref]);    

    useEffect(() => {
      if (!ref || !(ref as React.MutableRefObject<L.Map | null>).current) return;
      const mapInstance = (ref as React.MutableRefObject<L.Map | null>).current;

      if (!epicenterLayerRef.current) {
        if (mapInstance) {
          epicenterLayerRef.current = L.layerGroup().addTo(mapInstance);
        }
      }
      epicenterLayerRef.current?.clearLayers();

      epicenters.forEach((epi) => {
        const iconObj = L.icon({
          iconUrl: epi.icon,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          className: "blink",
        });
        const marker = L.marker([epi.lat, epi.lng], { icon: iconObj });
        epicenterLayerRef.current?.addLayer(marker);
      });

      if (enableDynamicZoom && autoZoomEnabled) {
        const latlngs = epicenters.map((epi) => [epi.lat, epi.lng]) as [number, number][];

        const polygonsBounds = L.latLngBounds([]);
        SaibunData.features.forEach((feature) => {
          const code = feature.properties?.code;
          if (!code) return;
          if (!(code in regionIntensityMap)) return;

          const layer = L.geoJSON(feature as GeoJSON.GeoJsonObject);
          const layerBounds = layer.getBounds();
          polygonsBounds.extend(layerBounds);
        });

        const finalBounds = L.latLngBounds(latlngs);
        finalBounds.extend(polygonsBounds);

        if (epicenters.length === 1) {
          const zoom = epicenters[0].depthval > 150 ? 5 : 7;
          if (finalBounds.isValid()) {
            mapInstance?.fitBounds(finalBounds, {
              maxZoom: zoom,
              padding: [50, 50],
            });
          } else {
            // 細分区の指定がないケース
            mapInstance?.setView([epicenters[0].lat, epicenters[0].lng], zoom);
          }
        } else if (epicenters.length > 1) {
          // 震源が複数
          const maxZoom = epicenters.some((epi) => epi.depthval > 150) ? 5 : 9;
          if (finalBounds.isValid()) {
            mapInstance?.fitBounds(finalBounds, {
              padding: [50, 50],
              maxZoom,
            });
          } else {
            // 細分区 + 震源なし等の想定がある場合
            mapInstance?.setView([35, 136], 5);
          }
        } else {
          // 震源が空の場合でも、細分区にズーム
          if (polygonsBounds.isValid()) {
            mapInstance?.fitBounds(polygonsBounds, {
              padding: [50, 50],
              maxZoom: 10,
            });
          } else {
            mapInstance?.setView([35, 136], 5);
          }
        }

        mapInstance?.once("moveend", () => {
          autoZoomViewRef.current = {
            center: mapInstance.getCenter(),
            zoom: mapInstance.getZoom(),
          };
        });
      }
    }, [epicenters, ref, autoZoomEnabled, enableDynamicZoom, regionIntensityMap]);    

    useEffect(() => {
      const timeoutId = autoZoomActionTimeoutRef.current;
      return () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      };
    }, [autoZoomEnabled, ref]);

    const handleZoomChange = useCallback((zoom: number) => {
      setCurrentZoom(zoom);
    }, []);

    const shouldShowCities = currentZoom >= 10;

    const saibunStyle = (
      feature?: GeoJSON.Feature<GeoJSON.Geometry, { code?: string }>
    ) => {
      const defaultStyle = {
        color: theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
        weight: 0.6,
        fillColor: theme === "dark" ? "#2C2C2C" : "#FFF",
        fillOpacity: 0.9,
      };
      if (enableMapWarningArea && feature?.properties?.code) {
        if (warningRegionCodes.includes(String(feature.properties.code))) {
          return {
            ...defaultStyle,
            fillColor: "#FF0000",
            fillOpacity: 0.9,
          };
        }
      }    

      if (!enableMapIntensityFill) {
        return defaultStyle;
      }
      if (!feature?.properties?.code) {
        return defaultStyle;
      }
      const regionCode = String(feature.properties.code);
      const intensity = regionIntensityMap[regionCode];
      if (!intensity) {
        return defaultStyle;
      }
      const fillColor = intensityFillColors[intensity] || "#62626B";
      return {
        ...defaultStyle,
        fillColor,
        fillOpacity: 1,
      };
    };

    return (
      <MapContainer
        ref={ref}
        center={homePosition.center}
        zoom={homePosition.zoom}
        style={{ width: "100%", height: "100vh", zIndex: 0 }}
        scrollWheelZoom={false}
        preferCanvas
        zoomControl={false}
      >
        <CreatePsWavePane />

        <UserInteractionDetector
          onUserInteractionStart={handleUserInteractionStart}
          onUserInteractionEnd={handleUserInteractionEnd}
        />
        <MapInner onZoomChange={handleZoomChange} homePosition={homePosition} />

        <KyoshinMonitor
          enableKyoshinMonitor={enableKyoshinMonitor}
          onTimeUpdate={onTimeUpdate}
          isConnected={isConnected}
          autoZoomEnabled={autoZoomEnabled}
        />

        {/*<h1 className="absolute top-0 left-0 p-0 m-0 text-[250px] text-center text-gray-400">TEST</h1>*/}

        {/* 世界図 */}
        <GeoJSON
          key={`worldMap-${mapResolution}`}
          data={countriesData}
          style={{
            color: theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
            fillColor: theme === "dark" ? "#252525" : "#737A8A",
            fillOpacity: 0.6,
            weight: 0.8,
          }}
        />

        {/* 日本　細分区 */}
        <GeoJSON
          data={SaibunData}
          style={saibunStyle}
        />

        {/* 市町村界（10ズーム以上で表示） */}
        {shouldShowCities && (
          <GeoJSON
            data={CitiesData}
            style={{
              color: theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
              fillOpacity: 0,
              weight: theme === "dark" ? 0.3 : 0.4,
            }}
          />
        )}
      </MapContainer>
    );
  }
);

Map.displayName = "Map";
export default Map;
