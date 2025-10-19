# 手机端数据持久化修复说明

## 问题描述
在手机端使用小剧场生成器时，每次退出酒馆重新进入都需要重新设置，无法保存小剧场、日记的HTML预览框、壁纸等设置数据。

## 解决方案
实现了多层级存储降级方案，自动检测可用的存储方式并按优先级使用：

### 存储优先级
1. **localStorage** - 首选存储方式
2. **sessionStorage** - 会话存储（页面关闭后数据丢失）
3. **IndexedDB** - 现代浏览器的数据库存储
4. **内存存储** - 最后降级方案（页面刷新后数据丢失）

### 主要改进

#### 1. 存储管理器 (StorageManager)
- 自动检测可用的存储方式
- 实现存储降级机制
- 提供统一的存储接口
- 支持数据备份和恢复

#### 2. 模块更新
- **TheaterModule**: 小剧场模块存储优化
- **DiaryModule**: 日记模块存储优化  
- **WallpaperModule**: 壁纸模块存储优化
- **API设置**: API配置存储优化

#### 3. 调试功能
添加了以下调试函数，可在浏览器控制台使用：

```javascript
// 查看存储状态
window.showStorageStatus()

// 调试存储管理器
window.debugStorageManager()

// 清理所有存储数据
window.clearAllStorage()
```

## 使用方法

### 1. 自动检测
系统会自动检测手机端可用的存储方式，无需手动配置。

### 2. 存储状态查看
在浏览器控制台输入 `window.showStorageStatus()` 查看当前存储状态。

### 3. 问题排查
如果遇到存储问题，可以在控制台输入 `window.debugStorageManager()` 进行诊断。

### 4. 数据清理
如果需要清理所有存储数据，可以在控制台输入 `window.clearAllStorage()`。

## 兼容性说明

### 支持的浏览器
- **iOS Safari**: 支持 localStorage、sessionStorage、IndexedDB
- **Android Chrome**: 支持 localStorage、sessionStorage、IndexedDB
- **Android Firefox**: 支持 localStorage、sessionStorage、IndexedDB
- **其他移动浏览器**: 根据支持情况自动降级

### 存储限制
- **localStorage**: 通常限制为 5-10MB
- **sessionStorage**: 通常限制为 5-10MB
- **IndexedDB**: 通常限制为 50MB 或更多
- **内存存储**: 无限制但页面刷新后丢失

## 技术实现

### 存储检测
```javascript
isStorageAvailable(type) {
    try {
        switch (type) {
            case 'localStorage':
                const test = '__storage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            // ... 其他存储方式检测
        }
    } catch (e) {
        return false;
    }
}
```

### 降级机制
```javascript
fallbackSetItem(key, value) {
    // 尝试其他存储方式
    for (const method of this.storageMethods) {
        if (method === this.currentMethod) continue;
        try {
            // 尝试使用其他存储方式
            // ...
        } catch (e) {
            continue;
        }
    }
}
```

## 注意事项

1. **隐私模式**: 某些浏览器在隐私模式下会禁用 localStorage，系统会自动降级到其他存储方式。

2. **存储空间**: 如果存储空间不足，系统会尝试清理旧数据或降级到内存存储。

3. **数据同步**: 不同存储方式之间的数据不会自动同步，建议使用同一种存储方式。

4. **调试信息**: 所有存储操作都会在控制台输出详细日志，便于问题排查。

## 更新日志

- **v1.0.0**: 实现多层级存储降级方案
- 添加存储管理器类
- 更新所有模块的存储方法
- 添加调试和状态检测功能
- 优化手机端兼容性

## 联系支持

如果遇到问题，请：
1. 查看浏览器控制台的错误信息
2. 使用 `window.debugStorageManager()` 进行诊断
3. 检查存储状态 `window.showStorageStatus()`
4. 必要时清理存储数据 `window.clearAllStorage()`

