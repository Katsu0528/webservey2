/** デフォルトで参照するメーカー一覧フォルダ ID */
var DEFAULT_MANUFACTURERS_FOLDER_ID = '13vPmhzBEPc4X57QrDPogS2tBC5RKCpg6';

/** 優先的に表示するメーカーの並び順 */
var PREFERRED_MANUFACTURER_ORDER = ['ポッカサッポロ', 'アサヒ', 'キリン', '伊藤園'];

/**
 * マッチング用に文字列を正規化する。
 * - 拡張子を除去
 * - スペースや括弧などの記号を除去
 * - 小文字化
 * @param {string} value
 * @returns {string}
 */
function normalizeKey(value) {
  if (!value) return '';

  var trimmed = trimExtension(String(value));
  return trimmed
    .replace(/[\s\u3000\(\)（）_\-]/g, '')
    .toLowerCase();
}

/** 集計結果を書き込むスプレッドシート ID */
var SURVEY_SPREADSHEET_ID = '1xkg8vNscpcWTA6GA0VPxGTJCAH6LyvsYhq7VhOlDcXg';

/** 集計結果を書き込むシート名 */
var SURVEY_SHEET_NAME = '集計';

/**
 * Vending lineup web app entry point.
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var maker = params.maker || '';
  var folderId = params.folderId || DEFAULT_MANUFACTURERS_FOLDER_ID || '';

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
    manufacturer: maker || '',
    categories: [],
    manufacturers: getManufacturers(),
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
 * メーカー一覧を取得する。デフォルトフォルダ配下のサブフォルダをメーカーとして扱う。
 * @returns {Array<{name: string, folderId: string, imageUrl: string}>}
 */
function getManufacturers() {
  if (!DEFAULT_MANUFACTURERS_FOLDER_ID) return [];

  try {
    var root = DriveApp.getFolderById(DEFAULT_MANUFACTURERS_FOLDER_ID);
    var folders = root.getFolders();
    var manufacturers = [];

    while (folders.hasNext()) {
      var folder = folders.next();
      var firstImage = getFirstImageInfo(folder);
      manufacturers.push({
        name: folder.getName(),
        folderId: folder.getId(),
        imageUrl: firstImage.url,
        imageName: firstImage.name,
      });
    }

    var normalizedMap = manufacturers.reduce(function (map, entry) {
      var keys = [entry.name, trimExtension(entry.imageName)];
      keys.forEach(function (key) {
        var normalized = normalizeKey(key);
        if (normalized && !map[normalized]) {
          map[normalized] = entry;
        }
      });
      return map;
    }, {});

    var orderedByPreference = PREFERRED_MANUFACTURER_ORDER.map(function (name) {
      var normalized = normalizeKey(name);
      return (
        normalizedMap[normalized] || {
          name: name,
          folderId: '',
          imageUrl: '',
          imageName: '',
        }
      );
    });

    var usedKeys = orderedByPreference.reduce(function (set, entry) {
      var key = normalizeKey(entry.name) || normalizeKey(entry.imageName);
      if (key) set[key] = true;
      return set;
    }, {});

    manufacturers.forEach(function (entry) {
      var key = normalizeKey(entry.name) || normalizeKey(entry.imageName);
      if (key && usedKeys[key]) return;
      orderedByPreference.push(entry);
      usedKeys[key] = true;
    });

    return orderedByPreference;
  } catch (err) {
    throw new Error('メーカー一覧の取得に失敗しました: ' + err.message);
  }
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
      imageUrl: getImageUrl(file),
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

/**
 * ファイル名の拡張子を取り除く。
 * @param {string} name
 * @returns {string}
 */
function trimExtension(name) {
  if (!name) return '';
  var lastDot = String(name).lastIndexOf('.');
  if (lastDot <= 0) return String(name);
  return String(name).slice(0, lastDot);
}

/**
 * フォルダ内の最初のファイルの URL を取得する。
 * @param {GoogleAppsScript.Drive.Folder} folder
 * @returns {string}
 */
function getFirstImageInfo(folder) {
  var files = folder.getFiles();
  if (files.hasNext()) {
    var file = files.next();
    return {
      url: getImageUrl(file),
      name: file.getName(),
    };
  }
  return { url: '', name: '' };
}

/**
 * 画像を埋め込み表示用の URL として返す。
 * Drive のファイルページ URL では直接表示できないため、googleusercontent.com ドメインの URL を利用する。
 *
 * @param {GoogleAppsScript.Drive.File} file
 * @returns {string}
 */
function getImageUrl(file) {
  var id = file && file.getId && file.getId();
  if (!id) return '';

  try {
    var access = file.getSharingAccess();
    var permission = file.getSharingPermission();
    var isPublic =
      access === DriveApp.Access.ANYONE_WITH_LINK &&
      permission === DriveApp.Permission.VIEW;

    if (!isPublic) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  } catch (err) {
    Logger.log('画像の公開設定変更に失敗しました: ' + err.message);
  }

  return 'https://lh3.googleusercontent.com/d/' + id;
}

/**
 * アンケートの回答をスプレッドシートに保存する。
 * @param {string} question1Answer 質問1の回答
 * @param {string} question2Answer 質問2の回答
 */
function submitSurveyResponse(question1Answer, question2Answer) {
  if (!SURVEY_SPREADSHEET_ID) {
    throw new Error('集計先のスプレッドシート ID が設定されていません。');
  }

  var spreadsheet = SpreadsheetApp.openById(SURVEY_SPREADSHEET_ID);
  var sheet = spreadsheet.getSheetByName(SURVEY_SHEET_NAME);
  if (!sheet) {
    throw new Error('集計シートが見つかりません。');
  }

  var email = getUserEmail();

  sheet.appendRow([new Date(), email || '', question1Answer || '', question2Answer || '']);
}

/**
 * 現在ログインしているユーザーのメールアドレスを内部的に取得する。
 * Apps Script の実行権限に応じて ActiveUser または EffectiveUser を参照する。
 * @returns {string}
 */
function getUserEmail() {
  var active = Session.getActiveUser();
  if (active) {
    var email = active.getEmail();
    if (email) return email;
  }

  try {
    var effective = Session.getEffectiveUser();
    if (effective) {
      var effectiveEmail = effective.getEmail();
      if (effectiveEmail) return effectiveEmail;
    }
  } catch (err) {
    Logger.log('EffectiveUser 取得時に権限エラーが発生しました: ' + err.message);
  }

  return '';
}
