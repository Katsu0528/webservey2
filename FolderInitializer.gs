/**
 * 指定のメーカー配下に商品カテゴリーと価格帯フォルダをまとめて作成するスクリプト。
 * 既存のフォルダがある場合は再利用し、重複作成を避ける。
 */
var MANUFACTURER_ROOT_FOLDER_ID = '18fA4HRavIBTM2aPL-OqVaWhjRRgBhlKg';

/** 対象のメーカー名一覧 */
var TARGET_MANUFACTURERS = ['アサヒ', 'ポッカサッポロ', 'キリン', '伊藤園'];

/** 商品カテゴリー名一覧 */
var BEVERAGE_CATEGORIES = ['エナドリ', 'お茶', 'コーヒー', '炭酸', '水', 'その他(果汁等)'];

/** 価格帯フォルダ名一覧 (80円〜160円を10円刻み) */
var PRICE_FOLDER_NAMES = (function buildPriceFolderNames() {
  var names = [];
  for (var price = 80; price <= 160; price += 10) {
    names.push(price + '円');
  }
  return names;
})();

/**
 * メーカー配下にカテゴリー・価格帯フォルダを作成するエントリーポイント。
 * @returns {{processed: number, details: Array<{manufacturer: string, categories: number, priceFoldersPerCategory: number}>}}
 */
function createManufacturerPriceFolders() {
  var rootFolder = DriveApp.getFolderById(MANUFACTURER_ROOT_FOLDER_ID);
  var details = [];

  TARGET_MANUFACTURERS.forEach(function (manufacturerName) {
    var manufacturerFolder = ensureChildFolder(rootFolder, manufacturerName);
    BEVERAGE_CATEGORIES.forEach(function (categoryName) {
      var categoryFolder = ensureChildFolder(manufacturerFolder, categoryName);
      PRICE_FOLDER_NAMES.forEach(function (priceName) {
        ensureChildFolder(categoryFolder, priceName);
      });
    });

    details.push({
      manufacturer: manufacturerName,
      categories: BEVERAGE_CATEGORIES.length,
      priceFoldersPerCategory: PRICE_FOLDER_NAMES.length,
    });
  });

  return { processed: details.length, details: details };
}

/**
 * 親フォルダ配下に指定名のサブフォルダが存在しない場合は作成し、存在すればそれを返す。
 * @param {GoogleAppsScript.Drive.Folder} parentFolder
 * @param {string} childName
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function ensureChildFolder(parentFolder, childName) {
  var existing = parentFolder.getFoldersByName(childName);
  if (existing.hasNext()) {
    return existing.next();
  }
  return parentFolder.createFolder(childName);
}

/**
 * カテゴリ>メーカー>価格 の階層に保存されている画像を、メーカー>カテゴリ>価格 の階層へ整理移動する。
 * 既に目的の階層が存在する場合は再利用し、必要に応じてフォルダを作成する。
 *
 * 例:
 *  - 移動前: ルート / エナドリ / アサヒ / 120円 / *.jpg
 *  - 移動後: ルート / アサヒ / エナドリ / 120円 / *.jpg
 *
 * @returns {{processedCategories: number, movedFiles: Array<{manufacturer: string, category: string, price: string, count: number}>}}
 */
function moveCategoryOrganizedImagesToManufacturerFolders() {
  var rootFolder = DriveApp.getFolderById(MANUFACTURER_ROOT_FOLDER_ID);
  var results = [];

  BEVERAGE_CATEGORIES.forEach(function (categoryName) {
    var sourceCategoryIterator = rootFolder.getFoldersByName(categoryName);
    if (!sourceCategoryIterator.hasNext()) {
      return;
    }

    var sourceCategoryFolder = sourceCategoryIterator.next();

    TARGET_MANUFACTURERS.forEach(function (manufacturerName) {
      var sourceManufacturerIterator = sourceCategoryFolder.getFoldersByName(manufacturerName);
      if (!sourceManufacturerIterator.hasNext()) {
        return;
      }

      var sourceManufacturerFolder = sourceManufacturerIterator.next();
      var destinationManufacturerFolder = ensureChildFolder(rootFolder, manufacturerName);
      var destinationCategoryFolder = ensureChildFolder(
        destinationManufacturerFolder,
        categoryName
      );

      var priceFolders = sourceManufacturerFolder.getFolders();
      while (priceFolders.hasNext()) {
        var priceFolder = priceFolders.next();
        var destinationPriceFolder = ensureChildFolder(
          destinationCategoryFolder,
          priceFolder.getName()
        );

        var files = priceFolder.getFiles();
        var movedCount = 0;

        while (files.hasNext()) {
          var file = files.next();
          file.moveTo(destinationPriceFolder);
          movedCount += 1;
        }

        results.push({
          manufacturer: manufacturerName,
          category: categoryName,
          price: priceFolder.getName(),
          count: movedCount,
        });
      }
    });
  });

  return { processedCategories: results.length, movedFiles: results };
}
