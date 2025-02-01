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

import rawCountriesData from "../../public/mapdata/Countries.json";
import rawJapanData from "../../public/mapdata/Japan.json";
import rawSaibunData from "../../public/mapdata/Saibun.json";
import rawCitiesData from "../../public/mapdata/Cities.json";

type EpicenterInfo = {
  eventId: string;
  lat: number;
  lng: number;
  icon: string;
  startTime?: number;
  depthval: number;
};

const CountriesData = rawCountriesData as FeatureCollection;
const JapanData = rawJapanData as FeatureCollection;
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

function UserInteractionDetector({
  onUserInteraction
}: {
  onUserInteraction: () => void;
}) {
  useMapEvents({
    dragstart: onUserInteraction,
    zoomstart: onUserInteraction,
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
        date.setSeconds(date.getSeconds() - 2); // 2秒前のデータを取得
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

  // PS波 & 震源 & 自動ズーム
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

      // 震源
      const epicenterMarker = L.marker([latVal, lngVal], {
        icon: epicenterIcon,
      });
      waveLayerRef.current?.addLayer(epicenterMarker);

      // P波
      const pCircle = L.circle([latVal, lngVal], {
        radius: pRadius * 1000,
        color: "#0066FF",
        fill: false,
      });
      waveLayerRef.current?.addLayer(pCircle);

      // S波
      const sCircle = L.circle([latVal, lngVal], {
        radius: sRadius * 1000,
        color: "#FF0000",
        fill: true,
        fillColor: "#FFCCCC",
        fillOpacity: 0.3,
      });
      waveLayerRef.current?.addLayer(sCircle);
    });

    waveLayerRef.current.addTo(map);

    if (autoZoomEnabled) {
      const epicenterPositions = kmoniData.psWave.items.map((item) => {
        const latVal =
          (item.latitude.startsWith("N") ? 1 : -1) * parseFloat(item.latitude.slice(1));
        const lngVal =
          (item.longitude.startsWith("E") ? 1 : -1) * parseFloat(item.longitude.slice(1));
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
          setTimeout(() => {
            kyoshinMonitorAutoZoomViewRef.current = {
              center: map.getCenter(),
              zoom: map.getZoom(),
            };
          }, 500);
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

interface MapProps {
  homePosition: { center: [number, number]; zoom: number };
  enableKyoshinMonitor: boolean;
  onTimeUpdate?: (time: string) => void;
  isConnected: boolean;
  epicenters: EpicenterInfo[];
  originDt?: Date | null;
}

const Map = forwardRef<L.Map, MapProps>(
  (
    {
      homePosition,
      enableKyoshinMonitor,
      onTimeUpdate,
      isConnected,
      epicenters,
    },
    ref
  ) => {
    const [currentZoom, setCurrentZoom] = useState(homePosition.zoom);
    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme || "light";
    const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
    const autoZoomTimeoutRef = useRef<number | null>(null);
    const autoZoomViewRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);

    const disableAutoZoomTemporarily = () => {
      setAutoZoomEnabled(false);
      if (autoZoomTimeoutRef.current !== null) {
        clearTimeout(autoZoomTimeoutRef.current);
      }
      autoZoomTimeoutRef.current = window.setTimeout(() => {
        setAutoZoomEnabled(true);
      });
    };

    const epicenterLayerRef = useRef<LayerGroup | null>(null);

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

      if (epicenters.length === 1) {
        const zoom = epicenters[0].depthval > 150 ? 6 : 8;
        mapInstance?.setView([epicenters[0].lat, epicenters[0].lng], zoom);
        autoZoomViewRef.current = {
          center: new L.LatLng(epicenters[0].lat, epicenters[0].lng),
          zoom,
        };
      } else if (epicenters.length > 1) {
        const latlngs = epicenters.map((epi) => [epi.lat, epi.lng]) as [number, number][];
        const bounds = L.latLngBounds(latlngs);
        mapInstance?.fitBounds(bounds, { padding: [50, 50], maxZoom: epicenters.some(epi => epi.depthval > 150) ? 6 : 10 });
        setTimeout(() => {
          autoZoomViewRef.current = {
            center: mapInstance?.getCenter() ?? new L.LatLng(0, 0),
            zoom: mapInstance?.getZoom() ?? 0,
          };
        }, 500);
        mapInstance?.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: epicenters.some(epi => epi.depthval > 150) ? 6 : 10
        });
        mapInstance?.once("moveend", () => {
          autoZoomViewRef.current = {
            center: mapInstance.getCenter(),
            zoom: mapInstance.getZoom(),
          };
        });
      } else {
        mapInstance?.setView([35, 136], 5);
        autoZoomViewRef.current = {
          center: new L.LatLng(35, 136),
          zoom: 5,
        };
      }
    }, [epicenters, ref]);

    useEffect(() => {
      if (
        autoZoomEnabled &&
        ref &&
        (ref as React.MutableRefObject<L.Map | null>).current &&
        autoZoomViewRef.current
      ) {
        const mapInstance = (ref as React.MutableRefObject<L.Map | null>).current;
        const { center, zoom } = autoZoomViewRef.current;
        mapInstance?.setView(center, zoom);
      }
    }, [autoZoomEnabled, ref]);

    const handleZoomChange = useCallback((zoom: number) => {
      setCurrentZoom(zoom);
    }, []);

    const shouldShowCities = currentZoom >= 10;
    const shouldShowSaibun = currentZoom >= 5;

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
        <UserInteractionDetector onUserInteraction={disableAutoZoomTemporarily} />
        <MapInner onZoomChange={handleZoomChange} homePosition={homePosition} />

        <KyoshinMonitor
          enableKyoshinMonitor={enableKyoshinMonitor}
          onTimeUpdate={onTimeUpdate}
          isConnected={isConnected}
          autoZoomEnabled={autoZoomEnabled}
        />

        <GeoJSON
          data={CountriesData}
          style={{
            color: theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
            fillColor: theme === "dark" ? "#252525" : "#737A8A",
            fillOpacity: 0.6,
            weight: 0.8,
          }}
        />

        <GeoJSON
          data={JapanData}
          style={{
            color: theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
            fillColor: theme === "dark" ? "#2C2C2C" : "#FFF",
            fillOpacity: 0.9,
            weight: 0.6,
          }}
        />

        {shouldShowSaibun && (
          <GeoJSON
            data={SaibunData}
            style={{
              color: theme === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
              fillOpacity: 0,
              weight: 0.5,
            }}
          />
        )}

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
