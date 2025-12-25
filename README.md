# VendingLineup サーベイページ

Google Apps Script で動作する自販機ラインアップのアンケートページです。`Code.gs` と `VendingLineup` を Apps Script プロジェクトに配置して利用します。

## フォルダ自動生成スクリプト
`FolderInitializer.gs` には、指定のドライブフォルダ配下にカテゴリー・価格帯フォルダをまとめて作成するスクリプトを追加しています。

- ルートフォルダ ID: `18fA4HRavIBTM2aPL-OqVaWhjRRgBhlKg`
- メーカー: アサヒ / ポッカサッポロ / キリン / 伊藤園
- カテゴリー: エナドリ / お茶 / コーヒー / 炭酸 / 水 / その他(果汁等)
- 価格帯: 80円〜160円（10円刻み）

Apps Script 上で `createManufacturerPriceFolders()` を実行すると、上記フォルダ構成を自動で生成します。既存フォルダがある場合は再利用され、重複作成は行われません。

## 注意事項
- 指示のない項目は新規に作成しないでください。必要な要素のみを追加・更新します。

## デプロイ方法
1. Google Apps Script プロジェクトにファイルをアップロードします。
2. 必要に応じて `DEFAULT_MANUFACTURERS_FOLDER_ID` を環境に合わせて更新します。
3. ウェブアプリとしてデプロイし、公開 URL を共有してください。
