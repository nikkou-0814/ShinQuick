"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

interface KmoniData {
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
  const [kmoniData, setKmoniData] = useState<KmoniData | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(map.getZoom());
  const layerRef = useRef<L.LayerGroup | null>(null);
  const waveLayerRef = useRef<L.LayerGroup | null>(null);

  // 色定義
  const colorList: { [key: string]: string } = React.useMemo(() => ({
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
  }), []);

  const convertStringToColor = React.useCallback((ch: string): string => {
    return colorList[ch.toLowerCase()] || "#b00201";
  }, [colorList]);

  const getRadiusForZoom = (zoom: number): number => {
    if (zoom > 10) return 12;
    if (zoom > 9) return 10;
    if (zoom > 8) return 8;
    if (zoom > 7) return 6;
    if (zoom > 6) return 3;
    if (zoom > 5) return 1.5;
    return 0.3;
  };

  useMapEvents({
    zoomend: () => {
      setZoomLevel(map.getZoom());
    },
  });

  // 観測点の取得
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
        const data = await res.json();
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

  // 強震モニタ表示
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
        color: convertStringToColor(char),
        fillOpacity: 1,
      });
      layerRef.current?.addLayer(circle);
    });

    layerRef.current.addTo(map);
  }, [map, kmoniData, zoomLevel, pointList, enableKyoshinMonitor, convertStringToColor]);

  // P/S波
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

    kmoniData.psWave.items.forEach((item: { latitude: string; longitude: string; pRadius: string; sRadius: string }) => {
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
        color: "#0000ff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0,
        pane: "psWavePane",
      });
      waveLayerRef.current?.addLayer(pCircle);

      // S波
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
  }, [enableKyoshinMonitor, kmoniData, map, isConnected, autoZoomEnabled]);

  return null;
}

export default KyoshinMonitor;
