"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { toast } from "sonner";
import pako from "pako";
import { EewInformation } from "@dmdata/telegram-json-types";
import { WebSocketContextType, SchemaCheck, AXISEewInformation } from "@/types/types";

// 型チェック
const isEewInformationMain = (
  data: unknown
): data is EewInformation.Latest.Main => {
  if (!data || typeof data !== "object") return false;
  
  // 必須プロパティの存在チェック
  const obj = data as SchemaCheck;
  if (!obj._schema || !obj.type) return false;
  const schema = obj._schema;
  if (schema.type !== "eew-information" || schema.version !== "1.0.0") return false;
  return obj.type === "緊急地震速報（地震動予報）";
};

// Gzip Base64 Decode
const decodeAndDecompress = (
  base64Body: string
): EewInformation.Latest.Main | null => {
  try {
    const binaryString = atob(base64Body);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.ungzip(bytes, { to: "string" });
    const jsonData = JSON.parse(decompressed);
    if (process.env.NODE_ENV === 'development') {
      console.log("data:", jsonData);
    }

    if (isEewInformationMain(jsonData)) {
      return jsonData;
    } else {
      console.warn("データが緊急地震速報の形式と一致しません。");
      return null;
    }
  } catch (error) {
    console.error("デコードまたは解凍に失敗しました:", error);
    toast.error("データ処理に失敗しました。");
    return null;
  }
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isDMDATAConnected, setIsDMDATAConnected] = useState(false);
  const [DMDATAreceivedData, setDMDATAReceivedData] =
    useState<EewInformation.Latest.Main | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const socketIdRef = useRef<number | null>(null);
  const passedIntensityFilterRef = useRef<Set<string>>(new Set());
  const [isAXISConnected, setIsAXISConnected] = useState(false);
  const [AXISreceivedData, setAXISReceivedData] = useState<AXISEewInformation | null>(null);
  const axisWsRef = useRef<WebSocket | null>(null);
  const axisRetrySecRef = useRef<number>(100);
  const axisRetryCountRef = useRef<number>(0);
  const axisRetryMaxRef = useRef<number>(10);
  const axisHeartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayDataList, setDisplayDataList] = useState<EewInformation.Latest.Main[]>([]);
  const [axisDisplayDataList, setAxisDisplayDataList] = useState<AXISEewInformation[]>([]);
  const receivedEventsRef = useRef<Record<string, { source: "DMDATA" | "AXIS", timestamp: number }>>({});
  const dmdataLatestSerialRef = useRef<Record<string, number>>({});
  const axisLatestSerialRef = useRef<Record<string, number>>({});

  const shouldProcessDMDATAData = (data: EewInformation.Latest.Main): boolean => {
    const eventId = data.eventId;
    const serialNo = parseInt(data.serialNo || '0', 10);
    const isCanceled = data.body?.isCanceled || false;
    
    const currentLatestSerial = dmdataLatestSerialRef.current[eventId] || 0;
    
    if (isCanceled) {
      return true;
    }
    
    if (serialNo > currentLatestSerial) {
      dmdataLatestSerialRef.current[eventId] = serialNo;
      return true;
    }
    
    if (serialNo < currentLatestSerial) {
      return false;
    }
    
    return false;
  };

  const shouldProcessAXISData = (data: AXISEewInformation): boolean => {
    const eventId = data.EventID;
    const serialNo = data.Serial;
    const isCanceled = data.Flag.is_cancel;
    
    const currentLatestSerial = axisLatestSerialRef.current[eventId] || 0;
    
    if (isCanceled) {
      return true;
    }
    
    if (serialNo > currentLatestSerial) {
      axisLatestSerialRef.current[eventId] = serialNo;
      return true;
    }
    
    if (serialNo < currentLatestSerial) {
      return false;
    }
    
    return false;
  };

  useEffect(() => {
    if (DMDATAreceivedData) {
      if (!shouldProcessDMDATAData(DMDATAreceivedData)) {
        return;
      }

      const eventId = DMDATAreceivedData.eventId;
      const currentTime = Date.now();
      const existingEvent = receivedEventsRef.current[eventId];
      
      if (!existingEvent) {
        receivedEventsRef.current[eventId] = { source: "DMDATA", timestamp: currentTime };
        setDisplayDataList(prev => {
          const filtered = prev.filter(item => item.eventId !== eventId);
          return [DMDATAreceivedData, ...filtered];
        });
      } else if (existingEvent.source === "DMDATA") {
        receivedEventsRef.current[eventId] = { source: "DMDATA", timestamp: currentTime };
        setDisplayDataList(prev => {
          const filtered = prev.filter(item => item.eventId !== eventId);
          return [DMDATAreceivedData, ...filtered];
        });
      } else if (existingEvent.source === "AXIS") {
        receivedEventsRef.current[eventId] = { source: "DMDATA", timestamp: currentTime };
        setDisplayDataList(prev => {
          const filtered = prev.filter(item => item.eventId !== eventId);
          return [DMDATAreceivedData, ...filtered];
        });
        setAxisDisplayDataList(prev => prev.filter(item => item.EventID !== eventId));
      }
    }
  }, [DMDATAreceivedData]);

  useEffect(() => {
    if (AXISreceivedData) {
      if (!shouldProcessAXISData(AXISreceivedData)) {
        return;
      }

      const eventId = AXISreceivedData.EventID;
      const currentTime = Date.now();
      const existingEvent = receivedEventsRef.current[eventId];
      
      if (!existingEvent) {
        receivedEventsRef.current[eventId] = { source: "AXIS", timestamp: currentTime };

        setAxisDisplayDataList(prev => {
          const filtered = prev.filter(item => item.EventID !== eventId);
          return [AXISreceivedData, ...filtered];
        });
      } else if (existingEvent.source === "AXIS") {
        receivedEventsRef.current[eventId] = { source: "AXIS", timestamp: currentTime };
        setAxisDisplayDataList(prev => {
          const filtered = prev.filter(item => item.EventID !== eventId);
          return [AXISreceivedData, ...filtered];
        });
      } else if (existingEvent.source === "DMDATA") {
        console.log(`AXIS data for event ${eventId} ignored as DMDATA is already active`);
      }
    }
  }, [AXISreceivedData]);

  // DMDATA WebSocket接続処理
  const connectDMDATAWebSocket = async (token: string, enableDrillTestInfo: boolean) => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      toast.warning("WebSocketはすでに接続されています。");
      return;
    }

    const socketStartUrl = "https://api.dmdata.jp/v2/socket";
    const requestBody = {
      classifications: ["eew.forecast"],
      types: ["VXSE45"],
      test: enableDrillTestInfo ? "including" : "no",
      appName: "ShinQuick",
      formatMode: "json",
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(socketStartUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // エラーハンドリング
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 409) {
          toast.error("同時接続数が上限に達しているため、WebSocketに接続できません。");
        }
        throw new Error(`WebSocket接続エラー: ${response.status} / ${text}`);
      }

      // レスポンス処理
      const data = await response.json();
      if (!data.websocket || !data.websocket.url || !data.websocket.id) {
        throw new Error("websocket.urlまたはwebsocket.idが見つかりません。");
      }

      // WebSocket接続
      const ws = new WebSocket(data.websocket.url, ["dmdata.v2"]);
      wsRef.current = ws;
      socketIdRef.current = data.websocket.id;

      // 接続イベント
      ws.addEventListener("open", () => {
        setIsDMDATAConnected(true);
        console.log("WebSocket connected");
        toast.success("WebSocketに接続しました！");
      });

      // メッセージ受信イベント
      ws.addEventListener("message", async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", pingId: msg.pingId }));
            return;
          }
          
          // データメッセージの処理
          if (msg.type === "data" && msg.format === "json") {
            requestAnimationFrame(() => {
              const decoded = decodeAndDecompress(msg.body);
              if (decoded) {
                setDMDATAReceivedData(decoded);
              } else {
                console.warn("受信したデータ形式が無効です。");
              }
            });
          }
        } catch (e) {
          console.error("メッセージ処理エラー:", e);
        }
      });

      // 切断イベント
      ws.addEventListener("close", () => {
        setIsDMDATAConnected(false);
        socketIdRef.current = null;
        console.log("WebSocketが切断されました。");
      });

      // エラーイベント
      ws.addEventListener("error", (err) => {
        console.error("WebSocketエラー:", err);
        toast.error("WebSocketでエラーが発生しました。");
      });
    } catch (err) {
      console.error("WebSocket接続に失敗しました:", err);
      toast.error("WebSocket接続に失敗しました。");
    }
  };

  // WebSocket切断処理
  const disconnectDMDATAWebSocket = async () => {
    if (!socketIdRef.current) {
      toast.warning(
        "WebSocket IDが見つかりません。すでに切断されている可能性があります。"
      );
      return;
    }

    const socketCloseUrl = `https://api.dmdata.jp/v2/socket/${socketIdRef.current}`;
    const token = localStorage.getItem("dmdata_access_token") || "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(socketCloseUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        // 状態のリセット
        socketIdRef.current = null;
        setDMDATAReceivedData(null);
        setIsDMDATAConnected(false);
        toast.info("WebSocketを正常に切断しました。");
      } else {
        // エラーレスポンスの処理
        const errorData = await response.json();
        throw new Error(
          `WebSocket切断エラー: ${errorData.error?.message || '不明なエラー'} (コード: ${errorData.error?.code || 'なし'})`
        );
      }
    } catch (err) {
      console.error("WebSocket切断に失敗しました:", err);
      
      // エラーメッセージの整形
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      toast.error(`WebSocketの切断に失敗しました: ${errorMessage}`);
      
      // 接続が既に切れている可能性があるため、状態をリセット
      if (wsRef.current) {
        wsRef.current = null;
      }
      socketIdRef.current = null;
      setIsDMDATAConnected(false);
    }
  };

  // テストデータ注入処理の最適化
  const injectdmdataTestData = useCallback((testData: { body: string }) => {
    requestAnimationFrame(() => {
      const decodedData = decodeAndDecompress(testData.body);
      if (decodedData) {
        setDMDATAReceivedData(decodedData);
        toast.success("テストデータOK");
      } else {
        toast.error("形式が無効");
      }
    });
  }, []);

  const injectaxisTestData = useCallback((testData: AXISEewInformation) => {
    requestAnimationFrame(() => {
      setAXISReceivedData(testData);
      toast.success("テストデータOK");
    });
  }, []);

  // AXIS WebSocket接続処理
  const connectAXISWebSocket = async (token: string) => {
    if (
      axisWsRef.current &&
      (axisWsRef.current.readyState === WebSocket.OPEN ||
        axisWsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      toast.warning("AXIS WebSocketはすでに接続されています。");
      return;
    }

    try {
      // WebSocketの接続
      const socketUrl = `wss://ws.axis.prioris.jp/socket?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(socketUrl);
      axisWsRef.current = ws;

      // 接続時の処理
      ws.addEventListener("open", () => {
        setIsAXISConnected(true);
        console.log("AXIS WebSocket connected");
        toast.success("AXIS WebSocketに接続しました！");
        axisRetrySecRef.current = 100;
        axisRetryCountRef.current = 0;
        startAxisHeartbeat();
      });

      // メッセージ受信時の処理
      ws.addEventListener("message", (ev) => {
        try {
          const message = ev.data;
          
          if (message === 'hello') {
            axisRetrySecRef.current = 100;
            axisRetryCountRef.current = 0;
            console.log('AXIS: hello received');
          } else if (message === 'hb') {
          } else {
            const data = JSON.parse(message);
            console.log(`AXIS: ${data.channel} received`);
            
            if (data.channel === 'eew') {
              setAXISReceivedData(data.message);
            }
          }
        } catch (e) {
          console.error("AXIS メッセージ処理エラー:", e);
        }
      });

      // エラー発生時の処理
      ws.addEventListener("error", (err) => {
        console.error("AXIS WebSocketエラー:", err);
        toast.error("AXIS WebSocketでエラーが発生しました。");
      });

      // 切断時の処理
      ws.addEventListener("close", () => {
        setIsAXISConnected(false);
        stopAxisHeartbeat();
        console.log("AXIS WebSocketが切断されました。");
        
        // 再接続処理
        retryAxisConnection();
      });
    } catch (err) {
      console.error("AXIS WebSocket接続に失敗しました:", err);
      toast.error("AXIS WebSocket接続に失敗しました。");
      retryAxisConnection();
    }
  };

  // AXIS WebSocket切断処理
  const disconnectAXISWebSocket = async () => {
    if (axisWsRef.current) {
      stopAxisHeartbeat();
      axisWsRef.current.close();
      axisWsRef.current = null;
      setIsAXISConnected(false);
      toast.info("AXIS WebSocketを正常に切断しました。");
    } else {
      toast.warning("AXIS WebSocketはすでに切断されています。");
    }
  };

  const startAxisHeartbeat = () => {
    if (axisHeartbeatTimerRef.current) {
      clearTimeout(axisHeartbeatTimerRef.current);
    }
    
    const sendHeartbeat = () => {
      if (axisWsRef.current && axisWsRef.current.readyState === WebSocket.OPEN) {
        axisWsRef.current.send('hb');
        axisHeartbeatTimerRef.current = setTimeout(sendHeartbeat, 30000);
      }
    };
    
    sendHeartbeat();
  };

  const stopAxisHeartbeat = () => {
    if (axisHeartbeatTimerRef.current) {
      clearTimeout(axisHeartbeatTimerRef.current);
      axisHeartbeatTimerRef.current = null;
    }
  };

  // AXIS 再接続処理
  const retryAxisConnection = () => {
    axisRetrySecRef.current = axisRetrySecRef.current * 2;
    
    if (axisRetryCountRef.current < axisRetryMaxRef.current) {
      axisRetryCountRef.current++;
      console.log(`AXIS Retry: ${axisRetryCountRef.current} (delay ${axisRetrySecRef.current}ms)`);
      
      setTimeout(() => {
        const token = localStorage.getItem("axis_access_token") || "";
        if (token) {
          connectAXISWebSocket(token);
        }
      }, axisRetrySecRef.current);
    } else {
      console.log("AXIS 最大再接続回数に達しました。");
    }
  };

  return (
    <WebSocketContext.Provider
      value={{
        isDMDATAConnected,
        DMDATAreceivedData,
        connectDMDATAWebSocket,
        disconnectDMDATAWebSocket,
        injectdmdataTestData,
        injectaxisTestData,
        passedIntensityFilterRef,
        isAXISConnected,
        AXISreceivedData,
        connectAXISWebSocket,
        disconnectAXISWebSocket,
        displayDataList,
        axisDisplayDataList,
        setAxisDisplayDataList,
        setDisplayDataList,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketはWebSocketProvider内で使用する必要があります。");
  }
  return ctx;
};
