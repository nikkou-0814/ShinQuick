import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import EewDisplay from "@/components/eew-display";
import { ChevronLeft } from "lucide-react";  
import { EewInformation } from "@dmdata/telegram-json-types";
import { Settings, RegionIntensityMap } from "@/types/types";

const SIDEBAR_CONFIG = {
  MIN_WIDTH: 300,
  MAX_WIDTH: 600,
  DEFAULT_WIDTH: 400,
  COLLAPSED_WIDTH: 40,
  RESIZE_SENSITIVITY: 2,
};

export const Sidebar: React.FC<{
  displayDataList: EewInformation.Latest.Main[];
  settings: Settings;
  onEpicenterUpdate: (info: {
    eventId: string;
    serialNo?: string;
    lat: number;
    lng: number;
    icon: string;
    depthval: number;
    originTime: number;
  }) => void;
  onRegionIntensityUpdate: (regionMap: RegionIntensityMap, eventId: string) => void;
  onWarningRegionUpdate: (warningRegions: { code: string; name: string }[], eventId: string) => void;
  getHypocenterMethod: (earthquake: EewInformation.Latest.PublicCommonBody["earthquake"]) => string;
}> = ({ 
  displayDataList, 
  settings, 
  onEpicenterUpdate, 
  onRegionIntensityUpdate, 
  onWarningRegionUpdate, 
  getHypocenterMethod 
}) => {
  const [width, setWidth] = useState(SIDEBAR_CONFIG.DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [height, setHeight] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(SIDEBAR_CONFIG.DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);
  const handleResizeMoveRef = useRef<(e: MouseEvent) => void>(null);
  const handleResizeEndRef = useRef<() => void>(null);

  useEffect(() => {
    const updateHeight = () => setHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  handleResizeMoveRef.current = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    const diff = startXRef.current - e.clientX;
    const newWidth = Math.max(
      Math.min(startWidthRef.current + diff, SIDEBAR_CONFIG.MAX_WIDTH),
      SIDEBAR_CONFIG.MIN_WIDTH
    );
  
    if (newWidth <= SIDEBAR_CONFIG.MIN_WIDTH) {
      setIsCollapsed(true);
      if (handleResizeEndRef.current) {
        handleResizeEndRef.current();
      }
    } else {
      setWidth(newWidth);
    }
  };  

  handleResizeEndRef.current = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleResizeMoveRef.current!);
    document.removeEventListener('mouseup', handleResizeEndRef.current!);
  };
  
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    isDraggingRef.current = true;
    
    document.addEventListener('mousemove', handleResizeMoveRef.current!);
    document.addEventListener('mouseup', handleResizeEndRef.current!);
  }, [isCollapsed, width]);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const filteredDisplayDataList = useMemo(() => {
    if (settings.enable_low_accuracy_eew) {
      return displayDataList;
    }
    
    return displayDataList.filter((data: EewInformation.Latest.Main) => {
      const body = data.body;
      if (!body) return true;
      if (!('earthquake' in body)) return true;
      
      const method = getHypocenterMethod(body.earthquake);
      return !["PLUM法", "レベル法", "IPF法 (1点)"].includes(method);
    });
  }, [displayDataList, settings.enable_low_accuracy_eew, getHypocenterMethod]);

  return (
    <div className="relative h-full">
      <div 
        className={`absolute h-full z-10 transition-all duration-300 ${
          isCollapsed ? "opacity-100 right-0" : "opacity-0 pointer-events-none -right-10"
        }`}
      >
        <button
          onClick={expandSidebar}
          className="absolute right-0 w-6 h-10 flex items-center justify-center text-lg bg-white/50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-s-lg border"
          aria-label="サイドバーを展開"
          style={{
            top: `${height / 2}px`,
            transform: "translateY(-50%)",
          }}
        >
          <ChevronLeft />
        </button>
      </div>

      <div
        ref={sidebarRef}
        className={`${isCollapsed ? 'absolute' : 'relative'} top-0 right-0 shadow-lg border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-black`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: isCollapsed ? `translateX(${width}px)` : "translateX(0)",
          transition: "transform 0.3s ease"
        }}
      >
        <div className="overflow-y-auto h-full p-2">
          {filteredDisplayDataList.length > 0 ? (
            <div className="space-y-2">
              {filteredDisplayDataList.map((data: EewInformation.Latest.Main) => (
                <EewDisplay
                  key={data.eventId}
                  parsedData={data}
                  isAccuracy={settings.enable_accuracy_info}
                  isLowAccuracy={settings.enable_low_accuracy_eew}
                  onEpicenterUpdate={onEpicenterUpdate}
                  onRegionIntensityUpdate={(regionMap) => {
                    if (onRegionIntensityUpdate) {
                      onRegionIntensityUpdate(regionMap, data.eventId);
                    }
                  }}
                  onWarningRegionUpdate={(regions) => {
                    if (onWarningRegionUpdate) {
                      onWarningRegionUpdate(regions, data.eventId);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center">
              <h1 className="text-xl font-medium text-center mb-2">緊急地震速報受信待機中</h1>
            </div>
          )}
        </div>

        <div
          className="absolute left-0 top-0 h-full cursor-ew-resize group"
          style={{ width: `${SIDEBAR_CONFIG.RESIZE_SENSITIVITY}px` }}
          onMouseDown={handleResizeStart}
        >
          <div className="w-0.5 h-full bg-transparent group-hover:bg-blue-400 transition-colors duration-200 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};
