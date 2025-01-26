import React, { useState } from 'react';
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

interface Settings {
  theme: 'system' | 'dark' | 'light';
  enable_kyoshin_monitor: boolean;
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
}

interface SettingsDialogProps {
  showSettings: boolean;
  setShowSettings: (value: boolean) => void;
  settings: Settings;
  handleSettingChange: (key: keyof Settings, value: Settings[keyof Settings]) => void;
}

const THEME_OPTIONS = [
  { value: 'system', label: 'システム' },
  { value: 'dark', label: 'ダーク' },
  { value: 'light', label: 'ライト' },
] as const;

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  showSettings,
  setShowSettings,
  settings,
  handleSettingChange,
}) => {
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const handleToggleLowAccuracyEEW = (checked: boolean) => {
    if (checked) {
      setShowAlert(true);
    } else {
      handleSettingChange('enable_low_accuracy_eew', false);
    }
  };

  const confirmLowAccuracyEEW = () => {
    handleSettingChange('enable_low_accuracy_eew', true);
    setShowAlert(false);
  };

  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent style={{ maxHeight: '80vh' }}>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            設定を変更することができます
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 強震モニタ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>強震モニタを有効にする</span>
              <Switch
                checked={settings.enable_kyoshin_monitor}
                onCheckedChange={(checked) => handleSettingChange('enable_kyoshin_monitor', checked)}
              />
            </div>
            <p className="text-sm text-gray-500">
              強震モニタとP/S波をリアルタイムに表示します。<br/>
            </p>
          </div>

          {/* 動的ズーム */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>地図の動的ズームを有効にする</span>
              <Switch
                checked={settings.enable_dynamic_zoom}
                onCheckedChange={(checked) => handleSettingChange('enable_dynamic_zoom', checked)}
              />
            </div>
            <p className="text-sm text-gray-500">
              地図の表示が自動的に拡大・縮小・移動されるようになります。
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
              {isCollapsed ? <ChevronDown className="mr-2" /> : <ChevronRight className="mr-2" />}
              十分に知識がある方のみご利用ください。
            </p>
            {isCollapsed && (
              <div className="text-sm text-gray-500">
                <p>緊急地震速報の1点観測では、観測された揺れが地震によるものとは限りません。</p>
                <p>
                  例えば、事故や落雷による振動、または観測機器の不具合などが原因で、
                  誤った情報が発信される場合があります。
                </p>
              </div>
            )}
          </div>

          {/* テーマ */}
          <div className="space-y-2">
            <p className="text-sm">テーマ</p>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {settings.theme
                    ? THEME_OPTIONS.find((theme) => theme.value === settings.theme)?.label
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
                            handleSettingChange('theme', currentValue as 'system' | 'dark' | 'light');
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              settings.theme === theme.value ? "opacity-100" : "opacity-0"
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
              アプリケーションの外観を変更できます。<br/>「システム」設定では、デバイスの設定に従います。
            </p>
          </div>
        </div>
      </DialogContent>

      {/* 警告ダイアログ */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に有効にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              再度ご確認ください。<br/>
              緊急地震速報の1点観測では、観測された揺れが地震によるものとは限りません。<br/>
              例えば、事故や落雷による振動、または観測機器の不具合などが原因で、<br/>
              誤った情報が発信される場合があります。<br/>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLowAccuracyEEW}>有効にする</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default SettingsDialog;
