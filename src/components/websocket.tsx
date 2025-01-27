"use client";

import React, { createContext, useContext, useState, useRef } from "react";
import { toast } from "sonner";

interface WebSocketContextType {
  isConnected: boolean;
  receivedData: Record<string, unknown> | null;
  connectWebSocket: (token: string) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<Record<string, unknown> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const socketIdRef = useRef<number | null>(null);

  const connectWebSocket = async (token: string) => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      toast.warning('WebSocketは既に接続されています。');
      return;
    }

    const socketStartUrl = "https://api.dmdata.jp/v2/socket";
    const requestBody = {
      classifications: ["eew.forecast"],
      types: ["VXSE45"],
      test: "including",
      appName: "Shin-Quick",
      formatMode: "json",
    };

    try {
      const response = await fetch(socketStartUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`WebSocket start error: ${response.status} / ${text}`);
      }

      const data = await response.json();
      if (!data.websocket || !data.websocket.url || !data.websocket.id) {
        throw new Error("websocket.url または websocket.id が見つかりません");
      }

      const ws = new WebSocket(data.websocket.url, ["dmdata.v2"]);
      wsRef.current = ws;
      socketIdRef.current = data.websocket.id;
      ws.addEventListener("open", () => {
        setIsConnected(true);
        console.log("WebSocket connected");
        toast.success('WebSocketに接続されました！');
      });

      ws.addEventListener("message", async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", pingId: msg.pingId }));
            return;
          }
          if (msg.type === "data" && msg.format === "json") {
            const decoded = await decodeBase64Gzip(msg.body);
            const parsed = JSON.parse(decoded);
            setReceivedData(parsed);
          }
        } catch (e) {
          console.error("メッセージ処理エラー", e);
        }
      });

      ws.addEventListener("close", () => {
        setIsConnected(false);
        socketIdRef.current = null;
        console.log("WebSocket closed");
      });

      ws.addEventListener("error", (err) => {
        console.error("WebSocket error", err);
        toast.error('WebSocketでエラーが発生しました');
      });
    } catch (err) {
      console.error("WebSocket接続に失敗:", err);
      toast.error('WebSocket接続に失敗しました');
      console.error(token);
    }
  };

  const disconnectWebSocket = async () => {
    if (!socketIdRef.current) {
      toast.warning('WebSocket IDが見つかりません。既に切断されている可能性があります。');
      return;
    }

    const socketCloseUrl = `https://api.dmdata.jp/v2/socket/${socketIdRef.current}`;

    try {
      const response = await fetch(socketCloseUrl, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("dmdata_access_token") || ""}`,
        },
      });

      if (response.ok) {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        socketIdRef.current = null;
        setReceivedData(null);
        toast.info('WebSocketを正常に切断しました');
      } else {
        const errorData = await response.json();
        throw new Error(`WebSocket切断エラー: ${errorData.error.message} (コード: ${errorData.error.code})`);
      }
    } catch (err) {
      console.error("WebSocket切断に失敗:", err);
      toast.error(`WebSocket切断に失敗しました: ${(err as Error).message}`);
    }
  };

  // Gzip Base64 Decode
  const decodeBase64Gzip = async (base64Data: string): Promise<string> => {
    try {
      const binaryString = atob(base64Data);
      const binaryLen = binaryString.length;
      const bytes = new Uint8Array(binaryLen);
      for (let i = 0; i < binaryLen; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes]);
      const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));

      const decompressedBuffer = await new Response(stream).text();
      return decompressedBuffer;
    } catch (error) {
      console.error("デコードまたは解凍に失敗しました:", (error as Error).message);
      throw error;
    }
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, receivedData, connectWebSocket, disconnectWebSocket }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
};
