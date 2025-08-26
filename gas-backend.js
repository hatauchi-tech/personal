/**
 * Google Apps Script バックエンド処理
 * 建築仕様書管理システム
 */

// スプレッドシートID（実際の運用時に設定）
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const TEMPLATE_FOLDER_ID = 'YOUR_TEMPLATE_FOLDER_ID_HERE';
const OUTPUT_FOLDER_ID = 'YOUR_OUTPUT_FOLDER_ID_HERE';

/**
 * Webアプリケーションのメインエントリーポイント
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * HTMLファイルの内容を取得
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ユーザー認証とアクセス権限チェック
 */
function checkUserAccess() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName('ユーザーマスタ');
  
  if (!userSheet) {
    throw new Error('ユーザーマスタシートが見つかりません');
  }
  
  const userData = userSheet.getDataRange().getValues();
  const userRow = userData.find(row => row[1] === userEmail); // B列にメールアドレス
  
  if (!userRow) {
    throw new Error('アクセス権限がありません');
  }
  
  return {
    email: userEmail,
    name: userRow[0], // A列に氏名
    department: userRow[2], // C列に部署
    role: userRow[3], // D列に権限
    isActive: userRow[4] // E列に有効フラグ
  };
}

/**
 * 案件一覧を取得
 */
function getProjectList(filters = {}) {
  try {
    const user = checkUserAccess();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const projectSheet = ss.getSheetByName('案件管理');
    
    if (!projectSheet) {
      throw new Error('案件管理シートが見つかりません');
    }
    
    const data = projectSheet.getDataRange().getValues();
    const headers = data[0];
    const projects = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const project = {
        id: row[0],
        customerName: row[1],
        projectName: row[2],
        lotNumber: row[3],
        assignee: row[4],
        status: row[5],
        department: row[6],
        createdAt: row[7],
        updatedAt: row[8]
      };
      
      // フィルター適用
      if (applyFilters(project, filters)) {
        projects.push(project);
      }
    }
    
    return projects;
  } catch (error) {
    console.error('案件一覧取得エラー:', error);
    throw error;
  }
}

/**
 * フィルター条件を適用
 */
function applyFilters(project, filters) {
  if (filters.assignee && project.assignee !== filters.assignee) return false;
  if (filters.customerName && !project.customerName.includes(filters.customerName)) return false;
  if (filters.status && project.status !== filters.status) return false;
  if (filters.department && project.department !== filters.department) return false;
  return true;
}

/**
 * 新規案件を作成
 */
function createProject(projectData) {
  try {
    const user = checkUserAccess();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const projectSheet = ss.getSheetByName('案件管理');
    
    const projectId = generateProjectId();
    const now = new Date();
    
    const newRow = [
      projectId,
      projectData.customerName,
      projectData.projectName,
      projectData.lotNumber,
      projectData.assignee,
      '打ち合わせ中',
      user.department,
      now,
      now
    ];
    
    projectSheet.appendRow(newRow);
    
    // 案件用フォルダを作成
    createProjectFolder(projectId, projectData.customerName);
    
    // 変更履歴を記録
    logChange(projectId, '案件作成', '', JSON.stringify(projectData), user.name);
    
    return { success: true, projectId: projectId };
  } catch (error) {
    console.error('案件作成エラー:', error);
    throw error;
  }
}

/**
 * 案件IDを生成
 */
function generateProjectId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  
  return `PRJ${year}${month}${day}${time}`;
}

/**
 * 案件用フォルダを作成
 */
function createProjectFolder(projectId, customerName) {
  try {
    const parentFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    const folderName = `${projectId}_${customerName}`;
    const projectFolder = parentFolder.createFolder(folderName);
    
    return projectFolder.getId();
  } catch (error) {
    console.error('フォルダ作成エラー:', error);
    throw error;
  }
}

/**
 * 仕様データを取得
 */
function getSpecificationData(projectId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const designSheet = ss.getSheetByName('設計仕様入力データ');
    const interiorSheet = ss.getSheetByName('IC仕様入力データ');
    
    const designData = getSheetDataByProjectId(designSheet, projectId);
    const interiorData = getSheetDataByProjectId(interiorSheet, projectId);
    
    return {
      design: designData,
      interior: interiorData
    };
  } catch (error) {
    console.error('仕様データ取得エラー:', error);
    throw error;
  }
}

/**
 * シートから案件IDに基づいてデータを取得
 */
function getSheetDataByProjectId(sheet, projectId) {
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) { // A列に案件ID
      result.push(data[i]);
    }
  }
  
  return result;
}

/**
 * 仕様データを保存
 */
function saveSpecificationData(projectId, specData) {
  try {
    const user = checkUserAccess();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 設計仕様データを保存
    if (specData.design) {
      saveDesignSpecification(ss, projectId, specData.design, user.name);
    }
    
    // IC仕様データを保存
    if (specData.interior) {
      saveInteriorSpecification(ss, projectId, specData.interior, user.name);
    }
    
    // 案件の更新日時を更新
    updateProjectTimestamp(ss, projectId);
    
    return { success: true };
  } catch (error) {
    console.error('仕様データ保存エラー:', error);
    throw error;
  }
}

/**
 * 設計仕様データを保存
 */
function saveDesignSpecification(ss, projectId, designData, userName) {
  const sheet = ss.getSheetByName('設計仕様入力データ');
  if (!sheet) return;
  
  // 既存データを削除
  deleteExistingData(sheet, projectId);
  
  // 新しいデータを追加
  designData.forEach(item => {
    const row = [
      projectId,
      item.category,
      item.item,
      item.manufacturer,
      item.productName,
      item.productCode,
      item.color,
      item.notes,
      new Date(),
      userName
    ];
    sheet.appendRow(row);
  });
}

/**
 * IC仕様データを保存
 */
function saveInteriorSpecification(ss, projectId, interiorData, userName) {
  const sheet = ss.getSheetByName('IC仕様入力データ');
  if (!sheet) return;
  
  // 既存データを削除
  deleteExistingData(sheet, projectId);
  
  // 新しいデータを追加
  interiorData.forEach(item => {
    const row = [
      projectId,
      item.category,
      item.item,
      item.manufacturer,
      item.productName,
      item.productCode,
      item.design,
      item.notes,
      new Date(),
      userName
    ];
    sheet.appendRow(row);
  });
}

/**
 * 既存データを削除
 */
function deleteExistingData(sheet, projectId) {
  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === projectId) {
      rowsToDelete.push(i + 1);
    }
  }
  
  rowsToDelete.forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });
}

/**
 * 案件の更新日時を更新
 */
function updateProjectTimestamp(ss, projectId) {
  const sheet = ss.getSheetByName('案件管理');
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) {
      sheet.getRange(i + 1, 9).setValue(new Date()); // I列に更新日時
      break;
    }
  }
}

/**
 * PDF仕様書を生成
 */
function generateSpecificationPDF(projectId) {
  try {
    const user = checkUserAccess();
    
    // 案件データを取得
    const projectData = getProjectData(projectId);
    if (!projectData) {
      throw new Error('案件データが見つかりません');
    }
    
    // 仕様データを取得
    const specData = getSpecificationData(projectId);
    
    // テンプレートドキュメントをコピー
    const templateDoc = DriveApp.getFileById(getTemplateDocumentId());
    const tempDoc = templateDoc.makeCopy(`temp_${projectId}_${Date.now()}`);
    
    // データを差し込み
    const doc = DocumentApp.openById(tempDoc.getId());
    replaceDocumentPlaceholders(doc, projectData, specData);
    doc.saveAndClose();
    
    // PDFに変換
    const pdfBlob = tempDoc.getAs('application/pdf');
    const fileName = `${projectData.customerName}様邸_内装仕様書_${Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd')}.pdf`;
    
    // 案件フォルダに保存
    const projectFolder = getProjectFolder(projectId, projectData.customerName);
    const pdfFile = projectFolder.createFile(pdfBlob.setName(fileName));
    
    // 一時ファイルを削除
    DriveApp.getFileById(tempDoc.getId()).setTrashed(true);
    
    // 変更履歴を記録
    logChange(projectId, 'PDF出力', '', fileName, user.name);
    
    return {
      success: true,
      fileId: pdfFile.getId(),
      fileName: fileName,
      downloadUrl: pdfFile.getDownloadUrl()
    };
  } catch (error) {
    console.error('PDF生成エラー:', error);
    throw error;
  }
}

/**
 * 案件データを取得
 */
function getProjectData(projectId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('案件管理');
  
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === projectId) {
      return {
        id: data[i][0],
        customerName: data[i][1],
        projectName: data[i][2],
        lotNumber: data[i][3],
        assignee: data[i][4],
        status: data[i][5],
        department: data[i][6],
        createdAt: data[i][7],
        updatedAt: data[i][8]
      };
    }
  }
  
  return null;
}

/**
 * テンプレートドキュメントIDを取得
 */
function getTemplateDocumentId() {
  // 実際の運用時にテンプレートドキュメントのIDを設定
  return 'YOUR_TEMPLATE_DOCUMENT_ID_HERE';
}

/**
 * 案件フォルダを取得
 */
function getProjectFolder(projectId, customerName) {
  const parentFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  const folderName = `${projectId}_${customerName}`;
  
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

/**
 * ドキュメントのプレースホルダーを置換
 */
function replaceDocumentPlaceholders(doc, projectData, specData) {
  const body = doc.getBody();
  
  // 基本情報の置換
  body.replaceText('{{customerName}}', projectData.customerName);
  body.replaceText('{{projectName}}', projectData.projectName);
  body.replaceText('{{lotNumber}}', projectData.lotNumber);
  body.replaceText('{{assignee}}', projectData.assignee);
  body.replaceText('{{date}}', Utilities.formatDate(new Date(), 'JST', 'yyyy年MM月dd日'));
  
  // 設計仕様データの置換
  if (specData.design && specData.design.length > 0) {
    let designText = '';
    specData.design.forEach(item => {
      designText += `${item[1]}: ${item[3]} ${item[4]} ${item[5]}\n`;
    });
    body.replaceText('{{designSpecs}}', designText);
  }
  
  // IC仕様データの置換
  if (specData.interior && specData.interior.length > 0) {
    let interiorText = '';
    specData.interior.forEach(item => {
      interiorText += `${item[1]}: ${item[3]} ${item[4]} ${item[5]}\n`;
    });
    body.replaceText('{{interiorSpecs}}', interiorText);
  }
}

/**
 * 変更履歴を記録
 */
function logChange(projectId, action, oldValue, newValue, userName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName('変更履歴ログ');
    
    if (!logSheet) {
      console.warn('変更履歴ログシートが見つかりません');
      return;
    }
    
    const logRow = [
      new Date(),
      projectId,
      action,
      oldValue,
      newValue,
      userName,
      Session.getActiveUser().getEmail()
    ];
    
    logSheet.appendRow(logRow);
  } catch (error) {
    console.error('変更履歴記録エラー:', error);
  }
}

/**
 * 変更履歴を取得
 */
function getChangeHistory(projectId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName('変更履歴ログ');
    
    if (!logSheet) return [];
    
    const data = logSheet.getDataRange().getValues();
    const history = [];
    
    for (let i = data.length - 1; i >= 1; i--) { // 新しい順に取得
      if (data[i][1] === projectId) {
        history.push({
          timestamp: data[i][0],
          action: data[i][2],
          oldValue: data[i][3],
          newValue: data[i][4],
          userName: data[i][5],
          userEmail: data[i][6]
        });
      }
    }
    
    return history;
  } catch (error) {
    console.error('変更履歴取得エラー:', error);
    throw error;
  }
}

/**
 * ひな形データを取得
 */
function getTemplateData(templateType) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const templateSheet = ss.getSheetByName(`ひな形_${templateType}`);
    
    if (!templateSheet) {
      console.warn(`ひな形シート（${templateType}）が見つかりません`);
      return { design: [], interior: [] };
    }
    
    const data = templateSheet.getDataRange().getValues();
    const templateData = { design: [], interior: [] };
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const category = row[0]; // A列にカテゴリ（design/interior）
      
      if (category === 'design') {
        templateData.design.push({
          item: row[1],
          manufacturer: row[2],
          productName: row[3],
          productCode: row[4],
          color: row[5],
          notes: row[6]
        });
      } else if (category === 'interior') {
        templateData.interior.push({
          item: row[1],
          manufacturer: row[2],
          productName: row[3],
          productCode: row[4],
          design: row[5],
          notes: row[6]
        });
      }
    }
    
    return templateData;
  } catch (error) {
    console.error('ひな形データ取得エラー:', error);
    throw error;
  }
}

/**
 * マスタデータを取得
 */
function getMasterData(category) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const masterSheet = ss.getSheetByName(`${category}仕様項目マスタ`);
    
    if (!masterSheet) {
      console.warn(`マスタシート（${category}）が見つかりません`);
      return [];
    }
    
    const data = masterSheet.getDataRange().getValues();
    const masterData = [];
    
    for (let i = 1; i < data.length; i++) {
      masterData.push({
        id: data[i][0],
        item: data[i][1],
        manufacturer: data[i][2],
        productName: data[i][3],
        productCode: data[i][4],
        color: data[i][5],
        design: data[i][6],
        notes: data[i][7]
      });
    }
    
    return masterData;
  } catch (error) {
    console.error('マスタデータ取得エラー:', error);
    throw error;
  }
}