# 震Quick

## 概要

震Quickは「緊急地震速報を、見やすく、リアルタイムに」をモットーに制作している緊急地震速報を表示できるアプリです。

### WebSocketによる通信
Project DM-D.S.Sを使用したWebSocketによる情報受信を行うため、気象庁が発表する情報を即時で受け取ることができます。（※使用するには各自で契約が必須です）

## 情報の取得元
- 強震モニタ（リアルタイム震度）と緊急地震速報（緊急地震速報はDM-D.S.Sを使用した場合には自動的に無効となります。）
[Yahoo強震モニタ](https://typhoon.yahoo.co.jp/weather/jp/earthquake/kyoshin/)

- 緊急地震速報
[Project DM(Disaster Mitigation)-Data Send Service](https://dmdata.jp/docs/telegrams/)
