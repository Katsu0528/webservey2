/**
 * Vending lineup web app entry point.
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var maker = params.maker || '';
  var folderId = params.folderId || '';

  var template = HtmlService.createTemplateFromFile('VendingLineup');
  template.maker = maker;
  template.folderId = folderId;

  return template
    .evaluate()
    .setTitle('商品ラインアップ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Drive 上のフォルダ構造から商品ラインアップを返す。
 * フォルダ直下に商品画像がある場合は "全商品" カテゴリとして扱い、
 * サブフォルダがある場合はフォルダ名をカテゴリー名として扱う。
 *
 * @param {string} maker メーカー名
 * @param {string} folderId 画像が格納された Drive フォルダ ID
 * @returns {{manufacturer: string, categories: Array<{name: string, items: Array<{name: string, imageUrl: string, price: string}>}>}}
 */
function getVendingLineup(maker, folderId) {
  var result = {
    manufacturer: maker || 'ラインアップ',
    categories: [],
  };

  if (!folderId) {
    return result;
  }

  try {
    var rootFolder = DriveApp.getFolderById(folderId);

    var subfolders = rootFolder.getFolders();
    while (subfolders.hasNext()) {
      var categoryFolder = subfolders.next();
      result.categories.push({
        name: categoryFolder.getName(),
        items: extractItems(categoryFolder),
      });
    }

    if (!result.categories.length) {
      result.categories.push({
        name: '全商品',
        items: extractItems(rootFolder),
      });
    }
  } catch (err) {
    throw new Error('商品情報の取得に失敗しました: ' + err.message);
  }

  return result;
}

/**
 * 指定フォルダ配下のファイルから商品情報を抽出する。
 * 価格はファイルの説明文に数字のみが記載されている場合に採用する。
 *
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @returns {Array<{name: string, imageUrl: string, price: string}>}
 */
function extractItems(folder) {
  var items = [];
  var files = folder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    items.push({
      name: file.getName(),
      imageUrl: file.getUrl(),
      price: parsePrice(file.getDescription()),
    });
  }

  return items;
}

/**
 * ファイル説明文から価格を抽出する。
 * @param {string} description
 * @returns {string}
 */
function parsePrice(description) {
  if (!description) return '';
  var match = String(description).match(/([0-9]{2,})/);
  return match ? match[1] : '';
}
