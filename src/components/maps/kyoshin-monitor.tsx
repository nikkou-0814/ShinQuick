"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Source, Layer, LayerProps } from "react-map-gl/maplibre";
import { KmoniData, KyoshinMonitorProps } from "@/types/types";

interface ModifiedKyoshinMonitorProps extends Omit<KyoshinMonitorProps, "nowAppTime"> {
  nowAppTimeRef: React.RefObject<number>;
}

const KyoshinMonitor: React.FC<ModifiedKyoshinMonitorProps> = ({
  enableKyoshinMonitor,
  onTimeUpdate,
  isConnected,
  nowAppTimeRef,
}) => {
  const [pointList, setPointList] = useState<Array<[number, number]>>([]);
  const [kmoniData, setKmoniData] = useState<KmoniData | null>(null);

  // 色定義
  const colorList: { [key: string]: string } = {
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

  const convertStringToColor = useCallback((ch: string): string => {
    return colorList[ch.toLowerCase()] || "#b00201";
  }, []);

  // 観測点の取得
  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    const fetchSiteList = async () => {
      try {
        const res = await fetch("https://weather-kyoshin.east.edge.storage-yahoo.jp/SiteList/sitelist.json");
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
    if (!enableKyoshinMonitor) return;
    let isMounted = true;

    const fetchKyoshinMonitorData = async () => {
      if (!nowAppTimeRef.current) return;
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
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("RealTimeData fetch error:", res.status, res.statusText);
          return;
        }
        const data = await res.json();
        if (isMounted) {
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
    };
  }, [enableKyoshinMonitor, onTimeUpdate, nowAppTimeRef]);

  const [siteGeoJSON, setSiteGeoJSON] = useState<any>({
    type: "FeatureCollection",
    features: [],
  });

  useEffect(() => {
    if (!enableKyoshinMonitor || !kmoniData?.realTimeData?.intensity || pointList.length === 0) {
      setSiteGeoJSON({ type: "FeatureCollection", features: [] });
      return;
    }
    const intensityStr = kmoniData.realTimeData.intensity;
    const features = pointList.map((pt: [number, number], idx: number) => {
      const [lat, lng] = pt;
      const char = intensityStr.charAt(idx) || "a";
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          color: convertStringToColor(char),
          radius: 3,
        },
      };
    });
    setSiteGeoJSON({ type: "FeatureCollection", features });
  }, [enableKyoshinMonitor, kmoniData, pointList, convertStringToColor]);

  const siteLayer: LayerProps = {
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
        10, 30,
        15, 25,
        20, 40,
        22, 50
      ],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 0,
    },
  };

  return (
    <Source id="siteSource" type="geojson" data={siteGeoJSON}>
      <Layer {...siteLayer} />
    </Source>
  );
};

export default KyoshinMonitor;
