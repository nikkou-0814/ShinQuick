# 震Quick

<div style="text-align: center;">
    <img src="images/screenshot.png" alt="screenshot" style="max-width: 100%; height: auto;">
</div>
複数地震でのテスト

## 概要

震Quickは「緊急地震速報を、見やすく、リアルタイムに」をモットーに制作している緊急地震速報を表示できるアプリです。

### WebSocketによる通信
Project DM-D.S.Sを使用したWebSocketによる情報受信を行うため、気象庁が発表する情報を即時で受け取ることができます。（※使用するには各自で`緊急地震（予報）`の契約が必須です）

## 緊急地震速報について
本アプリは普段から防災情報を確認する方に向けて、情報収集の補助を目的として作成されたアプリです。
そのため、一定の知識を有した方向けの機能があります（レベル法やIPF1点検知による緊急地震速報、震度0の表示など）。

### ご利用前のお願い
本アプリを使用する前に、気象庁のホームページなどで詳細を理解してからご利用いただきますようお願いします。

- [緊急地震速報とは](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/whats-eew.html)
- [緊急地震速報の発表条件](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/shousai.html#2)
- [レベル法とは](https://www.data.jma.go.jp/eew/data/nc/katsuyou/reference.pdf#page=15)
- [PLUM法とは](https://www.data.jma.go.jp/svd/eew/data/nc/plum/index.html)
- [緊急地震速報の特性や限界、利用上の注意](https://www.data.jma.go.jp/svd/eew/data/nc/shikumi/tokusei.html)

### 緊急地震（予報）の特性
- 地震発生から即時で情報が作成されるため、誤報が発生する場合があります。
- 初期段階の情報は震源、マグニチュード、予測震度の精度が低い場合があります。
- 通常でも推定震度に1階級程度の誤差が生じることがあります。
- 深さ150km以上の地震では予想最大震度が発表されない場合があります。（※実際の揺れに基づいて発表される場合もあります）
- 1点観測の情報を使用する場合は、その特性を十分に理解してからご利用ください。（PLUM法、レベル法、IPF法(1点)など）

## 情報の取得元
### 強震モニタ
- [Yahoo強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)

### 緊急地震速報
- [Project DM(Disaster Mitigation)-Data Send Service](https://dmdata.jp/docs/telegrams/)（※各自の契約が必須）
- [Yahoo強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)（※DM-D.S.S使用時には無効）

### 地図データ（世界）
- [Natural Earth](https://www.naturalearthdata.com/)

### 地図データ（日本）
- [気象庁 予報区等GISデータ](https://www.data.jma.go.jp/developer/gis.html)
- [国土数値情報](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v3_1.html)
