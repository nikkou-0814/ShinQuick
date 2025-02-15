# 震Quick

<div style="text-align: center;">
  <img src="images/screenshot.png" alt="screenshot" style="max-width: 100%; height: auto;">
  複数地震時の動作
</div>

## 概要

震Quickは「緊急地震速報を、見やすく、リアルタイムに」をコンセプトに開発されたWebアプリケーションです。

### 特徴

#### リアルタイム表示

Project DM-D.S.Sを使用したWebSocket通信により、気象庁発表の緊急地震速報をほぼリアルタイムで表示します。（※利用には`緊急地震（予報）`の契約が別途必要です）

#### 情報理解の補助

防災情報の確認を日常的に行うユーザー向けに、情報収集の補助を目的としています。

#### 詳細な情報表示

レベル法やIPF1点検知による緊急地震速報、震度0の表示など、一定の知識を有した方向けの機能があります。

## ご利用にあたって

### 事前知識の重要性

本アプリは緊急地震速報に関する一定の知識を持つユーザーを対象としています。ご利用前に、必ず気象庁のホームページなどで緊急地震速報の詳細を理解してください。

* [緊急地震速報とは](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/whats-eew.html)

* [緊急地震速報の発表条件](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/shousai.html#2)

* [レベル法とは](https://www.data.jma.go.jp/eew/data/nc/katsuyou/reference.pdf#page=15)

* [PLUM法とは](https://www.data.jma.go.jp/svd/eew/data/nc/plum/index.html)

* [緊急地震速報の特性や限界、利用上の注意](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/tokusei.html)

## 情報の取得元

### 強震モニタ

* [Yahoo!天気・災害 強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)

### 緊急地震速報

* [Project DM(Disaster Mitigation)-Data Send Service](https://dmdata.jp)（※各自の契約が必須）
* [Yahoo!天気・災害 強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)（※DM-D.S.S使用時には無効）

### その他データ

#### 走時表

* [気象庁 走時表・射出角表・速度構造データファイル](https://www.data.jma.go.jp/eqev/data/bulletin/catalog/appendix/trtime/trt_j.html)

#### 地図データ（世界）

* [Natural Earth](https://www.naturalearthdata.com/) (一部改変)

#### 地図データ（日本）

* [気象庁 予報区等GISデータ](https://www.data.jma.go.jp/developer/gis.html) (一部改変)
* [国土数値情報](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html) (一部改変)

## 謝辞
本アプリの開発にあたり、データ提供者および関係者の皆様に深く感謝申し上げます。

### 気象庁 / 国土交通省（国土数値情報）
* 走時表、GISデータ、緊急地震速報に関する情報提供
* 地理情報の提供

### Yahoo! JAPAN
* 強震モニタと緊急地震速報の提供

### [リアルタイム地震ビューアー](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)
* アプリ全体の仕様を参考にしています。

### [JQuake](https://jquake.net) / [KyoshinEewViewer for ingen](https://github.com/ingen084/KyoshinEewViewerIngen)
* 一部のUIや機能を参考にしています。

## ライセンス

本アプリは**MITライセンス**のもとで提供されています。

詳細については、[LICENSE](LICENSE)ファイルをご参照ください。

## 利用規約

本アプリの利用にあたっては、[利用規約](TERMS.md)に同意いただく必要があります。
