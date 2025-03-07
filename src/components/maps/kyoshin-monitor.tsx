"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Source, Layer, LayerProps } from "react-map-gl/maplibre";
import { KmoniData, SiteListData, KyoshinMonitorProps } from "@/types/types";
import { Feature, GeoJsonProperties, Point } from "geojson";

let cachedPointList: Array<[number, number]> | null = null;

const KyoshinMonitor: React.FC<KyoshinMonitorProps> = ({
  enableKyoshinMonitor,
  onTimeUpdate,
  nowAppTimeRef,
}) => {
  const [pointList, setPointList] = useState<Array<[number, number]>>(cachedPointList || []);
  const [kmoniData, setKmoniData] = useState<KmoniData | null>(null);
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(0);

  // 色定義
  const colorList = useMemo((): Record<string, string> => ({
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

  const convertStringToColor = useCallback((ch: string): string => {
    return colorList[ch.toLowerCase()] || "#b00201";
  }, [colorList]);

  // 観測点の取得
  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    if (cachedPointList && cachedPointList.length > 0) {
      setPointList(cachedPointList);
      return;
    }
    const fetchSiteList = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const res = await fetch("https://weather-kyoshin.east.edge.storage-yahoo.jp/SiteList/sitelist.json");
        if (!res.ok) {
          console.warn("SiteList fetch error:", res.status, res.statusText);
          return;
        }
        const data: SiteListData = await res.json();
        if (data.items && Array.isArray(data.items)) {
          cachedPointList = data.items;
          setPointList(data.items);
        } else {
          console.warn("Unknown SiteList Format", data);
        }
      } catch (err) {
        console.error("fetchSiteList error:", err);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchSiteList();
  }, [enableKyoshinMonitor]);

  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    let isMounted = true;

    const fetchKyoshinMonitorData = async () => {
      if (!nowAppTimeRef.current) return;
      const now = Date.now();
      if (now - lastFetchTime.current < 500) return;
      lastFetchTime.current = now;
      try {
        const target = nowAppTimeRef.current - 2000;
        const dateObj = new Date(target);
        const nowTime =
          dateObj.getFullYear().toString() +
          ("0" + (dateObj.getMonth() + 1)).slice(-2) +
          ("0" + dateObj.getDate()).slice(-2) +
          ("0" + dateObj.getHours()).slice(-2) +
          ("0" + dateObj.getMinutes()).slice(-2) +
          ("0" + dateObj.getSeconds()).slice(-2);
        const nowDay =
          dateObj.getFullYear().toString() +
          ("0" + (dateObj.getMonth() + 1)).slice(-2) +
          ("0" + dateObj.getDate()).slice(-2);
        const url = `https://weather-kyoshin.east.edge.storage-yahoo.jp/RealTimeData/${nowDay}/${nowTime}.json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          console.warn("RealTimeData fetch error:", res.status, res.statusText);
          return;
        }
        const data = await res.json();
        if (isMounted) {
          requestAnimationFrame(() => {
            setKmoniData(data);
            if (onTimeUpdate) {
              if (data.realTimeData?.dataTime) {
                const dateISO = new Date(data.realTimeData.dataTime);
                const formattedTime = dateISO.toLocaleString("ja-JP", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                onTimeUpdate(formattedTime);
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
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("Fetch aborted due to timeout");
        } else {
          console.error("KyoshinMonitor fetch error:", err);
        }
      }
    };
    
    fetchKyoshinMonitorData();
    const intervalId = window.setInterval(fetchKyoshinMonitorData, 1000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };    
  }, [enableKyoshinMonitor, onTimeUpdate, nowAppTimeRef]);

  const siteGeoJSON = useMemo(() => {
    if (!enableKyoshinMonitor || !kmoniData?.realTimeData?.intensity || pointList.length === 0) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    const intensityStr = kmoniData.realTimeData.intensity;
    const features: Feature<Point, GeoJsonProperties>[] = [];
    
    for (let idx = 0; idx < pointList.length; idx++) {
      const [lat, lng] = pointList[idx];
      const char = idx < intensityStr.length ? intensityStr.charAt(idx) : 'a';
      if (char === 'a' || char === 'b' || char === 'c') {
        continue;
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        } as Point,
        properties: {
          color: convertStringToColor(char),
          radius: 3,
        },
      });
    }

    return { type: "FeatureCollection" as const, features };
  }, [enableKyoshinMonitor, kmoniData, pointList, convertStringToColor]);

  const siteLayer = useMemo<LayerProps>(() => ({
    id: "site-layer",
    type: "circle",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": [
        "interpolate",
        ["exponential", 2.5],
        ["zoom"],
        0, 2,
        5, 4,
        10, 15,
        15, 20,
        20, 30,
        22, 40
      ],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 0,
    },
  }), []);

  if (siteGeoJSON.features.length === 0) {
    return null;
  }

  return (
    <Source id="siteSource" type="geojson" data={siteGeoJSON} generateId>
      <Layer {...siteLayer} />
    </Source>
  );
};

export default React.memo(KyoshinMonitor);
