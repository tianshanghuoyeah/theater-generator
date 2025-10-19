// 壁纸诊断脚本
// 在浏览器控制台中运行此脚本来诊断壁纸保存问题

console.log('🔍 开始壁纸诊断...');

// 1. 检查存储管理器状态
console.log('\n=== 1. 存储管理器状态 ===');
if (typeof storageManager !== 'undefined') {
    console.log('✅ 存储管理器已加载');
    console.log('当前方法:', storageManager.currentMethod);
    console.log('localStorage可用:', storageManager.isStorageAvailable('localStorage'));
} else {
    console.log('❌ 存储管理器未加载');
}

// 2. 检查壁纸模块状态
console.log('\n=== 2. 壁纸模块状态 ===');
if (typeof window.wallpaperModule !== 'undefined') {
    console.log('✅ 壁纸模块已加载');
    console.log('数据已加载:', window.wallpaperModule.dataLoaded);
    console.log('壁纸列表长度:', window.wallpaperModule.wallpapers ? window.wallpaperModule.wallpapers.length : 0);
    console.log('当前设置:', window.wallpaperModule.settings);
} else {
    console.log('❌ 壁纸模块未加载');
}

// 3. 检查localStorage中的壁纸数据
console.log('\n=== 3. localStorage中的壁纸数据 ===');
const wallpaperKeys = Object.keys(localStorage).filter(key => key.includes('wallpaper'));
console.log('壁纸相关键:', wallpaperKeys);

wallpaperKeys.forEach(key => {
    try {
        const value = localStorage.getItem(key);
        const parsed = value ? JSON.parse(value) : null;
        console.log(`${key}:`, parsed);
    } catch (e) {
        console.log(`${key}: (解析失败)`, localStorage.getItem(key));
    }
});

// 4. 检查数据一致性
console.log('\n=== 4. 数据一致性检查 ===');
const wallpapers = localStorage.getItem('wallpaper_module_wallpapers');
const settings = localStorage.getItem('wallpaper_module_settings');

if (wallpapers && settings) {
    try {
        const wallpaperList = JSON.parse(wallpapers);
        const settingsData = JSON.parse(settings);
        
        console.log('壁纸列表长度:', wallpaperList.length);
        console.log('当前壁纸ID:', settingsData.currentWallpaper);
        
        if (settingsData.currentWallpaper && wallpaperList.length > 0) {
            const currentWallpaper = wallpaperList.find(w => w.id === settingsData.currentWallpaper);
            if (currentWallpaper) {
                console.log('✅ 当前壁纸ID在壁纸列表中找到');
            } else {
                console.log('❌ 当前壁纸ID在壁纸列表中找不到！');
                console.log('可用的壁纸ID:', wallpaperList.map(w => w.id));
            }
        } else if (settingsData.currentWallpaper && wallpaperList.length === 0) {
            console.log('⚠️ 有当前壁纸ID但没有壁纸列表，数据不同步');
        }
    } catch (e) {
        console.log('❌ 数据解析失败:', e);
    }
} else {
    console.log('❌ 缺少壁纸数据或设置数据');
}

// 5. 测试壁纸保存功能
console.log('\n=== 5. 测试壁纸保存功能 ===');
if (typeof storageManager !== 'undefined') {
    const testWallpaper = {
        id: 'test_' + Date.now(),
        name: '测试壁纸',
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwN2JmZiIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9vTwvdGV4dD48L3N2Zz4=',
        type: 'test'
    };
    
    const saveResult = storageManager.setItem('wallpaper_module_wallpapers', [testWallpaper]);
    console.log('测试保存结果:', saveResult ? '✅ 成功' : '❌ 失败');
    
    const loadResult = storageManager.getItem('wallpaper_module_wallpapers');
    console.log('测试读取结果:', loadResult ? '✅ 成功' : '❌ 失败');
    
    if (loadResult) {
        console.log('读取的壁纸数量:', loadResult.length);
        console.log('第一张壁纸:', loadResult[0]);
    }
    
    // 清理测试数据
    storageManager.removeItem('wallpaper_module_wallpapers');
    console.log('测试数据已清理');
} else {
    console.log('❌ 无法测试，存储管理器未加载');
}

// 6. 提供修复建议
console.log('\n=== 6. 修复建议 ===');
if (wallpaperKeys.length === 0) {
    console.log('🔧 建议: 壁纸数据完全丢失，需要重新上传壁纸');
} else if (wallpapers && !settings) {
    console.log('🔧 建议: 有壁纸数据但没有设置，运行以下命令修复:');
    console.log('storageManager.setItem("wallpaper_module_settings", {currentWallpaper: "", modalSize: "medium", showTitle: true, showHeader: true, buttonStyle: "default"});');
} else if (settings && !wallpapers) {
    console.log('🔧 建议: 有设置但没有壁纸数据，运行以下命令修复:');
    console.log('storageManager.setItem("wallpaper_module_wallpapers", []);');
} else {
    console.log('🔧 建议: 数据存在但可能不同步，尝试重新加载壁纸模块');
}

console.log('\n🔍 壁纸诊断完成！');








