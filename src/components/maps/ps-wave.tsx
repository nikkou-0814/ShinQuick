"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSONSource } from "maplibre-gl";
import * as turf from "@turf/turf";
import { TravelTableRow, EpicenterInfo, ModifiedPsWaveProps } from "@/types/types";
import { Feature, FeatureCollection, Polygon } from "geojson";

// 走時表のキャッシュ
const travelTableCache = {
  data: null as TravelTableRow[] | null,
  loading: false,
  error: null as Error | null,
};

// 走時表の読み込み
async function importTable(): Promise<TravelTableRow[]> {
  // キャッシュがあればそれを返す
  if (travelTableCache.data) {
    return travelTableCache.data;
  }

  if (travelTableCache.loading) {
    return new Promise((resolve, reject) => {
      const checkCache = () => {
        if (travelTableCache.data) {
          resolve(travelTableCache.data);
        } else if (travelTableCache.error) {
          reject(travelTableCache.error);
        } else {
          setTimeout(checkCache, 100);
        }
      };
      checkCache();
    });
  }
  
  travelTableCache.loading = true;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch("/tjma2001.txt", { 
      signal: controller.signal,
      cache: 'force-cache'
    });
    
    clearTimeout(timeoutId);
    
    const text = await res.text();
    const lines = text.trim().split("\n").map(line => line.trim().replace(/\s+/g, " "));
    const data = lines.map(line => {
      const s = line.split(" ");
      return {
        p: parseFloat(s[1]),
        s: parseFloat(s[3]),
        depth: parseInt(s[4], 10),
        distance: parseInt(s[5], 10),
      };
    });
    
    // キャッシュに保存
    travelTableCache.data = data;
    travelTableCache.loading = false;
    
    return data;
  } catch (error) {
    travelTableCache.loading = false;
    travelTableCache.error = error instanceof Error ? error : new Error(String(error));
    console.error("走時表の読み込みに失敗:", error);
    throw error;
  }
}

// 走時表から現在時刻に基づいてP波・S波の伝播距離を計算
function getValue(
  table: TravelTableRow[],
  depth: number,
  time: number
): [number, number] {
  if (depth > 700 || time > 2000) {
    return [NaN, NaN];
  }

  const values = table.filter(x => x.depth === depth);
  if (values.length === 0) {
    console.log("該当するレコードがありません");
    return [NaN, NaN];
  }

  // P波
  const pCandidatesBefore = values.filter(x => x.p <= time);
  const pCandidatesAfter = values.filter(x => x.p >= time);
  const p1 = pCandidatesBefore[pCandidatesBefore.length - 1];
  const p2 = pCandidatesAfter[0];
  if (!p1 || !p2) {
    return [NaN, NaN];
  }
  const pDistance = ((time - p1.p) / (p2.p - p1.p)) * (p2.distance - p1.distance) + p1.distance;

  // S波
  const sCandidatesBefore = values.filter(x => x.s <= time);
  const sCandidatesAfter = values.filter(x => x.s >= time);
  const s1 = sCandidatesBefore[sCandidatesBefore.length - 1];
  const s2 = sCandidatesAfter[0];
  if (!s1 || !s2) {
    return [pDistance, NaN];
  }
  const sDistance = ((time - s1.s) / (s2.s - s1.s)) * (s2.distance - s1.distance) + s1.distance;

  return [pDistance, sDistance];
}

const PsWave: React.FC<ModifiedPsWaveProps> = ({ 
  epicenters, 
  psWaveUpdateInterval, 
  nowAppTimeRef,
  isMapMoving = false,
}) => {
  const { current: map } = useMap();
  const circleGeoJSONRef = useRef<FeatureCollection<Polygon>>({
    type: "FeatureCollection",
    features: [],
  });
  const sourceInitializedRef = useRef<boolean>(false);
  const travelTableRef = useRef<TravelTableRow[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    const loadTravelTable = async () => {
      try {
        const table = await importTable();
        if (isMountedRef.current) {
          travelTableRef.current = table;
        }
      } catch (err) {
        console.error("走時表の読み込み失敗", err);
      }
    };
    
    loadTravelTable();
    
    return () => {
      isMountedRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, []);

  // P/S波の位置を計算
  const calculateWavePositions = useCallback((
    currentTime: number, 
    epicentersList: EpicenterInfo[], 
    travelTable: TravelTableRow[],
    mapMoving: boolean
  ): Feature<Polygon>[] => {
    const circleSteps = mapMoving ? 24 : 48;
    const features: Feature<Polygon>[] = [];

    epicentersList.forEach((epi) => {
      const elapsedTime = (currentTime - epi.originTime) / 1000;
      const [pDistance, sDistance] = getValue(travelTable, epi.depthval, elapsedTime);

      // P波
      if (!isNaN(pDistance)) {
        const pCircle: Feature<Polygon> = turf.circle(
          [epi.lng, epi.lat],
          pDistance,
          { steps: circleSteps, units: "kilometers" }
        ) as Feature<Polygon>;
        pCircle.properties = { 
          color: "#0000ff", 
          type: "pWave",
          eventId: epi.eventId
        };
        features.push(pCircle);
      }

      // S波
      if (!isNaN(sDistance)) {
        const sCircle: Feature<Polygon> = turf.circle(
          [epi.lng, epi.lat],
          sDistance,
          { steps: circleSteps, units: "kilometers" }
        ) as Feature<Polygon>;
        sCircle.properties = { 
          color: "#ff0000", 
          fillOpacity: 0.2, 
          type: "sWave",
          eventId: epi.eventId
        };
        features.push(sCircle);
      }
    });

    return features;
  }, []);

  // GeoJSONを更新
  const updateGeoJSON = useCallback(() => {
    // コンポーネントがアンマウントされていたら更新しない
    if (!isMountedRef.current) return;
    
    try {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      if (!epicenters.length || !travelTableRef.current?.length || !nowAppTimeRef.current) {
        circleGeoJSONRef.current = { type: "FeatureCollection", features: [] };
        
        // MapLibre GLのソースを直接更新
        if (sourceInitializedRef.current && map) {
          const source = map.getSource('psWaveSource');
          if (source) {
            (source as GeoJSONSource).setData(circleGeoJSONRef.current);
          }
        }
        
        isUpdatingRef.current = false;
        return;
      }

      const now = nowAppTimeRef.current;
      
      // 前回の更新から十分な時間が経過していない場合はスキップ
      const minUpdateInterval = isMapMoving ? 100 : 50;
      if (now - lastUpdateTimeRef.current < minUpdateInterval) {
        isUpdatingRef.current = false;

        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = window.setTimeout(() => {
          updateGeoJSON();
        }, minUpdateInterval);
        
        return;
      }
      
      // P/S波の位置を計算
      const features = calculateWavePositions(
        now, 
        epicenters, 
        travelTableRef.current,
        isMapMoving
      );

      // GeoJSONを更新
      circleGeoJSONRef.current = { type: "FeatureCollection", features };
      
      // MapLibre GLのソースを直接更新
      if (sourceInitializedRef.current && map) {
        const source = map.getSource('psWaveSource');
        if (source) {
          (source as GeoJSONSource).setData(circleGeoJSONRef.current);
        }
      }
      
      lastUpdateTimeRef.current = now;

      // 次の更新をスケジュール
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

      const updateInterval = isMapMoving 
        ? Math.max(psWaveUpdateInterval * 1.5, 100) 
        : psWaveUpdateInterval;

      timeoutIdRef.current = window.setTimeout(() => {
        isUpdatingRef.current = false;
        if (isMountedRef.current) {
          updateGeoJSON();
        }
      }, updateInterval);
    } catch (error) {
      console.error("P/S波の更新中にエラーが発生しました:", error);
      isUpdatingRef.current = false;
      
      // エラー発生時も次の更新をスケジュール
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          updateGeoJSON();
        }
      }, psWaveUpdateInterval);
    }
  }, [epicenters, psWaveUpdateInterval, nowAppTimeRef, isMapMoving, calculateWavePositions, map]);

  useEffect(() => {
    if (!map) return;
    
    const checkSource = () => {
      const source = map.getSource('psWaveSource');
      if (source) {
        sourceInitializedRef.current = true;
      } else {
        setTimeout(checkSource, 100);
      }
    };
    
    checkSource();
    
    return () => {
      sourceInitializedRef.current = false;
    };
  }, [map]);

  useEffect(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (!epicenters.length || !travelTableRef.current?.length) {
      circleGeoJSONRef.current = { type: "FeatureCollection", features: [] };
      
      // MapLibre GLのソースを直接更新
      if (sourceInitializedRef.current && map) {
        const source = map.getSource('psWaveSource');
        if (source) {
          (source as GeoJSONSource).setData(circleGeoJSONRef.current);
        }
      }
      
      return;
    }

    isUpdatingRef.current = false;

    updateGeoJSON();

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [epicenters, psWaveUpdateInterval, isMapMoving, updateGeoJSON, map]);

  // 初期GeoJSONデータ
  const initialGeoJSON = useMemo(() => {
    return { type: "FeatureCollection" as const, features: [] };
  }, []);

  return (
    <Source id="psWaveSource" type="geojson" data={initialGeoJSON}>
      <Layer
        id="pWave-layer"
        type="line"
        paint={{
          "line-color": "#0000ff",
          "line-width": 2,
        }}
        filter={["==", ["get", "type"], "pWave"]}
      />
      <Layer
        id="sWave-layer"
        type="fill"
        paint={{
          "fill-color": "#ff0000",
          "fill-opacity": 0.2,
          "fill-outline-color": "#ff0000",
        }}
        filter={["==", ["get", "type"], "sWave"]}
      />
    </Source>
  );
};

export default React.memo(PsWave);
