"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import SettingItem from "@/components/setting-item";
import { Slider } from "@/components/ui/slider"

interface Settings {
  theme: "system" | "dark" | "light";
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
  enable_accuracy_info: boolean;
  enable_drill_test_info: boolean;
  enable_map_intensity_fill: boolean;
  enable_map_warning_area: boolean;
  world_map_resolution: "10m" | "50m" | "110m";
  ps_wave_update_interval: number;
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
  isConnected: boolean;
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
  isConnected,
}) => {
  const [openTheme, setOpenTheme] = useState(false);
  const [openWorldMapRes, setOpenWorldMapRes] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showDisconnectAlert, setShowDisconnectAlert] = useState(false);
  const [showDrillTestAlert, setShowDrillTestAlert] = useState(false);

  const handleWebSocketToggle = useCallback(async () => {
    if (isConnected) {
      await onDisconnectWebSocket();
    } else {
      onConnectWebSocket();
    }
  }, [isConnected, onConnectWebSocket, onDisconnectWebSocket]);

  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">設定</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="display" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="display">表示</TabsTrigger>
            <TabsTrigger value="features">機能</TabsTrigger>
            <TabsTrigger value="eew">緊急地震速報</TabsTrigger>
            <TabsTrigger value="dmdss">Project DM-D.S.S</TabsTrigger>
          </TabsList>

          {/* 表示設定 */}
          <TabsContent value="display">
            <Card>
              <CardContent className="space-y-4 pt-4">
                <SettingItem
                  title="アプリテーマ"
                  description="アプリケーションの外観を変更できます。「システム」設定では、デバイスの設定に従います。"
                >
                  <Popover open={openTheme} onOpenChange={setOpenTheme}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openTheme}
                      >
                        {THEME_OPTIONS.find(
                          (theme) => theme.value === settings.theme
                        )?.label}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-fit p-0">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {THEME_OPTIONS.map((theme) => (
                              <CommandItem
                                key={theme.value}
                                value={theme.value}
                                onSelect={(value) => {
                                  handleSettingChange("theme", value as Settings["theme"]);
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
                </SettingItem>

                <SettingItem
                  title="世界地図の解像度"
                  description="世界地図（日本以外）の読み込み解像度を変更できます。（10m: 高解像度, 50m: 中解像度, 110m: 低解像度）"
                >
                  <Popover open={openWorldMapRes} onOpenChange={setOpenWorldMapRes}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                      >
                        {settings.world_map_resolution}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-fit p-0">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {["10m", "50m", "110m"].map((res) => (
                              <CommandItem
                                key={res}
                                value={res}
                                onSelect={(value) => {
                                  handleSettingChange("world_map_resolution", value as Settings["world_map_resolution"]);
                                  setOpenWorldMapRes(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    settings.world_map_resolution === res
                                      ? "opacity-100"
                                      : "opacity-0"
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
                </SettingItem>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 機能設定 */}
          <TabsContent value="features">
            <Card>
              <CardContent className="space-y-4 pt-4">
                <SettingItem
                  title="強震モニタを有効にする"
                  description="強震モニタと緊急地震速報（震源とP/S波予測円のみ）を表示します。"
                >
                  <Switch
                    checked={settings.enable_kyoshin_monitor}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enable_kyoshin_monitor", checked)
                    }
                  />
                </SettingItem>

                <SettingItem
                  title="地図の動的ズームを有効にする"
                  description="地図の表示が自動的に拡大・縮小・移動されるようになります。（この機能は現在開発中なので、不安定です。）"
                >
                  <Switch
                    checked={settings.enable_dynamic_zoom}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enable_dynamic_zoom", checked)
                    }
                  />
                </SettingItem>

                <SettingItem
                  title="細分化地域の予想震度を表示する"
                  description="細分化地域における震度予測がされた場合に、対象の地域を塗りつぶします。（この機能は現在開発中なので、不安定です。）※DM-D.S.Sを利用しない場合は使用できません。"
                >
                  <Switch
                  checked={isAuthenticated ? settings.enable_map_intensity_fill : false}
                  onCheckedChange={(checked) =>
                    handleSettingChange("enable_map_intensity_fill", checked)
                  }
                  disabled={!isAuthenticated}
                  />
                </SettingItem>

                <SettingItem
                  title="警報発表地域の塗りつぶしを有効にする"
                  description="警報が発表されている、地域を塗りつぶします。※DM-D.S.Sを利用しない場合は使用できません。"
                >
                  <Switch
                  checked={isAuthenticated ? settings.enable_map_warning_area : false}
                  onCheckedChange={(checked) =>
                    handleSettingChange("enable_map_warning_area", checked)
                  }
                  disabled={!isAuthenticated}
                  />
                </SettingItem>

                <SettingItem
                  title="予測円の更新間隔"
                  description={`P/S波予測円の更新間隔を設定できます。（ミリ秒）(${settings.ps_wave_update_interval} ms)`}
                >
                  <Slider
                    value={[settings.ps_wave_update_interval]}
                    max={1000}
                    min={0}
                    step={1}
                    onValueChange={(value) =>
                      handleSettingChange("ps_wave_update_interval", value[0])
                    }
                    className="ml-4"
                  />
                </SettingItem>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 緊急地震速報設定 */}
          <TabsContent value="eew">
            <Card>
              <CardContent className="space-y-4 pt-4">
                <SettingItem
                  title="精度の低い緊急地震速報を表示する（1点観測）"
                  description="十分に知識がある方のみご利用ください。誤報の可能性が高くなります。※DM-D.S.Sを利用しない場合は使用できません。"
                >
                  <Switch
                  checked={isAuthenticated ? settings.enable_low_accuracy_eew : false}
                  onCheckedChange={(checked) => {
                    if (checked) setShowAlert(true);
                    else handleSettingChange("enable_low_accuracy_eew", false);
                  }}
                  disabled={!isAuthenticated}
                  />
                </SettingItem>

                <SettingItem
                  title="緊急地震速報の精度情報を表示する"
                  description="イベント毎の情報が長くなるため、複数地震が発生した場合に見切れる場合があります。※DM-D.S.Sを利用しない場合は使用できません。"
                >
                  <Switch
                  checked={isAuthenticated ? settings.enable_accuracy_info : false}
                  onCheckedChange={(checked) =>
                    handleSettingChange("enable_accuracy_info", checked)
                  }
                  disabled={!isAuthenticated}
                  />
                </SettingItem>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 接続設定 */}
          <TabsContent value="dmdss">
            <Card>
              <CardHeader>
                <CardTitle>Project DM-D.S.S</CardTitle>
                <CardDescription>
                  Project DM-D.S.Sを使用することで、数秒程度の遅延に抑えることができ、1点緊急地震速報、地図の塗りつぶしなどが使用可能になります。
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Table>
                  <TableCaption>使用可能な区分のみ表示しています。</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>区分名</TableHead>
                      <TableHead>区分API名</TableHead>
                      <TableHead className="text-right">価格（月）</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">緊急地震（予報）</TableCell>
                      <TableCell>eew.forecast</TableCell>
                      <TableCell className="text-right">1650円</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <SettingItem
                  title="アカウント連携"
                  description="DM-D.S.Sアカウントを連携してリアルタイム情報を受信します。"
                >
                  <Button
                    variant={isAuthenticated ? "destructive" : "default"}
                    onClick={() => {
                      if (isAuthenticated) {
                        setShowDisconnectAlert(true);
                      } else if (typeof window !== "undefined") {
                        window.location.href = "/api/oauth/authorize";
                      }
                    }}
                  >
                    {isAuthenticated ? "連携を解除" : "アカウント認証"}
                  </Button>
                </SettingItem>

                {isAuthenticated && (
                  <SettingItem
                    title="WebSocket接続"
                    description="リアルタイム情報を受信するためにWebSocketを接続します。"
                  >
                    <Button
                      variant={isConnected ? "destructive" : "default"}
                      onClick={handleWebSocketToggle}
                    >
                      {isConnected ? "接続を切断" : "接続を開始"}
                    </Button>
                  </SettingItem>
                )}

                <SettingItem
                  title="訓練報・テスト報の受信"
                  description="設定を反映するにはWebSocket接続の再接続が必要です。"
                >
                  <Switch
                    checked={settings.enable_drill_test_info}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setShowDrillTestAlert(true);
                      } else {
                        handleSettingChange("enable_drill_test_info", false);
                      }
                    }}
                  />
                </SettingItem>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 各種確認用アラートダイアログ */}
        <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>本当に有効にしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                再度ご確認ください。
                緊急地震速報の1点観測では、観測された揺れが地震によるものとは限りません。
                例えば、事故や落雷による振動、または観測機器の不具合などが原因で、
                誤った情報が発信される場合があります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleSettingChange("enable_low_accuracy_eew", true);
                  setShowAlert(false);
                }}
              >
                有効にする
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={showDisconnectAlert}
          onOpenChange={setShowDisconnectAlert}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>本当にアカウントとの連携を解除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                アカウントとの連携を解除すると、再度認証をしないとWebSocketが接続できません。
                続行しますか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDisconnectAuthentication();
                  setShowDisconnectAlert(false);
                }}
              >
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
                訓練報やテスト報を受信すると、実際の地震とは無関係の通知やバグが発生する場合があります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleSettingChange("enable_drill_test_info", true);
                  setShowDrillTestAlert(false);
                }}
              >
                有効にする
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
