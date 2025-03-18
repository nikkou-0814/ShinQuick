"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Source, Layer, LayerProps, useMap } from "react-map-gl/maplibre";
import type { GeoJSONSource } from "maplibre-gl";
import { KmoniData, SiteListData, KyoshinMonitorProps } from "@/types/types";
import { Feature, GeoJsonProperties, Point, FeatureCollection } from "geojson";

// 強震モニタデータのキャッシュ
const kyoshinDataCache = {
  pointList: null as Array<[number, number]> | null,
  lastFetchedTime: 0,
  abortController: null as AbortController | null,
  pointMap: new Map<string, [number, number]>(),
  colorCache: new Map<string, string>(),
};

const KyoshinMonitor: React.FC<KyoshinMonitorProps> = ({
  enableKyoshinMonitor,
  nowAppTimeRef,
}) => {
  const { current: map } = useMap();
  const [pointList, setPointList] = useState<Array<[number, number]>>(kyoshinDataCache.pointList || []);
  const kmoniDataRef = useRef<KmoniData | null>(null);
  const geoJSONRef = useRef<FeatureCollection>({ type: "FeatureCollection", features: [] });
  const sourceInitializedRef = useRef<boolean>(false);
  const fetchingRef = useRef(false);
  const lastFetchTime = useRef(kyoshinDataCache.lastFetchedTime);
  const isMountedRef = useRef(true);

  // 色定義
  const colorList: Record<string, string> = useMemo(
    () => ({
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
    }),
    []
  );

  const convertStringToColor = useCallback((ch: string): string => {
    const lowerCh = ch.toLowerCase();
    // キャッシュにあればそれを返す
    if (kyoshinDataCache.colorCache.has(lowerCh)) {
      return kyoshinDataCache.colorCache.get(lowerCh)!;
    }
    // 新しい色を計算してキャッシュに保存
    const color = colorList[lowerCh] || "#b00201";
    kyoshinDataCache.colorCache.set(lowerCh, color);
    return color;
  }, [colorList]);

  // コンポーネントのマウント状態を追跡
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (kyoshinDataCache.abortController) {
        kyoshinDataCache.abortController.abort();
        kyoshinDataCache.abortController = null;
      }
    };
  }, []);

  // 観測点の取得
  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    
    // キャッシュがあればそれを使用
    if (kyoshinDataCache.pointList && kyoshinDataCache.pointList.length > 0) {
      setPointList(kyoshinDataCache.pointList);
      return;
    }
    
    const fetchSiteList = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(
          "https://weather-kyoshin.east.edge.storage-yahoo.jp/SiteList/sitelist.json", 
          { 
            signal: controller.signal,
            cache: 'force-cache'
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.warn("SiteList fetch error:", res.status, res.statusText);
          return;
        }
        
        const data: SiteListData = await res.json();
        
        if (data.items && Array.isArray(data.items)) {
          // キャッシュに保存
          kyoshinDataCache.pointList = data.items;
          
          // インデックス化
          kyoshinDataCache.pointMap.clear();
          for (let i = 0; i < data.items.length; i++) {
            kyoshinDataCache.pointMap.set(`${i}`, data.items[i]);
          }
          
          if (isMountedRef.current) {
            setPointList(data.items);
          }
        } else {
          console.warn("Unknown SiteList Format", data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("観測点リストの取得がタイムアウトしました");
        } else {
          console.error("fetchSiteList error:", err);
        }
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchSiteList();
  }, [enableKyoshinMonitor]);

  // 強震モニタデータの取得
  useEffect(() => {
    if (!enableKyoshinMonitor) return;
    
    // 日時フォーマット関数
    const formatDateForKyoshin = (date: Date) => {
      return {
        time: date.getFullYear().toString() +
              ("0" + (date.getMonth() + 1)).slice(-2) +
              ("0" + date.getDate()).slice(-2) +
              ("0" + date.getHours()).slice(-2) +
              ("0" + date.getMinutes()).slice(-2) +
              ("0" + date.getSeconds()).slice(-2),
        day: date.getFullYear().toString() +
             ("0" + (date.getMonth() + 1)).slice(-2) +
             ("0" + date.getDate()).slice(-2)
      };
    };

    // GeoJSONデータを直接更新
    const updateGeoJSONData = (data: KmoniData) => {
      if (!data?.realTimeData?.intensity || pointList.length === 0) return;
      
      const intensityStr = data.realTimeData.intensity;
      const features: Feature<Point, GeoJsonProperties>[] = [];
      const maxPoints = Math.min(pointList.length, intensityStr.length);
      
      // 事前に配列サイズを確保して再割り当てを減らす
      features.length = 0;

      const skipChars = new Set(['a', 'b', 'c']);
      
      for (let idx = 0; idx < maxPoints; idx++) {
        const [lat, lng] = pointList[idx];
        const char = intensityStr.charAt(idx);
        const lowerChar = char.toLowerCase();

        if (skipChars.has(lowerChar)) {
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
      
      geoJSONRef.current = { 
        type: "FeatureCollection", 
        features 
      };
      if (sourceInitializedRef.current && map) {
        requestAnimationFrame(() => {
          const source = map.getSource('siteSource');
          if (source) {
            (source as GeoJSONSource).setData(geoJSONRef.current);
          }
        });
      }
    };

    const fetchKyoshinMonitorData = async () => {
      if (!nowAppTimeRef.current) return;
      const now = nowAppTimeRef.current;

      // スロットリング
      if (now - lastFetchTime.current < 500) return;
      lastFetchTime.current = now;
      kyoshinDataCache.lastFetchedTime = now;

      // 進行中のリクエストをキャンセル
      if (kyoshinDataCache.abortController) {
        kyoshinDataCache.abortController.abort();
      }
      
      try {
        const target = nowAppTimeRef.current - 2000;
        const dateObj = new Date(target);
        const { time: nowTime, day: nowDay } = formatDateForKyoshin(dateObj);
        
        const url = `https://weather-kyoshin.east.edge.storage-yahoo.jp/RealTimeData/${nowDay}/${nowTime}.json`;
        
        // 新しいAbortControllerを作成
        kyoshinDataCache.abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          if (kyoshinDataCache.abortController) {
            kyoshinDataCache.abortController.abort();
          }
        }, 5000);
        
        const res = await fetch(url, { 
          signal: kyoshinDataCache.abortController.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.warn("RealTimeData fetch error:", res.status, res.statusText);
          return;
        }
        
        const data = await res.json();
        
        if (isMountedRef.current) {
          requestAnimationFrame(() => {
            kmoniDataRef.current = data;
            updateGeoJSONData(data);
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("強震モニタデータの取得がタイムアウトまたはキャンセルされました");
        } else {
          console.error("KyoshinMonitor fetch error:", err);
        }
      } finally {
        // 完了したリクエストのコントローラーをクリア
        kyoshinDataCache.abortController = null;
      }
    };
    fetchKyoshinMonitorData();
    const intervalId = window.setInterval(fetchKyoshinMonitorData, 1000);
    return () => {
      clearInterval(intervalId);
      if (kyoshinDataCache.abortController) {
        kyoshinDataCache.abortController.abort();
        kyoshinDataCache.abortController = null;
      }
    };    
  }, [enableKyoshinMonitor, nowAppTimeRef, pointList, map, convertStringToColor]);

  // ソースの初期化を検知するためのエフェクト
  useEffect(() => {
    if (!map || !enableKyoshinMonitor) return;
    
    let checkCount = 0;
    const maxChecks = 50;
    
    const checkSource = () => {
      const source = map.getSource('siteSource');
      if (source) {
        sourceInitializedRef.current = true;
      } else if (checkCount < maxChecks) {
        checkCount++;
        setTimeout(checkSource, 100);
      } else {
        console.warn('siteSource の初期化タイムアウト');
      }
    };
    
    checkSource();
    
    return () => {
      sourceInitializedRef.current = false;
    };
  }, [map, enableKyoshinMonitor]);

  // レイヤープロパティ
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
        5, 3,
        10, 10,
        15, 15,
        20, 20,
        22, 30
      ],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 0,
    },
  };

  const initialGeoJSON = useMemo(() => {
    return { type: "FeatureCollection" as const, features: [] };
  }, []);

  if (!enableKyoshinMonitor) {
    return null;
  }

  return (
    <Source id="siteSource" type="geojson" data={initialGeoJSON} generateId>
      <Layer {...siteLayer} />
    </Source>
  );
};

export default React.memo(KyoshinMonitor);
