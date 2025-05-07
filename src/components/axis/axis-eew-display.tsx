"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { AXISEewInformation } from "@/types/types";

interface AXISEewDisplayProps {
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
  onRegionIntensityUpdate?: (regionMap: Record<string, string>) => void;
  onWarningRegionUpdate?: (warningRegions: { code: string; name: string }[]) => void;
}

const AXISEewDisplay: React.FC<AXISEewDisplayProps> = ({
  parsedData,
  onEpicenterUpdate,
  onRegionIntensityUpdate,
  onWarningRegionUpdate,
}) => {
  const prevWarningRegionsRef = useRef<{ code: string; name: string }[]>([]);

  useEffect(() => {
    if (!parsedData || !onWarningRegionUpdate) return;
    if (prevWarningRegionsRef.current.length > 0) {
      prevWarningRegionsRef.current = [];
      onWarningRegionUpdate([]);
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
      onRegionIntensityUpdate({});
      return;
    }
    
    const newMap: Record<string, string> = {};
    
    parsedData.Forecast.forEach((region) => {
      const code = region.Code.toString();
      const { To = "不明" } = region.Intensity;
      newMap[code] = To;
    });

    onRegionIntensityUpdate({...newMap});
  }, [parsedData, onRegionIntensityUpdate]);

  if (!parsedData) {
    return null;
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
  const hypName = Hypocenter.Name || "不明";
  const rawDepthValue = Hypocenter.Depth || "不明";
  const depthValue = typeof rawDepthValue === 'string' 
    ? rawDepthValue.replace(/[^0-9.]/g, "") 
    : rawDepthValue;
  const magnitudeValue = Magnitude || "不明";
  const originTime = getJstTime(OriginDateTime);

  const formatTime = (date: Date | null): string => {
    if (!date) return "不明";
    return `${date.getHours().toString().padStart(2, "0")}時${date.getMinutes().toString().padStart(2, "0")}分${date.getSeconds().toString().padStart(2, "0")}秒`;
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

  const displayIntensity = `推定最大震度 ${convertIntensity(Intensity)}`;

  return (
    <Card className="shadow-xl bg-white/90 dark:bg-black/75 border m-2">
      <CardHeader className="pb-4">
        <CardTitle
          className={`flex flex-col items-start gap-2 text-lg p-2 rounded-lg ${
            is_cancel
              ? "bg-gray-200 dark:bg-gray-600/20"
              : isWarning
              ? "bg-red-100 dark:bg-red-600/10"
              : "bg-yellow-100 dark:bg-yellow-950/30"
          }`}
        >
          <div className="flex items-center gap-2 w-full">
            {is_cancel ? (
              <XCircle className="h-5 w-5 text-gray-500 shrink-0" />
            ) : isWarning ? (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            )}
            <span className="break-keep">
              {`緊急地震速報（${
                isWarning ? (is_cancel ? "取消" : "警報") : (is_cancel ? "取消" : "予報")
              }）`}
            </span>
            {!is_training && (
              <span className="text-sm ml-auto break-keep text-center">
                {is_final ? `第${Serial}報 （最終）` : `第${Serial}報`}
              </span>
            )}
          </div>

          {is_training && (
            <div className="flex w-full justify-between items-center text-sm">
              <span className="text-xs break-keep">訓練・試験報</span>
              {!is_cancel && (
                <span className="ml-auto break-keep text-center">
                  {is_final ? `第${Serial}報 （最終）` : `第${Serial}報`}
                </span>
              )}
            </div>
          )}
          <div className="flex w-full justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">情報源: AXIS</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!is_cancel && (
          <div
            className={`rounded-lg border-2 p-4 ${
              isWarning
                ? "border-red-500/50 bg-red-200/30 dark:bg-red-950/30"
                : "border-yellow-500/50 bg-yellow-200/30 dark:bg-yellow-950/30"
            }`}
          >
            <h1 className="text-2xl font-bold mb-2 break-words">
              {hypName}で地震
            </h1>
            <p className="text-sm text-gray-800 dark:text-gray-300">
              {formattedTimeDisplay}発生
            </p>
            <div
              className="rounded-md p-4 mt-4 text-center font-bold shadow-md"
              style={{ backgroundColor, color: textColor }}
            >
              <h1 className="text-lg">
                {displayIntensity}
              </h1>
            </div>
          </div>
        )}
        {additionalMessage && !is_cancel && (
          <div
            className={`rounded-lg p-4 border-2 ${
              isWarning
                ? "border-red-500/50 bg-red-200/30 dark:bg-red-950/30"
                : "border-yellow-500/50 bg-yellow-200/30 dark:bg-yellow-950/30"
            }`}
          >
            <p className="text-sm font-medium break-words">{additionalMessage}</p>
          </div>
        )}
        {is_cancel && (
          <div
            className={`rounded-lg p-4 border-2 bg-gray-200/30 dark:bg-gray-950/30`}
          >
            <p className="text-sm font-medium">この緊急地震速報は取り消されました。</p>
          </div>
        )}    
        {!is_cancel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 p-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                マグニチュード
              </p>
              <p className="font-medium">M{magnitudeValue}</p>
            </div>
            <div className="space-y-1 p-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                深さ
              </p>
              <p className="font-medium">{depthValue} km</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AXISEewDisplay;
