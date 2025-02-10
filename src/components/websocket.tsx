"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import { toast } from "sonner";
import pako from "pako";
import { EewInformation } from "@dmdata/telegram-json-types";

const isEewInformationMain = (
  data: unknown
): data is EewInformation.Latest.Main => {
  return (
    typeof data === "object" &&
    data !== null &&
    "_schema" in data &&
    (data as EewInformation.Latest.Main)._schema.type === "eew-information" &&
    (data as EewInformation.Latest.Main)._schema.version === "1.0.0"
  );
};

// Gzip Base64 Decode
const decodeAndDecompress = (
  base64Body: string
): EewInformation.Latest.Main | null => {
  try {
    const binaryString = atob(base64Body);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.ungzip(bytes, { to: "string" });
    const jsonData = JSON.parse(decompressed);
    console.log("data:", jsonData);

    if (isEewInformationMain(jsonData)) {
      return jsonData;
    } else {
      console.warn("データが形式と一致しません。");
      return null;
    }
  } catch (error) {
    console.error("デコードまたは解凍に失敗しました:", error);
    toast.error("データ処理に失敗しました。");
    return null;
  }
};

interface WebSocketContextType {
  isConnected: boolean;
  receivedData: EewInformation.Latest.Main | null;
  connectWebSocket: (token: string, enableDrillTestInfo: boolean) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  injectTestData: (data: { body: string }) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] =
    useState<EewInformation.Latest.Main | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const socketIdRef = useRef<number | null>(null);

  const connectWebSocket = async (token: string, enableDrillTestInfo: boolean) => {
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
      appName: "Shin-Quick",
      formatMode: "json",
    };

    try {
      const response = await fetch(socketStartUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 409) {
          toast.error("同時接続数が上限に達しているため、WebSocketに接続できません。");
        }
        throw new Error(`WebSocket接続エラー: ${response.status} / ${text}`);
      }

      const data = await response.json();
      if (!data.websocket || !data.websocket.url || !data.websocket.id) {
        throw new Error("websocket.urlまたはwebsocket.idが見つかりません。");
      }

      const ws = new WebSocket(data.websocket.url, ["dmdata.v2"]);
      wsRef.current = ws;
      socketIdRef.current = data.websocket.id;

      ws.addEventListener("open", () => {
        setIsConnected(true);
        console.log("WebSocket connected");
        toast.success("WebSocketに接続しました！");
      });

      ws.addEventListener("message", async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", pingId: msg.pingId }));
            return;
          }
          if (msg.type === "data" && msg.format === "json") {
            const decoded = decodeAndDecompress(msg.body);
            if (decoded) {
              setReceivedData(decoded);
            } else {
              console.warn("受信したデータ形式が無効です。");
            }
          }
        } catch (e) {
          console.error("メッセージ処理エラー:", e);
        }
      });

      ws.addEventListener("close", () => {
        setIsConnected(false);
        socketIdRef.current = null;
        console.log("WebSocketが切断されました。");
      });

      ws.addEventListener("error", (err) => {
        console.error("WebSocketエラー:", err);
        toast.error("WebSocketでエラーが発生しました。");
      });
    } catch (err) {
      console.error("WebSocket接続に失敗しました:", err);
    }
  };

  const disconnectWebSocket = async () => {
    if (!socketIdRef.current) {
      toast.warning(
        "WebSocket IDが見つかりません。すでに切断されている可能性があります。"
      );
      return;
    }

    const socketCloseUrl = `https://api.dmdata.jp/v2/socket/${socketIdRef.current}`;

    try {
      const response = await fetch(socketCloseUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${
            localStorage.getItem("dmdata_access_token") || ""
          }`,
        },
      });

      if (response.ok) {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        socketIdRef.current = null;
        setReceivedData(null);
        setIsConnected(false);
        toast.info("WebSocketを正常に切断しました。");
      } else {
        const errorData = await response.json();
        throw new Error(
          `WebSocket切断エラー: ${errorData.error.message} (コード: ${errorData.error.code})`
        );
      }
    } catch (err) {
      console.error("WebSocket切断に失敗しました:", err);
      toast.error(
        `WebSocketの切断に失敗しました: ${(err as Error).message}`
      );
    }
  };

  const injectTestData = useCallback((testData: { body: string }) => {
    const decodedData = decodeAndDecompress(testData.body);
    if (decodedData) {
      setReceivedData(decodedData);
      toast.success("テストデータOK");
    } else {
      toast.error("形式が無効");
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        receivedData,
        connectWebSocket,
        disconnectWebSocket,
        injectTestData,
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
