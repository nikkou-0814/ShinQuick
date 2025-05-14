"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AXISEewInformation } from "@/types/types";

interface AXISMobileEewPanelProps {
  parsedData: AXISEewInformation | null;
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
  onRegionIntensityUpdate?: (regionMap: Record<string, string>, eventId: string) => void;
  onWarningRegionUpdate?: (warningRegions: { code: string; name: string }[], eventId: string) => void;
}

export const AXISMobileEewPanel: React.FC<AXISMobileEewPanelProps> = ({
  parsedData,
  onEpicenterUpdate,
  onRegionIntensityUpdate,
  onWarningRegionUpdate,
}) => {
  const prevWarningRegionsRef = useRef<{ code: string; name: string }[]>([]);

  useEffect(() => {
    if (!parsedData || !onWarningRegionUpdate) return;
  
    const regions = parsedData.Forecast.map(region => ({
      code: region.Code.toString(),
      name: region.Name
    }));
  
    if (regions.length === 0) {
      return;
    }
  
    if (JSON.stringify(prevWarningRegionsRef.current) !== JSON.stringify(regions)) {
      onWarningRegionUpdate(regions, parsedData.EventID);
      prevWarningRegionsRef.current = [...regions];
    }
  }, [parsedData, onWarningRegionUpdate]);

  const getJstTime = useCallback((timestamp: string | undefined): Date | null => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!parsedData || !onEpicenterUpdate) return;
  
    const { EventID, Serial, Flag, Hypocenter } = parsedData;
    const { is_cancel } = Flag;
  
    if (is_cancel) return;
  
    const icon = "/shingen.png";
    
    let quakeOriginTime = 0;
    const dt = getJstTime(parsedData.OriginDateTime);
    quakeOriginTime = dt ? dt.getTime() : Date.now();

    if (!Hypocenter.Coordinate || !Hypocenter.Depth) return;

    const latVal = Number(Hypocenter.Coordinate[1]);
    const lngVal = Number(Hypocenter.Coordinate[0]);
    const depthStr = Hypocenter.Depth.replace(/[^0-9]/g, "");
    const depthVal = Number(depthStr);
  
    if (isNaN(latVal) || isNaN(lngVal) || isNaN(depthVal)) return;
  
    const epicenterData = {
      eventId: EventID,
      serialNo: Serial.toString(),
      lat: latVal,
      lng: lngVal,
      icon,
      depthval: depthVal,
      originTime: quakeOriginTime,
      isCancel: is_cancel,
    };
    
    onEpicenterUpdate(epicenterData);
  }, [parsedData, onEpicenterUpdate, getJstTime]);

  useEffect(() => {
    if (!parsedData || !onRegionIntensityUpdate) return;
    
    if (parsedData.Flag.is_cancel) {
      onRegionIntensityUpdate({}, parsedData.EventID);
      return;
    }
    
    const newMap: Record<string, string> = {};
    
    parsedData.Forecast.forEach((region) => {
      const code = region.Code.toString();
      const { To = "不明" } = region.Intensity;
      newMap[code] = To;
    });

    onRegionIntensityUpdate(newMap, parsedData.EventID);
  }, [parsedData, onRegionIntensityUpdate]);

  if (!parsedData) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-black/90 border-t border-gray-200 dark:border-gray-800 p-4 text-center">
        <p className="font-medium">緊急地震速報受信待機中</p>
      </div>
    );
  }

  const {
    Title,
    Serial,
    Hypocenter,
    Intensity,
    Magnitude,
    Flag,
    OriginDateTime,
  } = parsedData;

  const { is_cancel, is_final, is_training } = Flag;

  const isWarning = Title.includes("警報");
  const status = is_training ? "訓練" : "";
  const hypName = Hypocenter.Name || "不明";
  const rawDepthValue = Hypocenter.Depth || "不明";
  const depthValue = typeof rawDepthValue === 'string' 
    ? rawDepthValue.replace(/[^0-9.]/g, "") 
    : rawDepthValue;
  const magnitudeValue = Magnitude || "不明";
  const originTime = getJstTime(OriginDateTime);

  const formatTime = (date: Date | null): string => {
    if (!date) return "不明";
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "不明";
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formattedOriginTime = formatTime(originTime);
  const formattedOriginDate = formatDate(originTime);

  const formattedTimeDisplay = originTime
    ? `${formattedOriginDate} ${formattedOriginTime}`
    : "不明";

  const getIntensityColor = (intensity: string): { bg: string; text: string } => {
    switch (intensity) {
      case "7":
        return { bg: "#5F0CA2", text: "white" };
      case "6+":
        return { bg: "#930A7A", text: "white" };
      case "6-":
        return { bg: "#A50C6B", text: "white" };
      case "5+":
        return { bg: "#C31B1B", text: "white" };
      case "5-":
        return { bg: "#E52A18", text: "white" };
      case "4":
        return { bg: "#FF9939", text: "black" };
      case "3":
        return { bg: "#F6CB51", text: "black" };
      case "2":
        return { bg: "#4CD0A7", text: "black" };
      case "1":
        return { bg: "#2B8EB2", text: "white" };
      case "不明":
        return { bg: "#62626B", text: "white" };
      default:
        return { bg: "#CCCCCC", text: "black" };
    }
  };

  const convertIntensity = (
    value: string,
  ): string => {
    const mapping: Record<string, string> = {
      "0": "0",
      "1": "1",
      "2": "2",
      "3": "3",
      "4": "4",
      "5-": "5弱",
      "5+": "5強",
      "6-": "6弱",
      "6+": "6強",
      "7": "7",
      "不明": "不明",
    };
    const intensity = mapping[value] || "不明";
    return intensity;
  };

  const intensityColors = getIntensityColor(Intensity);
  const backgroundColor = intensityColors.bg;
  const textColor = intensityColors.text;

  let displayIntensity = convertIntensity(Intensity)

  // 深発
  if (depthValue !== "不明") {
    const depthStr = depthValue.replace(/[^0-9]/g, "");
    const depthNum = parseInt(depthStr, 10);
    if (
      !isNaN(depthNum) &&
      depthNum >= 150 &&
      convertIntensity(Intensity) === "不明"
    ) {
      displayIntensity = "深発地震のため震度推定なし";
    }
  }

  const additionalMessage = (() => {
    if (
      isWarning &&
      ["6-", "6+", "7"].includes(Intensity)
    ) {
      return (
        <>
          緊急地震速報の特別警報です
          <br />
          身の安全を確保してください
        </>
      );
    } else if (displayIntensity === "深発地震のため震度推定なし") {
      return (
        <>
          震源が深いため震央から遠い場所で
          <br />
          揺れが大きくなることがあります
        </>
      );
    } else if (isWarning) {
      return (
        <>
          緊急地震速報（警報）発表
          <br />
          強い揺れに警戒してください
        </>
      );
    } else {
      return (
        <>
          緊急地震速報（予報）発表
          <br />
          揺れに注意してください
        </>
      );
    }
  })();

  return (
    <div className="relative top-0 left-0 right-0 z-40 max-h-[80vh] overflow-y-auto">
      <div className="p-2 space-y-2">
        <Card 
          className="bg-white/90 dark:bg-black/90 border overflow-hidden"
        >
          <div className={`p-2 flex items-center gap-2 ${
            is_cancel
              ? "bg-gray-200 dark:bg-gray-600/20"
              : isWarning
              ? "bg-red-100 dark:bg-red-600/10"
              : "bg-yellow-100 dark:bg-yellow-950/30"
          }`}>
            {is_cancel ? (
              <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
            ) : isWarning ? (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            )}
            <div className="flex-1 text-sm font-medium">
              {`緊急地震速報（${
                isWarning ? (is_cancel ? "取消" : "警報") : (is_cancel ? "取消" : "予報")
              }）`}
            </div>
            <div className="text-xs">
              {status === "訓練" ? "訓練・試験報" : ""}
              {!is_cancel && (
                <span>
                  {is_final ? `第${Serial}報 (最終)` : `第${Serial}報`}
                </span>
              )}
            </div>
          </div>

          {!is_cancel && (
            <div className="p-3">
              <div className="flex justify-between items-center gap-2">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold">{hypName}で地震</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formattedTimeDisplay} 頃発生
                  </p>
                </div>
                  {displayIntensity === "深発地震のため震度推定なし" ? (
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md font-bold flex items-center justify-end shrink-0" style={{ backgroundColor, color: textColor }}>
                      <div className="flex flex-col items-center">
                        <p className="text-xl">深発地震のため</p>
                        <p className="text-xl">震度推定なし</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md font-bold flex items-center justify-end shrink-0" style={{ backgroundColor, color: textColor }}>
                      <div className="flex flex-col items-end mr-4">
                        <span>推定</span>
                        <span>最大震度</span>
                      </div>
                      <div className="flex items-baseline">
                        <p className="text-4xl">{displayIntensity}</p>
                      </div>
                    </div>
                  )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="flex items-center space-x-1">
                    <div className="flex items-baseline">
                      <span className="text-sm mr-1">M</span>
                      <p className="font-medium text-2xl">{magnitudeValue}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="flex items-baseline">
                      <span className="text-sm mr-1 text-nowrap">深さ</span>
                      <p className="font-medium text-2xl">{depthValue}</p>
                      <span className="text-sm ml-1">km</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-nowrap text-right">
                  {additionalMessage}
                </div>
              </div>

              <div className="flex w-full justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">情報源: AXIS</span>
              </div>
            </div>
          )}
          
          {is_cancel && (
            <div className="p-3">
              <p className="text-gray-600 dark:text-gray-400">この緊急地震速報は取り消されました。</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AXISMobileEewPanel;
