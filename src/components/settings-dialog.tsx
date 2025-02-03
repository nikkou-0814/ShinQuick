"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWebSocket } from "@/components/websocket";

interface Settings {
  theme: "system" | "dark" | "light";
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
  enable_accuracy_info: boolean;
  enable_drill_test_info: boolean;
  enable_map_intensity_fill: boolean;
  world_map_resolution: "10m" | "50m" | "110m";
}

interface SettingsDialogProps {
  showSettings: boolean;
  setShowSettings: (value: boolean) => void;
  settings: Settings;
  handleSettingChange: (key: keyof Settings, value: Settings[keyof Settings]) => void;
  onConnectWebSocket: () => void;
  isAuthenticated: boolean;
  onDisconnectAuthentication: () => void;
  onDisconnectWebSocket: () => Promise<void>;
}

const THEME_OPTIONS = [
  { value: "system", label: "システム" },
  { value: "dark", label: "ダーク" },
  { value: "light", label: "ライト" },
] as const;

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  showSettings,
  setShowSettings,
  settings,
  handleSettingChange,
  onConnectWebSocket,
  isAuthenticated,
  onDisconnectAuthentication,
  onDisconnectWebSocket,
}) => {
  const [openTheme, setOpenTheme] = useState(false);
  const [openWorldMapRes, setOpenWorldMapRes] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false);
  const [showDrillTestAlert, setShowDrillTestAlert] = useState(false);
  const { isConnected } = useWebSocket();

  const handleToggleLowAccuracyEEW = (checked: boolean) => {
    if (checked) {
      setShowAlert(true);
    } else {
      handleSettingChange("enable_low_accuracy_eew", false);
    }
  };

  const confirmLowAccuracyEEW = () => {
    handleSettingChange("enable_low_accuracy_eew", true);
    setShowAlert(false);
  };

  const handleToggleDrillTestInfo = (checked: boolean) => {
    if (checked) {
      setShowDrillTestAlert(true);
    } else {
      handleSettingChange("enable_drill_test_info", false);
    }
  };

  const confirmDrillTestInfo = () => {
    handleSettingChange("enable_drill_test_info", true);
    setShowDrillTestAlert(false);
  };

  const handleAuthenticationClick = () => {
    if (isAuthenticated) {
      setShowDisconnectAlert(true);
    } else {
      if (typeof window !== "undefined") {
        window.location.href = "/api/oauth/authorize";
      }
    }
  };

  const confirmDisconnectAuthentication = () => {
    onDisconnectAuthentication();
    setShowDisconnectAlert(false);
  };

  const handleWebSocketToggle = async () => {
    if (isConnected) {
      await onDisconnectWebSocket();
    } else {
      onConnectWebSocket();
    }
  };

  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent style={{ maxHeight: "80vh", overflow: "scroll" }}>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>設定を変更することができます</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 強震モニタ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>強震モニタを有効にする</span>
              <Switch
                checked={settings.enable_kyoshin_monitor}
                onCheckedChange={(checked) =>
                  handleSettingChange("enable_kyoshin_monitor", checked)
                }
              />
            </div>
            <p className="text-sm text-gray-500">
              強震モニタとP/S波をリアルタイムに表示します。
            </p>
          </div>

          {/* 動的ズーム */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>地図の動的ズームを有効にする</span>
              <Switch
                checked={settings.enable_dynamic_zoom}
                onCheckedChange={(checked) =>
                  handleSettingChange("enable_dynamic_zoom", checked)
                }
              />
            </div>
            <p className="text-sm text-gray-500">
              地図の表示が自動的に拡大・縮小・移動されるようになります。<br />
              （この機能は現在開発中です。）
            </p>
          </div>

          {/* 精度の低い緊急地震速報 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>精度の低い緊急地震速報を表示する（1点観測）</span>
              <Switch
                checked={settings.enable_low_accuracy_eew}
                onCheckedChange={handleToggleLowAccuracyEEW}
              />
            </div>
            <p
              className="text-sm font-bold text-gray-500 cursor-pointer flex items-center"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronDown className="mr-2" />
              ) : (
                <ChevronRight className="mr-2" />
              )}
              十分に知識がある方のみご利用ください。
            </p>
            {isCollapsed && (
              <div className="text-sm text-gray-500">
                <p>
                  緊急地震速報の1点観測では、観測された揺れが地震によるものとは限りません。
                </p>
                <p>
                  例えば、事故や落雷による振動、または観測機器の不具合などが原因で、
                  誤った情報が発信される場合があります。
                </p>
              </div>
            )}
          </div>

          {/* 緊急地震速報の精度情報 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>緊急地震速報の精度情報を表示する</span>
              <Switch
                checked={settings.enable_accuracy_info}
                onCheckedChange={(checked) =>
                  handleSettingChange("enable_accuracy_info", checked)
                }
              />
            </div>
            <p className="text-sm text-gray-500">
              震源やマグニチュードの精度情報を表示します。
            </p>
          </div>

          {/* 訓練報・テスト報 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>訓練報・テスト報の受信をする</span>
              <Switch
                checked={settings.enable_drill_test_info}
                onCheckedChange={handleToggleDrillTestInfo}
              />
            </div>
            <p className="text-sm text-gray-500">
              反映には一度WebSocketを切断する必要があります。
            </p>
          </div>

          {/* 細分化地域の予想震度 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>細分化地域の予想震度を表示する</span>
              <Switch
                checked={settings.enable_map_intensity_fill}
                onCheckedChange={(checked) =>
                  handleSettingChange("enable_map_intensity_fill", checked)
                }
              />
            </div>
            <p className="text-sm text-gray-500">
              細分化地域における震度予測がされた場合に対象の地域を塗りつぶします。<br />
              （この機能は現在開発中です。）
            </p>
          </div>

          {/* テーマ */}
          <div className="space-y-2">
            <p className="text-sm">テーマ</p>
            <Popover open={openTheme} onOpenChange={setOpenTheme}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openTheme}
                  className="w-full justify-between"
                >
                  {settings.theme
                    ? THEME_OPTIONS.find(
                        (theme) => theme.value === settings.theme
                      )?.label
                    : "テーマを選択"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {THEME_OPTIONS.map((theme) => (
                        <CommandItem
                          key={theme.value}
                          value={theme.value}
                          onSelect={(currentValue) => {
                            handleSettingChange(
                              "theme",
                              currentValue as "system" | "dark" | "light"
                            );
                            setOpenTheme(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              settings.theme === theme.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {theme.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-sm text-gray-500">
              アプリケーションの外観を変更できます。
              <br />
              「システム」設定では、デバイスの設定に従います。
            </p>
          </div>

          {/* 世界地図の解像度 */}
          <div className="space-y-2">
            <p className="text-sm">世界地図の解像度</p>
            <Popover open={openWorldMapRes} onOpenChange={setOpenWorldMapRes}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openWorldMapRes}
                  className="w-full justify-between"
                >
                  {settings.world_map_resolution}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {["10m", "50m", "110m"].map((res) => (
                        <CommandItem
                          key={res}
                          value={res}
                          onSelect={(currentValue) => {
                            handleSettingChange(
                              "world_map_resolution",
                              currentValue as "10m" | "50m" | "110m"
                            );
                            setOpenWorldMapRes(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              settings.world_map_resolution === res ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {res}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-sm text-gray-500">
              世界地図（日本以外）の読み込み解像度を変更できます。<br />
              （10m: 高解像度, 50m: 中解像度, 110m: 低解像度）
            </p>
          </div>

          {/* 認証とWebSocket接続 */}
          <div className="space-y-2">
            <p className="text-sm">Project DM-D.S.S</p>
            <Button
              variant={isAuthenticated ? "destructive" : "outline"}
              onClick={handleAuthenticationClick}
              className="mr-4"
            >
              {isAuthenticated ? "アカウントとの連携を解除" : "認証"}
            </Button>
            {isAuthenticated && (
              <Button
                variant={isConnected ? "destructive" : "outline"}
                onClick={handleWebSocketToggle}
              >
                {isConnected ? "WebSocketを切断" : "WebSocketに接続"}
              </Button>
            )}
            <p className="text-sm text-gray-500">
              DM-D.S.Sにアカウントを連携すると<br />WebSocketを使用してリアルタイムの情報を受信できます。
            </p>
          </div>
        </div>
      </DialogContent>

      {/* 精度の低い緊急地震速報有効化確認ダイアログ */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に有効にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              再度ご確認ください。
              <br />
              緊急地震速報の1点観測では、観測された揺れが地震によるものとは限りません。
              <br />
              例えば、事故や落雷による振動、または観測機器の不具合などが原因で、
              <br />
              誤った情報が発信される場合があります。
              <br />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLowAccuracyEEW}>
              有効にする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* アカウント連携解除確認ダイアログ */}
      <AlertDialog open={showDisconnectAlert} onOpenChange={setShowDisconnectAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              本当にアカウントとの連携を解除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              アカウントとの連携を解除すると、再度認証をしないとWebSocketが接続できません。
              <br />
              続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnectAuthentication}>
              連携を解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDrillTestAlert} onOpenChange={setShowDrillTestAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に有効にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              訓練報やテスト報を受信すると、実際の地震とは
              <br />
              無関係の通知やバグが発生する場合があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDrillTestInfo}>
              有効にする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default SettingsDialog;
