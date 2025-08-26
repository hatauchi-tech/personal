// アプリケーションの状態管理
let currentProject = null;
let currentTab = 'design';
let selectedTemplate = 'standard';

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    // iPadでのタッチ操作を最適化
    document.addEventListener('touchstart', function() {}, { passive: true });
    
    // 初期表示は案件一覧
    showProjectList();
});

// 画面切り替え関数
function showProjectList() {
    document.getElementById('projectList').classList.remove('hidden');
    document.getElementById('specInput').classList.add('hidden');
}

function showSpecInput() {
    document.getElementById('projectList').classList.add('hidden');
    document.getElementById('specInput').classList.remove('hidden');
}

// 案件関連の関数
function openProject(projectId) {
    currentProject = projectId;
    
    // プロジェクトデータを読み込み（実際の実装ではGASから取得）
    const projectData = getProjectData(projectId);
    document.getElementById('projectTitle').textContent = `${projectData.customerName} - 仕様入力`;
    
    showSpecInput();
    
    // 変更履歴を記録
    logChange('案件を開きました', '', '', getCurrentUser());
}

function backToProjectList() {
    showProjectList();
    currentProject = null;
}

function showNewProjectModal() {
    document.getElementById('newProjectModal').classList.remove('hidden');
}

function closeNewProjectModal() {
    document.getElementById('newProjectModal').classList.add('hidden');
}

function createProject() {
    // フォームデータを取得
    const customerName = document.querySelector('#newProjectModal input[placeholder="お客様名を入力"]').value;
    const projectName = document.querySelector('#newProjectModal input[placeholder="物件名を入力"]').value;
    const lotNumber = document.querySelector('#newProjectModal input[placeholder="号地を入力"]').value;
    const assignee = document.querySelector('#newProjectModal select').value;
    
    if (!customerName || !projectName || !lotNumber) {
        alert('必須項目を入力してください。');
        return;
    }
    
    // 新規案件を作成（実際の実装ではGASに送信）
    const newProject = {
        id: generateProjectId(),
        customerName: customerName,
        projectName: projectName,
        lotNumber: lotNumber,
        assignee: assignee,
        status: '打ち合わせ中',
        department: getCurrentUserDepartment(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // プロジェクトリストに追加
    addProjectToList(newProject);
    
    closeNewProjectModal();
    
    // 成功メッセージ
    showNotification('新規案件を作成しました。', 'success');
}

// タブ切り替え
function switchTab(tabName) {
    currentTab = tabName;
    
    // タブボタンの状態を更新
    document.getElementById('designTab').className = tabName === 'design' 
        ? 'flex-1 py-4 px-6 text-center font-medium bg-blue-600 text-white'
        : 'flex-1 py-4 px-6 text-center font-medium bg-gray-100 text-gray-600 hover:bg-gray-200';
    
    document.getElementById('interiorTab').className = tabName === 'interior' 
        ? 'flex-1 py-4 px-6 text-center font-medium bg-blue-600 text-white'
        : 'flex-1 py-4 px-6 text-center font-medium bg-gray-100 text-gray-600 hover:bg-gray-200';
    
    // コンテンツの表示切り替え
    document.getElementById('designContent').classList.toggle('hidden', tabName !== 'design');
    document.getElementById('interiorContent').classList.toggle('hidden', tabName !== 'interior');
}

// ひな形選択
function selectTemplate(templateType) {
    selectedTemplate = templateType;
    
    // 選択状態を視覚的に更新
    const buttons = document.querySelectorAll('[onclick^="selectTemplate"]');
    buttons.forEach(button => {
        button.className = 'p-4 border-2 border-gray-300 rounded-lg text-left hover:bg-gray-50 transition-colors';
    });
    
    event.target.className = 'p-4 border-2 border-blue-500 bg-blue-50 rounded-lg text-left hover:bg-blue-100 transition-colors';
    
    // ひな形データを読み込み（実際の実装ではGASから取得）
    loadTemplateData(templateType);
    
    showNotification(`${getTemplateName(templateType)}を選択しました。`, 'info');
}

// 部屋の追加・削除
function addRoom() {
    const roomName = prompt('部屋名を入力してください：');
    if (!roomName) return;
    
    const roomsContainer = document.querySelector('.space-y-4');
    const newRoomHtml = createRoomHtml(roomName);
    
    // 「部屋を追加」ボタンの前に挿入
    const addButton = document.querySelector('[onclick="addRoom()"]');
    addButton.parentNode.insertBefore(newRoomHtml, addButton);
    
    logChange('部屋を追加', '', roomName, getCurrentUser());
}

function removeRoom(button) {
    if (confirm('この部屋を削除しますか？')) {
        const roomContainer = button.closest('.space-y-4').parentNode;
        const roomName = roomContainer.querySelector('span').textContent;
        roomContainer.remove();
        
        logChange('部屋を削除', roomName, '', getCurrentUser());
    }
}

// PDF出力
function generatePDF() {
    if (!currentProject) {
        alert('案件が選択されていません。');
        return;
    }
    
    // 入力データを収集
    const specData = collectSpecificationData();
    
    // PDF生成中の表示
    showNotification('PDF生成中...', 'info');
    
    // 実際の実装ではGASのPDF生成機能を呼び出し
    setTimeout(() => {
        const pdfUrl = generatePDFFile(currentProject, specData);
        showNotification('PDFが生成されました。', 'success');
        
        // PDFダウンロードリンクを表示
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `${getProjectData(currentProject).customerName}様邸_内装仕様書_${formatDate(new Date())}.pdf`;
        downloadLink.click();
        
        logChange('PDF出力', '', 'PDF生成完了', getCurrentUser());
    }, 2000);
}

// 変更履歴
function showHistory() {
    document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

function logChange(action, oldValue, newValue, user) {
    const changeLog = {
        projectId: currentProject,
        action: action,
        oldValue: oldValue,
        newValue: newValue,
        user: user,
        timestamp: new Date().toISOString(),
        department: getCurrentUserDepartment()
    };
    
    // 実際の実装ではGASのログ機能に送信
    console.log('Change logged:', changeLog);
}

// ユーティリティ関数
function getCurrentUser() {
    return '田中太郎'; // 実際の実装では認証情報から取得
}

function getCurrentUserDepartment() {
    return '企画設計部'; // 実際の実装では認証情報から取得
}

function generateProjectId() {
    return 'PRJ' + Date.now().toString().slice(-6);
}

function getProjectData(projectId) {
    // 実際の実装ではGASから取得
    const sampleData = {
        '001': { customerName: '山田様邸', projectName: '山田様邸', lotNumber: 'A-15' },
        '002': { customerName: '佐藤様邸', projectName: '佐藤様邸', lotNumber: 'B-08' }
    };
    return sampleData[projectId] || { customerName: '新規案件', projectName: '新規案件', lotNumber: '' };
}

function getTemplateName(templateType) {
    const names = {
        'standard': '標準仕様',
        'premium': 'プレミアム仕様',
        'compact': 'コンパクト仕様'
    };
    return names[templateType] || '標準仕様';
}

function loadTemplateData(templateType) {
    // 実際の実装ではGASからひな形データを取得して画面に反映
    console.log(`Loading template data for: ${templateType}`);
}

function collectSpecificationData() {
    // 現在の入力内容を収集
    const data = {
        template: selectedTemplate,
        designSpecs: {},
        interiorSpecs: {},
        rooms: []
    };
    
    // 各入力フィールドからデータを収集
    // 実際の実装では全ての入力項目を収集
    
    return data;
}

function generatePDFFile(projectId, specData) {
    // 実際の実装ではGASのPDF生成機能を呼び出し
    return 'https://example.com/generated-pdf.pdf';
}

function formatDate(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function addProjectToList(project) {
    // プロジェクトリストに新しい案件を追加
    const container = document.getElementById('projectListContainer');
    const projectHtml = createProjectHtml(project);
    container.insertAdjacentHTML('afterbegin', projectHtml);
}

function createProjectHtml(project) {
    const statusClass = getStatusClass(project.status);
    return `
        <div class="glass-card rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer" onclick="openProject('${project.id}')">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <h3 class="text-lg font-semibold text-gray-800">${project.customerName}</h3>
                        <span class="px-3 py-1 ${statusClass} text-sm rounded-full">${project.status}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div><span class="font-medium">号地:</span> ${project.lotNumber}</div>
                        <div><span class="font-medium">担当者:</span> ${project.assignee}</div>
                        <div><span class="font-medium">部署:</span> ${project.department}</div>
                        <div><span class="font-medium">更新日:</span> ${formatDisplayDate(project.updatedAt)}</div>
                    </div>
                </div>
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </div>
        </div>
    `;
}

function createRoomHtml(roomName) {
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span class="font-medium">${roomName}</span>
                <button class="text-red-600 hover:text-red-800" onclick="removeRoom(this)">削除</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">床材</label>
                    <select class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option>フローリング（ナチュラル）</option>
                        <option>フローリング（ダーク）</option>
                        <option>タイル</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">壁材</label>
                    <select class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option>クロス（標準）</option>
                        <option>クロス（特注）</option>
                        <option>塗装</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">天井材</label>
                    <select class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option>クロス（白）</option>
                        <option>木目調</option>
                        <option>塗装</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    return div.firstElementChild;
}

function getStatusClass(status) {
    const classes = {
        '打ち合わせ中': 'bg-yellow-100 text-yellow-800',
        '仕様確定': 'bg-green-100 text-green-800',
        '完了': 'bg-blue-100 text-blue-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function showNotification(message, type = 'info') {
    // 通知を表示する関数
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function logout() {
    if (confirm('ログアウトしますか？')) {
        // 実際の実装では認証情報をクリア
        window.location.reload();
    }
}

// フォーム入力の変更を監視して自動保存
document.addEventListener('change', function(e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // 変更を自動保存（実際の実装ではGASに送信）
        if (currentProject) {
            const fieldName = e.target.closest('label')?.textContent || 'Unknown Field';
            const oldValue = e.target.dataset.oldValue || '';
            const newValue = e.target.value;
            
            if (oldValue !== newValue) {
                logChange(`${fieldName}を変更`, oldValue, newValue, getCurrentUser());
                e.target.dataset.oldValue = newValue;
            }
        }
    }
});

// 初期値を記録
document.addEventListener('focus', function(e) {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.dataset.oldValue = e.target.value;
    }
}, true);