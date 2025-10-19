// SillyTavern 小剧场生成器插件
// 版本: 1.0.0

(function() {
    'use strict';

    // 插件信息
    const PLUGIN_NAME = 'theater-generator';
    const PLUGIN_VERSION = '1.0.0';

    // 等待SillyTavern加载完成
    function waitForSillyTavern() {
        return new Promise((resolve) => {
            if (window.SillyTavern && window.SillyTavern.plugins) {
                resolve();
            } else {
                setTimeout(() => waitForSillyTavern().then(resolve), 100);
            }
        });
    }

    // 插件主类
    class TheaterGeneratorPlugin {
        constructor() {
            this.name = PLUGIN_NAME;
            this.version = PLUGIN_VERSION;
            this.isInitialized = false;
        }

        // 初始化插件
        async init() {
            if (this.isInitialized) return;
            
            try {
                await waitForSillyTavern();
                this.createMenuButton();
                this.createModal();
                this.bindEvents();
                this.isInitialized = true;
                console.log(`[${PLUGIN_NAME}] 插件初始化成功 v${PLUGIN_VERSION}`);
            } catch (error) {
                console.error(`[${PLUGIN_NAME}] 插件初始化失败:`, error);
            }
        }

        // 创建菜单按钮
        createMenuButton() {
            // 等待扩展菜单加载
            const checkMenu = () => {
                const extensionsMenu = document.querySelector('#extensionsMenu');
                if (extensionsMenu && !document.getElementById('theater-generator-btn')) {
                    // 创建按钮
                    const button = document.createElement('div');
                    button.id = 'theater-generator-btn';
                    button.className = 'menu_button';
                    button.innerHTML = `
                        <i class="fa-solid fa-theater-masks"></i>
                        <span>小剧场生成</span>
                    `;
                    
                    // 添加到菜单
                    extensionsMenu.appendChild(button);
                    console.log(`[${PLUGIN_NAME}] 菜单按钮已添加`);
                } else if (!extensionsMenu) {
                    setTimeout(checkMenu, 100);
                }
            };
            
            checkMenu();
        }

        // 创建模态框
        createModal() {
            // 检查是否已存在
            if (document.getElementById('theater-generator-modal')) return;

            const modalHTML = `
                <div id="theater-generator-modal" class="theater-modal" style="display: none;">
                    <div class="theater-modal-overlay"></div>
                    <div class="theater-modal-content">
                        <div class="theater-modal-header">
                            <h3>🎭 小剧场生成器</h3>
                            <button class="theater-close-btn" id="theater-close-btn">&times;</button>
                        </div>
                        <div class="theater-modal-body">
                            <div class="theater-buttons-grid">
                                <button class="theater-function-btn" data-function="script">
                                    <div class="btn-icon">🎬</div>
                                    <div class="btn-text">创建剧本</div>
                                </button>
                                <button class="theater-function-btn" data-function="character">
                                    <div class="btn-icon">🎭</div>
                                    <div class="btn-text">角色设定</div>
                                </button>
                                <button class="theater-function-btn" data-function="scene">
                                    <div class="btn-icon">🎪</div>
                                    <div class="btn-text">场景设计</div>
                                </button>
                                <button class="theater-function-btn" data-function="music">
                                    <div class="btn-icon">🎵</div>
                                    <div class="btn-text">音效配乐</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            this.addStyles();
        }

        // 添加样式
        addStyles() {
            if (document.getElementById('theater-generator-styles')) return;

            const style = document.createElement('style');
            style.id = 'theater-generator-styles';
            style.textContent = `
                /* 小剧场生成器样式 */
                .theater-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .theater-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(5px);
                }

                .theater-modal-content {
                    position: relative;
                    background: var(--SmartThemeBodyColor, #ffffff);
                    border: 1px solid var(--SmartThemeBorderColor, #e0e0e0);
                    border-radius: 12px;
                    padding: 20px;
                    max-width: 90%;
                    width: 400px;
                    max-height: 80vh;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    animation: theaterModalSlideIn 0.3s ease;
                }

                @keyframes theaterModalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .theater-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--SmartThemeBorderColor, #e0e0e0);
                }

                .theater-modal-header h3 {
                    margin: 0;
                    color: var(--SmartThemeBodyTextColor, #333333);
                    font-size: 18px;
                    font-weight: 600;
                }

                .theater-close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: var(--SmartThemeBodyTextColor, #666666);
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .theater-close-btn:hover {
                    background-color: var(--SmartThemeBorderColor, #f0f0f0);
                    color: var(--SmartThemeBodyTextColor, #333333);
                }

                .theater-buttons-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }

                .theater-function-btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 10px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80px;
                    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
                }

                .theater-function-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }

                .theater-function-btn:active {
                    transform: translateY(0);
                }

                .btn-icon {
                    font-size: 24px;
                    margin-bottom: 5px;
                }

                .btn-text {
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                    text-align: center;
                    line-height: 1.2;
                }

                /* 手机适配 */
                @media (max-width: 768px) {
                    .theater-modal-content {
                        width: 95%;
                        padding: 15px;
                    }
                    
                    .theater-buttons-grid {
                        gap: 10px;
                    }
                    
                    .theater-function-btn {
                        min-height: 70px;
                        padding: 12px;
                    }
                    
                    .btn-icon {
                        font-size: 20px;
                    }
                    
                    .btn-text {
                        font-size: 11px;
                    }
                }

                @media (max-width: 480px) {
                    .theater-modal-content {
                        width: 98%;
                        padding: 12px;
                    }
                    
                    .theater-buttons-grid {
                        gap: 8px;
                    }
                    
                    .theater-function-btn {
                        min-height: 60px;
                        padding: 10px;
                    }
                    
                    .btn-icon {
                        font-size: 18px;
                    }
                    
                    .btn-text {
                        font-size: 10px;
                    }
                }
            `;
            
            document.head.appendChild(style);
        }

        // 绑定事件
        bindEvents() {
            // 点击菜单按钮
            document.addEventListener('click', (e) => {
                if (e.target.closest('#theater-generator-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showModal();
                }
            });

            // 点击关闭按钮
            document.addEventListener('click', (e) => {
                if (e.target.closest('#theater-close-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideModal();
                }
            });

            // 点击模态框背景
            document.addEventListener('click', (e) => {
                if (e.target.id === 'theater-generator-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    this.hideModal();
                }
            });

            // 功能按钮点击
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.theater-function-btn');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const functionType = btn.dataset.function;
                    this.handleFunctionClick(functionType, btn);
                }
            });

            // ESC键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isModalVisible()) {
                    this.hideModal();
                }
            });
        }

        // 显示模态框
        showModal() {
            const modal = document.getElementById('theater-generator-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }

        // 隐藏模态框
        hideModal() {
            const modal = document.getElementById('theater-generator-modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }

        // 检查模态框是否可见
        isModalVisible() {
            const modal = document.getElementById('theater-generator-modal');
            return modal && modal.style.display !== 'none';
        }

        // 处理功能按钮点击
        handleFunctionClick(functionType, button) {
            console.log(`[${PLUGIN_NAME}] 点击了功能: ${functionType}`);
            
            // 添加点击效果
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);

            // 根据功能类型执行相应操作
            switch(functionType) {
                case 'script':
                    this.generateScript();
                    break;
                case 'character':
                    this.generateCharacter();
                    break;
                case 'scene':
                    this.generateScene();
                    break;
                case 'music':
                    this.generateMusic();
                    break;
            }
        }

        // 生成剧本
        generateScript() {
            console.log('[小剧场生成器] 生成剧本功能');
            // 这里可以添加具体的剧本生成逻辑
            // 例如：发送消息到聊天框或调用API
        }

        // 生成角色
        generateCharacter() {
            console.log('[小剧场生成器] 生成角色功能');
        }

        // 生成场景
        generateScene() {
            console.log('[小剧场生成器] 生成场景功能');
        }

        // 生成音效
        generateMusic() {
            console.log('[小剧场生成器] 生成音效功能');
        }
    }

    // 创建插件实例
    const plugin = new TheaterGeneratorPlugin();

    // 注册到SillyTavern
    if (window.SillyTavern && window.SillyTavern.plugins) {
        window.SillyTavern.plugins.register(plugin);
    } else {
        // 如果SillyTavern还没加载，等待加载完成
        document.addEventListener('DOMContentLoaded', () => {
            plugin.init();
        });
    }

    // 暴露到全局作用域
    window.TheaterGeneratorPlugin = plugin;

})();

























