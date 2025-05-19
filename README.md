# 震Quick

<div style="text-align: center;">
  <img src="images/screenshot.png" alt="screenshot" style="max-width: 100%; height: auto;">
  v0.1.1での動作例
</div>

## 概要

震Quickは「緊急地震速報を、見やすく、リアルタイムに」をコンセプトに開発されたWebアプリケーションです。

### 特徴など

#### リアルタイム表示

Project DM-D.S.SまたはAXISを使用したWebSocket通信により、気象庁発表の緊急地震速報をほぼリアルタイムで表示します。**（※利用するには別途、契約または会員登録が必要です）**

#### 複数情報源の併用

Project DM-D.S.SとAXISは同時にWebSocket接続が可能です。たとえば、AXISの情報を先に受信し、その後にDM-D.S.Sの情報が届いた場合は、DM-D.S.Sの内容が自動的にAXISの情報に上書きされて表示されます。

#### 情報収集の補助

防災情報の確認を日常的に行うユーザー向けに、情報収集の補助を目的としています。

## ご利用にあたって

### 事前知識の重要性

本アプリは緊急地震速報に関する一定の知識を持つユーザーを対象としています。ご利用前に、必ず気象庁のホームページなどで緊急地震速報の詳細を理解してください。

#### 基本知識

- [緊急地震速報とは](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/whats-eew.html)

- [緊急地震速報の発表条件](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/shousai.html#2)

- [緊急地震速報の特性や限界、利用上の注意](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/tokusei.html)

#### 1点観測を使用する場合の知識

- [PLUM法とは](https://www.data.jma.go.jp/svd/eew/data/nc/plum/index.html)

- [レベル法とは](https://www.data.jma.go.jp/eew/data/nc/katsuyou/reference.pdf#page=15)

## 情報の取得元

### 強震モニタ

- [Yahoo!天気・災害 強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)

### 緊急地震速報

- [Project DM(Disaster Mitigation)-Data Send Service](https://dmdata.jp)（※各自契約が必須）
- [AXIS(An eXtendable Information Stream)](https://axis.prioris.jp/)（※各自会員登録が必須）
- [Yahoo!天気・災害 強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)（※DM-D.S.S使用時には無効）

### その他データ

#### 走時表

- [気象庁 走時表・射出角表・速度構造データファイル](https://www.data.jma.go.jp/eqev/data/bulletin/catalog/appendix/trtime/trt_j.html)

#### 地図データ（世界）

- [Natural Earth](https://www.naturalearthdata.com/) (一部改変)

#### 地図データ（日本）

- [気象庁 予報区等GISデータ](https://www.data.jma.go.jp/developer/gis.html) (一部改変)
- [国土数値情報](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html) (一部改変)

## 謝辞

本アプリの開発にあたり、データ提供者および関係者の皆様に深く感謝申し上げます。

### 気象庁 / 国土交通省（国土数値情報）

- 走時表、GISデータ、緊急地震速報に関する情報提供
- 地理情報の提供

### Yahoo! JAPAN

- 強震モニタと緊急地震速報の提供

### [リアルタイム地震ビューアー](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)

- アプリ全体の仕様を参考にしています。
- 震度配色を利用しています。

### [EarthQuicklyForWeb](https://github.com/Ameuma773/EarthQuicklyForWeb)

- ソースコードを参考に強震モニタを実装しています。

### [JQuake](https://jquake.net)

- 設定や緊急地震速報のUIを参考にしています。

### [KyoshinEewViewer for ingen](https://github.com/ingen084/KyoshinEewViewerIngen)

- 設定のDM-D.S.SタブのUIなどを参考にしています。

## ライセンス

本アプリは**MITライセンス**のもとで提供されています。

詳細については、[LICENSE](LICENSE)ファイルをご参照ください。

## 利用規約

本アプリの利用にあたっては、[利用規約](TERMS.md)に同意いただく必要があります。

### 免責事項

本アプリは、正確な情報提供に努めていますが、システムの仕様上、通信環境やデータ提供元の影響により、
**遅延・誤報・データの欠落が発生する可能性があります**。
そのため、本アプリの情報に基づく行動について、一切の責任を負いかねますのでご了承ください。

また、**本アプリは開発途中であり、安定した動作を保証するものではありません**。
現在も改良を進めていますが、**バグや不具合が含まれる可能性があり、一部未実装の機能も存在します**。
予期しない動作が発生することもあるため、自己責任のもとでご利用ください。

サービスの停止や変更が行われることもありますので、あらかじめご了承の上、ご利用ください。

## プライバシーポリシー

本アプリが収集する情報、利用目的、第三者サービスとの連携、ユーザーの設定管理、プライバシーポリシーの変更に関する詳細な方針については、[プライバシーポリシー](PRIVACY.md)をご参照ください。

## 貢献

本プロジェクトはオープンソースで開発されており、以下のような形で貢献できます。

### コードの貢献

- **バグ修正**: 既知のバグや不具合の修正を行う
- **機能追加**: 新しい機能や改善提案を実装する
- **最適化**: 処理の軽量化や高速化に取り組む

### ドキュメントの改善
- **READMEの改善**
- **誤字脱字の修正**
- **機能説明の追加や分かりやすくするための編集**

### バグ報告・改善提案
- **Issueの作成**: バグや改善点をGitHubのIssueで報告
- **フィードバックの提供**: 実際に使ってみて気づいた点を共有

### 貢献の方法
Pull Request（PR）は`dev`ブランチに対して送ってください。  
