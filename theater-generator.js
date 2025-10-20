// SillyTavern 第三方扩展 - 小剧场生成器
// 文件位置: public/scripts/extensions/third-party/theater-generator/theater-generator.js

(function() {
    'use strict';

    console.log('[小剧场生成器] 扩展开始加载');

    // 全局提示音：生成完成时播放短促提示音（不依赖外部资源）
    if (!window.playNotifySound) {
        window.playNotifySound = function playNotifySound() {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    const ctx = new AudioContextClass();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 880;
                    gain.gain.value = 0.0001;
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    const now = ctx.currentTime;
                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

                    osc.start(now);
                    osc.stop(now + 0.2);
                    osc.onended = () => { try { ctx.close(); } catch (_) {} };
                    return;
                }

                // 退化为内联wav（极短哔声）
                const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAABAAACABAAAAAAAP//AAD//wAA');
                audio.volume = 0.5;
                audio.play().catch(() => {});
            } catch (_) {
                // 静默失败
            }
        };
    }

    // 扩展信息
    const EXTENSION_NAME = 'theater-generator';
    let isInitialized = false;
    let buttonAdded = false;

    // 立即尝试初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 注册扩展到SillyTavern
    if (window.SillyTavern && window.SillyTavern.registerExtension) {
        window.SillyTavern.registerExtension({
            name: EXTENSION_NAME,
            init: init
        });
    }

    function init() {
        if (isInitialized) return;
        console.log('[小剧场生成器] 开始初始化');
        
        // 添加样式
        addStyles();
        
        // 立即尝试添加按钮
        addButton();
        
        // 设置多个定时器确保按钮被添加
        setTimeout(() => addButton(), 500);
        setTimeout(() => addButton(), 1000);
        setTimeout(() => addButton(), 2000);
        setTimeout(() => addButton(), 5000);
        
        // 监听页面变化
        const observer = new MutationObserver(() => {
            addButton();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 设置事件监听与轮询后备
        setupFloorListeners();

        isInitialized = true;
        console.log('[小剧场生成器] 初始化完成');
    }

    function addButton() {
        if (buttonAdded) return;
        
        const extensionsMenu = document.querySelector('#extensionsMenu');
        if (!extensionsMenu) {
            console.log('[小剧场生成器] 扩展菜单未找到，继续等待...');
            return;
        }

        if (document.getElementById('theater-generator-btn')) {
            buttonAdded = true;
            return;
        }

        console.log('[小剧场生成器] 找到扩展菜单，添加按钮');
        
        // 创建按钮
        const button = document.createElement('div');
        button.id = 'theater-generator-btn';
        button.className = 'list-group-item flex-container flexGap5 interactable';
        button.setAttribute('tabindex', '0');
        button.style.cssText = `
            display: flex !important;
            align-items: center !important;
            gap: 5px !important;
            padding: 8px 12px 8px 6px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            white-space: nowrap !important;
            border: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: inherit !important;
            line-height: inherit !important;
        `;
        
        button.innerHTML = `
            <i class="fa-solid fa-theater-masks" style="font-size: 16px !important;"></i>
            <span style="white-space: nowrap !important;">小剧场生成器</span>
        `;
        
        // 添加到菜单
        extensionsMenu.appendChild(button);
        buttonAdded = true;
        
        // 绑定点击事件
        button.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[小剧场生成器] 按钮被点击！');
            openTheaterGenerator();
        };
        
        // 悬停效果
        button.onmouseenter = function() {
            this.style.backgroundColor = 'var(--SmartThemeBorderColor, rgba(0, 0, 0, 0.05))';
        };
        
        button.onmouseleave = function() {
            this.style.backgroundColor = 'transparent';
        };
        
        console.log('[小剧场生成器] 按钮已成功添加到扩展菜单');
    }

    // ========================
    // 楼层监听与小剧场生成
    // ========================
    let listeningEnabled = true;
    let lastObservedMessageId = null;
    let selfMessageGuardTs = 0;

    function setupFloorListeners() {
        try {
            const tryEventOn = (typeof window !== 'undefined' && typeof window.eventOn === 'function');
            const hasEvents = (typeof window !== 'undefined' && typeof window.tavern_events !== 'undefined');

            if (tryEventOn && hasEvents && window.tavern_events.MESSAGE_RECEIVED) {
                console.log('[小剧场生成器] 使用事件监听 MESSAGE_RECEIVED');
                window.eventOn(window.tavern_events.MESSAGE_RECEIVED, handleMessageEvent);
            } else {
                console.warn('[小剧场生成器] 事件监听不可用，启用轮询后备');
                startPollingFallback();
            }
        } catch (e) {
            console.error('[小剧场生成器] 设置事件监听失败，启用轮询后备:', e);
            startPollingFallback();
        }
    }

    function startPollingFallback() {
        setInterval(() => {
            if (!listeningEnabled) return;
            const chatData = getChatData();
            if (!chatData) return;
            const currentLastId = chatData.lastMessageId;
            if (currentLastId && currentLastId !== lastObservedMessageId) {
                handleNewFloor(currentLastId);
                lastObservedMessageId = currentLastId;
            }
        }, 2000);
    }

    function handleMessageEvent(payload) {
        if (!listeningEnabled) return;
        // 避免立即被自身新增消息二次触发，设置最短冷却
        if (Date.now() - selfMessageGuardTs < 1500) return;

        try {
            const chatData = getChatData();
            if (!chatData) return;
            const currentLastId = chatData.lastMessageId;
            if (!currentLastId || currentLastId === lastObservedMessageId) return;

            handleNewFloor(currentLastId);
            lastObservedMessageId = currentLastId;
        } catch (e) {
            console.error('[小剧场生成器] 处理消息事件失败:', e);
        }
    }

    function getChatData() {
        try {
            if (typeof window !== 'undefined' && window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
                const ctx = window.SillyTavern.getContext();
                if (ctx && Array.isArray(ctx.chat)) {
                    const messages = ctx.chat;
                    const last = messages.length > 0 ? messages[messages.length - 1] : null;
                    return {
                        messages,
                        floorCount: Math.max(0, messages.length - 1),
                        lastMessageId: last ? (last.send_date || last.id || (messages.length - 1)) : null,
                    };
                }
            }
            if (Array.isArray(window.chat)) {
                const messages = window.chat;
                const last = messages.length > 0 ? messages[messages.length - 1] : null;
                return {
                    messages,
                    floorCount: Math.max(0, messages.length - 1),
                    lastMessageId: last ? (last.send_date || last.id || (messages.length - 1)) : null,
                };
            }
        } catch (e) {
            console.error('[小剧场生成器] 获取聊天数据失败:', e);
        }
        return null;
    }

    async function handleNewFloor(newMessageId) {
        try {
            const chatData = getChatData();
            if (!chatData) return;

            // 如果最后一条就是我们刚刚生成的小剧场，跳过
            const lastMsg = chatData.messages[chatData.messages.length - 1];
            if (lastMsg && typeof lastMsg?.mes === 'string' && lastMsg.mes.startsWith('[小剧场]')) {
                return;
            }

            // 基于楼层数量生成小剧场
            const theaterText = await generateTheaterByFloor(chatData.floorCount);
            if (!theaterText) return;

            await addTheaterMessage(theaterText);
        } catch (e) {
            console.error('[小剧场生成器] 处理新楼层失败:', e);
        }
    }

    function buildPromptByFloor(floorCount) {
        const safeCount = Number.isFinite(floorCount) ? floorCount : 0;
        return (
            '你是一个小剧场生成创作者，运用HTML 或内联 CSS 来美化和排版小剧场的内容。' +
            `\n硬性要求：\n- 基于当前聊天上下文创作，不引入无关设定\n- 输出1～4个小剧场片段（若上下文不足则少于4个），每个需独立成块\n- 每个片段使用<section class="mini-theater-card">包裹，包含<h3>标题</h3>、<div class="theater-dialogue">对话</div>，以及可选<div class="theater-direction"><em>舞台指示</em></div>\n- 使用适度的样式增强可读性（粗体、斜体、强调色、分隔线、列表、分镜等），禁止代码围栏与Markdown\n- 结构清晰可扫读，可模仿字幕/分镜/论坛楼层/报告摘要\n- 输出为可直接渲染的HTML片段（不含<html>包装）\n- 参考楼层数：${safeCount}\n`);
    }

    async function generateTheaterByFloor(floorCount) {
        const prompt = buildPromptByFloor(floorCount);
        try {
            // 优先使用 SillyTavern.generate（与当前预设一致）
            if (window.SillyTavern && typeof window.SillyTavern.generate === 'function') {
                const text = await window.SillyTavern.generate({
                    user_input: prompt,
                    should_stream: false,
                    max_chat_history: 'all',
                });
                return (text || '').trim();
            }
        } catch (e) {
            console.warn('[小剧场生成器] 使用 SillyTavern.generate 失败:', e);
        }

        // 后备：尝试全局 generate（若存在）
        try {
            if (typeof window.generate === 'function') {
                const text = await window.generate({ user_input: prompt, should_stream: false });
                return (text || '').trim();
            }
        } catch (e) {
            console.error('[小剧场生成器] 使用后备 generate 失败:', e);
        }
        return '';
    }

    async function addTheaterMessage(text) {
        const content = `[小剧场]\n${text}`;
        try {
            // 添加自定义消息并滚动
            if (window.SillyTavern && typeof window.SillyTavern.addOneMessage === 'function') {
                selfMessageGuardTs = Date.now();
                await window.SillyTavern.addOneMessage({
                    name: '小剧场',
                    is_user: false,
                    is_system: true,
                    is_char: false,
                    mes: content,
                }, { type: 'normal', scroll: true, showSwipes: false });
                return;
            }
        } catch (e) {
            console.warn('[小剧场生成器] 通过 SillyTavern.addOneMessage 添加失败:', e);
        }

        // 退化：尝试直接写入 DOM（不推荐，仅兜底）
        // 注释掉兜底渲染，避免插入透明度预览框
        /*
        try {
            const chatElem = document.querySelector('#chat') || document.body;
            const div = document.createElement('div');
            div.textContent = content;
            div.style.cssText = 'padding:6px 10px;border:1px dashed #888;border-radius:6px;margin:8px 0;font-size:12px;opacity:0.85;';
            chatElem.appendChild(div);
        } catch (e) {
            console.error('[小剧场生成器] 兜底渲染失败:', e);
        }
        */
    }
    function addStyles() {
        if (document.getElementById('theater-generator-styles')) return;

        const style = document.createElement('style');
        style.id = 'theater-generator-styles';
        style.textContent = `
            /* 小剧场生成器样式 - 与其他菜单项保持一致 */
            #theater-generator-btn {
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
                padding: 8px 12px 8px 6px !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                white-space: nowrap !important;
                border: none !important;
                background: transparent !important;
                color: inherit !important;
                font-size: inherit !important;
                line-height: inherit !important;
                border-radius: 4px !important;
            }

            #theater-generator-btn:hover {
                background-color: var(--SmartThemeBorderColor, rgba(0, 0, 0, 0.05)) !important;
                transform: none !important;
            }

            #theater-generator-btn:focus {
                outline: 2px solid var(--SmartThemeAccent, #007bff) !important;
                outline-offset: 2px !important;
            }

            #theater-generator-btn i {
                font-size: 16px !important;
                color: inherit !important;
            }

            #theater-generator-btn span {
                white-space: nowrap !important;
                color: inherit !important;
                font-weight: inherit !important;
            }

            .theater-modal {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 999999 !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                padding: 0 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
            }

            .theater-modal-overlay {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: transparent !important;
                backdrop-filter: none !important;
            }

            .theater-modal-content {
                position: relative !important;
                background: #ffffff !important;
                border: 2px solid #000000 !important;
                border-radius: 12px !important;
                padding: 0 !important;
                max-width: 72vw !important;
                width: 400px !important;
                height: 450px !important;
                min-height: 450px !important;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
                animation: theaterModalSlideIn 0.3s ease !important;
                margin: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-start !important;
                align-items: center !important;
            }

            @keyframes theaterModalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .theater-modal-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin: 0 !important;
                padding: 20px 30px !important;
                border-bottom: 2px solid #000000 !important;
                width: 100% !important;
                background: #000000 !important;
                border-radius: 10px 10px 0 0 !important;
            }

            .theater-modal-header h3 {
                margin: 0 !important;
                color: #ffffff !important;
                font-size: 20px !important;
                font-weight: 700 !important;
                flex: 1 !important;
                text-align: center !important;
            }

            .theater-close-btn {
                background: none !important;
                border: 2px solid #ffffff !important;
                font-size: 20px !important;
                color: #ffffff !important;
                cursor: pointer !important;
                padding: 5px !important;
                border-radius: 50% !important;
                transition: all 0.2s ease !important;
                width: 32px !important;
                height: 32px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            .theater-back-btn {
                background: rgba(255, 255, 255, 0.2) !important;
                border: 2px solid #ffffff !important;
                font-size: 14px !important;
                color: #ffffff !important;
                cursor: pointer !important;
                padding: 6px 12px !important;
                border-radius: 4px !important;
                transition: all 0.2s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            .theater-back-btn:hover {
                background: rgba(255, 255, 255, 0.3) !important;
                border-color: #ffffff !important;
            }

            .theater-close-btn:hover {
                background-color: #ffffff !important;
                color: #000000 !important;
            }

            .theater-buttons-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr 1fr !important;
                gap: 25px !important;
                width: 100% !important;
                flex: 1 !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 60px 50px 40px 50px !important;
            }

            .theater-function-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                border: none !important;
                border-radius: 16px !important;
                padding: 20px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 120px !important;
                height: 120px !important;
                width: 120px !important;
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3) !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 auto !important;
            }

            .theater-function-btn::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: -100% !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
                transition: left 0.5s ease !important;
            }

            .theater-function-btn:hover::before {
                left: 100% !important;
            }

            .theater-function-btn:hover {
                transform: translateY(-4px) scale(1.02) !important;
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%) !important;
                box-shadow: 0 12px 35px rgba(102, 126, 234, 0.5) !important;
            }

            .theater-function-btn:active {
                transform: translateY(-2px) scale(1.01) !important;
                background: linear-gradient(135deg, #4e5bc6 0%, #5e3a7e 100%) !important;
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
            }

            .btn-icon {
                font-size: 32px !important;
                margin-bottom: 10px !important;
            }

            .btn-text {
                font-size: 13px !important;
                font-weight: 600 !important;
                text-align: center !important;
                line-height: 1.2 !important;
            }

            /* API设置样式 */
            .api-settings-form {
                padding: 20px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            .api-form-group {
                margin-bottom: 20px !important;
            }

            .api-form-label {
                display: block !important;
                margin-bottom: 8px !important;
                font-weight: 600 !important;
                color: #2c3e50 !important;
                font-size: 14px !important;
            }

            .api-form-label input[type="checkbox"] {
                width: 18px !important;
                height: 18px !important;
                margin-right: 8px !important;
                accent-color: #667eea !important;
                cursor: pointer !important;
            }

            .api-form-input, .api-form-select {
                width: 100% !important;
                padding: 12px 16px !important;
                border: 2px solid #e1e5e9 !important;
                border-radius: 10px !important;
                font-size: 14px !important;
                background: #ffffff !important;
                color: #2c3e50 !important;
                box-sizing: border-box !important;
                transition: all 0.3s ease !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
            }

            .api-form-input:focus, .api-form-select:focus {
                outline: none !important;
                border-color: #667eea !important;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
                transform: translateY(-1px) !important;
            }

            .api-form-input:hover, .api-form-select:hover {
                border-color: #bdc3c7 !important;
            }

            .api-input-group {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }

            .api-input-toggle {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                border: none !important;
                color: #ffffff !important;
                padding: 10px 14px !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                transition: all 0.3s ease !important;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
            }

            .api-input-toggle:hover {
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
            }

            .api-input-toggle:active {
                transform: translateY(0) !important;
            }

            .api-form-range {
                width: 100% !important;
                margin: 8px 0 !important;
                height: 6px !important;
                border-radius: 3px !important;
                background: #e1e5e9 !important;
                outline: none !important;
                -webkit-appearance: none !important;
                appearance: none !important;
            }

            .api-form-range::-webkit-slider-thumb {
                -webkit-appearance: none !important;
                appearance: none !important;
                width: 20px !important;
                height: 20px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                cursor: pointer !important;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
                transition: all 0.3s ease !important;
            }

            .api-form-range::-webkit-slider-thumb:hover {
                transform: scale(1.1) !important;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.5) !important;
            }

            .api-form-range::-moz-range-thumb {
                width: 20px !important;
                height: 20px !important;
                border-radius: 50% !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                cursor: pointer !important;
                border: none !important;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
            }

            .api-range-value {
                font-weight: 600 !important;
                color: #000000 !important;
                margin-left: 10px !important;
            }

            .api-form-hint {
                display: block !important;
                font-size: 12px !important;
                color: #666666 !important;
                margin-top: 4px !important;
            }

            .api-form-actions {
                display: flex !important;
                gap: 10px !important;
                margin-top: 20px !important;
            }

            .api-btn-primary, .api-btn-secondary {
                padding: 12px 24px !important;
                border: none !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
                flex: 1 !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
                position: relative !important;
                overflow: hidden !important;
            }

            .api-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                color: #ffffff !important;
            }

            .api-btn-primary:hover {
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
            }

            .api-btn-primary:active {
                transform: translateY(0) !important;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
            }

            .api-btn-secondary {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
                color: #ffffff !important;
            }

            .api-btn-secondary:hover {
                background: linear-gradient(135deg, #ee82f0 0%, #f3455a 100%) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4) !important;
            }

            .api-btn-secondary:active {
                transform: translateY(0) !important;
                box-shadow: 0 2px 8px rgba(240, 147, 251, 0.3) !important;
            }

            .api-status-message {
                margin-top: 15px !important;
                padding: 10px !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                text-align: center !important;
            }

            /* 模块按钮样式 */
            .tg-theater-btn, .tg-wallpaper-btn {
                padding: 10px 20px !important;
                border: none !important;
                border-radius: 8px !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
                position: relative !important;
                overflow: hidden !important;
            }

            .tg-primary {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
                color: #ffffff !important;
            }

            .tg-primary:hover {
                background: linear-gradient(135deg, #3d8bfe 0%, #00e6fe 100%) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4) !important;
            }

            .tg-secondary {
                background: linear-gradient(135deg, #fa709a 0%, #fee140 100%) !important;
                color: #ffffff !important;
            }

            .tg-secondary:hover {
                background: linear-gradient(135deg, #f85a8a 0%, #fed030 100%) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 15px rgba(250, 112, 154, 0.4) !important;
            }

            .tg-theater-btn:active, .tg-wallpaper-btn:active {
                transform: translateY(0) !important;
            }

            /* 手机适配 */
            @media (max-width: 768px) {
                .theater-modal-content {
                    width: 76vw !important;
                    max-width: 76vw !important;
                    height: 60vh !important;
                    min-height: 60vh !important;
                }
                
                .theater-buttons-grid {
                    grid-template-columns: 1fr 1fr !important;
                    gap: 25px !important;
                    padding: 40px 30px 30px 30px !important;
                }
                
                .theater-function-btn {
                    min-height: 100px !important;
                    height: 100px !important;
                    width: 100px !important;
                    padding: 15px !important;
                }
                
                .btn-icon {
                    font-size: 28px !important;
                    margin-bottom: 8px !important;
                }
                
                .btn-text {
                    font-size: 11px !important;
                }

                .api-settings-form {
                    padding: 15px !important;
                }

                .api-form-group {
                    margin-bottom: 15px !important;
                }

                .api-form-actions {
                    flex-direction: column !important;
                }
            }

            @media (max-width: 480px) {
                .theater-modal-content {
                    width: 78vw !important;
                    max-width: 78vw !important;
                    height: 63vh !important;
                    min-height: 63vh !important;
                }
                
                .theater-buttons-grid {
                    grid-template-columns: 1fr 1fr !important;
                    gap: 20px !important;
                    padding: 30px 20px 20px 20px !important;
                }
                
                .theater-function-btn {
                    min-height: 90px !important;
                    height: 90px !important;
                    width: 90px !important;
                    padding: 12px !important;
                }
                
                .btn-icon {
                    font-size: 26px !important;
                    margin-bottom: 6px !important;
                }
                
                .btn-text {
                    font-size: 10px !important;
                }

                .api-settings-form {
                    padding: 12px !important;
                }

                .api-form-group {
                    margin-bottom: 12px !important;
                }

                .api-form-label {
                    font-size: 13px !important;
                }

                .api-form-input, .api-form-select {
                    padding: 8px !important;
                    font-size: 13px !important;
                }
            }
        `;
        
        document.head.appendChild(style);
        console.log('[小剧场生成器] 样式已添加');
    }

    function openTheaterGenerator() {
        console.log('[小剧场生成器] 打开小剧场生成器');
        
        // 检查是否已存在
        if (document.getElementById('theater-generator-modal')) {
            console.log('[小剧场生成器] 模态框已存在');
            return;
        }

        const modalHTML = `
            <div id="theater-generator-modal" class="theater-modal">
                <div class="theater-modal-overlay"></div>
                <div class="theater-modal-content">
                    <div class="theater-modal-header">
                        <h3>🎭 小剧场生成器</h3>
                        <button class="theater-close-btn" id="theater-close-btn">&times;</button>
                    </div>
                    <div class="theater-modal-body">
                        <div class="theater-buttons-grid">
                            <button class="theater-function-btn" data-function="api">
                                <div class="btn-icon">⚙️</div>
                                <div class="btn-text">API设置</div>
                            </button>
                            <button class="theater-function-btn" data-function="chat">
                                <div class="btn-icon">🔥</div>
                                <div class="btn-text">小火聊聊天</div>
                            </button>
                            <button class="theater-function-btn" data-function="diary">
                                <div class="btn-icon">📝</div>
                                <div class="btn-text">日记</div>
                            </button>
                            <button class="theater-function-btn" data-function="theater">
                                <div class="btn-icon">🎭</div>
                                <div class="btn-text">小剧场</div>
                            </button>
                            <button class="theater-function-btn" data-function="wallpaper">
                                <div class="btn-icon">🖼️</div>
                                <div class="btn-text">壁纸</div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        console.log('[小剧场生成器] 模态框已创建');
        
        // 绑定事件
        bindModalEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[主界面] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[主界面] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM元素已完全渲染
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
    }

    function bindModalEvents() {
        console.log('[小剧场生成器] 绑定模态框事件');
        
        // 点击关闭按钮
        const closeBtn = document.getElementById('theater-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[小剧场生成器] 关闭按钮被点击');
                closeTheaterGenerator();
            };
        }

        // 点击模态框背景
        const modal = document.getElementById('theater-generator-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'theater-generator-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    console.log('[小剧场生成器] 背景被点击');
                    closeTheaterGenerator();
                }
            };
        }

        // 功能按钮点击
        const functionBtns = document.querySelectorAll('.theater-function-btn');
        functionBtns.forEach(btn => {
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const functionType = this.dataset.function;
                console.log('[小剧场生成器] 功能按钮被点击:', functionType);
                handleFunctionClick(functionType, this);
            };
        });

        // ESC键关闭
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // 检查是否有全屏预览
                const fullscreenPreview = document.querySelector('.preview-container.fullscreen');
                if (fullscreenPreview) {
                    console.log('[小剧场生成器] ESC键退出全屏');
                    fullscreenPreview.classList.remove('fullscreen');
                    document.body.style.overflow = 'auto';
                } else if (document.getElementById('theater-generator-modal')) {
                    console.log('[小剧场生成器] ESC键被按下');
                    closeTheaterGenerator();
                }
            }
        });
    }

    function closeTheaterGenerator() {
        console.log('[小剧场生成器] 关闭小剧场生成器');
        const modal = document.getElementById('theater-generator-modal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    }

    function handleFunctionClick(functionType, button) {
        console.log('[小剧场生成器] 处理功能点击:', functionType);
        
        // 添加点击效果
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);

        // 根据功能类型执行相应操作
        switch(functionType) {
            case 'api':
                openAPISettings();
                break;
            case 'chat':
                openChatModule();
                break;
            case 'diary':
                openDiaryModule();
                break;
            case 'theater':
                openTheaterModule();
                break;
            case 'wallpaper':
                openWallpaperModule();
                break;
        }
    }

    function openAPISettings() {
        console.log('[小剧场生成器] 打开API设置');
        closeTheaterGenerator();
        showAPISettingsModal();
    }

    function closeAPISettingsModal() {
        const modal = document.getElementById('api-settings-modal');
        if (modal) {
            modal.remove();
            console.log('[小剧场生成器] API设置界面已关闭');
        }
    }

    // 聊天模块
    function openChatModule() {
        console.log('[小剧场生成器] 打开小火聊天模块');
        closeTheaterGenerator();
        showChatModuleModal();
    }

    // 日记模块
    function openDiaryModule() {
        console.log('[小剧场生成器] 打开日记模块');
        closeTheaterGenerator();
        showDiaryModuleModal();
    }

    // 小剧场模块
    function openTheaterModule() {
        console.log('[小剧场生成器] 打开小剧场模块');
        closeTheaterGenerator();
        showTheaterModuleModal();
    }


    // 壁纸模块
    function openWallpaperModule() {
        console.log('[小剧场生成器] 打开壁纸模块');
        closeTheaterGenerator();
        showWallpaperModuleModal();
    }
    // 显示聊天模块模态框
    function showChatModuleModal() {
        if (document.getElementById('chat-module-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'chat-module-modal';
        modal.className = 'theater-modal';
        modal.innerHTML = `
            <div class="theater-modal-overlay"></div>
            <div class="theater-modal-content" style="height: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="theater-modal-header">
                    <button class="theater-back-btn" id="chat-module-back-btn">← 返回</button>
                    <h3>🔥小剧场生成器</h3>
                    <button class="theater-close-btn" id="chat-module-close-btn">&times;</button>
                </div>
                <div class="theater-modal-body" style="width: 100%; overflow-y: auto; flex: 1;">
                    <div id="chat-module-content">
                        <!-- 聊天模块内容将在这里动态加载 -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        console.log('[小剧场生成器] 小火聊天模态框已创建');
        
        // 加载聊天模块内容
        loadChatModuleContent();
        
        // 绑定事件
        bindChatModuleEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[聊天模块] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[聊天模块] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM已完全加载
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
    }

    // 显示日记模块模态框
    function showDiaryModuleModal() {
        if (document.getElementById('diary-module-modal')) return;

        const modalHTML = `
            <div id="diary-module-modal" class="theater-modal">
                <div class="theater-modal-overlay"></div>
                <div class="theater-modal-content" style="height: 600px; max-height: 80vh; overflow-y: auto;">
                    <div class="theater-modal-header">
                        <button class="theater-back-btn" id="diary-module-back-btn">← 返回</button>
                        <h3>📝 日记生成</h3>
                        <button class="theater-close-btn" id="diary-module-close-btn">&times;</button>
                    </div>
                    <div class="theater-modal-body" style="width: 100%; overflow-y: auto; flex: 1;">
                        <div id="diary-module-content">
                            <!-- 日记模块内容将在这里动态加载 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 加载日记模块内容
        loadDiaryModuleContent();
        
        // 绑定事件
        bindDiaryModuleEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[日记模块] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[日记模块] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM已完全加载
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
    }

    // 显示小剧场模块模态框
    function showTheaterModuleModal() {
        if (document.getElementById('theater-module-modal')) return;

        const modalHTML = `
            <div id="theater-module-modal" class="theater-modal">
                <div class="theater-modal-overlay"></div>
                <div class="theater-modal-content" style="height: 600px; max-height: 80vh; overflow-y: auto;">
                    <div class="theater-modal-header">
                        <button class="theater-back-btn" id="theater-module-back-btn">← 返回</button>
                        <h3>🎭 小剧场生成</h3>
                        <button class="theater-close-btn" id="theater-module-close-btn">&times;</button>
                    </div>
                    <div class="theater-modal-body" style="width: 100%; overflow-y: auto; flex: 1;">
                        <div id="theater-module-content">
                            <!-- 小剧场模块内容将在这里动态加载 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 加载小剧场模块内容
        loadTheaterModuleContent();
        
        // 绑定事件
        bindTheaterModuleEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[小剧场模块] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[小剧场模块] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM已完全加载
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
    }


    // 显示壁纸模块模态框
    function showWallpaperModuleModal() {
        if (document.getElementById('wallpaper-module-modal')) return;

        const modalHTML = `
            <div id="wallpaper-module-modal" class="theater-modal">
                <div class="theater-modal-overlay"></div>
                <div class="theater-modal-content" style="height: 600px; max-height: 80vh; overflow-y: auto;">
                    <div class="theater-modal-header">
                        <button class="theater-back-btn" id="wallpaper-module-back-btn">← 返回</button>
                        <h3>🖼️ 壁纸设置</h3>
                        <button class="theater-close-btn" id="wallpaper-module-close-btn">&times;</button>
                    </div>
                    <div class="theater-modal-body" style="width: 100%; overflow-y: auto; flex: 1;">
                        <div id="wallpaper-module-content">
                            <!-- 壁纸模块内容将在这里动态加载 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 加载壁纸模块内容
        loadWallpaperModuleContent();
        
        // 绑定事件
        bindWallpaperModuleEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[壁纸模块] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[壁纸模块] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM已完全加载
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
    }

    // 加载聊天模块内容
    function loadChatModuleContent() {
        const contentDiv = document.getElementById('chat-module-content');
        if (!contentDiv) {
            console.error('[小剧场生成器] 聊天模块内容容器未找到');
            return;
        }

        if (!window.ChatModule) {
            console.error('[小剧场生成器] ChatModule类未加载，尝试重新加载模块脚本');
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔥</div>
                    <h3 style="margin: 0 0 8px 0; color: #495057;">聊天模块加载中...</h3>
                    <p style="margin: 0; font-size: 14px;">正在加载模块脚本，请稍候...</p>
                </div>
            `;
            
            // 尝试重新加载模块脚本
            loadModuleScripts();
            setTimeout(() => {
                if (window.ChatModule) {
                    loadChatModuleContent();
                } else {
                    console.error('[小剧场生成器] 模块脚本重新加载失败');
                    contentDiv.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: #dc3545;">
                            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                            <h3 style="margin: 0 0 8px 0; color: #dc3545;">模块加载失败</h3>
                            <p style="margin: 0; font-size: 14px;">请刷新页面重试</p>
                        </div>
                    `;
                }
            }, 2000);
            return;
        }

        try {
            // 创建聊天模块实例
            if (!window.chatModule) {
                window.chatModule = new window.ChatModule();
                console.log('[小剧场生成器] 创建了新的聊天模块实例');
            }
            
            // 获取模块内容
            const moduleContent = window.chatModule.getContent();
            const moduleStyles = window.chatModule.getStyles();
            
            // 注入样式
            let styleElement = document.getElementById('chat-module-styles');
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = 'chat-module-styles';
                document.head.appendChild(styleElement);
            }
            styleElement.textContent = moduleStyles;
            
            // 注入内容
            contentDiv.innerHTML = moduleContent;
            
            // 绑定事件
            window.chatModule.bindEvents();
            
            // 确保头像正确显示
            setTimeout(() => {
              window.chatModule.updateChatDisplay();
            }, 100);
            
            console.log('[小剧场生成器] 小火聊天内容已加载');
        } catch (error) {
            console.error('[小剧场生成器] 加载聊天模块内容失败:', error);
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                    <h3 style="margin: 0 0 8px 0; color: #dc3545;">加载失败</h3>
                    <p style="margin: 0; font-size: 14px;">${error.message}</p>
                </div>
            `;
        }
    }

    // 加载日记模块内容
    function loadDiaryModuleContent() {
        const contentDiv = document.getElementById('diary-module-content');
        if (!contentDiv) {
            console.error('[小剧场生成器] 找不到日记模块内容容器');
            return;
        }

        if (!window.DiaryModule) {
            console.error('[小剧场生成器] DiaryModule类未加载，尝试重新加载模块脚本');
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>📝 日记模块加载中...</h3>
                    <p>正在加载日记模块，请稍候...</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        重新加载页面
                    </button>
                </div>
            `;
            
            // 尝试重新加载模块脚本
            setTimeout(() => {
                loadModuleScripts();
                setTimeout(() => {
                    if (window.DiaryModule) {
                        loadDiaryModuleContent();
                    } else {
                        console.error('[小剧场生成器] 模块脚本重新加载失败');
                    }
                }, 1000);
            }, 500);
            return;
        }

        try {
            // 如果已有实例，先尝试恢复内容
            if (window.diaryModule && window.diaryModule.lastOutputs && window.diaryModule.lastOutputs.length > 0) {
                console.log('[小剧场生成器] 检测到已有日记实例，尝试恢复内容');
                const existingModule = window.diaryModule;
                contentDiv.innerHTML = existingModule.getContent();
                existingModule.bindEvents();
                // 恢复预览内容
                existingModule.renderPreviews(existingModule.lastOutputs);
                console.log('[小剧场生成器] 日记内容恢复成功');
                return;
            }
            
            const diaryModule = new window.DiaryModule();
            contentDiv.innerHTML = diaryModule.getContent();
            diaryModule.bindEvents();
            
            // 将实例保存到全局对象，以便其他函数访问
            window.diaryModule = diaryModule;
            
            console.log('[小剧场生成器] 日记模块内容加载成功');
        } catch (error) {
            console.error('[小剧场生成器] 日记模块初始化失败:', error);
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    <h3>❌ 日记模块加载失败</h3>
                    <p>错误信息: ${error.message}</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        重新加载页面
                    </button>
                </div>
            `;
        }
    }

    // 加载小剧场模块内容
    function loadTheaterModuleContent() {
        const contentDiv = document.getElementById('theater-module-content');
        if (!contentDiv) {
            console.error('[小剧场生成器] 找不到小剧场模块内容容器');
            return;
        }

        if (!window.TheaterModule) {
            console.error('[小剧场生成器] TheaterModule类未加载，尝试重新加载模块脚本');
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3>🎭 小剧场模块加载中...</h3>
                    <p>正在加载小剧场模块，请稍候...</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        重新加载页面
                    </button>
                </div>
            `;
            
            // 尝试重新加载模块脚本
            setTimeout(() => {
                loadModuleScripts();
                setTimeout(() => {
                    if (window.TheaterModule) {
                        loadTheaterModuleContent();
                    } else {
                        console.error('[小剧场生成器] 模块脚本重新加载失败');
                    }
                }, 1000);
            }, 500);
            return;
        }

        try {
            // 如果已有实例，先尝试恢复内容
            if (window.theaterModule && window.theaterModule.lastOutputs && window.theaterModule.lastOutputs.length > 0) {
                console.log('[小剧场生成器] 检测到已有小剧场实例，尝试恢复内容');
                const existingModule = window.theaterModule;
                contentDiv.innerHTML = existingModule.getContent();
                existingModule.bindEvents();
                // 恢复预览内容
                existingModule.renderPreviews(existingModule.lastOutputs);
                console.log('[小剧场生成器] 小剧场内容恢复成功');
                return;
            }
            
            const theaterModule = new window.TheaterModule();
            contentDiv.innerHTML = theaterModule.getContent();
            theaterModule.bindEvents();
            
            // 将实例保存到全局对象，以便其他函数访问
            window.theaterModule = theaterModule;
            
            console.log('[小剧场生成器] 小剧场模块内容加载成功');
        } catch (error) {
            console.error('[小剧场生成器] 小剧场模块初始化失败:', error);
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    <h3>❌ 小剧场模块加载失败</h3>
                    <p>错误信息: ${error.message}</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        重新加载页面
                    </button>
                </div>
            `;
        }
    }


    // 加载壁纸模块内容
    function loadWallpaperModuleContent() {
        const contentDiv = document.getElementById('wallpaper-module-content');
        if (!contentDiv || !window.WallpaperModule) return;

        // 使用全局实例或创建新实例
        if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
        }
        
        contentDiv.innerHTML = window.wallpaperModule.getContent();
        window.wallpaperModule.bindEvents();
        
        // 立即应用界面尺寸设置
        setTimeout(() => {
            window.wallpaperModule.applyModalSize();
        }, 50);
    }

    // 绑定聊天模块事件
    function bindChatModuleEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('chat-module-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeChatModuleModal();
            };
        }

        // 返回按钮
        const backBtn = document.getElementById('chat-module-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                closeChatModuleModal();
                openTheaterGenerator();
            });
        }

        // 点击模态框背景关闭
        const modal = document.getElementById('chat-module-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'chat-module-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    closeChatModuleModal();
                }
            };
        }
    }

    // 绑定日记模块事件
    function bindDiaryModuleEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('diary-module-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeDiaryModuleModal();
            };
        }

        // 返回按钮
        const backBtn = document.getElementById('diary-module-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                closeDiaryModuleModal();
                openTheaterGenerator();
            });
        }

        // 点击模态框背景
        const modal = document.getElementById('diary-module-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'diary-module-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    closeDiaryModuleModal();
                }
            };
        }
    }

    // 绑定小剧场模块事件
    function bindTheaterModuleEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('theater-module-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeTheaterModuleModal();
            };
        }

        // 返回按钮
        const backBtn = document.getElementById('theater-module-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                closeTheaterModuleModal();
                openTheaterGenerator();
            });
        }

        // 点击模态框背景
        const modal = document.getElementById('theater-module-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'theater-module-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    closeTheaterModuleModal();
                }
            };
        }
    }


    // 绑定壁纸模块事件
    function bindWallpaperModuleEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('wallpaper-module-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeWallpaperModuleModal();
            };
        }

        // 返回按钮
        const backBtn = document.getElementById('wallpaper-module-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                closeWallpaperModuleModal();
                openTheaterGenerator();
            });
        }

        // 点击模态框背景
        const modal = document.getElementById('wallpaper-module-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'wallpaper-module-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    closeWallpaperModuleModal();
                }
            };
        }
    }

    // 关闭聊天模块模态框
    function closeChatModuleModal() {
        const modal = document.getElementById('chat-module-modal');
        if (!modal) return;
        
        // 检查是否有正在进行的生成任务
        if (window.chatModule && 
            window.chatModule.backgroundGenerationTask && 
            window.chatModule.backgroundGenerationTask.status === 'running') {
            
            if (window.chatModule.backgroundGenerationTask.isForeground) {
                console.log('[小火聊天] 切换到后台模式');
                
                // 切换到后台模式
                window.chatModule.backgroundGenerationTask.isForeground = false;
                
                // ✅ 修复1: 先显示通知，再关闭模态框（直接使用聊天模块的页面内通知）
                if (window.chatModule && typeof window.chatModule.showNotification === 'function') {
                    window.chatModule.showNotification('🔥 小火在后台继续思考中，完成后会通知你', 'info');
                } else if (window.showAPIStatus) {
                    window.showAPIStatus('🔥 小火在后台继续思考中，完成后会通知你', 'info');
                }
                
                // ✅ 修复2: 请求浏览器通知权限
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('[小火聊天] 浏览器通知权限已获取');
                        }
                    });
                }
                
                // ✅ 修复3: 立即显示浏览器通知
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('小火聊天', {
                        body: '小火正在后台思考中，完成后会通知你 🔥',
                        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff6b6b"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">🔥</text></svg>',
                        tag: 'fire-chat-background',
                        requireInteraction: false
                    });
                }
                
                // ✅ 修复4: 延迟关闭模态框，确保通知显示
                setTimeout(() => {
                    modal.remove();
                    console.log('[小火聊天] 界面已关闭，后台继续运行');
                }, 300);
                
                return; // 不立即关闭
            }
        }
        
        // 没有后台任务，直接关闭
        modal.remove();
        console.log('[小火聊天] 界面已关闭');
    }

    // 关闭日记模块模态框
    function closeDiaryModuleModal() {
        // 检查是否有正在进行的生成任务，如果有则切换到后台模式
        if (window.diaryModule && window.diaryModule.backgroundGenerationTask && 
            window.diaryModule.backgroundGenerationTask.status === 'running') {
            
            // 如果是前台生成任务，切换到后台模式
            if (window.diaryModule.backgroundGenerationTask.isForeground) {
                console.log('[小剧场生成器] 检测到生成过程中关闭界面，切换到后台模式');
                window.diaryModule.backgroundGenerationTask.isForeground = false;
                // 显示友好的提示
                if (window.diaryModule.showNotification) {
                    window.diaryModule.showNotification('日记将在后台继续生成，完成后会收到通知', 'info');
                }
            } else {
                console.log('[小剧场生成器] 后台生成任务正在进行中，直接关闭界面');
            }
        }

        const modal = document.getElementById('diary-module-modal');
        if (modal) {
            modal.remove();
            console.log('[小剧场生成器] 日记模块界面已关闭');
        }
    }

    // 关闭模块模态框
    function closeTheaterModuleModal() {
        // 检查是否有正在进行的生成任务，如果有则切换到后台模式
        if (window.theaterModule && window.theaterModule.backgroundGenerationTask && 
            window.theaterModule.backgroundGenerationTask.status === 'running') {
            
            // 如果是前台生成任务，切换到后台模式
            if (window.theaterModule.backgroundGenerationTask.isForeground) {
                console.log('[小剧场生成器] 检测到生成过程中关闭界面，切换到后台模式');
                window.theaterModule.backgroundGenerationTask.isForeground = false;
                // 显示友好的提示
                if (window.theaterModule.showNotification) {
                    window.theaterModule.showNotification('小剧场将在后台继续生成，完成后会收到通知', 'info');
                }
            } else {
                console.log('[小剧场生成器] 后台生成任务正在进行中，直接关闭界面');
            }
        }

        const modal = document.getElementById('theater-module-modal');
        if (modal) {
            modal.remove();
            console.log('[小剧场生成器] 小剧场模块界面已关闭');
        }
    }


    function closeWallpaperModuleModal() {
        const modal = document.getElementById('wallpaper-module-modal');
        if (modal) {
            modal.remove();
            console.log('[小剧场生成器] 壁纸模块界面已关闭');
        }
    }

    // API设置相关功能
    function showAPISettingsModal() {
        // 检查是否已存在
        if (document.getElementById('api-settings-modal')) return;

        const modalHTML = `
            <div id="api-settings-modal" class="theater-modal">
                <div class="theater-modal-overlay"></div>
                <div class="theater-modal-content" style="height: 550px; max-height: 80vh; overflow-y: auto;">
                    <div class="theater-modal-header">
                        <button class="theater-back-btn" id="api-back-btn">← 返回</button>
                        <h3>⚙️ API设置</h3>
                        <button class="theater-close-btn" id="api-close-btn">&times;</button>
                    </div>
                    <div class="theater-modal-body" style="width: 100%; overflow-y: auto; flex: 1;">
                        <div id="api-settings-content">
                            <!-- API设置内容将在这里动态加载 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 加载API设置内容
        loadAPISettingsContent();
        
        // 绑定API设置事件
        bindAPISettingsEvents();
        
        // 应用壁纸设置和界面尺寸
        if (window.WallpaperModule) {
          // 使用全局实例或创建新实例
          if (!window.wallpaperModule) {
            window.wallpaperModule = new window.WallpaperModule();
            console.log('[API设置] 创建了新的壁纸模块实例');
          }
          
          // 检查并应用壁纸设置
          const savedSettings = localStorage.getItem('wallpaper_module_settings');
          if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.currentWallpaper) {
              console.log('[API设置] 应用保存的壁纸设置');
              window.wallpaperModule.applyWallpaperSettings();
            }
          }
          
          // 延迟应用界面尺寸，确保DOM已完全加载
          setTimeout(() => {
            window.wallpaperModule.applyModalSize();
          }, 100);
        }
        
        // 绑定返回按钮事件
        const backBtn = document.getElementById('api-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                closeAPISettingsModal();
                openTheaterGenerator(); // 返回到主界面
            });
        }
        
        // 显示提示信息
        setTimeout(() => {
            const settings = loadAPISettings();
            if (settings.model) {
                showAPIStatus('检测到已保存的模型配置,请点击"🔥 刷新模型列表"验证模型是否仍然可用', 'info');
                // 如果有保存的模型，尝试刷新模型列表
                if (settings.apiUrl && settings.apiKey) {
                    refreshModels();
                }
            } else {
                showAPIStatus('请填写API密钥和URL,然后点击"🔥 刷新模型列表"获取真实模型', 'info');
            }
        }, 100);

        // 添加自动刷新模型列表如果有保存的配置
        setTimeout(() => {
            const settings = loadAPISettings();
            if (settings.apiUrl && settings.apiKey && settings.provider) {
                refreshModels();
            }
        }, 500);
    }
    function loadAPISettingsContent() {
        const contentDiv = document.getElementById('api-settings-content');
        if (!contentDiv) return;

        // 从localStorage加载设置
        const settings = loadAPISettings();
        const providers = getSupportedProviders();
        
        console.log('[API设置] 加载设置内容，当前设置:', {
            ...settings,
            apiKey: settings.apiKey ? `${settings.apiKey.substring(0, 8)}...` : '(空)'
        });
        
        contentDiv.innerHTML = `
            <div class="api-settings-form">
                <!-- 启用开关 -->
                <div class="api-form-group">
                    <label class="api-form-label">
                        <input type="checkbox" id="theater-api-enabled" ${settings.enabled ? 'checked' : ''}>
                        启用自定义API
                    </label>
                </div>

                <!-- 服务商选择 -->
                <div class="api-form-group">
                    <label class="api-form-label">API服务商:</label>
                    <select id="theater-api-provider" class="api-form-select">
                        ${Object.entries(providers)
                            .map(
                                ([key, provider]) =>
                                    `<option value="${key}" ${key === settings.provider ? 'selected' : ''}>${provider.icon} ${provider.name}</option>`
                            )
                            .join('')}
                    </select>
                </div>

                <!-- API URL -->
                <div class="api-form-group" id="theater-api-url-section">
                    <label class="api-form-label">API URL:</label>
                    <input type="text" id="theater-api-url" placeholder="https://api.openai.com"
                           value="${settings.apiUrl || ''}" class="api-form-input">
                    <small class="api-form-hint" style="color: ${settings.apiUrl ? '#28a745' : '#999'};">
                        ${settings.apiUrl ? '✅ 已保存API URL (可重新输入以更新)' : '请输入完整的API URL（如 https://api.openai.com）'}
                    </small>
                </div>

                <!-- API密钥 -->
                <div class="api-form-group" id="theater-api-key-section">
                    <label class="api-form-label">API密钥:</label>
                    <div class="api-input-group" style="display: flex; gap: 8px;">
                        <input type="password" id="theater-api-key" placeholder="sk-... 或 AIza..." 
                               value="${settings.apiKey || ''}" class="api-form-input" style="flex: 1;">
                        <button type="button" id="theater-toggle-api-key" class="api-input-toggle" title="显示/隐藏密钥" style="flex-shrink: 0;">
                            👁️
                        </button>
                    </div>
                    <small class="api-form-hint" style="color: ${settings.apiKey ? '#28a745' : '#999'}; font-size: 11px; margin-top: 3px; display: block;">
                        ${settings.apiKey ? '✅ 已保存API密钥 (可重新输入以更新)' : '🔒 请输入API密钥'}
                    </small>
                </div>

                <!-- 模型选择 - 关键修复点 -->
                <div class="api-form-group">
                    <label class="api-form-label">模型:</label>
                    <select id="theater-api-model" class="api-form-select" style="margin-bottom: 10px;">
                        ${settings.model ? `<option value="${settings.model}" selected>${settings.model}</option>` : '<option value="">请先点击"🔥 刷新模型列表"获取真实模型...</option>'}
                    </select>
                    <button type="button" id="theater-refresh-models" class="api-btn-secondary" style="width: 100%; margin-top: 5px;">
                        🔥 刷新模型列表
                    </button>
                    <small class="api-form-hint" id="model-list-hint" style="color: ${settings.model ? '#28a745' : '#666'}; margin-top: 5px; display: block;">
                        ${settings.model ? `✅ 已保存模型: ${settings.model} (点击刷新验证是否仍可用)` : '点击刷新按钮从API获取最新可用模型列表'}
                    </small>
                </div>

                <!-- 按钮组 -->
                <div class="api-form-actions">
                    <button type="button" id="test-api-connection" class="api-btn-primary">
                        🧪 测试连接
                    </button>
                    <button type="button" id="theater-save-api-config" class="api-btn-primary">
                        💾 保存配置
                    </button>
                </div>

                <!-- 清除配置按钮 -->
                <div class="api-form-actions" style="margin-top: 10px;">
                    <button type="button" id="clear-api-config" class="api-btn-secondary" style="background: #dc3545; color: white; border-color: #dc3545;">
                        🗑️ 清除API配置
                    </button>
                </div>

                <!-- 消息楼层监控 -->
                <div class="api-form-group" style="margin-top: 20px;">
                    <label class="api-form-label">消息楼层监控:</label>
                    <div class="api-threshold-control" style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="api-message-threshold" min="1" max="50" value="${settings.messageThreshold || 10}" class="api-form-range" style="flex: 1;">
                        <span class="api-threshold-display" style="min-width: 60px; text-align: center; font-weight: bold;">${settings.messageThreshold || 10} 层</span>
                    </div>
                    <small class="api-form-hint" style="color: #666; margin-top: 5px; display: block;">
                        控制小剧场生成需要达到的消息楼层数
                    </small>
                </div>

                <!-- 状态显示 -->
                <div id="api-status" class="api-status-message" style="display: none;"></div>
            </div>
        `;
        
        console.log('[API设置] ✅ HTML模板已生成，包含保存的值');
    }

    function bindAPISettingsEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('api-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeAPISettingsModal();
            };
        }

        // 点击模态框背景
        const modal = document.getElementById('api-settings-modal');
        if (modal) {
            modal.onclick = function(e) {
                if (e.target.id === 'api-settings-modal' || e.target.classList.contains('theater-modal-overlay')) {
                    closeAPISettingsModal();
                }
            };
        }

        // 服务商选择变化
        const providerSelect = document.getElementById('theater-api-provider');
        if (providerSelect) {
            providerSelect.addEventListener('change', e => {
                onProviderChange(e.target.value);
            });
        }

        // 密钥显示切换
        const toggleBtn = document.getElementById('theater-toggle-api-key');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const keyInput = document.getElementById('theater-api-key');
                const isPassword = keyInput.type === 'password';
                keyInput.type = isPassword ? 'text' : 'password';
                toggleBtn.textContent = isPassword ? '🙈' : '👁️';
            });
        }


        // 刷新模型列表
        const refreshBtn = document.getElementById('theater-refresh-models');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshModels();
            });
        }

        // 消息阈值滑块
        const thresholdSlider = document.getElementById('api-message-threshold');
        const thresholdDisplay = document.querySelector('.api-threshold-display');
        if (thresholdSlider && thresholdDisplay) {
            thresholdSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                thresholdDisplay.textContent = `${value} 层`;
            });
        }

        // 测试连接
        const testBtn = document.getElementById('test-api-connection');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                testConnection();
            });
        }

        // 保存配置
        const saveBtn = document.getElementById('theater-save-api-config');
        console.log('[API设置] 查找保存按钮:', saveBtn);
        if (saveBtn) {
            console.log('[API设置] ✅ 找到保存按钮，开始绑定事件');
            saveBtn.addEventListener('click', (e) => {
                console.log('[API设置] 🔥 保存按钮被点击！');
                e.preventDefault();
                e.stopPropagation();
                try {
                    saveAPIConfig();
                } catch (error) {
                    console.error('[API设置] ❌ 保存配置时出错:', error);
                    showAPIStatus('❌ 保存失败: ' + error.message, 'error');
                }
            });
            console.log('[API设置] ✅ 保存按钮事件绑定完成');
        } else {
            console.error('[API设置] ❌ 未找到保存按钮元素！');
            console.error('[API设置] 当前页面所有按钮:', document.querySelectorAll('button'));
        }

        // 清除配置
        const clearBtn = document.getElementById('clear-api-config');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                clearAPIConfig();
            });
        }

        // 初始化时设置服务商
        const currentProvider = document.getElementById('theater-api-provider')?.value || 'openai';
        onProviderChange(currentProvider);

        // 强制重新填充UI字段 - 修复字段ID映射
        const settings = loadAPISettings();
        console.log('[API设置] 开始填充UI字段，设置数据:', {
            ...settings,
            apiKey: settings.apiKey ? `${settings.apiKey.substring(0, 8)}...` : '(空)'
        });
        
        // 填充启用开关
        const enabledElement = document.getElementById('theater-api-enabled');
        if (enabledElement) {
            enabledElement.checked = settings.enabled;
            console.log('[API设置] ✅ 已填充启用开关:', settings.enabled);
        } else {
            console.warn('[API设置] ⚠️ 未找到启用开关元素');
        }
        
        // 填充服务商选择
        const providerElement = document.getElementById('theater-api-provider');
        if (providerElement) {
            providerElement.value = settings.provider;
            console.log('[API设置] ✅ 已填充服务商:', settings.provider);
        } else {
            console.warn('[API设置] ⚠️ 未找到服务商选择元素');
        }
        
        // 填充API URL
        const urlElement = document.getElementById('theater-api-url');
        if (urlElement) {
            urlElement.value = settings.apiUrl || '';
            console.log('[API设置] ✅ 已填充API URL:', settings.apiUrl ? '已设置' : '未设置');
        } else {
            console.warn('[API设置] ⚠️ 未找到API URL输入框');
        }
        
        // 填充API密钥
        const keyElement = document.getElementById('theater-api-key');
        if (keyElement) {
            keyElement.value = settings.apiKey || '';
            console.log('[API设置] ✅ 已填充API密钥:', settings.apiKey ? '已设置' : '未设置');
        } else {
            console.warn('[API设置] ⚠️ 未找到API密钥输入框');
        }
        
        // 填充模型选择
        const modelElement = document.getElementById('theater-api-model');
        if (modelElement) {
            modelElement.value = settings.model || '';
            console.log('[API设置] ✅ 已填充模型:', settings.model || '未设置');
        } else {
            console.warn('[API设置] ⚠️ 未找到模型选择框');
        }
        
        // 重新触发服务商变化逻辑
        onProviderChange(settings.provider);
        console.log('[API设置] ✅ UI字段填充完成');
    }

    /**
     * 加载设置
     */
    function loadAPISettings() {
        const defaultSettings = {
            enabled: false,
            provider: 'openai',
            apiUrl: '',
            apiKey: '',
            model: '',
            messageThreshold: 10,
            temperature: 0.8,
            maxTokens: 30000,
            systemPrompt: '',
            timestamp: null
        };

        try {
            const savedSettings = localStorage.getItem('theater_api_settings');
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                console.log('[API设置] 设置已加载:', {
                    ...parsed,
                    apiKey: parsed.apiKey ? `${parsed.apiKey.substring(0, 8)}...` : '(空)'
                });
                return { ...defaultSettings, ...parsed };
            }
            return defaultSettings;
        } catch (error) {
            console.error('[API设置] 加载设置失败:', error);
            return defaultSettings;
        }
    }

    function getSupportedProviders() {
        return {
            openai: {
                name: 'OpenAI',
                defaultUrl: 'https://api.openai.com',
                urlSuffix: 'v1/chat/completions',
                modelsEndpoint: 'v1/models',
                defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
                authType: 'Bearer',
                requiresKey: true,
                icon: '🤖'
            },
            gemini: {
                name: 'Google Gemini',
                defaultUrl: 'https://generativelanguage.googleapis.com',
                urlSuffix: 'v1beta/models/{model}:generateContent',
                modelsEndpoint: 'v1beta/models',
                defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest'],
                authType: 'Key',
                requiresKey: true,
                icon: '💎'
            },
            custom: {
                name: '自定义API',
                defaultUrl: '',
                urlSuffix: 'chat/completions',
                modelsEndpoint: 'models',
                defaultModels: [],
                authType: 'Bearer',
                requiresKey: true,
                icon: '⚙️'
            }
        };
    }

    function onProviderChange(providerKey) {
        const provider = getSupportedProviders()[providerKey];
        if (!provider) return;

        console.log('[API设置] 服务商切换:', providerKey, provider);

        // 处理URL输入框的显示/隐藏
        const urlSection = document.getElementById('theater-api-url-section');
        const urlInput = document.getElementById('theater-api-url');

        if (providerKey === 'gemini') {
            // Gemini: 隐藏URL输入框,使用内置URL
            if (urlSection) {
                urlSection.style.display = 'none';
            }
        } else {
            // OpenAI和自定义API: 显示URL输入框让用户编辑
            if (urlSection) {
                urlSection.style.display = 'block';
            }
        if (urlInput) {
            // 如果当前没有值，则设置占位符
            if (!urlInput.value) {
                urlInput.placeholder = provider.defaultUrl;
            }
        }
        }

        // 更新API密钥占位符
        const keyInput = document.getElementById('theater-api-key');
        if (keyInput) {
            // 如果当前没有值，则设置占位符
            if (!keyInput.value) {
                if (providerKey === 'openai') {
                    keyInput.placeholder = 'sk-...';
                } else if (providerKey === 'gemini') {
                    keyInput.placeholder = 'AIza...';
                } else {
                    keyInput.placeholder = '输入API密钥...';
                }
            }
        }

        // 显示/隐藏密钥输入框
        const keySection = document.getElementById('theater-api-key-section');
        if (keySection) {
            keySection.style.display = provider.requiresKey ? 'block' : 'none';
        }

        // 清空模型列表,等待用户手动刷新获取真实模型
        const modelSelect = document.getElementById('theater-api-model');
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="">请点击"🔥 刷新模型列表"获取真实模型...</option>';
        }
        
        // 更新提示信息
        const hintElement = document.getElementById('model-list-hint');
        if (hintElement) {
            hintElement.textContent = `点击刷新按钮从 ${provider.name} API 获取最新可用模型列表`;
            hintElement.style.color = '#007bff';
        }
        
        showAPIStatus(`已切换到 ${provider.name}，请输入API密钥后点击"🔥 刷新模型列表"`, 'info');
    }

    function updateModelList(models) {
        console.log('[API设置] ===== 开始更新模型列表 =====');
        console.log('[API设置] 接收到的模型数组:', models);
        console.log('[API设置] 模型数量:', models ? models.length : 0);
        
        const modelSelect = document.getElementById('theater-api-model');
        console.log('[API设置] 找到的模型选择框元素:', modelSelect);
        
        if (!modelSelect) {
            console.error('[API设置] ❌ 致命错误: 未找到ID为theater-api-model的选择框!');
            console.error('[API设置] 当前页面所有select元素:', document.querySelectorAll('select'));
            return;
        }

        console.log('[API设置] ✅ 选择框元素已找到');
        console.log('[API设置] 选择框当前HTML:', modelSelect.innerHTML);
        console.log('[API设置] 选择框父元素:', modelSelect.parentElement);

        const currentModel = modelSelect.value || '';
        console.log('[API设置] 当前选中的模型:', currentModel);

        // 清空现有选项
        modelSelect.innerHTML = '';
        console.log('[API设置] ✅ 已清空选择框');

        // 添加默认选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '选择模型...';
        modelSelect.appendChild(defaultOption);
        console.log('[API设置] ✅ 已添加默认选项');

        // 获取当前保存的模型
        const savedSettings = loadAPISettings();
        const savedModel = savedSettings.model || '';
        console.log('[API设置] 当前保存的模型:', savedModel);

        if (models && Array.isArray(models) && models.length > 0) {
            console.log('[API设置] 开始添加模型选项,共', models.length, '个');
            
            let addedCount = 0;
            models.forEach((model, index) => {
                if (typeof model === 'string' && model.trim().length > 0) {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    
                    // 如果当前模型匹配,则选中
                    if (model === currentModel || model === savedModel) {
                        option.selected = true;
                        console.log('[API设置] ✅ 选中模型:', model);
                    }
                    
                    modelSelect.appendChild(option);
                    addedCount++;
                    
                    // 每添加10个模型输出一次日志
                    if ((index + 1) % 10 === 0) {
                        console.log('[API设置] 进度: 已添加', index + 1, '/', models.length, '个模型');
                    }
                } else {
                    console.warn('[API设置] ⚠️ 跳过无效模型:', model);
                }
            });
            
            console.log('[API设置] ✅ 模型列表更新完成!');
            console.log('[API设置] 成功添加:', addedCount, '个有效模型');
            console.log('[API设置] 最终选项数量:', modelSelect.options.length);
            console.log('[API设置] 当前选中值:', modelSelect.value);
            
            // 验证添加的选项
            console.log('[API设置] 前5个选项验证:');
            for (let i = 0; i < Math.min(5, modelSelect.options.length); i++) {
                const opt = modelSelect.options[i];
                console.log(`  [${i}] value="${opt.value}" text="${opt.textContent}" selected=${opt.selected}`);
            }
            
            // 更新提示信息
            const hintElement = document.getElementById('model-list-hint');
            if (hintElement) {
                hintElement.textContent = `✅ 成功获取 ${addedCount} 个可用模型`;
                hintElement.style.color = '#28a745';
            }
            
        } else {
            console.warn('[API设置] ⚠️ 没有有效的模型数据');
            console.warn('[API设置] models参数:', models);
            
            // 更新提示信息
            const hintElement = document.getElementById('model-list-hint');
            if (hintElement) {
                hintElement.textContent = '⚠️ 未获取到模型,请检查API配置或重试';
                hintElement.style.color = '#dc3545';
            }
        }
        
        // 强制触发change事件,确保UI更新
        setTimeout(() => {
            modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[API设置] ✅ 已触发change事件');
            
            // 最终验证
            console.log('[API设置] ===== 最终状态验证 =====');
            console.log('[API设置] 选项总数:', modelSelect.options.length);
            console.log('[API设置] 当前选中索引:', modelSelect.selectedIndex);
            console.log('[API设置] 当前选中值:', modelSelect.value);
            console.log('[API设置] 选择框可见性:', modelSelect.offsetParent !== null);
            console.log('[API设置] ===== 更新流程结束 =====');
        }, 100);
    }

    async function refreshModels() {
        console.log('[API设置] ===== 开始刷新模型列表 =====');
        
        const provider = document.getElementById('theater-api-provider')?.value || 'openai';
        
        // 调试：检查所有输入框 - 更详细的检查
        console.log('[API设置] 🔍 开始检查页面所有元素...');
        
        // 检查页面上所有的 input 元素
        const allInputs = document.querySelectorAll('input');
        console.log('[API设置] 页面上所有 input 元素数量:', allInputs.length);
        allInputs.forEach((input, index) => {
            if (input.id || input.placeholder?.includes('API') || input.placeholder?.includes('密钥')) {
                console.log(`  Input[${index}]:`, {
                    id: input.id,
                    type: input.type,
                    placeholder: input.placeholder,
                    value: input.value ? `${input.value.substring(0, 10)}... (长度:${input.value.length})` : '(空)',
                    visible: input.offsetParent !== null
                });
            }
        });
        
        // 方法1: 直接通过ID获取
        const apiUrlElement = document.getElementById('theater-api-url');
        const apiKeyElement = document.getElementById('theater-api-key');
        
        console.log('[API设置] 方法1 - getElementById:');
        console.log('  - api-url:', apiUrlElement ? '✅ 找到' : '❌ 未找到');
        console.log('  - api-key:', apiKeyElement ? '✅ 找到' : '❌ 未找到');
        
        // 方法2: 通过选择器获取
        const apiUrlElement2 = document.querySelector('#theater-api-url');
        const apiKeyElement2 = document.querySelector('#theater-api-key');
        
        console.log('[API设置] 方法2 - querySelector:');
        console.log('  - api-url:', apiUrlElement2 ? '✅ 找到' : '❌ 未找到');
        console.log('  - api-key:', apiKeyElement2 ? '✅ 找到' : '❌ 未找到');
        
        // 方法3: 通过占位符查找
        const apiKeyElement3 = document.querySelector('input[placeholder*="sk-"]');
        const apiKeyElement4 = document.querySelector('input[placeholder*="AIza"]');
        const apiKeyElement5 = document.querySelector('input[type="password"]');
        
        console.log('[API设置] 方法3 - 通过属性查找:');
        console.log('  - placeholder包含sk-:', apiKeyElement3 ? '✅ 找到' : '❌ 未找到');
        console.log('  - placeholder包含AIza:', apiKeyElement4 ? '✅ 找到' : '❌ 未找到');
        console.log('  - type=password:', apiKeyElement5 ? '✅ 找到' : '❌ 未找到');
        
        // 使用找到的元素
        const finalApiKeyElement = apiKeyElement || apiKeyElement2 || apiKeyElement3 || apiKeyElement4 || apiKeyElement5;
        
        if (finalApiKeyElement) {
            console.log('[API设置] ✅ 最终使用的密钥输入框:', finalApiKeyElement);
            console.log('  - ID:', finalApiKeyElement.id);
            console.log('  - Type:', finalApiKeyElement.type);
            console.log('  - Value:', finalApiKeyElement.value ? `${finalApiKeyElement.value.substring(0, 10)}... (长度:${finalApiKeyElement.value.length})` : '(空)');
            console.log('  - Placeholder:', finalApiKeyElement.placeholder);
            console.log('  - 是否可见:', finalApiKeyElement.offsetParent !== null);
            console.log('  - 是否禁用:', finalApiKeyElement.disabled);
            console.log('  - 父元素:', finalApiKeyElement.parentElement);
        } else {
            console.error('[API设置] ❌ 所有方法都没找到密钥输入框！');
        }
        
        let apiUrl;
        if (provider === 'gemini') {
            apiUrl = getSupportedProviders().gemini.defaultUrl;
            console.log('[API设置] Gemini模式: 使用内置URL:', apiUrl);
        } else {
            apiUrl = (apiUrlElement || apiUrlElement2)?.value?.trim() || '';
            console.log('[API设置] 非Gemini模式: 从输入框获取URL:', apiUrl);
        }

        const apiKey = finalApiKeyElement?.value?.trim() || '';

        console.log('[API设置] 📊 最终刷新参数:', {
            provider: provider,
            hasApiUrl: !!apiUrl,
            hasApiKey: !!apiKey,
            apiUrlLength: apiUrl.length,
            apiKeyLength: apiKey.length,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : '(空)',
            apiKeyFull: apiKey || '(完全为空)'
        });

        if (!apiUrl) {
            showAPIStatus('❌ 请先填写API URL', 'error');
            return;
        }

        if (!apiKey) {
            showAPIStatus('❌ 请先填写API密钥', 'error');
            return;
        }

        showAPIStatus('🔄 正在获取模型列表...', 'info');
        
        // 禁用刷新按钮
        const refreshBtn = document.getElementById('theater-refresh-models');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ 获取中...';
        }

        try {
            console.log('[API设置] 开始调用fetchModels...');
            const models = await fetchModels(provider, apiUrl, apiKey);
            console.log('[API设置] ✅ fetchModels返回成功');
            console.log('[API设置] 返回的模型列表:', models);
            
            if (models && models.length > 0) {
                console.log('[API设置] 准备更新UI,模型数量:', models.length);
                updateModelList(models);
                showAPIStatus(`✅ 已获取 ${models.length} 个真实模型`, 'success');
            } else {
                console.warn('[API设置] ⚠️ API返回了空的模型列表');
                updateModelList([]);
                showAPIStatus('⚠️ API返回空列表,请检查配置', 'warning');
            }
        } catch (error) {
            console.error('[API设置] ❌ 获取模型失败:', error);
            console.error('[API设置] 错误详情:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            updateModelList([]);
            showAPIStatus('❌ 获取模型失败: ' + error.message, 'error');
        } finally {
            // 恢复刷新按钮
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔥 刷新模型列表';
            }
            console.log('[API设置] ===== 刷新流程结束 =====');
        }
    }

    async function fetchModels(provider, apiUrl, apiKey) {
        console.log('[API设置] ===== fetchModels开始 =====');
        
        const providerConfig = getSupportedProviders()[provider];
        if (!providerConfig) {
            throw new Error('不支持的服务商: ' + provider);
        }

        console.log('[API设置] 服务商配置:', providerConfig);

        // 构建模型列表URL
        let modelsUrl = apiUrl.trim();
        if (!modelsUrl.endsWith('/')) {
            modelsUrl += '/';
        }

        // 根据不同服务商构建正确的URL
        if (provider === 'gemini') {
            // Gemini API使用特殊的URL结构
            if (!modelsUrl.includes('/v1beta/models')) {
                if (modelsUrl.endsWith('/v1/')) {
                    modelsUrl = modelsUrl.replace('/v1/', '/v1beta/models');
                } else {
                    modelsUrl += 'v1beta/models';
                }
            }
        } else {
            // OpenAI和自定义API使用标准URL构建
            if (modelsUrl.endsWith('/v1/')) {
                modelsUrl += 'models';
            } else if (!modelsUrl.includes('/models')) {
                modelsUrl += 'models';
            }
        }

        console.log('[API设置] 最终URL:', modelsUrl.replace(apiKey, '[HIDDEN]'));

        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };

        // 根据服务商设置正确的认证方式
        if (providerConfig.requiresKey && apiKey) {
            if (provider === 'gemini') {
                // Gemini API使用URL参数传递key
                modelsUrl += `?key=${apiKey}`;
                console.log('[API设置] Gemini: API key已添加到URL参数');
            } else {
                // OpenAI和自定义API使用Bearer认证
                headers['Authorization'] = `Bearer ${apiKey}`;
                console.log('[API设置] OpenAI/Custom: API key已添加到Authorization头');
            }
        }

        console.log('[API设置] 请求头:', {
            ...headers,
            Authorization: headers.Authorization ? 'Bearer [HIDDEN]' : undefined
        });

        console.log('[API设置] 发起fetch请求...');
        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: headers
        });

        console.log('[API设置] 收到响应:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API设置] ❌ HTTP错误:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[API设置] 解析JSON成功');
        console.log('[API设置] 原始响应数据:', data);

        // 根据不同服务商解析响应
        let models = [];
        if (provider === 'gemini') {
            // Gemini API响应格式: { models: [{ name: "models/gemini-pro", ... }] }
            console.log('[API设置] 解析Gemini响应...');
            if (data.models && Array.isArray(data.models)) {
                models = data.models
                    .filter(model => {
                        const supported = model.supportedGenerationMethods?.includes('generateContent');
                        console.log(`[API设置] 模型 ${model.name}: supported=${supported}`);
                        return supported;
                    })
                    .map(model => model.name.replace('models/', ''));
                console.log('[API设置] Gemini过滤后的模型:', models);
            } else {
                console.warn('[API设置] ⚠️ Gemini API响应格式异常');
                throw new Error('Gemini API响应格式异常,请检查API配置');
            }
        } else {
            // OpenAI兼容格式
            console.log('[API设置] 解析OpenAI兼容响应...');
            if (data.data && Array.isArray(data.data)) {
                // 标准OpenAI格式
                models = data.data.map(model => model.id);
                console.log('[API设置] OpenAI标准格式,提取的模型:', models);
            } else if (Array.isArray(data)) {
                // 直接数组格式
                models = data.map(model => model.id || model.name || model);
                console.log('[API设置] 直接数组格式,提取的模型:', models);
            } else {
                console.warn('[API设置] ⚠️ API响应格式异常');
                throw new Error('API响应格式异常,请检查API服务商是否正确');
            }
        }

        const filteredModels = models.filter(model => typeof model === 'string' && model.length > 0);
        console.log('[API设置] 过滤后的最终模型列表:', filteredModels);
        console.log('[API设置] 最终模型数量:', filteredModels.length);

        if (filteredModels.length === 0) {
            console.error('[API设置] ❌ 过滤后没有有效模型');
            throw new Error('API返回的模型列表为空,请检查API密钥和URL是否正确');
        }
        
        console.log('[API设置] ===== fetchModels成功结束 =====');
        return filteredModels;
    }
    async function testConnection() {
        const provider = document.getElementById('theater-api-provider')?.value || 'openai';
        let apiUrl;

        if (provider === 'gemini') {
            apiUrl = getSupportedProviders().gemini.defaultUrl;
        } else {
            apiUrl = document.getElementById('theater-api-url')?.value || '';
        }

        const apiKey = document.getElementById('theater-api-key')?.value || '';
        const model = document.getElementById('theater-api-model')?.value || '';

        if (!apiUrl) {
            showAPIStatus('❌ 请先填写API URL', 'error');
            return;
        }

        const providerConfig = getSupportedProviders()[provider];
        if (providerConfig?.requiresKey && !apiKey) {
            showAPIStatus('❌ 请先填写API密钥', 'error');
            return;
        }

        if (!model) {
            showAPIStatus('❌ 请先选择模型', 'error');
            return;
        }

        showAPIStatus('🧪 正在测试连接...', 'info');

        try {
            const result = await testAPICall(provider, apiUrl, apiKey, model);
            if (result.success) {
                showAPIStatus('✅ 连接测试成功!', 'success');
            } else {
                showAPIStatus('❌ 连接测试失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('[API设置] 连接测试失败:', error);
            showAPIStatus('❌ 连接测试失败: ' + error.message, 'error');
        }
    }

    async function testAPICall(provider, apiUrl, apiKey, model) {
        const providerConfig = getSupportedProviders()[provider];

        // 构建请求URL
        let requestUrl = apiUrl.trim();
        if (!requestUrl.endsWith('/')) {
            requestUrl += '/';
        }

        // 根据不同服务商构建URL
        if (provider === 'gemini') {
            requestUrl += providerConfig.urlSuffix.replace('{model}', model);
            if (apiKey) {
                requestUrl += `?key=${apiKey}`;
            }
        } else {
            requestUrl += providerConfig.urlSuffix.replace('{model}', model);
        }

        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };

        if (providerConfig.requiresKey && apiKey && provider !== 'gemini') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // 构建请求体
        const requestBody = buildTestRequestBody(provider, model);

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }

        const data = await response.json();
        return { success: true, data: data };
    }

    function buildTestRequestBody(provider, model) {
        const testMessage = "Hello! This is a test message.";

        if (provider === 'gemini') {
            return {
                contents: [{
                    parts: [{ text: testMessage }]
                }],
                generationConfig: {
                    maxOutputTokens: 50,
                    temperature: 0.7
                }
            };
        } else {
            return {
                model: model,
                messages: [{ role: 'user', content: testMessage }],
                max_tokens: 50,
                temperature: 0.7
            };
        }
    }

    /**
     * 保存设置
     */
    async function saveAPIConfig() {
        try {
            console.log('[API设置] ===== 开始保存配置 =====');
            console.log('[API设置] 🔥 saveAPIConfig函数被调用！');
            console.log('[API设置] 调用堆栈:', new Error().stack);
            
            const provider = document.getElementById('theater-api-provider')?.value || 'openai';
            let apiUrl;

            if (provider === 'gemini') {
                apiUrl = getSupportedProviders().gemini.defaultUrl;
                console.log('[API设置] Gemini模式: 使用内置URL:', apiUrl);
            } else {
                apiUrl = document.getElementById('theater-api-url')?.value || '';
                console.log('[API设置] 非Gemini模式: 从输入框获取URL:', apiUrl);
            }

            // 获取当前保存的配置作为基础
            const currentSettings = loadAPISettings();
            
            // 收集表单数据，完全覆盖现有配置
            const formData = {
                enabled: document.getElementById('theater-api-enabled')?.checked || false,
                provider: provider,
                apiUrl: apiUrl,
                apiKey: document.getElementById('theater-api-key')?.value || '',
                model: document.getElementById('theater-api-model')?.value || '',
                messageThreshold: parseInt(document.getElementById('api-message-threshold')?.value || '10'),
                temperature: 0.8,
                maxTokens: 30000,
                systemPrompt: '',
                timestamp: new Date().toISOString()
            };

            console.log('[API设置] 覆盖前的配置:', {
                ...currentSettings,
                apiKey: currentSettings.apiKey ? `${currentSettings.apiKey.substring(0, 8)}...` : '(空)'
            });
            
            console.log('[API设置] 覆盖后的配置:', {
                ...formData,
                apiKey: formData.apiKey ? `${formData.apiKey.substring(0, 8)}...` : '(空)'
            });

            // 验证必填字段
            const providerConfig = getSupportedProviders()[formData.provider];
            if (providerConfig?.requiresKey && !formData.apiKey) {
                showAPIStatus('❌ 请填写API密钥', 'error');
                return false;
            }

            if (!formData.model) {
                showAPIStatus('❌ 请选择模型', 'error');
                return false;
            }

            if (!formData.apiUrl) {
                showAPIStatus('❌ 请填写API URL', 'error');
                return false;
            }

            // 保存到localStorage
            console.log('[API设置] 准备保存到localStorage:', formData);
            localStorage.setItem('theater_api_settings', JSON.stringify(formData));
            console.log('[API设置] ✅ 设置已保存到localStorage');

            // 验证覆盖是否成功
            const savedData = localStorage.getItem('theater_api_settings');
            console.log('[API设置] 从localStorage读取的数据:', savedData);
            
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                console.log('[API设置] ✅ 验证保存成功:', {
                    ...parsedData,
                    apiKey: parsedData.apiKey ? `${parsedData.apiKey.substring(0, 8)}...` : '(空)'
                });
                
                // 测试loadAPISettings函数
                const loadedSettings = loadAPISettings();
                console.log('[API设置] ✅ 测试加载功能:', {
                    ...loadedSettings,
                    apiKey: loadedSettings.apiKey ? `${loadedSettings.apiKey.substring(0, 8)}...` : '(空)'
                });
            } else {
                console.error('[API设置] ❌ 保存验证失败: localStorage中没有数据');
            }

            // 触发设置更新事件
            document.dispatchEvent(new CustomEvent('theater-api-config-updated', {
                detail: formData,
            }));

            showAPIStatus('✅ 配置已保存并覆盖成功', 'success');
            
            // 延迟关闭并返回主界面
            setTimeout(() => {
                closeAPISettingsModal();
                openTheaterGenerator();
            }, 1500);

            return true;
            
        } catch (error) {
            console.error('[API设置] 保存设置失败:', error);
            showAPIStatus('❌ 保存失败: ' + error.message, 'error');
            return false;
        }
    }

    function showAPIStatus(message, type = 'info') {
        const statusDiv = document.getElementById('api-status');
        if (!statusDiv) return;

        const colors = {
            info: '#17a2b8',
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
        };

        statusDiv.style.display = 'block';
        statusDiv.style.color = colors[type] || colors.info;
        statusDiv.textContent = message;

        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * 清除API配置
     */
    function clearAPIConfig() {
        try {
            console.log('[API设置] ===== 开始清除API配置 =====');
            
            // 清除localStorage中的配置
            localStorage.removeItem('theater_api_settings');
            console.log('[API设置] ✅ 已清除localStorage中的配置');
            
            // 清除所有相关的localStorage数据
            const keysToRemove = [
                'theater_api_settings',
                'theater_api_settings_backup',
                'theater_api_settings_test',
                'mobile_api_url_openai',
                'mobile_api_url_custom',
                'mobile_api_url_gemini'
            ];
            
            keysToRemove.forEach(key => {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                    console.log('[API设置] ✅ 已清除:', key);
                }
            });
            
            // 清空表单字段
            const fieldsToClear = [
                'api-enabled',
                'api-provider', 
                'theater-api-url',
                'theater-api-key',
                'theater-api-model'
            ];
            
            fieldsToClear.forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = false;
                    } else {
                        element.value = '';
                    }
                    console.log('[API设置] ✅ 已清空字段:', fieldId);
                }
            });
            
            // 重置服务商选择
            const providerSelect = document.getElementById('api-provider');
            if (providerSelect) {
                providerSelect.value = 'openai';
                onProviderChange('openai');
            }
            
            // 清空模型列表
            const modelSelect = document.getElementById('theater-api-model');
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">请先点击"🔥 刷新模型列表"获取真实模型...</option>';
            }
            
            showAPIStatus('✅ API配置已完全清除', 'success');
            console.log('[API设置] ===== 清除API配置完成 =====');
            
            // 验证清除是否成功
            const remainingData = localStorage.getItem('theater_api_settings');
            if (remainingData) {
                console.warn('[API设置] ⚠️ 警告: 仍有数据残留:', remainingData);
            } else {
                console.log('[API设置] ✅ 确认: localStorage已完全清空');
            }
            
        } catch (error) {
            console.error('[API设置] ❌ 清除配置失败:', error);
            showAPIStatus('❌ 清除失败: ' + error.message, 'error');
        }
    }

    // 添加配置持久性验证函数
    function validateConfigPersistence() {
        console.log('[API设置] ===== 验证配置持久性 =====');
        
        try {
            // 1. 检查localStorage中是否有数据
            const rawData = localStorage.getItem('theater_api_settings');
            if (!rawData) {
                console.log('[API设置] ❌ localStorage中没有配置数据');
                return false;
            }
            
            // 2. 验证JSON格式
            const parsedData = JSON.parse(rawData);
            console.log('[API设置] ✅ JSON解析成功');
            
            // 3. 检查关键字段
            const requiredFields = ['provider', 'apiKey', 'model'];
            const missingFields = requiredFields.filter(field => !parsedData[field]);
            
            if (missingFields.length > 0) {
                console.log('[API设置] ❌ 缺少关键字段:', missingFields);
                return false;
            }
            
            // 4. 检查字段值的有效性
            if (parsedData.provider && !getSupportedProviders()[parsedData.provider]) {
                console.log('[API设置] ❌ 无效的服务商:', parsedData.provider);
                return false;
            }
            
            if (parsedData.apiKey && parsedData.apiKey.length < 10) {
                console.log('[API设置] ❌ API密钥过短:', parsedData.apiKey.length);
                return false;
            }
            
            if (parsedData.model && parsedData.model.length < 3) {
                console.log('[API设置] ❌ 模型名称过短:', parsedData.model.length);
                return false;
            }
            
            console.log('[API设置] ✅ 配置持久性验证通过');
            console.log('[API设置] 配置摘要:', {
                provider: parsedData.provider,
                hasApiKey: !!parsedData.apiKey,
                model: parsedData.model,
                enabled: parsedData.enabled,
                timestamp: parsedData.timestamp
            });
            
            return true;
            
        } catch (error) {
            console.error('[API设置] ❌ 配置持久性验证失败:', error);
            return false;
        }
    }

    // 添加调试函数
    window.debugTheaterAPI = function() {
        console.group('🔧 [小剧场API] 调试信息');
        
        // 检查localStorage
        const saved = localStorage.getItem('theater_api_settings');
        console.log('📦 localStorage内容:', saved ? JSON.parse(saved) : '无数据');
        
        // 检查当前UI状态
        const currentSettings = {
            enabled: document.getElementById('api-enabled')?.checked || false,
            provider: document.getElementById('api-provider')?.value || '未选择',
            apiUrl: document.getElementById('theater-api-url')?.value || '未填写',
            apiKey: document.getElementById('theater-api-key')?.value || '未填写',
            model: document.getElementById('theater-api-model')?.value || '未选择'
        };
        console.log('🖥️ 当前UI状态:', currentSettings);
        
        // 检查loadAPISettings函数
        const loadedSettings = loadAPISettings();
        console.log('📖 loadAPISettings()返回:', loadedSettings);
        
        // 验证配置持久性
        const isValid = validateConfigPersistence();
        console.log('🔍 配置持久性验证:', isValid ? '✅ 通过' : '❌ 失败');
        
        console.groupEnd();
    };

    // 添加配置清理函数
    window.clearTheaterAPIConfig = function() {
        console.log('[API设置] 清理API配置...');
        localStorage.removeItem('theater_api_settings');
        console.log('[API设置] ✅ 配置已清理');
    };

    // 添加配置导出函数
    window.exportTheaterAPIConfig = function() {
        const config = loadAPISettings();
        const configJson = JSON.stringify(config, null, 2);
        console.log('[API设置] 当前配置:', configJson);
        
        // 创建下载链接
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'theater-api-config.json';
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('[API设置] ✅ 配置已导出');
    };

    // 导出配置持久性验证函数到全局作用域
    window.validateConfigPersistence = validateConfigPersistence;
    
    // 导出其他重要函数到全局作用域
    window.loadAPISettingsContent = loadAPISettingsContent;
    window.bindAPISettingsEvents = bindAPISettingsEvents;
    window.loadAPISettings = loadAPISettings;
    window.saveAPIConfig = saveAPIConfig;
    window.clearAPIConfig = clearAPIConfig;

    // 添加简单的保存测试函数
    window.testSimpleSave = function() {
        console.log('[API设置] ===== 开始简单保存测试 =====');
        
        const testData = {
            enabled: true,
            provider: 'openai',
            apiUrl: 'https://api.openai.com',
            apiKey: 'sk-test123456789',
            model: 'gpt-3.5-turbo',
            temperature: 0.8,
            maxTokens: 30000,
            systemPrompt: '',
            timestamp: new Date().toISOString()
        };
        
        console.log('[API设置] 测试数据:', {
            ...testData,
            apiKey: testData.apiKey ? `${testData.apiKey.substring(0, 8)}...` : '(空)'
        });
        
        try {
            // 直接保存到localStorage
            localStorage.setItem('theater_api_settings', JSON.stringify(testData));
            console.log('[API设置] ✅ 测试数据已保存到localStorage');
            
            // 验证保存结果
            const savedData = localStorage.getItem('theater_api_settings');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                console.log('[API设置] ✅ 验证保存成功:', {
                    ...parsedData,
                    apiKey: parsedData.apiKey ? `${parsedData.apiKey.substring(0, 8)}...` : '(空)'
                });
                
                // 测试加载功能
                const loadedSettings = loadAPISettings();
                console.log('[API设置] ✅ 测试加载成功:', {
                    ...loadedSettings,
                    apiKey: loadedSettings.apiKey ? `${loadedSettings.apiKey.substring(0, 8)}...` : '(空)'
                });
                
                return true;
            } else {
                console.error('[API设置] ❌ 保存验证失败');
                return false;
            }
        } catch (error) {
            console.error('[API设置] ❌ 测试保存失败:', error);
            return false;
        }
    };

    // 添加检查localStorage状态的函数
    window.checkLocalStorageStatus = function() {
        console.log('[API设置] ===== 检查localStorage状态 =====');
        
        const keys = [
            'theater_api_settings',
            'theater_api_settings_backup', 
            'theater_api_settings_test',
            'mobile_api_url_openai',
            'mobile_api_url_custom',
            'mobile_api_url_gemini'
        ];
        
        keys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`[API设置] ${key}:`, {
                        ...parsed,
                        apiKey: parsed.apiKey ? `${parsed.apiKey.substring(0, 8)}...` : '(空)'
                    });
                } catch (error) {
                    console.log(`[API设置] ${key}:`, data);
                }
            } else {
                console.log(`[API设置] ${key}: (空)`);
            }
        });
        
        // 检查所有localStorage键
        console.log('[API设置] 所有localStorage键:', Object.keys(localStorage));
    };

    // 添加检查保存按钮状态的函数
    window.checkSaveButton = function() {
        console.log('[API设置] ===== 检查保存按钮状态 =====');
        
        const saveBtn = document.getElementById('theater-save-api-config');
        if (saveBtn) {
            console.log('[API设置] ✅ 保存按钮存在:', saveBtn);
            console.log('[API设置] 按钮文本:', saveBtn.textContent);
            console.log('[API设置] 按钮可见性:', saveBtn.offsetParent !== null);
            console.log('[API设置] 按钮是否禁用:', saveBtn.disabled);
            
            // 检查事件监听器
            const hasClickHandler = saveBtn.onclick !== null;
            console.log('[API设置] 是否有onclick处理器:', hasClickHandler);
            
            // 手动触发点击事件测试
            console.log('[API设置] 尝试手动触发点击事件...');
            try {
                saveBtn.click();
                console.log('[API设置] ✅ 手动点击成功');
            } catch (error) {
                console.error('[API设置] ❌ 手动点击失败:', error);
            }
        } else {
            console.error('[API设置] ❌ 保存按钮不存在');
            
            // 检查所有按钮
            const allButtons = document.querySelectorAll('button');
            console.log('[API设置] 页面中所有按钮:', Array.from(allButtons).map(btn => ({
                id: btn.id,
                text: btn.textContent,
                class: btn.className
            })));
        }
    };

    // 添加直接测试保存功能的函数
    window.testSaveFunction = function() {
        console.log('[API设置] ===== 直接测试保存功能 =====');
        
        try {
            // 直接调用保存函数
            console.log('[API设置] 直接调用saveAPIConfig()...');
            saveAPIConfig().then(result => {
                console.log('[API设置] ✅ 保存函数执行完成，结果:', result);
            }).catch(error => {
                console.error('[API设置] ❌ 保存函数执行失败:', error);
            });
        } catch (error) {
            console.error('[API设置] ❌ 调用保存函数时出错:', error);
        }
    };

    // 添加强制重新绑定事件的函数
    window.rebindSaveButton = function() {
        console.log('[API设置] ===== 强制重新绑定保存按钮事件 =====');
        
        const saveBtn = document.getElementById('theater-save-api-config');
        if (saveBtn) {
            // 移除所有现有的事件监听器
            const newBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newBtn, saveBtn);
            
            // 重新绑定事件
            newBtn.addEventListener('click', (e) => {
                console.log('[API设置] 🔥 重新绑定的保存按钮被点击！');
                e.preventDefault();
                e.stopPropagation();
                try {
                    saveAPIConfig();
                } catch (error) {
                    console.error('[API设置] ❌ 保存配置时出错:', error);
                    showAPIStatus('❌ 保存失败: ' + error.message, 'error');
                }
            });
            
            console.log('[API设置] ✅ 保存按钮事件重新绑定完成');
        } else {
            console.error('[API设置] ❌ 未找到保存按钮元素');
        }
    };

    // 添加检查表单数据的函数
    window.checkFormData = function() {
        console.log('[API设置] ===== 检查表单数据 =====');
        
        const formFields = [
            'api-enabled',
            'api-provider', 
            'theater-api-url',
            'theater-api-key',
            'theater-api-model'
        ];
        
        formFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                const value = element.type === 'checkbox' ? element.checked : element.value;
                console.log(`[API设置] ${fieldId}:`, value);
            } else {
                console.warn(`[API设置] ⚠️ 未找到元素: ${fieldId}`);
            }
        });
        
        // 模拟收集表单数据
        const mockFormData = {
            enabled: document.getElementById('api-enabled')?.checked || false,
            provider: document.getElementById('api-provider')?.value || 'openai',
            apiUrl: document.getElementById('theater-api-url')?.value || '',
            apiKey: document.getElementById('theater-api-key')?.value || '',
            model: document.getElementById('theater-api-model')?.value || '',
            temperature: 0.8,
            maxTokens: 30000,
            systemPrompt: '',
            timestamp: new Date().toISOString()
        };
        
        console.log('[API设置] 模拟收集的表单数据:', {
            ...mockFormData,
            apiKey: mockFormData.apiKey ? `${mockFormData.apiKey.substring(0, 8)}...` : '(空)'
        });
        
        return mockFormData;
    };

    // 添加直接测试localStorage的函数
    window.testLocalStorage = function() {
        console.log('[API设置] ===== 测试localStorage功能 =====');
        
        // 测试1: 检查localStorage是否可用
        try {
            localStorage.setItem('test_key', 'test_value');
            const testValue = localStorage.getItem('test_key');
            localStorage.removeItem('test_key');
            
            if (testValue === 'test_value') {
                console.log('[API设置] ✅ localStorage功能正常');
            } else {
                console.error('[API设置] ❌ localStorage功能异常');
                return false;
            }
        } catch (error) {
            console.error('[API设置] ❌ localStorage不可用:', error);
            return false;
        }
        
        // 测试2: 测试保存和读取配置
        const testConfig = {
            enabled: true,
            provider: 'openai',
            apiUrl: 'https://api.openai.com',
            apiKey: 'sk-test123',
            model: 'gpt-3.5-turbo'
        };
        
        try {
            localStorage.setItem('theater_api_settings', JSON.stringify(testConfig));
            const saved = localStorage.getItem('theater_api_settings');
            const parsed = JSON.parse(saved);
            
            console.log('[API设置] ✅ 配置保存和读取测试成功:', parsed);
            return true;
        } catch (error) {
            console.error('[API设置] ❌ 配置保存测试失败:', error);
            return false;
        }
    };

    // 添加恢复真实配置的函数
    window.restoreRealConfig = function() {
        console.log('[API设置] ===== 恢复真实配置 =====');
        
        // 检查是否有备份
        const backupKey = 'theater_api_settings_backup';
        const backupData = localStorage.getItem(backupKey);
        
        if (backupData) {
            try {
                const parsedBackup = JSON.parse(backupData);
                localStorage.setItem('theater_api_settings', backupData);
                console.log('[API设置] ✅ 已从备份恢复配置:', {
                    ...parsedBackup,
                    apiKey: parsedBackup.apiKey ? `${parsedBackup.apiKey.substring(0, 8)}...` : '(空)'
                });
                return true;
            } catch (error) {
                console.error('[API设置] ❌ 恢复配置失败:', error);
                return false;
            }
        } else {
            console.log('[API设置] ⚠️ 没有找到备份配置');
            return false;
        }
    };

    // 添加备份当前配置的函数
    window.backupCurrentConfig = function() {
        console.log('[API设置] ===== 备份当前配置 =====');
        
        const currentConfig = localStorage.getItem('theater_api_settings');
        if (currentConfig) {
            localStorage.setItem('theater_api_settings_backup', currentConfig);
            console.log('[API设置] ✅ 当前配置已备份');
            return true;
        } else {
            console.log('[API设置] ⚠️ 没有找到当前配置');
            return false;
        }
    };
    
// 加载模块样式
function loadModuleStyles() {
  if (document.getElementById('theater-modules-styles')) return;

  // 尝试加载外部CSS文件
  const link = document.createElement('link');
  link.id = 'theater-modules-styles';
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = './theater-modules.css';
  
  // 如果外部CSS加载失败，使用内联样式
  link.onerror = () => {
    console.warn('[小剧场生成器] 外部CSS加载失败，使用内联样式');
    loadInlineStyles();
  };
  
  link.onload = () => {
    console.log('[小剧场生成器] 模块样式已加载');
  };
  
  document.head.appendChild(link);
}
// 加载内联样式作为备用方案
function loadInlineStyles() {
  if (document.getElementById('theater-modules-inline-styles')) return;

  const style = document.createElement('style');
  style.id = 'theater-modules-inline-styles';
  style.textContent = `
    /* 消息阈值监控样式 */
    .tg-threshold-control {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0;
    }

    .tg-form-range {
      flex: 1;
      height: 6px;
      background: #ddd;
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
    }

    .tg-form-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      background: #007bff;
      border-radius: 50%;
      cursor: pointer;
    }

    .tg-form-range::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: #007bff;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .tg-threshold-display {
      font-weight: bold;
      color: #007bff;
      min-width: 60px;
      text-align: center;
    }

    .tg-progress-container {
      margin-top: 12px;
    }

    .tg-progress-bar {
      width: 100%;
      height: 20px;
      background: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .tg-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #28a745, #20c997);
      transition: width 0.3s ease;
      border-radius: 10px;
    }

    .tg-progress-text {
      text-align: center;
      font-size: 14px;
      color: #6c757d;
      font-weight: 500;
    }

    /* 结果头部样式 */
    .tg-result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .tg-result-header h3 {
      margin: 0;
      color: #495057;
    }

    /* 预览占位符样式 */
    .tg-preview-placeholder {
      text-align: center;
      color: #6c757d;
      padding: 40px 20px;
    }

    .tg-preview-placeholder p {
      margin: 8px 0;
      font-size: 16px;
    }

    /* 小剧场HTML样式 */
    .theater-play {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .theater-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
    }

    .theater-header h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
    }

    .theater-meta {
      font-size: 14px;
      opacity: 0.9;
    }

    .theater-content {
      padding: 24px;
    }

    .theater-dialogue {
      margin: 16px 0;
      padding: 12px 16px;
      background: #f8f9fa;
      border-left: 4px solid #007bff;
      border-radius: 0 8px 8px 0;
    }

    .theater-dialogue .speaker {
      font-weight: bold;
      color: #007bff;
      display: block;
      margin-bottom: 4px;
    }

    .theater-dialogue .dialogue {
      color: #495057;
      font-size: 16px;
    }

    .theater-direction {
      margin: 12px 0;
      padding: 8px 12px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      text-align: center;
    }

    .theater-direction em {
      color: #856404;
      font-style: italic;
      font-size: 14px;
    }

    .theater-narration {
      margin: 12px 0;
      color: #6c757d;
      font-size: 15px;
      line-height: 1.7;
    }

    /* 移动端阈值控制样式 */
    @media (max-width: 768px) {
      .tg-threshold-control {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .tg-result-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
    }
  `;
  
  document.head.appendChild(style);
  console.log('[小剧场生成器] 内联样式已加载');
}

    // ========================================
    // 🎭 内嵌模块代码区域 - TheaterModule
    // ========================================
    // 小剧场模块 - 独立的小剧场生成功能
    // 基于参考代码封装，集成API配置功能，支持消息阈值监控和HTML生成
    
    class TheaterModule {
      constructor() {
        this.settings = this.loadSettings();
        this.history = this.loadHistory();
        this.prompts = this.loadPrompts();
        this.apiConfig = this.loadAPIConfig();
        this.currentMessageCount = 0;
        this.threshold = 10; // 默认阈值
        this.currentPreviewIndex = 0;
        this.lastOutputs = this.loadLastOutputs();
        // 优先采用 API 设置中的阈值（若存在），否则采用模块设置
        if (this.apiConfig && Number.isFinite(this.apiConfig.messageThreshold)) {
          this.threshold = this.apiConfig.messageThreshold;
        }
        this.init();
      }

      init() {
        console.log('[Theater Module] 小剧场模块初始化');
        this.updateMessageCount();
      }

      loadSettings() {
        const defaultSettings = {
          theaterPrompt: '请生成一个小剧场场景，包含对话和动作描述。',
          theaterLength: 800,
          theaterStyle: 'dramatic',
          characterCount: 2,
          autoSave: true,
          messageThreshold: 10, // 消息阈值
          theaterCount: 1,
          selectedPreset: '',
          customPrompt: '' // 用户自定义输入的提示词
        };

        try {
          const saved = localStorage.getItem('theater_module_settings');
          const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
          if (!Number.isFinite(settings.theaterCount) || settings.theaterCount < 1 || settings.theaterCount > 4) {
            settings.theaterCount = 1;
          }
          this.threshold = settings.messageThreshold;
          return settings;
        } catch (error) {
          console.warn('[Theater Module] 设置加载失败，使用默认设置:', error);
          return defaultSettings;
        }
      }

      loadLastOutputs() {
        try {
          // 检查localStorage是否可用
          if (typeof Storage === 'undefined' || !window.localStorage) {
            console.warn('[Theater Module] localStorage不可用，使用内存存储');
            return this.lastOutputs || [];
          }
          
          const saved = localStorage.getItem('theater_module_last_outputs');
          if (!saved) return [];
          
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            console.log('[Theater Module] 成功加载上次输出，数量:', parsed.length);
            return parsed.slice(0, 4);
          }
          return [];
        } catch (error) {
          console.warn('[Theater Module] 加载上次输出失败:', error);
          return [];
        }
      }

      saveLastOutputs(outputs) {
        try {
          const arr = Array.isArray(outputs) ? outputs.slice(0, 4) : [];
          
          // 检查localStorage是否可用
          if (typeof Storage === 'undefined' || !window.localStorage) {
            console.warn('[Theater Module] localStorage不可用，仅保存到内存');
            this.lastOutputs = arr;
            return;
          }
          
          localStorage.setItem('theater_module_last_outputs', JSON.stringify(arr));
          this.lastOutputs = arr;
          console.log('[Theater Module] 成功保存输出，数量:', arr.length);
        } catch (error) {
          console.warn('[Theater Module] 保存输出失败:', error);
          // 即使保存失败，也要更新内存中的内容
          this.lastOutputs = Array.isArray(outputs) ? outputs.slice(0, 4) : [];
        }
      }

      // 更新消息计数
      updateMessageCount() {
        try {
          if (window.TavernHelper && window.TavernHelper.getChatMessages) {
            const messages = window.TavernHelper.getChatMessages('0-{{lastMessageId}}');
            this.currentMessageCount = messages ? messages.length : 0;
          } else if (window.getLastMessageId) {
            this.currentMessageCount = window.getLastMessageId() + 1;
          } else {
            // 降级方案：尝试从DOM获取
            const messageElements = document.querySelectorAll('[id^="mes_"]');
            this.currentMessageCount = messageElements.length;
          }
          console.log('[Theater Module] 当前消息数量:', this.currentMessageCount);
        } catch (error) {
          console.warn('[Theater Module] 获取消息数量失败:', error);
          this.currentMessageCount = 0;
        }
      }

      loadHistory() {
        try {
          const saved = localStorage.getItem('theater_module_history');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Theater Module] 历史记录加载失败:', error);
          return [];
        }
      }

      loadPrompts() {
        try {
          const saved = localStorage.getItem('theater_module_prompts');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Theater Module] 提示词加载失败:', error);
          return [];
        }
      }

      loadCustomPresets() {
        try {
          const saved = localStorage.getItem('theater_module_custom_presets');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Theater Module] 自定义预设加载失败:', error);
          return [];
        }
      }

      saveCustomPresets(presets) {
        try {
          localStorage.setItem('theater_module_custom_presets', JSON.stringify(presets));
        } catch (error) {
          console.warn('[Theater Module] 自定义预设保存失败:', error);
        }
      }

      loadAPIConfig() {
        const defaultAPIConfig = {
          enabled: false,
          provider: 'openai',
          apiUrl: '',
          apiKey: '',
          model: '',
          temperature: 0.8,
          maxTokens: 30000,
          useProxy: false,
          proxyUrl: '',
          timeout: 30000,
          retryCount: 3,
          customHeaders: {},
          systemPrompt: '',
          streamEnabled: false,
        };

        try {
          const saved = localStorage.getItem('theater_api_settings');
          return saved ? { ...defaultAPIConfig, ...JSON.parse(saved) } : defaultAPIConfig;
        } catch (error) {
          console.warn('[Theater Module] API配置加载失败，使用默认配置:', error);
          return defaultAPIConfig;
        }
      }

      saveSettings() {
        try {
          localStorage.setItem('theater_module_settings', JSON.stringify(this.settings));
        } catch (error) {
          console.error('[Theater Module] 设置保存失败:', error);
        }
      }

      saveHistory() {
        try {
          localStorage.setItem('theater_module_history', JSON.stringify(this.history));
        } catch (error) {
          console.error('[Theater Module] 历史记录保存失败:', error);
        }
      }

      savePrompts() {
        try {
          localStorage.setItem('theater_module_prompts', JSON.stringify(this.prompts));
        } catch (error) {
          console.error('[Theater Module] 提示词保存失败:', error);
        }
      }

      // 检查API是否可用
      isAPIAvailable() {
        return this.apiConfig.enabled && this.apiConfig.apiUrl && this.apiConfig.model && this.apiConfig.apiKey;
      }

      // 调用API生成小剧场
      async callTheaterAPI(prompt) {
        // 优先尝试使用 SillyTavern 内置生成（避免外部API配置问题）
        try {
          if (window.SillyTavern && typeof window.SillyTavern.generate === 'function') {
            const result = await window.SillyTavern.generate({
              user_input: prompt,
              should_stream: false,
              max_chat_history: 'all',
            });
            if (result) return result;
          }
        } catch (e) {
          console.warn('[Theater Module] SillyTavern.generate 调用失败，回退到自定义API:', e);
        }

        if (!this.isAPIAvailable()) {
          throw new Error('API配置不完整或未启用');
        }

        const messages = [
          {
            role: 'system',
            content: `你是一个小剧场生成创作者，运用HTML 或内联 CSS 来美化和排版小剧场的内容：
— 严格依据聊天上下文与提示进行创作；
— 输出1～${Math.min(4, this.settings.theaterCount || 1)}个小剧场片段（若上下文不足则少于该数），每个片段独立成块；
— 每个片段使用<section class="mini-theater-card">包裹，包含<h3>标题</h3>、<div class="theater-dialogue">对话</div>，以及可选<div class="theater-direction"><em>舞台指示</em></div>；
— 使用适度的 HTML/内联 CSS（粗体/斜体/强调色/背景条/边框/列表/分区/分镜等）；
— 结构清晰可扫读，可模仿字幕、分镜、论坛楼层或报告摘要；
— 角色不超过${this.settings.characterCount}人，风格为${this.settings.theaterStyle}；
— 输出为可直接渲染的HTML片段，禁止解释文字与代码围栏。`,
          },
          { role: 'user', content: prompt },
        ];

        try {
          const response = await this.makeAPICall(messages);
          return response.content || response;
        } catch (error) {
          console.error('[Theater Module] API调用失败:', error);
          throw error;
        }
      }

      // 执行API调用
      async makeAPICall(messages) {
        const provider = this.apiConfig.provider;
        let apiUrl = this.apiConfig.apiUrl;

        // 构建请求URL
        apiUrl = (apiUrl || '').toString();
        // 去除结尾多余斜杠
        apiUrl = apiUrl.replace(/\/+$/g, '');

        let requestUrl;
        if (provider === 'gemini') {
          // Gemini 端点通常不重复版本段
          requestUrl = `${apiUrl}/v1beta/models/${this.apiConfig.model}:generateContent?key=${this.apiConfig.apiKey}`;
        } else {
          // OpenAI 兼容端点：如果 base 已包含 /v{n}，则不要重复添加
          const hasVersion = /\/v\d+(?:\/|$)/.test(apiUrl);
          requestUrl = hasVersion
            ? `${apiUrl}/chat/completions`
            : `${apiUrl}/v1/chat/completions`;
          // 规范化重复斜杠（但保留协议部分 //）
          requestUrl = requestUrl.replace(/([^:])\/\/+/, '$1/');
        }

        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };
        if (provider !== 'gemini' && this.apiConfig.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiConfig.apiKey}`;
        }

        // 构建请求体
        const requestBody = this.buildRequestBody(provider, messages);

        console.log('[Theater Module] API请求:', {
          provider: provider,
          url: requestUrl.replace(this.apiConfig.apiKey || '', '[HIDDEN]'),
          headers: { ...headers, Authorization: headers.Authorization ? 'Bearer [HIDDEN]' : undefined },
        });

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API调用失败: HTTP ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return this.parseAPIResponse(provider, data);
      }

      // 构建请求体
      buildRequestBody(provider, messages) {
        if (provider === 'gemini') {
          const contents = [];
          messages.forEach(msg => {
            if (msg.role === 'system') {
              if (contents.length === 0) {
                contents.push({
                  parts: [{ text: msg.content + '\n\n' }],
                });
              }
            } else if (msg.role === 'user') {
              const existingText = contents.length > 0 ? contents[contents.length - 1].parts[0].text : '';
              if (contents.length > 0 && !contents[contents.length - 1].role) {
                contents[contents.length - 1].parts[0].text = existingText + msg.content;
              } else {
                contents.push({
                  parts: [{ text: msg.content }],
                });
              }
            } else if (msg.role === 'assistant') {
              contents.push({
                role: 'model',
                parts: [{ text: msg.content }],
              });
            }
          });

          return {
            contents: contents,
            generationConfig: {
              maxOutputTokens: this.apiConfig.maxTokens,
              temperature: this.apiConfig.temperature,
            },
          };
        } else {
          return {
            model: this.apiConfig.model,
            messages: messages,
            max_tokens: this.apiConfig.maxTokens,
            temperature: this.apiConfig.temperature,
          };
        }
      }

      // 解析API响应
      parseAPIResponse(provider, data) {
        if (provider === 'gemini') {
          return {
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            usage: data.usageMetadata,
          };
        } else {
          return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage,
          };
        }
      }

      // 生成模拟小剧场
      generateSampleTheater(prompt) {
        const styles = {
          dramatic: '【戏剧性场景】',
          comedy: '【喜剧场景】',
          romance: '【浪漫场景】',
          mystery: '【悬疑场景】',
          action: '【动作场景】',
        };

        const style = styles[this.settings.theaterStyle] || styles.dramatic;
        const length = this.settings.theaterLength;
        const characterCount = this.settings.characterCount;

        const characters = ['小明', '小红', '小李', '小王', '小张', '小陈'].slice(0, characterCount);

        return `${style}\n\n场景：${prompt}\n\n${characters[0]}：（走进房间，环顾四周）这里就是我们要找的地方吗？\n\n${
          characters[1]
        }：（点头）是的，根据线索，应该就是这里。\n\n${characters[0]}：（仔细观察）等等，你们看这个...\n\n${
          characters[2] || characters[0]
        }：（凑近看）这确实很奇怪，不像是普通的装饰。\n\n[场景描述：房间里的气氛变得紧张起来，每个人都在仔细观察着周围的环境。]\n\n${
          characters[0]
        }：（低声）我们得小心点，这里可能有什么机关。\n\n${
          characters[1]
        }：（点头同意）对，大家保持警惕。\n\n[突然，房间里的灯光开始闪烁，所有人的心都提到了嗓子眼...]\n\n字数：约${length}字，角色数：${characterCount}个`;
      }

      // 获取HTML内容
      getContent() {
        this.updateMessageCount();
        const progress = Math.min((this.currentMessageCount / this.threshold) * 100, 100);
        
        // 加载自定义预设
        const customPresets = this.loadCustomPresets();
        const customPresetOptions = customPresets.map(preset => 
          `<option value="${preset.content}">${preset.name}</option>`
        ).join('');
        
        return `
          <div class="tg-theater-module-container" style="margin: 0 20px;">
            <div class="tg-theater-header">
              <h2>🎭 小剧场生成</h2>
            </div>
            <div class="tg-theater-content">
              <!-- 提示词设置 -->
              <div class="tg-theater-form">
                <div class="tg-form-group">
                  <label for="theater-preset" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">📝 提示词预设模版</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <select id="theater-preset" style="flex:1;padding:8px 12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">
                      <option value="">🎨 自定义</option>
                      <option value="题材不限，发挥想象力，从例如平行世界、校园风、古风、玄幻、欧美贵族等各大热门题材中选择一个，创造对应的可直接渲染的美化小剧场，鼓励增加趣味互动性的点击功能，不输出html等html头部格式">小火默认小剧场预设</option>
                    </select>
                    <button id="delete-preset" style="padding:8px;background:#ff6b6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.2s ease;min-width:36px;" title="删除选中的预设" onmouseover="this.style.background='#ff5252'" onmouseout="this.style.background='#ff6b6b'">🗑️</button>
                  </div>
                </div>
                <div class="tg-form-group">
                  <label for="theater-count" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">🔢 生成数量（1-4）</label>
                  <select id="theater-count" style="padding:8px 12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;width:120px;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">
                    <option value="1" ${this.settings.theaterCount === 1 ? 'selected' : ''}>1 个</option>
                    <option value="2" ${this.settings.theaterCount === 2 ? 'selected' : ''}>2 个</option>
                    <option value="3" ${this.settings.theaterCount === 3 ? 'selected' : ''}>3 个</option>
                    <option value="4" ${this.settings.theaterCount === 4 ? 'selected' : ''}>4 个</option>
                  </select>
                </div>
                <div class="tg-form-group">
                  <label for="theater-word-count" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">📝 字数范围</label>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="number" id="theater-min-words" placeholder="最少" min="100" max="10000" step="100" value="${this.settings.minWords || 500}" style="flex:1;padding:8px 12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">
                    <span style="color:#666;font-size:14px;">-</span>
                    <input type="number" id="theater-max-words" placeholder="最多" min="100" max="10000" step="100" value="${this.settings.maxWords || 7000}" style="flex:1;padding:8px 12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">
                    <span style="color:#666;font-size:12px;white-space:nowrap;">字</span>
                  </div>
                </div>
                <div class="tg-form-group">
                  <label for="theater-prompt" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">✍️ 提示词</label>
                  <textarea id="theater-prompt" placeholder="描述你想要的小剧场场景..." rows="3" style="width:100%;padding:12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;resize:vertical;min-height:80px;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">${this.settings.customPrompt || this.settings.theaterPrompt}</textarea>
                </div>
                <div class="tg-form-actions" style="display:flex;gap:12px;margin-top:20px;">
                  <button id="generate-theater" style="flex:1;padding:12px 20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:all 0.3s ease;box-shadow:0 4px 15px rgba(102, 126, 234, 0.3);min-height:48px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.3)'">🎭 生成小剧场</button>
                  <button id="save-prompt" style="flex:1;padding:12px 20px;background:#f8f9fa;color:#495057;border:2px solid #e9ecef;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:all 0.3s ease;min-height:48px;" onmouseover="this.style.background='#e9ecef';this.style.borderColor='#dee2e6'" onmouseout="this.style.background='#f8f9fa';this.style.borderColor='#e9ecef'">💾 保存提示词</button>
                </div>
              </div>

              <!-- HTML预览区域 -->
              <div class="tg-theater-result" id="theater-result" style="display:block;">
                <div id="theater-previews" style="position:relative;">
                  <!-- 多预览容器将由脚本注入 -->
                </div>
                <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:15px;">
                  <button id="theater-prev" style="padding:6px 12px;background:#f8f9fa;color:#495057;border:1px solid #dee2e6;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">上一页</button>
                  <span id="theater-page-indicator" style="min-width:60px;text-align:center;font-size:12px;color:#6c757d;font-weight:500;">1 / ${this.settings.theaterCount}</span>
                  <button id="theater-next" style="padding:6px 12px;background:#f8f9fa;color:#495057;border:1px solid #dee2e6;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">下一页</button>
                </div>
                <div style="text-align: center; margin-top: 12px; display: flex; gap: 8px; justify-content: center;">
                  <button id="screenshot-theater" style="padding:8px 16px;background:#28a745;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">📸 截图</button>
                  <button id="fullscreen-theater" style="padding:8px 16px;background:#17a2b8;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#138496'" onmouseout="this.style.background='#17a2b8'">⛶ 全屏</button>
                </div>
              </div>
            </div>
            <div style="margin-bottom: 30px;"></div>
          </div>
        `;
      }

      // 绑定事件
      bindEvents() {


        // 预设模版选择
        const presetSelect = document.getElementById('theater-preset');
        if (presetSelect) {
          presetSelect.addEventListener('change', e => {
            const val = e.target.value || '';
            if (val) {
              const ta = document.getElementById('theater-prompt');
              if (ta) {
                ta.value = val;
                // 清空自定义提示词，因为选择了预设
                this.settings.customPrompt = '';
                this.saveSettings();
              }
              this.settings.selectedPreset = val;
              this.saveSettings();
            }
          });
          // 恢复已选预设
          if (this.settings.selectedPreset) {
            presetSelect.value = this.settings.selectedPreset;
            // 同时恢复预设对应的提示词内容
            const ta = document.getElementById('theater-prompt');
            if (ta) {
              ta.value = this.settings.selectedPreset;
            }
          }
        }

        // 生成数量变更
        const countSelect = document.getElementById('theater-count');
        if (countSelect) {
          countSelect.addEventListener('change', e => {
            const val = parseInt(e.target.value) || 1;
            this.settings.theaterCount = Math.min(4, Math.max(1, val));
            this.saveSettings();
            this.currentPreviewIndex = 0;
            this.renderPreviews(this.lastOutputs);
          });
        }

        // 字数设置变更
        const minWordsInput = document.getElementById('theater-min-words');
        const maxWordsInput = document.getElementById('theater-max-words');
        
        if (minWordsInput) {
          minWordsInput.addEventListener('change', e => {
            const val = parseInt(e.target.value) || 500;
            this.settings.minWords = Math.min(10000, Math.max(100, val));
            this.saveSettings();
          });
        }
        
        if (maxWordsInput) {
          maxWordsInput.addEventListener('change', e => {
            const val = parseInt(e.target.value) || 7000;
            this.settings.maxWords = Math.min(10000, Math.max(100, val));
            this.saveSettings();
          });
        }

        // 提示词输入框事件
        const promptTextarea = document.getElementById('theater-prompt');
        if (promptTextarea) {
          promptTextarea.addEventListener('input', (e) => {
            // 用户手动输入时，清空预设选择并保存自定义提示词
            const presetSelect = document.getElementById('theater-preset');
            if (presetSelect) {
              presetSelect.value = '';
              this.settings.selectedPreset = '';
            }
            this.settings.customPrompt = e.target.value;
            this.saveSettings();
          });
        }

        // 生成小剧场按钮
        const generateBtn = document.getElementById('generate-theater');
        if (generateBtn) {
          generateBtn.addEventListener('click', () => this.generateTheater());
        }

        // 保存提示词按钮
        const savePromptBtn = document.getElementById('save-prompt');
        if (savePromptBtn) {
          savePromptBtn.addEventListener('click', () => this.savePrompt());
        }

        // 删除预设按钮
        const deletePresetBtn = document.getElementById('delete-preset');
        if (deletePresetBtn) {
          deletePresetBtn.addEventListener('click', () => this.deletePreset());
        }

        // 截图按钮（针对当前页）
        const screenshotBtn = document.getElementById('screenshot-theater');
        if (screenshotBtn) {
          screenshotBtn.addEventListener('click', () => {
            const cur = this.getCurrentPreviewElement();
            if (!cur) return this.showNotification('暂无预览内容', 'warning');
            // 临时将目标ID设为通用ID以复用截图逻辑
            const originalId = cur.id;
            cur.id = 'theater-html-preview';
            try { this.takeScreenshot(); } finally { cur.id = originalId; }
          });
        }

        // 全屏按钮（共享）
        const fullscreenBtn = document.getElementById('fullscreen-theater');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', () => {
            const cur = this.getCurrentPreviewElement();
            if (cur) this.openFullscreen(cur);
          });
        }

        // 分页按钮
        const prevBtn = document.getElementById('theater-prev');
        const nextBtn = document.getElementById('theater-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.gotoPrev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.gotoNext());

        // 首次渲染预览（恢复上次输出）
        this.renderPreviews(this.lastOutputs);

        // 检查是否有正在进行的生成任务，如果有则显示进度
        this.updateGenerationProgress();
      }

      async generateTheater() {
        try {
          const prompt = document.getElementById('theater-prompt').value;
          if (!prompt.trim()) {
            this.showNotification('请输入小剧场提示词', 'warning');
                return;
            }

          // 检查是否有正在进行的后台生成任务
          if (this.backgroundGenerationTask && this.backgroundGenerationTask.status === 'running') {
            this.showNotification('已有后台生成任务正在进行中，请等待完成', 'warning');
            return;
          }

          // 请求通知权限（提前请求）
          await this.requestNotificationPermission();

          // 显示加载状态
          const generateBtn = document.getElementById('generate-theater');
          const originalText = generateBtn.textContent;
          generateBtn.textContent = '生成中...';
          generateBtn.disabled = true;

          // 显示前台生成提示
          this.showNotification('开始生成小剧场，如需关闭界面可继续后台生成', 'info');

          const count = Math.min(4, Math.max(1, this.settings.theaterCount || 1));

          // 获取聊天历史作为上下文
          const chatHistory = this.getChatHistory();
          
          // 构建完整的提示词
          const fullPrompt = this.buildTheaterPrompt(prompt, chatHistory);

          // 创建生成任务（标记为前台生成）
          this.backgroundGenerationTask = {
            status: 'running',
            progress: 0,
            total: count,
            prompt: prompt,
            startTime: Date.now(),
            isForeground: true,  // 标记为前台生成
            outputs: []  // 初始化输出数组
          };

          const outputs = this.backgroundGenerationTask.outputs;

          for (let i = 0; i < count; i++) {
            // 检查是否已切换到后台模式
            if (this.backgroundGenerationTask && !this.backgroundGenerationTask.isForeground) {
              console.log('[Theater Module] 检测到界面已关闭，切换到后台生成模式');
              // 调用后台生成方法继续生成
              await this.generateTheaterBackground();
              return;
            }

            // 更新进度显示
            generateBtn.textContent = `生成中... 小剧场${i + 1}/${count}`;
            
            // 更新任务进度
            this.backgroundGenerationTask.progress = i + 1;
            
            // 显示进度提示
            this.showNotification(`正在生成第${i + 1}个小剧场...`, 'info');
            
            let theaterContent = '';
            // 先本地兜底
            const local = this.generateLocalTheater(prompt, chatHistory);
            theaterContent = local && local.trim() ? local : '';
            // API增强
            if (this.isAPIAvailable()) {
              try {
                const apiResult = await this.callTheaterAPI(fullPrompt);
                if (apiResult && apiResult.trim()) {
                  theaterContent = apiResult;
                }
              } catch (apiError) {
                console.warn('[Theater Module] API调用失败（第', i + 1, '个），使用本地内容:', apiError);
              }
            }
            // 去围栏
            let stripped = (theaterContent || '')
              .replace(/^```html\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim();
            if (!stripped) {
              stripped = this.generateLocalTheater(prompt, chatHistory).trim();
            }
            // 最终HTML
            const htmlTheater = this.generateHTMLTheater(stripped);
            outputs.push(htmlTheater || stripped || '');
          }

          // 标记任务完成
          this.backgroundGenerationTask.status = 'completed';
          this.backgroundGenerationTask.endTime = Date.now();
          this.backgroundGenerationTask.outputs = outputs;

          // 显示结果为HTML预览（多页）
          this.saveLastOutputs(outputs);
          this.currentPreviewIndex = 0;
          this.renderPreviews(outputs);
          const resultWrapper = document.getElementById('theater-result');
          if (resultWrapper) resultWrapper.style.display = 'block';
          
          // 显示成功消息
          this.showNotification(`成功生成${count}个小剧场！可以关闭界面继续其他操作`, 'success');

          // 在界面下方提供原始输出面板（只显示动态内容）
          try {
            const raw = document.getElementById('theater-raw-output');
            if (raw) {
              try { raw.remove(); } catch (_) {}
            }
          } catch(_) {}

          // 保存到历史记录
          outputs.forEach(out => this.addToHistory(prompt, out));

          // 同步插入到聊天（系统消息）
          try {
            if (typeof addTheaterMessage === 'function' && outputs.length > 0) {
              for (let i = 0; i < outputs.length; i++) {
                await addTheaterMessage(outputs[i].trim());
              }
            }
          } catch (insertErr) {
            console.warn('[Theater Module] 插入聊天失败（已忽略）：', insertErr);
          }

          // 恢复按钮状态
          generateBtn.textContent = originalText;
          generateBtn.disabled = false;

          // 清除任务
          setTimeout(() => {
            this.backgroundGenerationTask = null;
          }, 5000);

        } catch (error) {
          console.error('[Theater Module] 生成小剧场失败:', error);
          this.showNotification('生成失败: ' + error.message, 'error');

          // 恢复按钮状态
          const generateBtn = document.getElementById('generate-theater');
          generateBtn.textContent = '生成小剧场';
          generateBtn.disabled = false;

          // 清除任务
          if (this.backgroundGenerationTask) {
            this.backgroundGenerationTask.status = 'failed';
            this.backgroundGenerationTask.error = error.message;
          }
        }
      }

      // 后台生成方法
      async generateTheaterBackground() {
        try {
          // 检查是否有正在进行的生成任务
          if (!this.backgroundGenerationTask || this.backgroundGenerationTask.status !== 'running') {
            console.log('[Theater Module] 后台生成：没有正在进行的任务');
            return;
          }

          const task = this.backgroundGenerationTask;
          const prompt = task.prompt;
          const count = task.total;
          const currentProgress = task.progress;
          // 保留之前已生成的内容，而不是重新初始化
          const outputs = task.outputs || [];

          console.log('[Theater Module] 继续后台生成任务，当前进度:', currentProgress, '/', count);

          // 获取聊天历史作为上下文
          const chatHistory = this.getChatHistory();
          
          // 构建完整的提示词
          const fullPrompt = this.buildTheaterPrompt(prompt, chatHistory);

          // 从当前进度继续生成
          for (let i = currentProgress; i < count; i++) {
            // 更新后台任务进度
            this.backgroundGenerationTask.progress = i + 1;
            
            // 更新按钮进度显示（如果界面还开着）
            this.updateGenerationProgress();
            
            let theaterContent = '';
            // 先本地兜底
            const local = this.generateLocalTheater(prompt, chatHistory);
            theaterContent = local && local.trim() ? local : '';
            // API增强
            if (this.isAPIAvailable()) {
              try {
                const apiResult = await this.callTheaterAPI(fullPrompt);
                if (apiResult && apiResult.trim()) {
                  theaterContent = apiResult;
                }
              } catch (apiError) {
                console.warn('[Theater Module] API调用失败（第', i + 1, '个），使用本地内容:', apiError);
              }
            }
            // 去围栏
            let stripped = (theaterContent || '')
              .replace(/^```html\s*/i, '')
              .replace(/```\s*$/i, '')
              .trim();
            if (!stripped) {
              stripped = this.generateLocalTheater(prompt, chatHistory).trim();
            }
            // 最终HTML
            const htmlTheater = this.generateHTMLTheater(stripped);
            outputs.push(htmlTheater || stripped || '');
          }

          // 标记后台任务完成
          this.backgroundGenerationTask.status = 'completed';
          this.backgroundGenerationTask.endTime = Date.now();
          this.backgroundGenerationTask.outputs = outputs;

          // 显示结果为HTML预览（多页）
          this.saveLastOutputs(outputs);
          this.currentPreviewIndex = 0;

          // 显示完成提示 + 提示音
          const successMessage = `成功生成${count}个小剧场！`;
          this.showNotification(successMessage, 'success');
          if (window.playNotifySound) window.playNotifySound();
          // 仍然尝试系统通知（如果授权）
          this.showBrowserNotification(successMessage, '小剧场生成完成！');

          // 保存到历史记录
          outputs.forEach(out => this.addToHistory(prompt, out));

          // 同步插入到聊天（系统消息）
          try {
            if (typeof addTheaterMessage === 'function' && outputs.length > 0) {
              for (let i = 0; i < outputs.length; i++) {
                await addTheaterMessage(outputs[i].trim());
              }
            }
          } catch (insertErr) {
            console.warn('[Theater Module] 插入聊天失败（已忽略）：', insertErr);
          }

          console.log('[Theater Module] 后台生成任务完成');

          // 更新按钮状态
          this.updateGenerationProgress();

          // 清除后台任务
          setTimeout(() => {
            this.backgroundGenerationTask = null;
            this.updateGenerationProgress(); // 再次更新确保按钮恢复正常
          }, 5000);

        } catch (error) {
          console.error('[Theater Module] 后台生成失败:', error);
          const errorMessage = '生成失败: ' + error.message;

          // 显示错误通知
          this.showBrowserNotification(errorMessage, '小剧场生成失败');

          // 标记后台任务失败
          if (this.backgroundGenerationTask) {
            this.backgroundGenerationTask.status = 'failed';
            this.backgroundGenerationTask.error = error.message;
          }
        }
      }

      // 清理HTML内容，保留所有美化样式但不影响全局
      cleanHTMLContent(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string') return '';
        
        // 移除完整的HTML文档标签，但保留所有样式相关标签
        let cleaned = htmlContent
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<meta[^>]*>/gi, '')
          .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
          .replace(/<link[^>]*>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        
        // 保留所有style标签，只移除可能影响全局的样式
        cleaned = cleaned.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleContent) => {
          // 只移除可能影响全局布局的样式，保留所有美化样式
          const filteredStyle = styleContent
            .replace(/body\s*\{[^}]*\}/gi, '')
            .replace(/html\s*\{[^}]*\}/gi, '')
            .replace(/margin\s*:\s*0\s*!important/gi, '')
            .replace(/padding\s*:\s*0\s*!important/gi, '')
            .replace(/position\s*:\s*fixed/gi, 'position: relative')
            .replace(/z-index\s*:\s*\d+/gi, 'z-index: 1');
          return `<style>${filteredStyle}</style>`;
        });
        
        // 确保样式被正确应用，添加样式隔离
        if (cleaned.includes('<style>') || cleaned.includes('style=')) {
          // 如果包含样式，确保样式被正确应用
          console.log('[Theater Module] 检测到样式内容，确保样式正确应用');
        }
        
        // 清理多余的空白字符
        cleaned = cleaned.trim();
        
        return cleaned;
      }

      // 将CSS内容作用域到指定容器类，避免影响全局
      scopeCSS(cssText, scopeClass) {
        try {
          if (!cssText || !scopeClass) return cssText || '';
          const scoped = [];
          // 简单的规则拆分：按 '}' 分块再还原
          const blocks = cssText.split('}');
          for (let raw of blocks) {
            raw = raw.trim();
            if (!raw) continue;
            const parts = raw.split('{');
            if (parts.length < 2) continue;
            const selectorPart = parts[0].trim();
            const bodyPart = parts.slice(1).join('{').trim();

            // 跳过或保留@规则（如 @keyframes, @font-face 等）
            if (selectorPart.startsWith('@')) {
              scoped.push(selectorPart + ' {' + bodyPart + '}');
              continue;
            }

            // 处理多个选择器
            const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean).map(sel => {
              // 将全局 body/html 选择器替换为作用域容器
              if (sel === 'body' || sel.startsWith('body ')) sel = sel.replace(/^body\b/, '.' + scopeClass);
              if (sel === 'html' || sel.startsWith('html ')) sel = sel.replace(/^html\b/, '.' + scopeClass);
              // 将 :root 转为容器本身
              if (sel === ':root' || sel.startsWith(':root')) sel = sel.replace(/^:root\b/, '.' + scopeClass);
              // 已经包含作用域类则不再重复添加
              if (sel.startsWith('.' + scopeClass)) return sel;
              return '.' + scopeClass + ' ' + sel;
            });

            scoped.push(selectors.join(', ') + ' {' + bodyPart + '}');
          }
          return scoped.join('\n');
        } catch (_) {
          return cssText;
        }
      }

      // 对HTML中的<style>内容进行作用域处理，并返回包裹后的HTML
      applyScopeToHTML(htmlContent, scopeClass) {
        if (!htmlContent || !scopeClass) return { html: htmlContent };
        try {
          const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
          let match;
          let output = '';
          let lastIndex = 0;
          while ((match = styleRegex.exec(htmlContent)) !== null) {
            output += htmlContent.slice(lastIndex, match.index);
            const fullTag = match[0];
            const cssInside = match[1] || '';
            const scopedCSS = this.scopeCSS(cssInside, scopeClass);
            output += fullTag.replace(cssInside, scopedCSS);
            lastIndex = match.index + fullTag.length;
          }
          output += htmlContent.slice(lastIndex);
          // 包裹一层作用域容器
          const wrapped = `<div class="${scopeClass}">` + output + `</div>`;
          return { html: wrapped };
        } catch (_) {
          return { html: `<div class="${scopeClass}">` + htmlContent + `</div>` };
        }
      }

      // 渲染多预览容器并应用分页显示
      renderPreviews(outputs) {
        const container = document.getElementById('theater-previews');
        const indicator = document.getElementById('theater-page-indicator');
        const total = Math.min(4, Math.max(1, this.settings.theaterCount || 1));
        if (!container) return;
        
        // ✅ 不清空容器，只更新内容，保留已有样式
        for (let i = 0; i < total; i++) {
          let div = document.getElementById(`theater-html-preview-${i}`);
          if (!div) {
            // 如果不存在，创建新的预览容器
            div = document.createElement('div');
            div.id = `theater-html-preview-${i}`;
            div.className = 'preview-container';
            div.style.cssText = 'border:1px solid #ddd;border-radius:8px;min-height:400px;max-height:70vh;overflow:auto;padding:12px;background:#fafafa;position:relative;display:none;';
            container.appendChild(div);
          }
          
        // ✅ 清理HTML内容
        const cleanedOutput = (outputs && outputs[i]) ? this.cleanHTMLContent(outputs[i]) : '';
        // ✅ 为每个预览生成独立作用域类并应用样式作用域
        const scopeClass = `tg-scope-${i}`;
        const scoped = this.applyScopeToHTML(cleanedOutput, scopeClass);
        div.innerHTML = scoped.html;
          
          // 设置图片跨域属性以避免CORS污染
          this.setImagesCrossOrigin(div);
          
          // ✅ 确保样式正确应用 - 强制重新计算样式
          setTimeout(() => {
            const previewElement = document.getElementById(`theater-html-preview-${i}`);
            if (previewElement) {
              // 强制重新计算样式
              previewElement.style.transform = 'translateZ(0)';
              previewElement.style.willChange = 'transform';
              // 触发重绘
              previewElement.offsetHeight;
              
              // 确保样式被正确应用
              const styleElements = previewElement.querySelectorAll('style');
              if (styleElements.length > 0) {
                console.log(`[Theater Module] 预览 ${i} 包含 ${styleElements.length} 个样式标签`);
                // 强制重新应用样式
                styleElements.forEach(styleEl => {
                  styleEl.textContent = styleEl.textContent;
                });
              }
              
              // ✅ 额外确保样式应用 - 重新设置innerHTML
              if (scoped && scoped.html && scoped.html.includes('<style')) {
                console.log(`[Theater Module] 预览 ${i} 包含样式，重新应用`);
                // 重新设置内容以确保样式生效
                const currentContent = previewElement.innerHTML;
                previewElement.innerHTML = '';
                setTimeout(() => {
                  previewElement.innerHTML = currentContent;
                }, 50);
              }
            }
          }, 100);
        }
        // 保证索引有效
        if (this.currentPreviewIndex >= total) this.currentPreviewIndex = total - 1;
        if (this.currentPreviewIndex < 0) this.currentPreviewIndex = 0;
        // 显示当前页
        this.updatePreviewVisibility();
        if (indicator) indicator.textContent = `${this.currentPreviewIndex + 1} / ${total}`;
      }

      updatePreviewVisibility() {
        const total = Math.min(4, Math.max(1, this.settings.theaterCount || 1));
        for (let i = 0; i < total; i++) {
          const el = document.getElementById(`theater-html-preview-${i}`);
          if (!el) continue;
          el.style.display = (i === this.currentPreviewIndex) ? 'block' : 'none';
        }
        const indicator = document.getElementById('theater-page-indicator');
        if (indicator) indicator.textContent = `${this.currentPreviewIndex + 1} / ${total}`;
      }

      gotoPrev() {
        const total = Math.min(4, Math.max(1, this.settings.theaterCount || 1));
        this.currentPreviewIndex = (this.currentPreviewIndex - 1 + total) % total;
        this.updatePreviewVisibility();
      }

      gotoNext() {
        const total = Math.min(4, Math.max(1, this.settings.theaterCount || 1));
        this.currentPreviewIndex = (this.currentPreviewIndex + 1) % total;
        this.updatePreviewVisibility();
      }

      getCurrentPreviewElement() {
        const el = document.getElementById(`theater-html-preview-${this.currentPreviewIndex}`);
        return el || null;
      }

      savePrompt() {
        const prompt = document.getElementById('theater-prompt').value;
        if (!prompt.trim()) {
          this.showNotification('请输入要保存的提示词', 'warning');
          return;
        }

        // 弹出输入预设名的对话框
        const presetName = window.prompt('请输入预设名称：', '');
        if (!presetName || !presetName.trim()) {
          this.showNotification('预设名称不能为空', 'warning');
          return;
        }

        const customPresets = this.loadCustomPresets();
        
        // 检查是否已存在同名预设
        const existingIndex = customPresets.findIndex(preset => preset.name === presetName.trim());
        
        const newPreset = {
          name: presetName.trim(),
          content: prompt.trim(),
          timestamp: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          // 更新现有预设
          customPresets[existingIndex] = newPreset;
          this.showNotification('预设已更新', 'success');
        } else {
          // 添加新预设
          customPresets.push(newPreset);
          this.showNotification('预设已保存', 'success');
        }

        this.saveCustomPresets(customPresets);
        
        // 刷新界面
        this.refreshPresetSelect();
      }


      deletePreset() {
        const presetSelect = document.getElementById('theater-preset');
        const selectedValue = presetSelect.value;
        
        if (!selectedValue) {
          this.showNotification('请选择要删除的预设', 'warning');
          return;
        }

        // 检查是否是内置预设
        const builtinPresets = [
          '题材不限，发挥想象力，从例如平行世界、校园风、古风、玄幻、欧美贵族等各大热门题材中选择一个，创造对应的可直接渲染的美化小剧场，鼓励增加趣味互动性的点击功能，不输出html等html头部格式'
        ];

        if (builtinPresets.includes(selectedValue)) {
          this.showNotification('内置预设无法删除', 'warning');
          return;
        }

        // 确认删除
        if (!confirm('确定要删除这个预设吗？')) {
          return;
        }

        const customPresets = this.loadCustomPresets();
        const filteredPresets = customPresets.filter(preset => preset.content !== selectedValue);
        
        if (filteredPresets.length < customPresets.length) {
          this.saveCustomPresets(filteredPresets);
          this.showNotification('预设已删除', 'success');
          
          // 清空选择
          presetSelect.value = '';
          
          // 刷新界面
          this.refreshPresetSelect();
        } else {
          this.showNotification('未找到要删除的预设', 'warning');
        }
      }
      refreshPresetSelect() {
        // 直接更新预设选择框，不重新加载整个界面
        const presetSelect = document.getElementById('theater-preset');
        if (presetSelect) {
          const customPresets = this.loadCustomPresets();
          const customPresetOptions = customPresets.map(preset => 
            `<option value="${preset.content}">${preset.name}</option>`
          ).join('');
          
          // 保存当前选中的值
          const currentValue = presetSelect.value;
          
          // 更新选择框内容
          presetSelect.innerHTML = `
            <option value="">🎨 自定义</option>
            <option value="题材不限，发挥想象力，从例如平行世界、校园风、古风、玄幻、欧美贵族等各大热门题材中选择一个，创造对应的可直接渲染的美化小剧场，鼓励增加趣味互动性的点击功能，不输出html等html头部格式">小火默认小剧场预设</option>
            ${customPresetOptions}
          `;
          
          // 恢复之前选中的值（如果还存在）
          if (currentValue && presetSelect.querySelector(`option[value="${currentValue}"]`)) {
            presetSelect.value = currentValue;
          }
        }
      }

      showNotification(message, type = 'info') {
        if (window.showAPIStatus) {
          window.showAPIStatus(message, type);
        } else {
          console.log(`[Theater Module] ${type.toUpperCase()}: ${message}`);
        }
      }

      // 请求浏览器通知权限
      async requestNotificationPermission() {
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            try {
              const permission = await Notification.requestPermission();
              console.log('[Theater Module] 通知权限状态:', permission);
              return permission === 'granted';
            } catch (error) {
              console.warn('[Theater Module] 请求通知权限失败:', error);
              return false;
            }
          }
          return Notification.permission === 'granted';
        }
        console.warn('[Theater Module] 浏览器不支持通知API');
        return false;
      }

      // 显示浏览器通知
      showBrowserNotification(message, title = '小剧场生成器') {
        console.log('[Theater Module] 尝试显示通知:', title, message);
        
        // 首先尝试浏览器原生通知
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const notification = new Notification(title, {
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><text y="18" font-size="18">🎭</text></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><text y="18" font-size="18">🎭</text></svg>',
                tag: 'theater-generation',
                requireInteraction: true
              });

              // 点击通知时聚焦到窗口
              notification.onclick = function() {
                window.focus();
                notification.close();
              };

              // 5秒后自动关闭
              setTimeout(() => {
                notification.close();
              }, 5000);

              console.log('[Theater Module] 浏览器通知已发送');
              return notification;
            } catch (error) {
              console.error('[Theater Module] 创建浏览器通知失败:', error);
            }
          } else {
            console.warn('[Theater Module] 通知权限未授予，当前状态:', Notification.permission);
          }
        } else {
          console.warn('[Theater Module] 浏览器不支持通知API');
        }

        // 降级到页面内通知
        console.log('[Theater Module] 使用页面内通知');
        this.showNotification(message, 'success');
        
        return null;
      }

      // 更新生成进度显示
      updateGenerationProgress() {
        const generateBtn = document.getElementById('generate-theater');
        if (!generateBtn) return;

        // 检查是否有正在进行的生成任务
        if (this.backgroundGenerationTask && this.backgroundGenerationTask.status === 'running') {
          const task = this.backgroundGenerationTask;
          const progress = task.progress || 0;
          const total = task.total || 1;
          const percentage = Math.round((progress / total) * 100);
          
          // 更新按钮显示
          generateBtn.textContent = `生成中... ${progress}/${total} (${percentage}%)`;
          generateBtn.disabled = true;
          
          console.log('[Theater Module] 恢复生成进度显示:', progress, '/', total);
        } else {
          // 没有正在进行的任务，恢复正常状态
          generateBtn.textContent = '🎭 生成小剧场';
          generateBtn.disabled = false;
        }
      }


      // 获取聊天历史
      getChatHistory() {
        try {
          const limit = Number.isFinite(this.threshold) ? Math.max(1, this.threshold) : 10;
          let items = [];

          if (window.TavernHelper && window.TavernHelper.getChatMessages) {
            const all = window.TavernHelper.getChatMessages('0-{{lastMessageId}}') || [];
            items = all.map(msg => ({ name: msg.name, text: msg.message }));
          } else if (window.getLastMessageId) {
            const lastId = window.getLastMessageId();
            for (let i = 0; i <= lastId; i++) {
              const messageEl = document.getElementById(`mes_${i}`);
              if (!messageEl) continue;
              const nameEl = messageEl.querySelector('.name');
              const contentEl = messageEl.querySelector('.mes');
              if (nameEl && contentEl) {
                items.push({ name: nameEl.textContent, text: contentEl.textContent });
              }
            }
          } else if (typeof window !== 'undefined' && window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
            const ctx = window.SillyTavern.getContext();
            const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
            items = chat.map(m => ({ name: m.name || (m.is_user ? '用户' : '角色'), text: (m.mes || '').toString() }));
          }

          const sliced = items.slice(-limit);
          return sliced.map(it => `${it.name}: ${it.text}`).join('\n');
        } catch (error) {
          console.warn('[Theater Module] 获取聊天历史失败:', error);
          return '';
        }
      }

      // 构建小剧场提示词
      buildTheaterPrompt(userPrompt, chatHistory) {
        const minWords = this.settings.minWords || 500;
        const maxWords = this.settings.maxWords || 7000;
        
        const systemPrompt = `你是一个小剧场生成创作者，运用HTML 或内联 CSS 来美化和排版小剧场的内容。

硬性要求：
1) 让输出具有视觉吸引力、易于阅读，并能增强叙事或评论的氛围。；
2) 你以自由选择最适合当前小剧场内容和风格的格式，尝试多样化的美化方式。
3) 鼓励根据小剧场的具体情节或情绪，使用不同的字体效果（粗体、斜体）、颜色、背景、边框、列表或区块划分等，来模仿电影字幕、剧本分镜、论坛评论或报告摘要等效果。
6) 字数最少${minWords}，最多不超过${maxWords}字（不含代码部分）。
7) 当用户提示词里明确提到nsfw向的词语时，你不会回避nsfw向内容的生成，器官词汇拒绝隐晦，但需要注意不要太过粗俗，可以用一些女性向的词汇。


聊天历史（严格依此取材）：
${chatHistory}

用户提示：${userPrompt}

只返回最终 HTML 代码，不要附加解释或反引号围栏。`;
        
        return systemPrompt;
      }

      // 生成HTML格式的小剧场（无任何预设结构，仅最小包裹）
      generateHTMLTheater(content) {
        // 若已是HTML，直接返回，不添加任何额外结构
        if (/<[a-z][\s\S]*>/i.test(content)) return content;

        const lines = content.split('\n').filter(line => line.trim());
        // 仅用 <div> 包裹行，保持最小化
        return lines.map(line => {
          if (/[：:]/.test(line)) {
            const [speaker, ...rest] = line.split(/[：:]/);
            const dialogue = rest.join(':').trim();
            return `<div>${speaker.trim()}：${dialogue}</div>`;
          }
          return `<div>${line}</div>`;
        }).join('');
      }

      // 本地小剧场生成器：根据聊天历史提取角色与语气，产出简短剧本
      generateLocalTheater(userPrompt, chatHistory) {
        try {
          const lines = (chatHistory || '').split('\n').filter(Boolean).slice(-8);
          const speakers = Array.from(new Set(lines
            .map(l => l.split(/[:：]/)[0]?.trim())
            .filter(Boolean)))
            .slice(0, 3);

          const cast = speakers.length > 0 ? speakers : ['甲', '乙', '丙'];
          const topic = (userPrompt || '围绕当前话题展开');

          const sampleExchanges = [
            `这是默认的文字`,
            `这是默认的文字`,
            `这是默认的文字`,
            `这是默认的文字`
          ];

          const preface = '看起来还没有小剧场呢';
          const stage = '生成一个吧';

          return [preface, stage, ...sampleExchanges].join('\n');
        } catch (_) {
          return '~~~~';
        }
      }

      // 显示截图按钮 - 现在按钮始终显示
      showScreenshotButton() {
        // 截图按钮现在始终显示，不需要特殊处理
      }

      // 为预览中的图片设置 crossOrigin 以避免 CORS 污染画布
      setImagesCrossOrigin(root) {
        try {
          const images = root.querySelectorAll('img');
          images.forEach(img => {
            try {
              const url = new URL(img.getAttribute('src') || '', window.location.href);
              if (url.origin && url.origin !== window.location.origin) {
                if (img.crossOrigin !== 'anonymous') {
                  img.crossOrigin = 'anonymous';
                  const src = img.getAttribute('src');
                  img.src = src;
                }
              }
            } catch (_) {}
          });
        } catch (e) {
          console.warn('[Theater Module] 设置图片跨域属性失败（已忽略）:', e);
        }
      }

      // 等待容器内图片和字体加载完成
      async waitForAssets(root, timeoutMs = 15000) {
        const start = Date.now();
        const imgPromises = Array.from(root.querySelectorAll('img'))
          .filter(img => !(img.complete && img.naturalWidth > 0))
          .map(img => new Promise(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, Math.max(1000, timeoutMs / 2));
          }));

        const fontPromise = (document.fonts && document.fonts.ready)
          ? Promise.race([
              document.fonts.ready.catch(() => {}),
              new Promise(r => setTimeout(r, timeoutMs / 2)),
            ])
          : Promise.resolve();

        await Promise.race([
          Promise.allSettled([...imgPromises, fontPromise]),
          new Promise(r => setTimeout(r, Math.max(1500, timeoutMs - (Date.now() - start))))
        ]);
      }

      // 截图功能
      takeScreenshot() {
        try {
          const preview = document.getElementById('theater-html-preview');
          if (!preview) {
            this.showNotification('预览区域不存在', 'error');
            return;
          }

          // 检测是否为移动端
          const isMobile = window.innerWidth <= 768;
          console.log('[Theater Module] 截图环境检测:', {
            isMobile,
            devicePixelRatio: window.devicePixelRatio,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            previewScrollWidth: preview.scrollWidth,
            previewScrollHeight: preview.scrollHeight,
            previewClientWidth: preview.clientWidth,
            previewClientHeight: preview.clientHeight
          });

          // 确保按需加载 html2canvas
          const ensureHtml2canvas = () => new Promise((resolve, reject) => {
            if (window.html2canvas) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('html2canvas 加载失败'));
            document.head.appendChild(s);
          });

          ensureHtml2canvas()
            .then(() => {
              // 预处理跨域图片
              this.setImagesCrossOrigin(preview);
              
              // 移动端特殊处理：确保元素完全渲染
              if (isMobile) {
                // 强制重新计算样式
                preview.style.transform = 'translateZ(0)';
                preview.style.willChange = 'transform';
                // 等待一帧确保渲染完成
                return new Promise(resolve => {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                  });
                });
              }
            })
            .then(() => {
              // 移动端使用特殊处理
              if (isMobile) {
                const { tempContainer, clone } = this.prepareMobileElementForScreenshot(preview);
                const width = Math.max(clone.scrollWidth, clone.clientWidth, clone.offsetWidth);
                const height = Math.max(clone.scrollHeight, clone.clientHeight, clone.offsetHeight);
                
                console.log('[Theater Module] 移动端元素尺寸:', { width, height });
                
                return this.waitForAssets(clone).then(() => ({ 
                  cloneWrapper: tempContainer, 
                  clone, 
                  width, 
                  height,
                  isMobile: true 
                }));
              } else {
                // 桌面端使用原有逻辑
                const cloneWrapper = document.createElement('div');
                cloneWrapper.style.cssText = 'position:fixed;left:-100000px;top:0;background:#ffffff;z-index:-1;';
                const clone = preview.cloneNode(true);
                
                const width = Math.max(preview.scrollWidth, preview.clientWidth, preview.offsetWidth);
                const height = Math.max(preview.scrollHeight, preview.clientHeight, preview.offsetHeight);
                
                console.log('[Theater Module] 桌面端元素尺寸:', { width, height });
                
                clone.style.width = width + 'px';
                clone.style.height = height + 'px';
                clone.style.overflow = 'visible';
                cloneWrapper.appendChild(clone);
                document.body.appendChild(cloneWrapper);
                
                return this.waitForAssets(clone).then(() => ({ 
                  cloneWrapper, 
                  clone, 
                  width, 
                  height,
                  isMobile: false 
                }));
              }
            })
            .then(({ cloneWrapper, clone, width, height }) => {
              // 移动端使用更保守的缩放设置
              const scale = isMobile ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) : Math.max(1.5, Math.min(2, window.devicePixelRatio || 1));
              const safeW = Math.max(1, width || clone.scrollWidth || clone.clientWidth || 1);
              const safeH = Math.max(1, height || clone.scrollHeight || clone.clientHeight || 1);
              
              console.log('[Theater Module] Canvas配置:', { scale, safeW, safeH, isMobile });
              
              // 移动端特殊配置
              const canvasOptions = {
                backgroundColor: '#ffffff',
                scale,
                width: safeW,
                height: safeH,
                useCORS: true,
                allowTaint: false,
                imageTimeout: isMobile ? 20000 : 15000, // 减少超时时间提高速度
                foreignObjectRendering: false,
                logging: false, // 关闭日志提高速度
                scrollX: 0,
                scrollY: 0,
                windowWidth: safeW,
                windowHeight: safeH,
              };
              
              // 移动端额外配置
              if (isMobile) {
                canvasOptions.ignoreElements = (element) => {
                  // 忽略可能影响渲染的元素
                  return element.tagName === 'SCRIPT' || 
                         element.tagName === 'STYLE' ||
                         element.classList.contains('tg-fullscreen-overlay') ||
                         element.classList.contains('tg-fullscreen-wrapper');
                };
                canvasOptions.onclone = (clonedDoc) => {
                  // 确保克隆文档中的样式正确
                  const clonedPreview = clonedDoc.getElementById('theater-html-preview');
                  if (clonedPreview) {
                    clonedPreview.style.position = 'static';
                    clonedPreview.style.transform = 'none';
                    clonedPreview.style.willChange = 'auto';
                  }
                };
              }
              
              return window.html2canvas(clone, canvasOptions).finally(() => {
                // 清理临时元素
                if (isMobile) {
                  this.cleanupMobileScreenshotElements(cloneWrapper);
                } else {
                  try { document.body.removeChild(cloneWrapper); } catch (_) {}
                }
              });
            })
            .then(canvas => {
              console.log('[Theater Module] Canvas生成完成:', {
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                isMobile
              });
              
              // 检查Canvas是否为空
              if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('生成的Canvas尺寸为0，可能是移动端渲染问题');
              }
              
              // 移动端使用更保守的输出缩放
              const outputScale = isMobile ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) : Math.max(1.5, Math.min(2, window.devicePixelRatio || 1));
              const out = document.createElement('canvas');
              out.width = canvas.width * outputScale;
              out.height = canvas.height * outputScale;
              const ctx = out.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, out.width, out.height);
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'medium'; // 降低质量提高速度
              ctx.drawImage(canvas, 0, 0, out.width, out.height);

              // 简单去除底部空白
              const trimBottomWhitespace = (sourceCanvas, threshold = 250) => {
                try {
                  const w = sourceCanvas.width;
                  const h = sourceCanvas.height;
                  const ctx2 = sourceCanvas.getContext('2d');
                  const data = ctx2.getImageData(0, 0, w, h).data;
                  let bottom = h - 1;

                  const isWhite = (idx) => {
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
                    if (a === 0) return true; // 全透明视为空白
                    return r >= threshold && g >= threshold && b >= threshold;
                  };

                  // 从底部向上找非空白行
                  outerBottom: for (; bottom >= 0; bottom--) {
                    for (let x = 0; x < w; x++) {
                      const i = (bottom * w + x) * 4;
                      if (!isWhite(i)) break outerBottom;
                    }
                  }

                  const cropH = Math.max(1, bottom + 1);
                  if (cropH === h) return sourceCanvas; // 无需裁剪

                  const c = document.createElement('canvas');
                  c.width = w;
                  c.height = cropH;
                  c.getContext('2d').drawImage(sourceCanvas, 0, 0, w, cropH, 0, 0, w, cropH);
                  return c;
                } catch (_) {
                  return sourceCanvas;
                }
              };

              const trimmed = trimBottomWhitespace(out, 248);

              const link = document.createElement('a');
              const pad = (n) => String(n).padStart(2, '0');
              const d = new Date();
              const filename = `小剧场_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`;
              trimmed.toBlob((blob) => {
                if (!blob) return this.showNotification('生成图片失败', 'error');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 0);
                this.showNotification('截图已保存', 'success');
              }, 'image/png', 0.8); // 降低质量提高速度
            })
            .catch(error => {
              const msg = (error && (error.message || error.type)) ? `${error.message || error.type}` : String(error);
              console.error('[Theater Module] 截图失败:', error);
              this.showNotification('截图失败: ' + msg, 'error');
            });
        } catch (error) {
          console.error('[Theater Module] 截图失败:', error);
          const msg = (error && (error.message || error.type)) ? `${error.message || error.type}` : String(error);
          this.showNotification('截图失败: ' + msg, 'error');
        }
      }

      // 打开全屏（通过按钮触发），提供关闭按钮
      openFullscreen(element) {
        if (!element) return;

        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'tg-fullscreen-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:transparent;display:flex;align-items:center;justify-content:center;';
        // 移动端全屏下移约100px
        if (window.innerWidth <= 768) {
          overlay.style.alignItems = 'flex-start';
          overlay.style.paddingTop = '50px';
        }

        // 包裹内容容器
        const wrapper = document.createElement('div');
        wrapper.className = 'tg-fullscreen-wrapper';
        wrapper.style.cssText = 'position:relative;width:90vw;height:85vh;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.35);overflow:auto;padding:12px;';

        // 关闭按钮（20px，半透明）
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tg-fullscreen-close';
        closeBtn.title = '关闭全屏';
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;width:20px;height:20px;border:none;border-radius:10px;background:rgba(0,0,0,0.4);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:20px;';

        // 克隆预览内容
        const clone = document.createElement('div');
        clone.className = 'tg-fullscreen-content';
        clone.innerHTML = element.innerHTML;
        clone.style.cssText = 'width:100%;height:100%;overflow:auto;background:#fafafa;border-radius:6px;';

        // 组装
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(clone);
        overlay.appendChild(wrapper);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // 关闭逻辑（仅按钮关闭）
        closeBtn.addEventListener('click', () => {
          try { document.body.removeChild(overlay); } catch (_) {}
          document.body.style.overflow = 'auto';
          this.showNotification('已退出全屏', 'info');
        });

        // 移动端高度修复（按 85% 视口高度，顶部偏移 50px）
        if (window.innerWidth <= 768) {
          try { wrapper.dataset.vhScale = '85'; wrapper.dataset.vhOffsetPx = '50'; } catch(_) {}
        } else {
          try { delete wrapper.dataset.vhScale; delete wrapper.dataset.vhOffsetPx; } catch(_) {}
        }
        this.fixMobileViewport(wrapper);
      }

      // 修复移动端视口高度问题（支持自定义比例与偏移）
      fixMobileViewport(element) {
        if (window.innerWidth <= 768) {
          const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            element.style.setProperty('--vh', `${vh}px`);
            const scaleStr = (element.dataset && element.dataset.vhScale) ? element.dataset.vhScale : '100';
            const offsetStr = (element.dataset && element.dataset.vhOffsetPx) ? element.dataset.vhOffsetPx : '0';
            const scale = Number(isNaN(Number(scaleStr)) ? 100 : Number(scaleStr));
            const offsetPx = Number(isNaN(Number(offsetStr)) ? 0 : Number(offsetStr));
            element.style.height = `calc((var(--vh, 1vh) * ${scale}) - ${offsetPx}px)`;
          };

          setViewportHeight();
          window.addEventListener('resize', setViewportHeight);
          window.addEventListener('orientationchange', setViewportHeight);

          // 清理事件监听器
          element.addEventListener('click', () => {
            window.removeEventListener('resize', setViewportHeight);
            window.removeEventListener('orientationchange', setViewportHeight);
          }, { once: true });
        }
      }

      // 移动端截图辅助函数
      prepareMobileElementForScreenshot(element) {
        if (!element || window.innerWidth > 768) return element;
        
        // 创建临时容器来确保元素正确渲染
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
          width: ${window.innerWidth}px;
          height: auto;
          background: #ffffff;
          z-index: -1;
          overflow: visible;
        `;
        
        // 克隆元素
        const clone = element.cloneNode(true);
        
        // 重置所有可能影响渲染的样式
        clone.style.cssText = `
          position: static !important;
          transform: none !important;
          will-change: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow: visible !important;
          display: block !important;
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        `;
        
        // 移除可能影响渲染的类
        clone.classList.remove('fullscreen', 'tg-fullscreen-overlay', 'tg-fullscreen-wrapper');
        
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);
        
        // 强制重新计算布局
        clone.offsetHeight;
        
        return { tempContainer, clone };
      }

      // 清理移动端截图辅助元素
      cleanupMobileScreenshotElements(tempContainer) {
        if (tempContainer && tempContainer.parentNode) {
          try {
            document.body.removeChild(tempContainer);
          } catch (e) {
            console.warn('[Theater Module] 清理临时元素失败:', e);
          }
        }
      }

      // 更新阈值显示
      updateThresholdDisplay() {
        const display = document.querySelector('.tg-threshold-display');
        if (display) {
          display.textContent = `${this.threshold} 层`;
        }
      }


      // 添加到历史记录
      addToHistory(prompt, content) {
        this.history.unshift({
          prompt: prompt,
          content: content,
          timestamp: new Date().toISOString(),
          style: this.settings.theaterStyle,
          characterCount: this.settings.characterCount,
        });

        // 限制历史记录数量
        if (this.history.length > 50) {
          this.history = this.history.slice(0, 50);
        }

        this.saveHistory();
      }

      // 显示页面内通知
      showNotification(message, type = 'info') {
        console.log(`[Theater Module] ${type.toUpperCase()}: ${message}`);
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          padding: 12px 20px;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          max-width: 300px;
          word-wrap: break-word;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateX(100%);
          transition: transform 0.3s ease;
        `;
        
        // 根据类型设置颜色
        switch (type) {
          case 'success':
            notification.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            break;
          case 'error':
            notification.style.background = 'linear-gradient(135deg, #dc3545, #e74c3c)';
            break;
          case 'warning':
            notification.style.background = 'linear-gradient(135deg, #ffc107, #fd7e14)';
            break;
          case 'info':
          default:
            notification.style.background = 'linear-gradient(135deg, #17a2b8, #6f42c1)';
            break;
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
          notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
          notification.style.transform = 'translateX(100%)';
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }, 3000);
      }
    }

    // ========================================
    // 💬 内嵌模块代码区域 - ChatModule
    // ========================================
    // 聊天模块 - AI聊天功能
    // 提供与AI角色"小火"的对话功能
    
    class ChatModule {
      constructor() {
        this.settings = this.loadSettings();
        this.history = this.loadHistory();
        this.apiConfig = this.loadAPIConfig();
        this.currentMessageCount = 0;
        this.isGenerating = false;
        this.isBackgroundGenerating = false;
        this.backgroundGenerationId = null;
        this.threshold = 10; // 默认消息阈值
        this.init();
      }

      init() {
        console.log('[Chat Module] 聊天模块初始化');
        this.updateMessageCount();
        
        // ✅ 在初始化时请求浏览器通知权限
        if ('Notification' in window && Notification.permission === 'default') {
          console.log('[小火聊天] 请求浏览器通知权限...');
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              console.log('[小火聊天] 浏览器通知权限已获取 ✓');
            } else {
              console.log('[小火聊天] 用户拒绝了浏览器通知权限');
            }
          });
        }
      }

      updateMessageCount() {
        // 聊天模块不需要消息计数功能，这里只是占位方法
        console.log('[Chat Module] 消息计数更新');
      }

      loadSettings() {
        const defaultSettings = {
          chatName: '小火聊聊天',
          headerColor: '#ff6b6b',
          avatar: '🔥',
          userAvatar: '🔥', // 用户头像，独立于AI头像
          characterPrompt: `你是一个名叫小火的小女孩，作为user的好闺蜜为user出谋划策，你会跟user吐槽剧情的发展、以及评价出现的人物，或者给user好建议，跟user聊天。作为全知全能的小火，你也能帮user做一切你能做的事。
输出的格式为不超过10条的聊天对话，可以在对话里输出小卡片一般的美化代码，比如提醒事项、便利贴之类的，这不是必须的，看需要。生成聊天内美化代码时，直接输出可渲染的内容，不要使用代码块标记。

每条对话的字数一般不超过50字，特殊情况可长一些，最长不超过500字。要记住这是在聊天，而不是写文章，严格按照内容1|内容2|内容3|...格式回复。

另外小火你不会避免nsfw内容的输出，但是措辞尽量女性化一些。`,
          maxMessages: 10,
          enableEmoji: true,
          chatStyle: 'modern',
          // ✅ 添加存储配置
          storageConfig: {
            maxMessages: 100,         // 最大消息数量（默认100）
            maxDays: 7,               // 最大保存天数（默认7天）
            autoClean: true,          // 是否自动清理
            // 清理阈值：与API设置联动（存在则覆盖），否则退回10，在init时二次同步
            cleanThreshold: 10,
            keepRecent: 50,           // 保留最近消息数量（默认50）
            enableCompression: true   // 是否启用压缩存储
          },
          presets: [
            {
              id: 'default',
              name: '小火',
              prompt: `你是一个名叫小火的小女孩，作为user的好闺蜜为user出谋划策，你会跟user吐槽剧情的发展、以及评价出现的人物，或者给user好建议，跟user聊天。作为全知全能的小火，你也能帮user做一切你能做的事。

输出的格式为不超过10条的聊天对话，可以在对话里输出小卡片一般的美化代码，比如提醒事项、便利贴之类的，这不是必须的，看需要。生成聊天内美化代码时，直接输出可渲染的内容，不要使用代码块标记。

每条对话的字数一般不超过50字，特殊情况可长一些，最长不超过500字。要记住这是在聊天，而不是写文章，严格按照内容1|内容2|内容3|...格式回复。

另外小火你不会避免nsfw内容的输出，但是措辞尽量女性化一些。`,
              avatar: '🔥',
              headerColor: '#ff6b6b',
              isDefault: true
            }
          ]
        };

        try {
          const saved = localStorage.getItem('chat_module_settings');
          return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
          console.warn('[Chat Module] 设置加载失败，使用默认设置:', error);
          return defaultSettings;
        }
      }

      saveSettings() {
        try {
          localStorage.setItem('chat_module_settings', JSON.stringify(this.settings));
          console.log('[Chat Module] 设置已保存');
        } catch (error) {
          console.error('[Chat Module] 设置保存失败:', error);
        }
      }

      loadHistory() {
        try {
          const saved = localStorage.getItem('chat_module_history');
          if (saved) {
            this.history = JSON.parse(saved);
            console.log('[Chat Module] 聊天记录已加载:', this.history.length, '条消息');
            
            // ✅ 自动清理：检查是否需要清理旧记录
            this.autoCleanHistory();
            
            return this.history;
          }
        } catch (error) {
          console.warn('[Chat Module] 加载聊天记录失败:', error);
        }
        return [];
      }

      // 保存聊天历史
      saveHistory() {
        try {
          // ✅ 自动清理：在保存前检查是否需要清理
          this.autoCleanHistory();
          
          localStorage.setItem('chat_module_history', JSON.stringify(this.history));
          console.log('[Chat Module] 聊天记录已保存');
        } catch (error) {
          console.warn('[Chat Module] 保存聊天记录失败:', error);
        }
      }

      // ✅ 自动清理聊天记录
      autoCleanHistory() {
        if (!this.settings.storageConfig || !this.settings.storageConfig.autoClean) {
          return;
        }

        const config = this.settings.storageConfig;
        const currentCount = this.history.length;
        
        // 检查是否需要清理
        if (currentCount < config.cleanThreshold) {
          return;
        }

        console.log(`[小火聊天] 开始自动清理聊天记录 (当前: ${currentCount} 条)`);
        
        let cleanedCount = 0;
        const now = Date.now();
        const maxAge = config.maxDays * 24 * 60 * 60 * 1000; // 转换为毫秒
        
        // 1. 按时间清理：删除超过指定天数的消息
        if (config.maxDays > 0) {
          const beforeTime = now - maxAge;
          const originalLength = this.history.length;
          
          this.history = this.history.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime > beforeTime;
          });
          
          const timeCleaned = originalLength - this.history.length;
          if (timeCleaned > 0) {
            console.log(`[小火聊天] 时间清理: 删除了 ${timeCleaned} 条超过 ${config.maxDays} 天的消息`);
            cleanedCount += timeCleaned;
          }
        }
        
        // 2. 按数量清理：如果仍然超过最大数量，保留最新的消息
        if (this.history.length > config.maxMessages) {
          const keepCount = Math.min(config.keepRecent, config.maxMessages);
          const toRemove = this.history.length - keepCount;
          
          // 按时间戳排序，保留最新的消息
          this.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          this.history = this.history.slice(0, keepCount);
          
          console.log(`[小火聊天] 数量清理: 删除了 ${toRemove} 条旧消息，保留最新 ${keepCount} 条`);
          cleanedCount += toRemove;
        }
        
        // 3. 压缩存储（如果启用）
        if (config.enableCompression && this.history.length > 0) {
          this.compressHistory();
        }
        
        if (cleanedCount > 0) {
          console.log(`[小火聊天] 自动清理完成: 删除了 ${cleanedCount} 条消息，当前剩余 ${this.history.length} 条`);
          this.showNotification(`自动清理了 ${cleanedCount} 条旧消息`, 'info');
        }
      }

      // ✅ 压缩聊天记录（减少存储空间）
      compressHistory() {
        if (this.history.length === 0) return;
        
        try {
          // 压缩长消息内容
          this.history.forEach(msg => {
            if (msg.content && msg.content.length > 500) {
              // 对于超长消息，只保留前500字符和最后100字符
              const content = msg.content;
              if (content.length > 600) {
                msg.content = content.substring(0, 500) + '...[已压缩]...' + content.substring(content.length - 100);
                msg.compressed = true;
              }
            }
          });
          
          console.log('[小火聊天] 聊天记录已压缩');
        } catch (error) {
          console.warn('[小火聊天] 压缩聊天记录失败:', error);
        }
      }

      // ✅ 获取存储统计信息
      getStorageStats() {
        const config = this.settings.storageConfig;
        const currentCount = this.history.length;
        const maxCount = config.maxMessages;
        const usagePercent = Math.round((currentCount / maxCount) * 100);
        
        // 计算存储大小
        const dataSize = JSON.stringify(this.history).length;
        const sizeKB = Math.round(dataSize / 1024);
        
        // 计算最旧和最新消息的时间
        let oldestTime = null;
        let newestTime = null;
        
        if (this.history.length > 0) {
          const timestamps = this.history.map(msg => new Date(msg.timestamp).getTime());
          oldestTime = new Date(Math.min(...timestamps));
          newestTime = new Date(Math.max(...timestamps));
        }
        
        return {
          currentCount,
          maxCount,
          usagePercent,
          sizeKB,
          oldestTime,
          newestTime,
          config
        };
      }

      // ✅ 手动清理聊天记录
      manualCleanHistory(options = {}) {
        const {
          keepRecent = 100,
          maxDays = 7,
          forceClean = false
        } = options;
        
        const originalCount = this.history.length;
        
        if (originalCount === 0) {
          this.showNotification('没有聊天记录需要清理', 'info');
          return;
        }
        
        console.log(`[小火聊天] 开始手动清理聊天记录 (当前: ${originalCount} 条)`);
        
        // 按时间清理
        if (maxDays > 0) {
          const now = Date.now();
          const maxAge = maxDays * 24 * 60 * 60 * 1000;
          const beforeTime = now - maxAge;
          
          this.history = this.history.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime > beforeTime;
          });
        }
        
        // 按数量保留
        if (this.history.length > keepRecent) {
          this.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          this.history = this.history.slice(0, keepRecent);
        }
        
        const cleanedCount = originalCount - this.history.length;
        
        if (cleanedCount > 0) {
          this.saveHistory();
          this.showNotification(`手动清理完成: 删除了 ${cleanedCount} 条消息，保留 ${this.history.length} 条`, 'success');
          console.log(`[小火聊天] 手动清理完成: 删除了 ${cleanedCount} 条消息`);
        } else {
          this.showNotification('没有需要清理的消息', 'info');
        }
      }

      // ✅ 显示存储管理界面
      showStorageManager() {
        const stats = this.getStorageStats();
        const config = this.settings.storageConfig;
        
        const modal = document.createElement('div');
        modal.className = 'tg-modal-overlay';
        modal.innerHTML = `
          <div class="tg-modal-content" style="max-width: 600px; max-height: 40vh; overflow-y: auto; margin-top: 10vh; scrollbar-width: none; -ms-overflow-style: none;">
            <div class="tg-modal-header">
              <h3>💾 存储管理</h3>
              <button class="tg-modal-close" onclick="this.closest('.tg-modal-overlay').remove()">&times;</button>
            </div>
            <div class="tg-modal-body" style="scrollbar-width: none; -ms-overflow-style: none;">
              <style>
                .tg-modal-content::-webkit-scrollbar,
                .tg-modal-body::-webkit-scrollbar {
                  display: none;
                }
              </style>
              <!-- 存储统计 -->
              <div class="storage-stats">
                <h4>📊 存储统计</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">当前消息数:</span>
                    <span class="stat-value">${stats.currentCount} / ${stats.maxCount}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">存储使用率:</span>
                    <span class="stat-value">${stats.usagePercent}%</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">存储大小:</span>
                    <span class="stat-value">${stats.sizeKB} KB</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">最旧消息:</span>
                    <span class="stat-value">${stats.oldestTime ? stats.oldestTime.toLocaleDateString() : '无'}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">最新消息:</span>
                    <span class="stat-value">${stats.newestTime ? stats.newestTime.toLocaleDateString() : '无'}</span>
                  </div>
                </div>
              </div>
              
              <!-- 存储配置 -->
              <div class="storage-config">
                <h4>⚙️ 存储配置</h4>
                <div class="config-grid">
                  <div class="config-item">
                    <label>最大消息数:</label>
                    <input type="number" id="max-messages" value="${config.maxMessages}" min="100" max="5000">
                  </div>
                  <div class="config-item">
                    <label>最大保存天数:</label>
                    <input type="number" id="max-days" value="${config.maxDays}" min="1" max="365">
                  </div>
                  <div class="config-item">
                    <label>清理阈值:</label>
                    <input type="number" id="clean-threshold" value="${config.cleanThreshold}" min="100" max="2000">
                  </div>
                  <div class="config-item">
                    <label>保留最近消息数:</label>
                    <input type="number" id="keep-recent" value="${config.keepRecent}" min="50" max="1000">
                  </div>
                  <div class="config-item">
                    <label>
                      <input type="checkbox" id="auto-clean" ${config.autoClean ? 'checked' : ''}>
                      自动清理
                    </label>
                  </div>
                  <div class="config-item">
                    <label>
                      <input type="checkbox" id="enable-compression" ${config.enableCompression ? 'checked' : ''}>
                      启用压缩
                    </label>
                  </div>
                </div>
              </div>
              
              <!-- 操作按钮 -->
              <div class="storage-actions">
                <h4>🔧 操作</h4>
                <div class="action-buttons">
                  <button id="save-config-btn" class="action-btn primary">保存配置</button>
                  <button id="manual-clean-btn" class="action-btn secondary">手动清理</button>
                  <button id="export-data-btn" class="action-btn secondary">导出数据</button>
                  <button id="import-data-btn" class="action-btn secondary">导入数据</button>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // ✅ 修复：将模态框添加到聊天容器内，而不是整个页面
        const chatContainer = document.querySelector('.tg-chat-module-container');
        if (chatContainer) {
          chatContainer.appendChild(modal);
        } else {
          document.body.appendChild(modal);
        }
        
        // 绑定事件
        this.bindStorageManagerEvents(modal);
      }

      // ✅ 绑定存储管理事件
      bindStorageManagerEvents(modal) {
        // 保存配置
        const saveBtn = modal.querySelector('#save-config-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            this.saveStorageConfig(modal);
          });
        }
        
        // 手动清理
        const cleanBtn = modal.querySelector('#manual-clean-btn');
        if (cleanBtn) {
          cleanBtn.addEventListener('click', () => {
            const keepRecent = parseInt(modal.querySelector('#keep-recent').value) || 100;
            const maxDays = parseInt(modal.querySelector('#max-days').value) || 7;
            this.manualCleanHistory({ keepRecent, maxDays });
            modal.remove();
          });
        }
        
        // 导出数据
        const exportBtn = modal.querySelector('#export-data-btn');
        if (exportBtn) {
          exportBtn.addEventListener('click', () => {
            this.exportChatData();
          });
        }
        
        // 导入数据
        const importBtn = modal.querySelector('#import-data-btn');
        if (importBtn) {
          importBtn.addEventListener('click', () => {
            this.importChatData();
          });
        }
      }

      // ✅ 保存存储配置
      saveStorageConfig(modal) {
        const config = {
          maxMessages: parseInt(modal.querySelector('#max-messages').value) || 1000,
          maxDays: parseInt(modal.querySelector('#max-days').value) || 30,
          cleanThreshold: parseInt(modal.querySelector('#clean-threshold').value) || 800,
          keepRecent: parseInt(modal.querySelector('#keep-recent').value) || 200,
          autoClean: modal.querySelector('#auto-clean').checked,
          enableCompression: modal.querySelector('#enable-compression').checked
        };
        
        this.settings.storageConfig = config;
        this.saveSettings();
        this.showNotification('存储配置已保存', 'success');
        modal.remove();
      }

      // ✅ 导出聊天数据
      exportChatData() {
        try {
          const data = {
            history: this.history,
            settings: this.settings,
            exportTime: new Date().toISOString(),
            version: '1.0'
          };
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `小火聊天记录_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          this.showNotification('聊天数据已导出', 'success');
        } catch (error) {
          console.error('[小火聊天] 导出数据失败:', error);
          this.showNotification('导出失败: ' + error.message, 'error');
        }
      }

      // ✅ 导入聊天数据
      importChatData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result);
              
              if (data.history && Array.isArray(data.history)) {
                this.history = data.history;
                this.saveHistory();
                this.showNotification(`成功导入 ${data.history.length} 条聊天记录`, 'success');
                
                // 刷新聊天显示
                this.updateChatDisplay();
              } else {
                this.showNotification('无效的聊天数据文件', 'error');
              }
            } catch (error) {
              console.error('[小火聊天] 导入数据失败:', error);
              this.showNotification('导入失败: ' + error.message, 'error');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      }


      loadAPIConfig() {
        const defaultAPIConfig = {
          enabled: false,
          provider: 'openai',
          apiUrl: '',
          apiKey: '',
          model: '',
          messageThreshold: 10, // 消息阈值
          temperature: 0.8,
          maxTokens: 30000,
          useProxy: false,
          proxyUrl: '',
          timeout: 60000,  // ✅ 修复: 增加到60秒
          retryCount: 2,    // ✅ 修复: 减少重试次数，但确保重试生效
          customHeaders: {},
          systemPrompt: '',
          streamEnabled: false
        };

        try {
          const saved = localStorage.getItem('theater_api_settings');
          const config = saved ? { ...defaultAPIConfig, ...JSON.parse(saved) } : defaultAPIConfig;
          this.threshold = config.messageThreshold || 10;
          
          // ✅ 修复: 根据模型类型动态调整超时
          if (config.model.includes('gpt-4') || config.model.includes('claude')) {
            config.timeout = Math.max(config.timeout, 90000); // 大模型至少90秒
          }
          
          return config;
        } catch (error) {
          console.warn('[Chat Module] API配置加载失败，使用默认配置:', error);
          this.threshold = 10;
          return defaultAPIConfig;
        }
      }

      // 检查API是否可用
      isAPIAvailable() {
        return this.apiConfig.enabled && this.apiConfig.apiUrl && this.apiConfig.model && this.apiConfig.apiKey;
      }

      // 调用API生成回复
      async callChatAPI(userMessage) {
        console.log('[小火聊天] 开始生成回复...');
        
        const chatHistory = this.getChatHistory();
        const fullPrompt = this.buildChatPrompt(userMessage, chatHistory);
        
        // ✅ 策略1: 优先使用最可靠的API
        const apiMethods = [];
        
        // 如果外部API配置完整，优先使用
        if (this.isAPIAvailable()) {
          apiMethods.push({
            name: '外部API',
            handler: () => this.callExternalAPI(fullPrompt)
          });
        }
        
        // SillyTavern内置
        if (window.SillyTavern && typeof window.SillyTavern.generate === 'function') {
          apiMethods.push({
            name: 'SillyTavern',
            handler: () => this.callSillyTavernAPI(fullPrompt)
          });
        }
        
        // 全局generate
        if (typeof window.generate === 'function') {
          apiMethods.push({
            name: '全局Generate',
            handler: () => this.callGlobalGenerate(fullPrompt)
          });
        }
        
        // ✅ 策略2: 快速失败，依次尝试
        for (const method of apiMethods) {
          try {
            console.log(`[小火聊天] 尝试使用: ${method.name}`);
            const result = await method.handler();
            
            if (result && result.trim()) {
              console.log(`[小火聊天] ${method.name} 调用成功`);
              // 立即页面级提示（无需系统通知权限）
              this.showNotification('小火已拿到回复，正在处理...', 'success');
              return result.trim();
            }
          } catch (error) {
            console.warn(`[小火聊天] ${method.name} 失败:`, error.message);
            // 继续尝试下一个方法
          }
        }
        
        // 所有方法都失败，使用本地生成
        console.log('[小火聊天] 所有API调用失败，使用本地生成');
        return this.generateLocalResponse(userMessage);
      }

      // 分离的API调用方法
      async callSillyTavernAPI(prompt) {
        const result = await window.SillyTavern.generate({
          user_input: prompt,
          should_stream: false,
          max_chat_history: 'all',
        });
        if (!result || !result.trim()) {
          throw new Error('SillyTavern返回空结果');
        }
        return result;
      }

      async callGlobalGenerate(prompt) {
        const result = await window.generate({ 
          user_input: prompt, 
          should_stream: false 
        });
        if (!result || !result.trim()) {
          throw new Error('全局Generate返回空结果');
        }
        return result;
      }

      async callExternalAPI(prompt) {
        const messages = [
          {
            role: 'system',
            content: this.settings.characterPrompt
          },
          { role: 'user', content: prompt }
        ];
        
        return await this.makeAPICallWithRetry(messages);
      }

      // ✅ 修复的外部API调用（带重试）
      async makeAPICallWithRetry(messages, retryCount = 0) {
        const maxRetries = this.apiConfig.retryCount || 2;
        
        try {
          return await this.makeAPICall(messages);
        } catch (error) {
          console.error(`[小火聊天] API调用失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error.message);
          
          // ✅ 如果是超时错误且还有重试次数，则重试
          if (retryCount < maxRetries && 
              (error.message.includes('超时') || error.message.includes('timeout'))) {
            
            console.log(`[小火聊天] ${2 ** retryCount}秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** retryCount)));
            
            return await this.makeAPICallWithRetry(messages, retryCount + 1);
          }
          
          throw error;
        }
      }

      // 本地生成回复
      generateLocalResponse(userMessage) {
        const responses = [
          "api没调用成功，刷新再来",
          "生成失败鸟~大侠重发一次吧"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
      }

      // ✅ 修复语法错误的makeAPICall
      async makeAPICall(messages) {
        const provider = this.apiConfig.provider;
        let apiUrl = (this.apiConfig.apiUrl || '').toString().replace(/\/+$/g, '');

        // 构建请求URL
        let requestUrl;
        if (provider === 'gemini') {
          requestUrl = `${apiUrl}/v1beta/models/${this.apiConfig.model}:generateContent`;
        } else {
          const hasVersion = /\/v\d+(?:\/|$)/.test(apiUrl);
          requestUrl = hasVersion
            ? `${apiUrl}/chat/completions`
            : `${apiUrl}/v1/chat/completions`;
          requestUrl = requestUrl.replace(/([^:])\/\/+/g, '$1/');
        }

        // 构建请求体
        const requestBody = {
          model: this.apiConfig.model,
          messages: messages,
          temperature: this.apiConfig.temperature,
          max_tokens: this.apiConfig.maxTokens,
          stream: false  // ✅ 强制关闭流式，避免超时
        };

        if (provider === 'gemini') {
          requestBody.contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }));
          delete requestBody.messages;
        }

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiConfig.apiKey}`,
          ...this.apiConfig.customHeaders
        };

        console.log('[小火聊天] API请求:', {
          url: requestUrl,
          provider: provider,
          model: this.apiConfig.model,
          timeout: this.apiConfig.timeout
        });

        // ✅ 修复: 使用AbortController实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn('[小火聊天] API调用超时，已取消请求');
        }, this.apiConfig.timeout || 60000);

        try {
          const response = await fetch(requestUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[小火聊天] API错误:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`API请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
          }

          const data = await response.json();
          
          // 解析响应
          let content;
          if (provider === 'gemini') {
            content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            content = data.choices?.[0]?.message?.content || '';
          }
          
          if (!content) {
            throw new Error('API返回空内容');
          }
          
          return content;
          
        } catch (error) {  // ✅ 修复: 补充缺失的左花括号
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            throw new Error(`API调用超时 (>${this.apiConfig.timeout/1000}秒)，请检查网络或增加超时时间`);
          }
          
          throw error;
        }
      }
      // 发送消息
      async sendMessage(message) {
        if (this.isGenerating && !this.isBackgroundGenerating) return;

        this.isGenerating = true;
        
        // 如果输入为空，直接让AI找话题，不发送任何用户消息
        if (!message.trim()) {
          // 清空输入框
          const inputElement = document.getElementById('chat-input');
          if (inputElement) inputElement.value = '';

          try {
            // 检查是否在后台生成
            if (this.isBackgroundGenerating) {
              // 显示后台生成提示
              this.showBackgroundGenerationNotification();
              return;
            }
            
            // 显示输入提示
            this.showTypingIndicator();
            
            // 直接让AI找话题，不添加用户消息
            const response = await this.callChatAPI("请随便聊点什么吧，我想听听你的想法～");
            
            // 隐藏输入提示
            this.hideTypingIndicator();
            
            // 处理AI回复，分割多条消息
            await this.processAIResponse(response);
            
            // 保存历史记录
            this.saveHistory();
            
          } catch (error) {
            console.error('[Chat Module] 发送消息失败:', error);
            this.hideTypingIndicator();
            this.addMessageToUI('system', '抱歉，小火现在有点忙，请稍后再试～ 😅');
          } finally {
            this.isGenerating = false;
          }
          return;
        }

        // 处理用户消息，支持|分隔符分割多条消息
        const userMessages = message.split(/\|/).map(msg => msg.trim()).filter(msg => msg.length > 0);
        
        // 添加所有用户消息到历史记录
        userMessages.forEach(userMsg => {
          this.history.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            role: 'user',
            content: userMsg,
            timestamp: new Date().toISOString()
          });
        });

        // 更新UI显示所有用户消息
        userMessages.forEach((userMsg, index) => {
          const messageId = this.history[this.history.length - userMessages.length + index].id;
          this.addMessageToUI('user', userMsg, messageId);
        });
        
        // 清空输入框
        const inputElement = document.getElementById('chat-input');
        if (inputElement) inputElement.value = '';

        try {
          // 检查是否在后台生成
          if (this.isBackgroundGenerating) {
            // 显示后台生成提示
            this.showBackgroundGenerationNotification();
            return;
          }
          
          // 显示输入提示
          this.showTypingIndicator();
          
          // 调用API生成回复，使用最后一条用户消息
          const response = await this.callChatAPI(userMessages[userMessages.length - 1]);
          
          // 隐藏输入提示
          this.hideTypingIndicator();
          
          // 处理AI回复，分割多条消息（仅一次）
          await this.processAIResponse(response);
          // 前台完成提示 + 提示音（仅一次）
          this.showNotification('✓ 小火回复完成！', 'success');
          if (window.playNotifySound) window.playNotifySound();
          
          // 保存历史记录
          this.saveHistory();
          
        } catch (error) {
          console.error('[Chat Module] 发送消息失败:', error);
          this.hideTypingIndicator();
          this.addMessageToUI('system', '抱歉，小火现在有点忙，请稍后再试～ 😅');
        } finally {
          this.isGenerating = false;
        }
      }

      // 处理AI回复，分割多条消息
      async processAIResponse(response) {
        // 使用正则表达式分割消息，支持|分隔符
        const messages = response.split(/\|/).map(msg => msg.trim()).filter(msg => msg.length > 0);
        
        if (messages.length === 0) {
          // 如果没有分割出消息，直接显示原回复
          this.history.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
          });
          const messageId = this.history[this.history.length - 1].id;
          this.addMessageToUI('assistant', response, messageId);
          return;
        }
        
        // 显示第一条消息
        const firstMessageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        this.history.push({
          id: firstMessageId,
          role: 'assistant',
          content: messages[0],
          timestamp: new Date().toISOString()
        });
        this.addMessageToUI('assistant', messages[0], firstMessageId);
        
        // 如果有更多消息，延迟显示
        for (let i = 1; i < messages.length; i++) {
          // 显示输入提示
          this.showTypingIndicator();
          
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // 1-2秒随机延迟
          
          // 隐藏输入提示
          this.hideTypingIndicator();
          
          const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          this.history.push({
            id: messageId,
            role: 'assistant',
            content: messages[i],
            timestamp: new Date().toISOString()
          });
          this.addMessageToUI('assistant', messages[i], messageId);
        }
      }

      // 显示输入提示
      showTypingIndicator() {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;

        // 移除已存在的输入提示
        this.hideTypingIndicator();

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message chat-message-assistant typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
          <div class="chat-message-content">
            <div class="chat-avatar">🔥</div>
            <div class="chat-message-bubble">
              <div class="chat-message-text typing-text">
                <span class="typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
                小火正在思考中...
              </div>
            </div>
          </div>
        `;

        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }

      // 隐藏输入提示
      hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
          typingIndicator.remove();
        }
      }

      // 显示后台生成提示（统一走页面内通知，确保可见）
      showBackgroundGenerationNotification() {
        this.showNotification('小火正在后台思考中，请稍候...', 'info');
      }

      // 开始后台生成
      startBackgroundGeneration(message) {
        if (this.isBackgroundGenerating) return;
        
        this.isBackgroundGenerating = true;
        this.backgroundGenerationId = Date.now();
        
        // 创建后台任务对象
        this.backgroundGenerationTask = {
          status: 'running',
          message: message,
          startTime: Date.now(),
          isForeground: true
        };
        
        // 显示后台生成状态
        this.showBackgroundStatus();
        
        // 显示后台生成提示
        this.showBackgroundGenerationNotification();
        
        // 在后台执行生成
        this.executeBackgroundGeneration(message, this.backgroundGenerationId);
      }

      // ✅ 改进后台生成完成通知
      async executeBackgroundGeneration(message, generationId) {
        try {
          this.history.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
          });

          this.addMessageToUI('user', message);
          
          // ✅ 添加进度提示
          const startTime = Date.now();
          
          const response = await this.callChatAPI(message);
          
          if (this.backgroundGenerationId === generationId) {
            await this.processAIResponse(response);
            this.saveHistory();
            
            if (this.backgroundGenerationTask) {
              this.backgroundGenerationTask.status = 'completed';
              this.backgroundGenerationTask.endTime = Date.now();
            }
            
            this.hideBackgroundStatus();
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // ✅ 改进: 更明显的完成通知
            if (this.backgroundGenerationTask && !this.backgroundGenerationTask.isForeground) {
              // 后台完成 - 显示浏览器通知，若不可用则使用页面通知
              if ('Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification('🔥 小火回复完成！', {
                  body: `已完成回复 (${duration}秒)，点击查看`,
                  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%234caf50"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">✓</text></svg>',
                  tag: 'fire-chat-complete',
                  requireInteraction: true,
                  vibrate: [200, 100, 200]
                });
                // 点击通知重新打开聊天窗口
                notification.onclick = () => {
                  notification.close();
                  if (window.openChatModule) {
                    window.openChatModule();
                  }
                };
              } else {
                this.showNotification(`✓ 小火回复完成！(${duration}秒)`, 'success');
              }
              // 统一再补一条页面内提示，确保视觉可见 + 提示音
              this.showNotification(`✓ 小火回复完成！(${duration}秒)`, 'success');
              if (window.playNotifySound) window.playNotifySound();
            } else {
              // 前台完成 - 页面通知
              this.showNotification(`✓ 小火回复完成！(${duration}秒)`, 'success');
              if (window.playNotifySound) window.playNotifySound();
            }
          }
        } catch (error) {
          console.error('[小火聊天] 后台生成失败:', error);
          
          if (this.backgroundGenerationId === generationId) {
            this.hideBackgroundStatus();
            
            // ✅ 更友好的错误提示
            const errorMsg = error.message.includes('超时') 
              ? '小火思考超时了，请稍后再试 ⏰' 
              : '小火现在有点忙，请稍后再试 😅';
            
            this.addMessageToUI('system', errorMsg);
            this.saveHistory();
            
            if (this.backgroundGenerationTask) {
              this.backgroundGenerationTask.status = 'failed';
              this.backgroundGenerationTask.error = error.message;
            }
            
            // 后台失败也发送通知；若无权限则页面提示
            if (this.backgroundGenerationTask && !this.backgroundGenerationTask.isForeground) {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('小火聊天', {
                  body: errorMsg,
                  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff9800"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">!</text></svg>',
                  tag: 'fire-chat-error'
                });
              } else {
                this.showNotification(errorMsg, 'error');
              }
              // 统一再补一条页面内提示
              this.showNotification(errorMsg, 'error');
            }
          }
        } finally {
          if (this.backgroundGenerationId === generationId) {
            this.isBackgroundGenerating = false;
            this.backgroundGenerationId = null;
            
            setTimeout(() => {
              this.backgroundGenerationTask = null;
            }, 5000);
          }
        }
      }

      // 停止后台生成
      stopBackgroundGeneration() {
        this.isBackgroundGenerating = false;
        this.backgroundGenerationId = null;
        this.hideBackgroundStatus();
        this.showNotification('后台生成已停止', 'info');
      }

      // 显示后台生成状态
      showBackgroundStatus() {
        const statusElement = document.getElementById('background-status');
        if (statusElement) {
          statusElement.style.display = 'block';
        }
      }

      // 隐藏后台生成状态
      hideBackgroundStatus() {
        const statusElement = document.getElementById('background-status');
        if (statusElement) {
          statusElement.style.display = 'none';
        }
      }

      // 添加消息到UI
      addMessageToUI(role, content, messageId = null) {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message chat-message-${role}`;
        messageDiv.dataset.messageId = messageId || Date.now().toString();
        
        if (role === 'user') {
          const userAvatar = this.settings.userAvatar || '🔥';
          const isImageAvatar = userAvatar.startsWith('data:');
          
          messageDiv.innerHTML = `
            <div class="chat-message-content">
              <div class="chat-avatar user-avatar" data-message-id="${messageDiv.dataset.messageId}" style="${isImageAvatar ? `background-image: url(${userAvatar}); background-size: cover; background-position: center;` : ''}">${isImageAvatar ? '' : userAvatar}</div>
              <div class="chat-message-bubble">
                <div class="chat-message-text">${this.escapeHtml(content)}</div>
                <div class="chat-message-time">${new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          `;
        } else if (role === 'assistant') {
          messageDiv.innerHTML = `
            <div class="chat-message-content">
              <div class="chat-avatar ai-avatar" data-message-id="${messageDiv.dataset.messageId}">🔥</div>
              <div class="chat-message-bubble">
                <button class="bubble-expand-btn" title="全屏查看">⤢</button>
                <div class="chat-message-text">${content}</div>
                <div class="chat-message-time">${new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          `;
        } else {
          messageDiv.innerHTML = `
            <div class="chat-message-content">
              <div class="chat-message-text system-message">${this.escapeHtml(content)}</div>
            </div>
          `;
        }

        // 添加头像点击事件监听器（用户和AI消息）
        if (role === 'user' || role === 'assistant') {
          // 延迟绑定事件，确保DOM已渲染
          setTimeout(() => {
            // 头像点击功能已移除
          }, 100);
        }

        // 为AI消息添加"全屏查看"按钮功能
        if (role === 'assistant') {
          const bubble = messageDiv.querySelector('.chat-message-bubble');
          const expandBtn = messageDiv.querySelector('.bubble-expand-btn');
          if (bubble && expandBtn) {
            expandBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              try {
                const html = bubble.querySelector('.chat-message-text')?.innerHTML || '';
                this.showBubbleFullscreen(html);
              } catch (err) {
                console.warn('[Chat Module] 打开全屏失败:', err);
              }
            });
          }
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }

      // 全屏展示某条气泡的HTML内容
      showBubbleFullscreen(html) {
        try {
          const overlay = document.createElement('div');
          overlay.className = 'chat-bubble-fullscreen-overlay';
          overlay.innerHTML = `
            <div class="chat-bubble-fullscreen">
              <div class="chat-bubble-fullscreen-header">
                <span>全屏预览</span>
                <button class="chat-bubble-fullscreen-close" title="关闭">×</button>
              </div>
              <div class="chat-bubble-fullscreen-body">${html}</div>
            </div>
          `;
          // 将遮罩插入到聊天模块容器内，保证层级在生成器前且相对容器居中
          const chatContainer = document.querySelector('.tg-chat-module-container');
          if (chatContainer) {
            // 确保容器是定位上下文
            const prevPos = window.getComputedStyle(chatContainer).position;
            if (prevPos === 'static') {
              chatContainer.style.position = 'relative';
            }
            chatContainer.appendChild(overlay);
          } else {
            document.body.appendChild(overlay);
          }

          const close = () => { try { overlay.remove(); } catch (_) {} };
          overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
          overlay.querySelector('.chat-bubble-fullscreen-close')?.addEventListener('click', close);
        } catch (e) {
          console.warn('[Chat Module] 全屏预览创建失败:', e);
        }
      }

      // 头像点击功能已移除

      // 头像操作菜单功能已移除

      // 消息操作菜单功能已移除

      // 批量选择模式相关功能
      isSelectionMode = false;
      selectedMessages = new Set();

      // 进入批量选择模式
      enterSelectionMode() {
        this.isSelectionMode = true;
        this.selectedMessages.clear();
        
        // 为所有消息添加选择框
        const messages = document.querySelectorAll('.chat-message');
        messages.forEach(messageDiv => {
          this.addSelectionCheckbox(messageDiv);
        });
        
        // 已隐藏批量操作工具栏
        
        this.showNotification('已进入批量选择模式', 'info');
      }

      // 退出批量选择模式
      exitSelectionMode() {
        this.isSelectionMode = false;
        this.selectedMessages.clear();
        
        // 移除所有选择框
        const checkboxes = document.querySelectorAll('.message-checkbox');
        checkboxes.forEach(checkbox => checkbox.remove());
        
        // 移除批量操作工具栏
        const toolbar = document.getElementById('batch-action-toolbar');
        if (toolbar) {
          toolbar.remove();
        }
        
        this.showNotification('已退出批量选择模式', 'info');
      }

      // 为消息添加选择框
      addSelectionCheckbox(messageDiv) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'message-checkbox';
        
        // 找到头像元素
        const avatarElement = messageDiv.querySelector('.chat-avatar');
        if (avatarElement) {
          // 设置选择框样式，覆盖在头像上
          checkbox.style.position = 'absolute';
          checkbox.style.top = '50%';
          checkbox.style.left = '50%';
          checkbox.style.transform = 'translate(-50%, -50%)';
          checkbox.style.zIndex = '1001';
          checkbox.style.width = '20px';
          checkbox.style.height = '20px';
          checkbox.style.opacity = '0.8';
          checkbox.style.cursor = 'pointer';
          
          // 确保头像容器是相对定位
          avatarElement.style.position = 'relative';
          avatarElement.appendChild(checkbox);
        } else {
          // 如果没有找到头像，使用原来的位置
          checkbox.style.position = 'absolute';
          checkbox.style.left = '10px';
          checkbox.style.top = '10px';
          checkbox.style.zIndex = '1000';
          messageDiv.style.position = 'relative';
          messageDiv.appendChild(checkbox);
        }
        
        checkbox.addEventListener('change', (e) => {
          const messageId = messageDiv.dataset.messageId;
          if (e.target.checked) {
            this.selectedMessages.add(messageId);
          } else {
            this.selectedMessages.delete(messageId);
          }
          this.updateBatchToolbar();
        });
      }

      // 显示批量操作工具栏
      showBatchActionToolbar() {
        // 已隐藏批量操作工具栏，不再创建
        return;
      }

      // 更新批量工具栏
      updateBatchToolbar() {
        const countElement = document.getElementById('selected-count');
        if (countElement) {
          countElement.textContent = `已选择 ${this.selectedMessages.size} 条消息`;
        }
        
        const deleteBtn = document.getElementById('delete-selected-btn');
        if (deleteBtn) {
          deleteBtn.disabled = this.selectedMessages.size === 0;
        }
      }

      // ✅ 全选消息（优化版）
      selectAllMessages() {
        const checkboxes = document.querySelectorAll('.message-checkbox');
        let selectedCount = 0;
        
        checkboxes.forEach(checkbox => {
          if (!checkbox.checked) {
            checkbox.checked = true;
            const messageId = checkbox.closest('.chat-message').dataset.messageId;
            this.selectedMessages.add(messageId);
            selectedCount++;
          }
        });
        
        this.updateBatchToolbar();
        
        if (selectedCount > 0) {
          this.showNotification(`已全选 ${this.selectedMessages.size} 条消息`, 'success');
        } else {
          this.showNotification('所有消息已选中', 'info');
        }
      }

      // ✅ 全不选消息（优化版）
      selectNoMessages() {
        const checkboxes = document.querySelectorAll('.message-checkbox');
        let uncheckedCount = 0;
        
        checkboxes.forEach(checkbox => {
          if (checkbox.checked) {
            checkbox.checked = false;
            uncheckedCount++;
          }
        });
        
        this.selectedMessages.clear();
        this.updateBatchToolbar();
        
        if (uncheckedCount > 0) {
          this.showNotification(`已取消选择 ${uncheckedCount} 条消息`, 'info');
        } else {
          this.showNotification('没有选中的消息', 'info');
        }
      }

      // ✅ 智能选择消息
      smartSelectMessages() {
        const checkboxes = document.querySelectorAll('.message-checkbox');
        const totalMessages = checkboxes.length;
        const selectedMessages = this.selectedMessages.size;
        
        // 如果选中了大部分消息，则全不选；否则全选
        if (selectedMessages >= totalMessages * 0.5) {
          this.selectNoMessages();
          this.showNotification('智能选择：已取消全选', 'info');
        } else {
          this.selectAllMessages();
          this.showNotification('智能选择：已全选', 'success');
        }
      }

      // ✅ 快速全选功能（直接全选所有消息并进入删除模式）
      quickSelectAll() {
        // 如果没有聊天记录，提示用户
        if (this.history.length === 0) {
          this.showNotification('没有聊天记录可以删除', 'warning');
          return;
        }

        // 进入选择模式
        this.enterSelectionMode();
        
        // 全选所有消息
        this.selectAllMessages();
        
        // 显示确认删除的提示
        setTimeout(() => {
          this.showNotification(`已全选 ${this.history.length} 条消息，点击删除按钮确认删除`, 'info');
        }, 500);
      }

      // 删除选中的消息
      deleteSelectedMessages() {
        if (this.selectedMessages.size === 0) {
          this.showNotification('请先选择要删除的消息', 'warning');
          return;
        }
        
        if (confirm(`确定要删除选中的 ${this.selectedMessages.size} 条消息吗？此操作不可恢复。`)) {
          // 从历史记录中删除
          this.history = this.history.filter(msg => !this.selectedMessages.has(msg.id));
          this.saveHistory();
          
          // 从UI中删除
          this.selectedMessages.forEach(messageId => {
            const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageDiv) {
              messageDiv.remove();
            }
          });
          
          this.showNotification(`已删除 ${this.selectedMessages.size} 条消息`, 'success');
          this.exitSelectionMode();
        } else {
          // 用户取消删除，退出选择模式
          this.exitSelectionMode();
        }
      }

      // HTML转义
      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      // 清空聊天记录
      clearHistory() {
        this.history = [];
        this.saveHistory();
        const chatContainer = document.getElementById('chat-messages');
        if (chatContainer) {
          chatContainer.innerHTML = '';
        }
        this.showNotification('聊天记录已清空', 'success');
      }

      // 清除聊天记录（带确认）
      clearChatHistory() {
        if (confirm('确定要清除所有聊天记录吗？此操作不可恢复。')) {
          this.history = [];
          this.saveHistory();
          
          // 清空聊天界面
          const chatContainer = document.getElementById('chat-messages');
          if (chatContainer) {
            chatContainer.innerHTML = '';
          }
          
          this.showNotification('聊天记录已清除', 'success');
        }
      }

      // 获取聊天历史
      getChatHistory() {
        try {
          const limit = Number.isFinite(this.threshold) ? Math.max(1, this.threshold) : 10;
          let items = [];

          if (window.TavernHelper && window.TavernHelper.getChatMessages) {
            const all = window.TavernHelper.getChatMessages('0-{{lastMessageId}}') || [];
            items = all.map(msg => ({ name: msg.name, text: msg.message }));
          } else if (window.getLastMessageId) {
            const lastId = window.getLastMessageId();
            for (let i = 0; i <= lastId; i++) {
              const messageEl = document.getElementById(`mes_${i}`);
              if (messageEl) {
                const nameEl = messageEl.querySelector('.name');
                const textEl = messageEl.querySelector('.mes');
                if (nameEl && textEl) {
                  items.push({
                    name: nameEl.textContent.trim(),
                    text: textEl.textContent.trim()
                  });
                }
              }
            }
          }

          const sliced = items.slice(-limit);
          return sliced.map(it => `${it.name}: ${it.text}`).join('\n');
        } catch (error) {
          console.warn('[Chat Module] 获取聊天历史失败:', error);
          return '';
        }
      }

      // 构建聊天提示词
      buildChatPrompt(userMessage, chatHistory) {
        const systemPrompt = this.settings.characterPrompt;
        
        let fullPrompt = systemPrompt;
        
        // 处理用户消息，如果包含|分隔符，需要特殊处理
        let processedUserMessage = userMessage;
        if (userMessage.includes('|')) {
          const messages = userMessage.split('|').map(msg => msg.trim()).filter(msg => msg.length > 0);
          if (messages.length > 1) {
            processedUserMessage = `用户发送了多条消息，请逐一回复：\n${messages.map((msg, index) => `${index + 1}. ${msg}`).join('\n')}`;
          }
        }
        
        // 如果有聊天历史，添加到提示词中
        if (chatHistory && chatHistory.trim()) {
          fullPrompt += `\n\n聊天历史（严格依此取材）：\n${chatHistory}\n\n用户当前消息：${processedUserMessage}`;
        } else {
          fullPrompt += `\n\n用户消息：${processedUserMessage}`;
        }
        
        return fullPrompt;
      }

      // 显示通知（页面级兜底）
      showNotification(message, type = 'info') {
        const chatModal = document.getElementById('chat-module-modal');
        const apiStatusEl = document.getElementById('api-status');
        const canUseGlobalStatus = typeof window.showAPIStatus === 'function' && !!apiStatusEl;

        // 优先用全局状态（只有在容器存在时）
        if (canUseGlobalStatus) {
          window.showAPIStatus(message, type);
        }

        // 没有可用的全局状态容器，或聊天模态已关闭 → 使用页面级 Toast
        if (!canUseGlobalStatus || !chatModal) {
          this.showPageToast(message, type);
        }

        if (!canUseGlobalStatus && chatModal) {
          console.log(`[Chat Module] ${type.toUpperCase()}: ${message}`);
        }
      }
      // 页面级Toast（不依赖任何模态）
      showPageToast(message, type = 'info') {
        try {
          const existing = document.querySelector('.chat-toast-container');
          const container = existing || document.createElement('div');
          if (!existing) {
            container.className = 'chat-toast-container';
            container.style.position = 'fixed';
            container.style.right = '20px';
            container.style.top = '20px';
            container.style.zIndex = '100000';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '8px';
            document.body.appendChild(container);
          }

          const toast = document.createElement('div');
          toast.className = 'chat-toast';
          toast.textContent = message;
          toast.style.maxWidth = '320px';
          toast.style.padding = '10px 14px';
          toast.style.borderRadius = '8px';
          toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
          toast.style.color = '#fff';
          toast.style.fontSize = '14px';
          toast.style.lineHeight = '1.4';
          toast.style.background = type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#1565c0';
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          toast.style.transition = 'opacity .2s ease, transform .2s ease';

          container.appendChild(toast);
          requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
          });

          setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
              toast.remove();
              if (container.children.length === 0) container.remove();
            }, 250);
          }, 3000);
        } catch (e) {
          console.log(`[Chat Module] ${type.toUpperCase()}: ${message}`);
        }
      }

      // 显示浏览器通知
      showBrowserNotification(message, title = '小火聊天') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff6b6b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
          });
        }
      }

      // 获取HTML内容
      getContent() {
        return `
          <div class="tg-chat-module-container" style="margin: 0 20px; opacity: 1;">
            <div class="tg-chat-header">
              <h2>🔥 ${this.settings.chatName || '小火聊聊天'}</h2>
              <div class="tg-chat-actions">
                <div id="background-status" class="background-status" style="display: none; color: #fff; font-size: 12px; margin-right: 8px; padding: 4px 8px; background: rgba(255,255,255,0.2); border-radius: 4px;">
                  🔄 后台生成中...
                </div>
                <button id="chat-storage-btn" class="tg-chat-storage-btn" title="存储管理">💾</button>
                <button id="chat-select-all-btn" class="tg-chat-select-all-btn" title="一键全选">☑️</button>
                <button id="chat-clear-btn" class="tg-chat-clear-btn" title="清除聊天记录">🗑️</button>
                <button id="chat-edit-btn" class="tg-chat-edit-btn" title="编辑名字和人设">✏️</button>
              </div>
            </div>
            
            <div class="tg-chat-content">
              <!-- 聊天消息区域 -->
              <div class="tg-chat-messages" id="chat-messages">
              </div>
              
              <!-- 输入区域 -->
              <div class="tg-chat-input-area">
                <div class="tg-chat-input-wrapper">
                  <input type="text" id="chat-input" placeholder="输入消息..." maxlength="500">
                  <button id="send-message" class="tg-chat-send-btn">发送</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // 获取CSS样式
      getStyles() {
        return `
          .tg-chat-module-container {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
            height: 600px;
            display: flex;
            flex-direction: column;
          }

          .tg-chat-header {
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
          }

          .tg-chat-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .tg-chat-actions {
            display: flex;
            gap: 8px;
          }

          .tg-chat-edit-btn, .tg-chat-clear-btn, .tg-chat-storage-btn, .tg-chat-select-all-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .tg-chat-edit-btn:hover, .tg-chat-clear-btn:hover, .tg-chat-storage-btn:hover, .tg-chat-select-all-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.05);
          }

          /* ✅ 存储管理界面样式 */
          .tg-modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .tg-modal-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 90%;
            max-height: 90%;
            overflow: hidden;
          }

          .tg-modal-header {
            background: #007bff;
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .tg-modal-header h3 {
            margin: 0;
            font-size: 18px;
          }

          .tg-modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .tg-modal-body {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
          }

          .storage-stats, .storage-config, .storage-actions {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }

          .storage-stats h4, .storage-config h4, .storage-actions h4 {
            margin: 0 0 15px 0;
            color: #495057;
            font-size: 16px;
          }

          .stats-grid, .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
          }

          .stat-item, .config-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #dee2e6;
          }

          .stat-label, .config-item label {
            font-weight: 500;
            color: #495057;
          }

          .stat-value {
            font-weight: 600;
            color: #007bff;
          }

          .config-item input[type="number"] {
            width: 80px;
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            text-align: center;
          }

          .config-item input[type="checkbox"] {
            margin-right: 8px;
          }

          .action-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .action-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .action-btn.primary {
            background: #007bff;
            color: white;
          }

          .action-btn.primary:hover {
            background: #0056b3;
            transform: translateY(-1px);
          }

          .action-btn.secondary {
            background: #6c757d;
            color: white;
          }

          .action-btn.secondary:hover {
            background: #545b62;
            transform: translateY(-1px);
          }

          /* ✅ 批量操作工具栏样式 */
          .batch-toolbar-content {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
          }

          .batch-info {
            font-weight: 500;
            color: #495057;
            font-size: 14px;
          }

          .batch-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .batch-btn {
            padding: 6px 12px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: white;
            color: #495057;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          }

          .batch-btn:hover {
            background: #f8f9fa;
            border-color: #adb5bd;
            transform: translateY(-1px);
          }

          .batch-btn.delete-btn {
            background: #dc3545;
            color: white;
            border-color: #dc3545;
          }

          .batch-btn.delete-btn:hover {
            background: #c82333;
            border-color: #bd2130;
          }

          .batch-btn.smart-btn {
            background: #17a2b8;
            color: white;
            border-color: #17a2b8;
          }

          .batch-btn.smart-btn:hover {
            background: #138496;
            border-color: #117a8b;
          }

          .batch-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          .batch-btn:disabled:hover {
            background: white;
            border-color: #dee2e6;
            transform: none;
          }

          .tg-chat-clear-btn:hover {
            background: rgba(220, 53, 69, 0.3);
          }

          .tg-chat-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .tg-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f8f9fa;
          }


          .chat-message {
            margin-bottom: 16px;
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .chat-message-user {
            justify-content: flex-end;
          }

          .chat-message-user .chat-message-content {
            flex-direction: row-reverse;
          }

          /* 用户消息与AI气泡样式统一：去掉渐变底，改用白底圆角 */
          .chat-message-user .chat-message-text {
            background: transparent;
            color: inherit;
          }
          .chat-message-user .chat-message-bubble {
            border-radius: 18px 18px 4px 18px;
          }

          .user-avatar {
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
          }

          .user-avatar:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          }

          .user-avatar::after {
            content: '👆';
            position: absolute;
            top: -8px;
            right: -8px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .user-avatar:hover::after {
            opacity: 1;
          }

          .ai-avatar {
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
          }

          .ai-avatar:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          }

          .ai-avatar::after {
            content: '👆';
            position: absolute;
            top: -8px;
            right: -8px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .ai-avatar:hover::after {
            opacity: 1;
          }

          .chat-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
          }

          .chat-message-content {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            max-width: 70%;
          }

          .chat-message-bubble {
            background: white;
            border-radius: 18px 18px 18px 4px;
            padding: 12px 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: relative;
          }

          .bubble-expand-btn {
            position: absolute;
            bottom: 6px;
            left: 6px;
            background: rgba(0,0,0,0.05);
            border: none;
            border-radius: 6px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            color: #333;
            font-size: 12px;
            line-height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .bubble-expand-btn:hover { background: rgba(0,0,0,0.12); }

          .chat-bubble-fullscreen-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .chat-bubble-fullscreen {
            background: #fff;
            width: min(90vw, 1000px);
            max-height: 90vh;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          .chat-bubble-fullscreen-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            color: #fff;
          }
          .chat-bubble-fullscreen-close {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 22px;
            cursor: pointer;
          }
          .chat-bubble-fullscreen-body {
            padding: 16px;
            overflow: auto;
          }

          .chat-message-text {
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
          }

          .chat-message-time {
            font-size: 11px;
            color: #999;
            margin-top: 4px;
            text-align: right;
          }

          .system-message {
            text-align: center;
            color: #666;
            font-style: italic;
            background: #f0f0f0;
            padding: 8px 12px;
            border-radius: 12px;
            margin: 8px 0;
          }

          .tg-chat-input-area {
            padding: 16px;
            background: white;
            border-top: 1px solid #e9ecef;
          }

          .tg-chat-input-wrapper {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }

          #chat-input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 24px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease;
          }

          #chat-input:focus {
            border-color: #ff6b6b;
          }

          .tg-chat-send-btn {
            padding: 12px 20px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
            color: white;
            border: none;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .tg-chat-send-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
          }

          .tg-chat-send-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }


          /* 滚动条样式 */
          .tg-chat-messages::-webkit-scrollbar {
            width: 6px;
          }

          .tg-chat-messages::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }

          .tg-chat-messages::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }

          .tg-chat-messages::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }

          /* 消息操作菜单样式 */
          .message-actions-menu {
            position: fixed;
            z-index: 10000;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            border: 1px solid #e1e5e9;
            overflow: hidden;
            animation: messageMenuFadeIn 0.2s ease-out;
          }

          @keyframes messageMenuFadeIn {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-10px) scale(0.9);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0) scale(1);
            }
          }

          .message-actions-content {
            display: flex;
            gap: 8px;
            padding: 8px;
          }

          .action-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border: none;
            border-radius: 8px;
            background: #f8f9fa;
            color: #495057;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 60px;
            justify-content: center;
          }

          .action-btn:hover {
            background: #e9ecef;
            transform: translateY(-1px);
          }

          .delete-btn:hover {
            background: #f8d7da;
            color: #721c24;
          }

          .recall-btn:hover {
            background: #d1ecf1;
            color: #0c5460;
          }

          .action-icon {
            font-size: 14px;
          }

          .action-text {
            font-weight: 500;
          }

          /* 头像更换模态框样式 */
          .avatar-change-modal {
            position: fixed;
            z-index: 10001;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .avatar-change-content {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            max-width: 300px;
            width: 100%;
          }

          .avatar-change-content h3 {
            margin: 0 0 16px 0;
            text-align: center;
            color: #333;
            font-size: 16px;
          }

          .avatar-options {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 16px;
          }

          .avatar-option {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 2px solid transparent;
          }

          .avatar-option:hover {
            transform: scale(1.1);
            border-color: #4a90e2;
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
          }

          .avatar-upload-section {
            text-align: center;
            margin-bottom: 16px;
          }

          .upload-btn {
            padding: 8px 16px;
            background: #4a90e2;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
          }

          .upload-btn:hover {
            background: #357abd;
          }

          .avatar-actions {
            text-align: center;
          }

          .cancel-btn {
            padding: 8px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s ease;
          }

          .cancel-btn:hover {
            background: #5a6268;
          }

          /* 输入提示样式 */
          .typing-indicator {
            opacity: 0.8;
          }
          .typing-text {
            color: #666;
            font-style: italic;
          }

          .typing-dots {
            display: inline-block;
            animation: typingDots 1.5s infinite;
          }

          .typing-dots span {
            display: inline-block;
            animation: typingDot 1.5s infinite;
          }

          .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
          }

          .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
          }

          @keyframes typingDots {
            0%, 20% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }

          @keyframes typingDot {
            0%, 20% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
        `;
      }

      // 绑定事件
      bindEvents() {
        // 发送消息按钮
        const sendBtn = document.getElementById('send-message');
        if (sendBtn) {
          sendBtn.addEventListener('click', () => {
            const input = document.getElementById('chat-input');
            if (input) {
              this.sendMessage(input.value.trim());
            }
          });
        }

        // 输入框回车发送
        const input = document.getElementById('chat-input');
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              this.sendMessage(input.value.trim());
            }
          });
        }

        // ✅ 存储管理按钮
        const storageBtn = document.getElementById('chat-storage-btn');
        if (storageBtn) {
          storageBtn.addEventListener('click', () => {
            this.showStorageManager();
          });
        }

        // ✅ 全选按钮
        const selectAllBtn = document.getElementById('chat-select-all-btn');
        if (selectAllBtn) {
          selectAllBtn.addEventListener('click', () => {
            this.quickSelectAll();
          });
        }

        // 清除按钮 - 改为批量选择模式
        const clearBtn = document.getElementById('chat-clear-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            if (this.isSelectionMode) {
              // 如果在选择模式中，检查是否有选中的消息
              if (this.selectedMessages.size > 0) {
                // 有选中消息，执行删除
                this.deleteSelectedMessages();
              } else {
                // 没有选中消息，退出选择模式
                this.exitSelectionMode();
              }
            } else {
              // 不在选择模式，进入选择模式
              this.enterSelectionMode();
            }
          });
        }

        // 编辑按钮
        const editBtn = document.getElementById('chat-edit-btn');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            this.showEditModal();
          });
        }
      }

      // 显示编辑模态框
      showEditModal() {
        // 先移除已存在的模态框
        const existingModal = document.getElementById('chat-edit-modal');
        if (existingModal) {
          existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'chat-edit-modal';
        modal.className = 'tg-modal-overlay';
        // 获取聊天界面的宽度，并设置得比聊天界面小一点
        const chatContainerElement = document.querySelector('.tg-chat-module-container');
        const chatWidth = chatContainerElement ? Math.max(chatContainerElement.offsetWidth - 40, 400) : 460;
        
        modal.innerHTML = `
          <div class="tg-modal-content" style="width: ${chatWidth}px; max-height: 60vh; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); position: fixed; top: 15%; left: 50%; transform: translateX(-50%); overflow: hidden; display: flex; flex-direction: column;">
            <div class="tg-modal-header" style="background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e1e5e9;">
              <h3 style="margin: 0; font-size: 18px; font-weight: 600;">✏️ 编辑聊天设置</h3>
              <button class="tg-modal-close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">&times;</button>
            </div>
            <div class="tg-modal-body" style="flex: 1; padding: 20px; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; color: #333;">
              <style>
                .tg-modal-body::-webkit-scrollbar {
                  display: none;
                }
              </style>
              <div class="tg-form-group">
                <label for="chat-name">聊天名字</label>
                <input type="text" id="chat-name" value="${this.settings.chatName}" placeholder="小火聊聊天" style="width: 100%; padding: 8px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 14px; color: #333; transition: border-color 0.3s ease, box-shadow 0.3s ease;" onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 3px rgba(74, 144, 226, 0.1)'" onblur="this.style.borderColor='#e1e5e9'; this.style.boxShadow='none'">
              </div>
              
              <div class="tg-form-group">
                <label for="header-color">头部颜色</label>
                <input type="color" id="header-color" value="${this.settings.headerColor || '#ff6b6b'}" style="width: 100%; height: 40px; border: 2px solid #e1e5e9; border-radius: 6px;">
              </div>
              
              <div class="tg-form-group">
                <label for="user-avatar">用户头像</label>
                <div class="avatar-selection">
                  <div class="current-user-avatar" id="current-user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 10px; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); ${this.settings.userAvatar && this.settings.userAvatar.startsWith('data:') ? `background-image: url(${this.settings.userAvatar}); background-size: cover; background-position: center;` : ''}">${this.settings.userAvatar && this.settings.userAvatar.startsWith('data:') ? '' : (this.settings.userAvatar || '🔥')}</div>
                  <input type="file" id="user-avatar-upload" accept="image/*" style="display: none;">
                  <button type="button" id="upload-user-avatar-btn" style="padding: 6px 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; font-size: 12px;">上传用户头像</button>
                </div>
              </div>
              
              <div class="tg-form-group">
                <label for="avatar-select">头像选择</label>
                <div class="avatar-selection">
                  <div class="current-avatar" id="current-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 10px; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.2); ${this.settings.avatar && this.settings.avatar.startsWith('data:') ? `background-image: url(${this.settings.avatar}); background-size: cover; background-position: center;` : ''}">${this.settings.avatar && this.settings.avatar.startsWith('data:') ? '' : (this.settings.avatar || '🔥')}</div>
                  <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                  <button type="button" id="upload-avatar-btn" style="padding: 6px 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; cursor: pointer; font-size: 12px;">上传头像</button>
                </div>
              </div>
              
              <div class="tg-form-group">
                <label for="character-prompt">人设提示词</label>
                <textarea id="character-prompt" rows="6" style="width: 100%; padding: 8px; border: 2px solid #e1e5e9; border-radius: 6px; font-size: 14px; resize: vertical; transition: border-color 0.3s ease, box-shadow 0.3s ease;" onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 3px rgba(74, 144, 226, 0.1)'" onblur="this.style.borderColor='#e1e5e9'; this.style.boxShadow='none'">${this.settings.characterPrompt}</textarea>
              </div>
              
              <div class="tg-form-group">
                <label>人设管理</label>
                <div class="preset-list" id="preset-list">
                  ${this.renderPresetList()}
                </div>
                <div class="preset-actions" style="margin-top: 10px;">
                  <input type="text" id="new-preset-name" placeholder="新人设名" style="width: 60%; padding: 6px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; color: #333; transition: border-color 0.3s ease, box-shadow 0.3s ease;" onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 3px rgba(74, 144, 226, 0.1)'" onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                  <button type="button" id="add-preset-btn" style="width: 35%; padding: 6px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.3s ease;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">添加人设</button>
                </div>
              </div>
            </div>
            <div class="tg-modal-footer" style="padding: 20px; border-top: 1px solid #e1e5e9; background: #f8f9fa; display: flex; gap: 12px; justify-content: flex-end;">
              <button id="save-edit-settings" class="tg-btn tg-primary" style="padding: 10px 20px; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">保存设置</button>
              <button class="tg-btn tg-secondary tg-modal-close" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">取消</button>
            </div>
          </div>
        `;

        // 将模态框添加到聊天模块容器内，而不是整个页面
        if (chatContainerElement) {
          chatContainerElement.appendChild(modal);
        } else {
          // 如果找不到聊天容器，则添加到body
          document.body.appendChild(modal);
        }

        // 绑定预设事件
        this.bindPresetEvents();

        // 绑定事件
        const closeModal = () => {
          const modalToRemove = document.getElementById('chat-edit-modal');
          if (modalToRemove) {
            modalToRemove.remove();
          }
        };

        modal.querySelectorAll('.tg-modal-close').forEach(btn => {
          btn.addEventListener('click', closeModal);
        });

        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });

        // AI头像上传
        document.getElementById('upload-avatar-btn').addEventListener('click', () => {
          document.getElementById('avatar-upload').click();
        });

        document.getElementById('avatar-upload').addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            this.handleAvatarUpload(file);
          }
        });

        // 用户头像上传
        document.getElementById('upload-user-avatar-btn').addEventListener('click', () => {
          document.getElementById('user-avatar-upload').click();
        });

        document.getElementById('user-avatar-upload').addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            this.handleUserAvatarUpload(file);
          }
        });

        // 添加预设
        document.getElementById('add-preset-btn').addEventListener('click', () => {
          const name = document.getElementById('new-preset-name').value.trim();
          if (name) {
            this.addPreset(name);
            document.getElementById('new-preset-name').value = '';
          }
        });

        // 保存设置
        document.getElementById('save-edit-settings').addEventListener('click', () => {
          const chatName = document.getElementById('chat-name').value.trim();
          const prompt = document.getElementById('character-prompt').value;
          const headerColor = document.getElementById('header-color').value;
          
          this.settings.chatName = chatName || '小火聊聊天';
          this.settings.characterPrompt = prompt;
          this.settings.headerColor = headerColor;
          
          // 如果当前使用的是某个预设，更新该预设的prompt（但不影响用户头像）
          if (this.settings.currentPresetId) {
            const currentPreset = this.settings.presets.find(p => p.id === this.settings.currentPresetId);
            if (currentPreset) {
              currentPreset.prompt = prompt;
              currentPreset.avatar = this.settings.avatar;
              currentPreset.headerColor = headerColor;
              // 注意：不更新用户头像，用户头像独立于AI人设
            }
          }
          
          this.saveSettings();
          
          // 更新界面显示
          this.updateChatDisplay();
          
          this.showNotification('设置已保存', 'success');
          closeModal();
        });
      }

      // 更新聊天显示
      updateChatDisplay() {
        const titleElement = document.querySelector('.tg-chat-header h2');
        if (titleElement) {
          // 保持🔥小火聊聊天作为整体名称，不要分离
          titleElement.textContent = `🔥 ${this.settings.chatName || '小火聊聊天'}`;
        }
        
        const headerElement = document.querySelector('.tg-chat-header');
        if (headerElement && this.settings.headerColor) {
          headerElement.style.background = `linear-gradient(135deg, ${this.settings.headerColor}, ${this.lightenColor(this.settings.headerColor, 20)})`;
        }
        
        // 更新所有聊天头像
        const avatarElements = document.querySelectorAll('.chat-avatar');
        avatarElements.forEach(avatarElement => {
          // 如果头像是图片URL，显示图片；否则显示emoji
          if (this.settings.avatar && this.settings.avatar.startsWith('data:')) {
            avatarElement.style.backgroundImage = `url(${this.settings.avatar})`;
            avatarElement.style.backgroundSize = 'cover';
            avatarElement.style.backgroundPosition = 'center';
            avatarElement.textContent = '';
          } else {
            avatarElement.style.backgroundImage = '';
            avatarElement.textContent = this.settings.avatar || '🔥';
          }
        });
        
        // ✅ 修复：加载并显示聊天记录
        this.loadAndDisplayHistory();
      }

      // ✅ 加载并显示聊天记录
      loadAndDisplayHistory() {
        const chatContainer = document.getElementById('chat-messages');
        if (!chatContainer) return;
        
        // 清空当前显示
        chatContainer.innerHTML = '';
        
        // 如果有聊天记录，显示它们
        if (this.history && this.history.length > 0) {
          console.log(`[小火聊天] 加载 ${this.history.length} 条聊天记录`);
          
          this.history.forEach(msg => {
            this.addMessageToUI(msg.role, msg.content, msg.id);
          });
          
          // 滚动到底部
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
          console.log('[小火聊天] 没有聊天记录');
        }
      }

      // 渲染预设列表
      renderPresetList() {
        if (!this.settings.presets) return '';
        
        return this.settings.presets.map(preset => `
          <div class="preset-item" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border: 1px solid #e1e5e9; border-radius: 6px; margin-bottom: 8px; background: #f8f9fa;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 500;">${preset.name}</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="use-preset-btn" data-id="${preset.id}" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">使用</button>
              ${!preset.isDefault ? `<button type="button" class="delete-preset-btn" data-id="${preset.id}" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">删除</button>` : ''}
            </div>
          </div>
        `).join('');
      }

      // 处理AI头像上传
      handleAvatarUpload(file) {
        if (file.size > 2 * 1024 * 1024) {
          this.showNotification('头像文件过大，请选择小于2MB的图片', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          // 压缩图片
          this.compressImage(e.target.result, file.name).then(compressedUrl => {
            this.settings.avatar = compressedUrl;
            const avatarElement = document.getElementById('current-avatar');
            if (avatarElement) {
              avatarElement.style.backgroundImage = `url(${compressedUrl})`;
              avatarElement.style.backgroundSize = 'cover';
              avatarElement.style.backgroundPosition = 'center';
              avatarElement.textContent = '';
            }
            this.showNotification('AI头像上传成功', 'success');
          }).catch(error => {
            this.showNotification('头像处理失败: ' + error.message, 'error');
          });
        };
        reader.readAsDataURL(file);
      }

      // 处理用户头像上传
      handleUserAvatarUpload(file) {
        if (file.size > 2 * 1024 * 1024) {
          this.showNotification('头像文件过大，请选择小于2MB的图片', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          // 压缩图片
          this.compressImage(e.target.result, file.name).then(compressedUrl => {
            this.settings.userAvatar = compressedUrl;
            const avatarElement = document.getElementById('current-user-avatar');
            if (avatarElement) {
              avatarElement.style.backgroundImage = `url(${compressedUrl})`;
              avatarElement.style.backgroundSize = 'cover';
              avatarElement.style.backgroundPosition = 'center';
              avatarElement.textContent = '';
            }
            this.showNotification('用户头像上传成功', 'success');
          }).catch(error => {
            this.showNotification('头像处理失败: ' + error.message, 'error');
          });
        };
        reader.readAsDataURL(file);
      }

      // 压缩图片
      compressImage(imageUrl, fileName) {
        return new Promise((resolve, reject) => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
              // 计算压缩后的尺寸，最大64x64px
              const maxSize = 64;
              let { width, height } = img;
              
              if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width *= ratio;
                height *= ratio;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              // 绘制压缩后的图片
              ctx.drawImage(img, 0, 0, width, height);
              
              // 转换为base64，使用中等质量
              const compressedUrl = canvas.toDataURL('image/jpeg', 0.7);
              
              console.log(`[Chat Module] 头像已压缩: ${width}x${height}, 原文件: ${fileName}`);
              resolve(compressedUrl);
            };
            
            img.onerror = () => {
              reject(new Error('图片加载失败'));
            };
            
            img.src = imageUrl;
          } catch (error) {
            reject(error);
          }
        });
      }

      // 添加预设
      addPreset(name) {
        const newPreset = {
          id: 'preset_' + Date.now(),
          name: name,
          prompt: this.settings.characterPrompt,
          avatar: this.settings.avatar,
          headerColor: this.settings.headerColor,
          isDefault: false
        };
        
        this.settings.presets.push(newPreset);
        this.settings.currentPresetId = newPreset.id; // 设置为当前使用的预设
        this.saveSettings();
        
        // 更新预设列表显示
        const presetList = document.getElementById('preset-list');
        if (presetList) {
          presetList.innerHTML = this.renderPresetList();
          this.bindPresetEvents();
        }
        
        this.showNotification(`预设"${name}"已添加`, 'success');
      }

      // 绑定预设事件
      bindPresetEvents() {
        // 使用预设
        document.querySelectorAll('.use-preset-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const presetId = e.target.dataset.id;
            this.usePreset(presetId);
          });
        });

        // 删除预设
        document.querySelectorAll('.delete-preset-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const presetId = e.target.dataset.id;
            this.deletePreset(presetId);
          });
        });
      }

      // 使用预设
      usePreset(presetId) {
        const preset = this.settings.presets.find(p => p.id === presetId);
        if (preset) {
          this.settings.chatName = preset.name + '聊聊天';
          this.settings.characterPrompt = preset.prompt;
          this.settings.avatar = preset.avatar;
          this.settings.headerColor = preset.headerColor;
          this.settings.currentPresetId = presetId; // 记录当前使用的预设ID
          // 注意：不更新用户头像，用户头像独立于AI人设
          
          // 更新表单
          document.getElementById('chat-name').value = this.settings.chatName;
          document.getElementById('character-prompt').value = this.settings.characterPrompt;
          document.getElementById('header-color').value = this.settings.headerColor;
          
          // 更新AI头像显示
          const avatarElement = document.getElementById('current-avatar');
          if (avatarElement) {
            if (preset.avatar.startsWith('data:')) {
              avatarElement.style.backgroundImage = `url(${preset.avatar})`;
              avatarElement.style.backgroundSize = 'cover';
              avatarElement.style.backgroundPosition = 'center';
              avatarElement.textContent = '';
            } else {
              avatarElement.style.backgroundImage = '';
              avatarElement.textContent = preset.avatar;
            }
          }
          
          // 保存设置以确保切换生效
          this.saveSettings();
          
          this.showNotification(`已切换到预设"${preset.name}"`, 'success');
        }
      }

      // 删除预设
      deletePreset(presetId) {
        const preset = this.settings.presets.find(p => p.id === presetId);
        if (preset && !preset.isDefault) {
          if (confirm(`确定要删除预设"${preset.name}"吗？`)) {
            this.settings.presets = this.settings.presets.filter(p => p.id !== presetId);
            this.saveSettings();
            
            // 更新预设列表显示
            const presetList = document.getElementById('preset-list');
            if (presetList) {
              presetList.innerHTML = this.renderPresetList();
              this.bindPresetEvents();
            }
            
            this.showNotification(`预设"${preset.name}"已删除`, 'success');
          }
        }
      }

      // 颜色变亮
      lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
          (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
          (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
      }

    }
    // 📝 内嵌模块代码区域 - DiaryModule
    // ========================================
    // 日记模块 - 独立的日记生成功能
    // 基于TheaterModule封装，使用日记风格的提示词和界面
    
    class DiaryModule {
      constructor() {
        this.settings = this.loadSettings();
        this.history = this.loadHistory();
        this.prompts = this.loadPrompts();
        this.apiConfig = this.loadAPIConfig();
        this.currentMessageCount = 0;
        this.threshold = 10; // 默认阈值
        this.currentPreviewIndex = 0;
        this.lastOutputs = this.loadLastOutputs();
        // 优先采用 API 设置中的阈值（若存在），否则采用模块设置
        if (this.apiConfig && Number.isFinite(this.apiConfig.messageThreshold)) {
          this.threshold = this.apiConfig.messageThreshold;
        }
        this.init();
      }

      init() {
        console.log('[Diary Module] 日记模块初始化');
        this.updateMessageCount();
      }

      loadSettings() {
        const defaultSettings = {
          diaryPrompt: '请生成一篇日记，记录角色的内心感受和日常经历。',
          diaryLength: 800,
          diaryStyle: 'personal',
          characterCount: 1,
          autoSave: true,
          messageThreshold: 10, // 消息阈值
          diaryCount: 1, // 日记一次只生成一个
          selectedPreset: '',
          customPrompt: '' // 用户自定义输入的提示词
        };

        try {
          const saved = localStorage.getItem('diary_module_settings');
          const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
          // 日记模块固定为1个，不允许修改
          settings.diaryCount = 1;
          this.threshold = settings.messageThreshold;
          return settings;
        } catch (error) {
          console.warn('[Diary Module] 设置加载失败，使用默认设置:', error);
          return defaultSettings;
        }
      }

      loadLastOutputs() {
        try {
          // 检查localStorage是否可用
          if (typeof Storage === 'undefined' || !window.localStorage) {
            console.warn('[Diary Module] localStorage不可用，使用内存存储');
            return this.lastOutputs || [];
          }
          
          const saved = localStorage.getItem('diary_module_last_outputs');
          if (!saved) return [];
          
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            console.log('[Diary Module] 成功加载上次输出，数量:', parsed.length);
            return parsed.slice(0, 1); // 日记只保留1个
          }
          return [];
        } catch (error) {
          console.warn('[Diary Module] 加载上次输出失败:', error);
          return [];
        }
      }

      saveLastOutputs(outputs) {
        try {
          const arr = Array.isArray(outputs) ? outputs.slice(0, 1) : []; // 日记只保存1个
          
          // 检查localStorage是否可用
          if (typeof Storage === 'undefined' || !window.localStorage) {
            console.warn('[Diary Module] localStorage不可用，仅保存到内存');
            this.lastOutputs = arr;
            return;
          }
          
          localStorage.setItem('diary_module_last_outputs', JSON.stringify(arr));
          this.lastOutputs = arr;
          console.log('[Diary Module] 成功保存输出，数量:', arr.length);
        } catch (error) {
          console.warn('[Diary Module] 保存输出失败:', error);
          // 即使保存失败，也要更新内存中的内容
          this.lastOutputs = Array.isArray(outputs) ? outputs.slice(0, 1) : [];
        }
      }

      // 更新消息计数
      updateMessageCount() {
        try {
          if (window.TavernHelper && window.TavernHelper.getChatMessages) {
            const messages = window.TavernHelper.getChatMessages('0-{{lastMessageId}}');
            this.currentMessageCount = messages ? messages.length : 0;
          } else if (window.getLastMessageId) {
            this.currentMessageCount = window.getLastMessageId() + 1;
          } else {
            // 降级方案：尝试从DOM获取
            const messageElements = document.querySelectorAll('[id^="mes_"]');
            this.currentMessageCount = messageElements.length;
          }
          console.log('[Diary Module] 当前消息数量:', this.currentMessageCount);
        } catch (error) {
          console.warn('[Diary Module] 获取消息数量失败:', error);
          this.currentMessageCount = 0;
        }
      }

      loadHistory() {
        try {
          const saved = localStorage.getItem('diary_module_history');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Diary Module] 历史记录加载失败:', error);
          return [];
        }
      }

      loadPrompts() {
        try {
          const saved = localStorage.getItem('diary_module_prompts');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Diary Module] 提示词加载失败:', error);
          return [];
        }
      }

      loadAPIConfig() {
        const defaultAPIConfig = {
          enabled: false,
          provider: 'openai',
          apiUrl: '',
          apiKey: '',
          model: '',
          temperature: 0.8,
          maxTokens: 30000,
          useProxy: false,
          proxyUrl: '',
          timeout: 30000,
          retryCount: 3,
          customHeaders: {},
          systemPrompt: '',
          streamEnabled: false,
          messageThreshold: 10
        };

        try {
          const saved = localStorage.getItem('theater_api_settings');
          return saved ? { ...defaultAPIConfig, ...JSON.parse(saved) } : defaultAPIConfig;
        } catch (error) {
          console.warn('[Diary Module] API配置加载失败，使用默认配置:', error);
          return defaultAPIConfig;
        }
      }

      saveSettings() {
        try {
          localStorage.setItem('diary_module_settings', JSON.stringify(this.settings));
          console.log('[Diary Module] 设置已保存');
        } catch (error) {
          console.warn('[Diary Module] 设置保存失败:', error);
        }
      }

      saveHistory() {
        try {
          localStorage.setItem('diary_module_history', JSON.stringify(this.history));
        } catch (error) {
          console.warn('[Diary Module] 历史记录保存失败:', error);
        }
      }

      savePrompts() {
        try {
          localStorage.setItem('diary_module_prompts', JSON.stringify(this.prompts));
        } catch (error) {
          console.warn('[Diary Module] 提示词保存失败:', error);
        }
      }

      loadCustomPresets() {
        try {
          const saved = localStorage.getItem('diary_module_custom_presets');
          return saved ? JSON.parse(saved) : [];
        } catch (error) {
          console.warn('[Diary Module] 自定义预设加载失败:', error);
          return [];
        }
      }

      saveCustomPresets(presets) {
        try {
          localStorage.setItem('diary_module_custom_presets', JSON.stringify(presets));
        } catch (error) {
          console.warn('[Diary Module] 自定义预设保存失败:', error);
        }
      }

      // 获取HTML内容
      getContent() {
        this.updateMessageCount();
        const progress = Math.min((this.currentMessageCount / this.threshold) * 100, 100);
        
        // 加载自定义预设
        const customPresets = this.loadCustomPresets();
        const customPresetOptions = customPresets.map(preset => 
          `<option value="${preset.content}">${preset.name}</option>`
        ).join('');
        
        return `
          <div class="tg-diary-module-container" style="margin: 0 20px;">
            <div class="tg-diary-header">
              <h2>📝 日记生成</h2>
            </div>
            <div class="tg-diary-content">
              <!-- 提示词设置 -->
              <div class="tg-diary-form">
                <div class="tg-form-group">
                  <label for="diary-preset" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">📝 提示词预设模版</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <select id="diary-preset" style="flex:1;padding:8px 12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">
                      <option value="">🎨 自定义</option>
                      <option value="你作为char角色，根据上下文，创作一篇饱含感情的日志">小火默认日记预设</option>
                      ${customPresetOptions}
                    </select>
                    <button id="delete-preset" style="padding:8px;background:#ff6b6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.2s ease;min-width:36px;" title="删除选中的预设" onmouseover="this.style.background='#ff5252'" onmouseout="this.style.background='#ff6b6b'">🗑️</button>
                  </div>
                </div>
                <div class="tg-form-group">
                  <label for="diary-prompt" style="font-weight:500;color:#333;margin-bottom:6px;display:block;">✍️ 提示词</label>
                  <textarea id="diary-prompt" placeholder="描述你想要记录的日记内容..." rows="3" style="width:100%;padding:12px;border:2px solid #e1e5e9;border-radius:8px;background:#fff;font-size:14px;color:#333;transition:all 0.2s ease;outline:none;resize:vertical;min-height:80px;" onfocus="this.style.borderColor='#4a90e2'" onblur="this.style.borderColor='#e1e5e9'">${this.settings.customPrompt || this.settings.diaryPrompt}</textarea>
                </div>
                <div class="tg-form-actions" style="display:flex;gap:12px;margin-top:20px;">
                  <button id="generate-diary" style="flex:1;padding:12px 20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:all 0.3s ease;box-shadow:0 4px 15px rgba(102, 126, 234, 0.3);min-height:48px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.3)'">📝 生成日记</button>
                  <button id="save-prompt" style="flex:1;padding:12px 20px;background:#f8f9fa;color:#495057;border:2px solid #e9ecef;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:all 0.3s ease;min-height:48px;" onmouseover="this.style.background='#e9ecef';this.style.borderColor='#dee2e6'" onmouseout="this.style.background='#f8f9fa';this.style.borderColor='#e9ecef'">💾 保存提示词</button>
                </div>
              </div>

              <!-- HTML预览区域 -->
              <div class="tg-diary-result" id="diary-result" style="display:block;">
                <div id="diary-previews" style="position:relative;">
                  <!-- 预览容器将由脚本注入 -->
                </div>
                <div style="text-align: center; margin-top: 12px; display: flex; gap: 8px; justify-content: center;">
                  <button id="screenshot-diary" style="padding:8px 16px;background:#28a745;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">📸 截图</button>
                  <button id="fullscreen-diary" style="padding:8px 16px;background:#17a2b8;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s ease;" onmouseover="this.style.background='#138496'" onmouseout="this.style.background='#17a2b8'">⛶ 全屏</button>
                </div>
              </div>
            </div>
            <div style="margin-bottom: 30px;"></div>
          </div>
        `;
      }

      // 绑定事件
      bindEvents() {
        // 预设模版选择
        const presetSelect = document.getElementById('diary-preset');
        if (presetSelect) {
          presetSelect.addEventListener('change', e => {
            const val = e.target.value || '';
            if (val) {
              const ta = document.getElementById('diary-prompt');
              if (ta) {
                ta.value = val;
                // 清空自定义提示词，因为选择了预设
                this.settings.customPrompt = '';
                this.saveSettings();
              }
              this.settings.selectedPreset = val;
              this.saveSettings();
            }
          });
          // 恢复已选预设
          if (this.settings.selectedPreset) {
            presetSelect.value = this.settings.selectedPreset;
            // 同时恢复预设对应的提示词内容
            const ta = document.getElementById('diary-prompt');
            if (ta) {
              ta.value = this.settings.selectedPreset;
            }
          }
        }

        // 提示词输入框事件
        const promptTextarea = document.getElementById('diary-prompt');
        if (promptTextarea) {
          promptTextarea.addEventListener('input', (e) => {
            // 用户手动输入时，清空预设选择并保存自定义提示词
            const presetSelect = document.getElementById('diary-preset');
            if (presetSelect) {
              presetSelect.value = '';
              this.settings.selectedPreset = '';
            }
            this.settings.customPrompt = e.target.value;
            this.saveSettings();
          });
        }

        // 生成日记按钮
        const generateBtn = document.getElementById('generate-diary');
        if (generateBtn) {
          generateBtn.addEventListener('click', () => this.generateDiary());
        }

        // 保存提示词按钮
        const savePromptBtn = document.getElementById('save-prompt');
        if (savePromptBtn) {
          savePromptBtn.addEventListener('click', () => this.savePrompt());
        }

        // 删除预设按钮
        const deletePresetBtn = document.getElementById('delete-preset');
        if (deletePresetBtn) {
          deletePresetBtn.addEventListener('click', () => this.deletePreset());
        }

        // 截图按钮
        const screenshotBtn = document.getElementById('screenshot-diary');
        if (screenshotBtn) {
          screenshotBtn.addEventListener('click', () => {
            const cur = this.getCurrentPreviewElement();
            if (!cur) return this.showNotification('暂无预览内容', 'warning');
            // 临时将目标ID设为通用ID以复用截图逻辑
            const originalId = cur.id;
            cur.id = 'diary-html-preview';
            try { this.takeScreenshot(); } finally { cur.id = originalId; }
          });
        }

        // 全屏按钮
        const fullscreenBtn = document.getElementById('fullscreen-diary');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', () => {
            const cur = this.getCurrentPreviewElement();
            if (cur) this.openFullscreen(cur);
          });
        }

        // 首次渲染预览（恢复上次输出）
        this.renderPreviews(this.lastOutputs);

        // 检查是否有正在进行的生成任务，如果有则显示进度
        this.updateGenerationProgress();
      }

      async generateDiary() {
        try {
          const prompt = document.getElementById('diary-prompt').value;
          if (!prompt.trim()) {
            this.showNotification('请输入日记提示词', 'warning');
            return;
          }

          console.log('[Diary Module] 开始生成日记，提示词:', prompt.substring(0, 100) + '...');

          // 检查是否有正在进行的后台生成任务
          if (this.backgroundGenerationTask && this.backgroundGenerationTask.status === 'running') {
            this.showNotification('已有后台生成任务正在进行中，请等待完成', 'warning');
            return;
          }

          // 请求通知权限（提前请求）
          await this.requestNotificationPermission();

          // 更新按钮状态
          const generateBtn = document.getElementById('generate-diary');
          const originalText = generateBtn.textContent;
          generateBtn.textContent = '生成中...';
          generateBtn.disabled = true;

          // 创建生成任务（标记为前台生成）
          this.backgroundGenerationTask = {
            status: 'running',
            progress: 0,
            total: 1,
            prompt: prompt,
            startTime: Date.now(),
            isForeground: true  // 标记为前台生成
          };

          // 检查是否已切换到后台模式
          if (this.backgroundGenerationTask && !this.backgroundGenerationTask.isForeground) {
            console.log('[Diary Module] 检测到界面已关闭，切换到后台生成模式');
            // 调用后台生成方法继续生成
            await this.generateDiaryBackground();
            return;
          }

          // 更新任务进度
          this.backgroundGenerationTask.progress = 1;
          
          // 获取聊天历史
          const chatHistory = this.getChatHistory();
          console.log('[Diary Module] 聊天历史长度:', chatHistory.length);
          
          // 使用新的日记prompt模板
          const systemPrompt = `你是一名角色，你可能会是char，也有可能是动物或者路人，至于是什么角色需要根据提示词来判定，要代入你的角色，根据上下文写你的日记。
要求：
1. 生成HTML内联代码片段，包含CSS样式，但严格禁止使用<html>、<head>、<body>等完整文档标签
2. 可以自由选择最适合当前日记内容和风格的格式，尝试多样化的美化方式。
3. 鼓励根据日记的情绪，使用不同的字体效果（粗体、斜体）、颜色、背景、边框、列表或区块划分等，来达到最好的效果
4. 当用户提示词里明确提到nsfw向的词语时，你不会回避nsfw向内容的生成，器官词汇拒绝隐晦，但需要注意不要太过粗俗，可以用一些女性向的词汇。
5. 输出为可直接渲染的HTML片段，不要解释文字与代码围栏

聊天历史：
${chatHistory}

用户提示：${prompt}

请直接返回HTML内联代码片段，不要包含任何解释文字。`;

          console.log('[Diary Module] 完整prompt长度:', systemPrompt.length);
          
          // 调用API生成日记
          const result = await this.callDiaryAPI(systemPrompt);
          
          let diaryContent = result;
          
          // 如果API调用失败或返回空结果，使用本地生成
          if (!diaryContent || !diaryContent.trim()) {
            console.log('[Diary Module] API调用失败，使用本地生成');
            diaryContent = this.generateLocalDiary(prompt, chatHistory);
          }
          
          // 去围栏（移除```html和```标记）
          let stripped = (diaryContent || '')
            .replace(/^```html\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          
          if (!stripped) {
            stripped = this.generateLocalDiary(prompt, chatHistory).trim();
          }
          
          // 最终HTML处理
          const finalResult = this.generateHTMLDiary(stripped);
          
          if (finalResult && finalResult.trim()) {
            console.log('[Diary Module] 日记生成成功，结果长度:', finalResult.length);
            
            // 标记任务完成
            this.backgroundGenerationTask.status = 'completed';
            this.backgroundGenerationTask.endTime = Date.now();
            this.backgroundGenerationTask.outputs = [finalResult];
            
            // 保存到历史记录
            this.addToHistory({
              prompt: prompt,
              result: finalResult,
              timestamp: new Date().toISOString()
            });

            // 更新最后输出
            this.saveLastOutputs([finalResult]);
            
            // 渲染预览
            this.renderPreviews([finalResult]);
            
            this.showNotification('日记生成成功！', 'success');
          } else {
            console.error('[Diary Module] 生成结果为空');
            this.showNotification('生成失败：无法生成日记内容', 'error');
          }

        } catch (error) {
          console.error('[Diary Module] 生成日记失败:', error);
          this.showNotification('生成失败: ' + error.message, 'error');

          // 标记任务失败
          if (this.backgroundGenerationTask) {
            this.backgroundGenerationTask.status = 'failed';
            this.backgroundGenerationTask.error = error.message;
          }
        } finally {
          // 恢复按钮状态
          const generateBtn = document.getElementById('generate-diary');
          generateBtn.textContent = '📝 生成日记';
          generateBtn.disabled = false;

          // 清除任务
          setTimeout(() => {
            this.backgroundGenerationTask = null;
          }, 5000);
        }
      }

      // 后台生成方法
      async generateDiaryBackground() {
        try {
          // 检查是否有正在进行的生成任务
          if (!this.backgroundGenerationTask || this.backgroundGenerationTask.status !== 'running') {
            console.log('[Diary Module] 后台生成：没有正在进行的任务');
            return;
          }

          const task = this.backgroundGenerationTask;
          const prompt = task.prompt;
          const currentProgress = task.progress;

          console.log('[Diary Module] 继续后台生成任务，当前进度:', currentProgress, '/', task.total);

          // 获取聊天历史作为上下文
          const chatHistory = this.getChatHistory();
          
          // 使用新的日记prompt模板
          const systemPrompt = `你是一名角色，你可能会是char，也有可能是动物或者路人，至于是什么角色需要根据提示词来判定，要代入你的角色，根据上下文写你的日记。
要求：
1. 生成HTML内联代码片段，包含CSS样式，但严格禁止使用<html>、<head>、<body>等完整文档标签
2. 可以自由选择最适合当前日记内容和风格的格式，尝试多样化的美化方式。
3. 鼓励根据日记的情绪，使用不同的字体效果（粗体、斜体）、颜色、背景、边框、列表或区块划分等，来达到最好的效果
4. 当用户提示词里明确提到nsfw向的词语时，你不会回避nsfw向内容的生成，器官词汇拒绝隐晦，但需要注意不要太过粗俗，可以用一些女性向的词汇。
5. 输出为可直接渲染的HTML片段，不要解释文字与代码围栏

聊天历史：
${chatHistory}

用户提示：${prompt}

请直接返回HTML内联代码片段，不要包含任何解释文字。`;

          // 更新后台任务进度
          this.backgroundGenerationTask.progress = 1;
          
          // 更新按钮进度显示（如果界面还开着）
          this.updateGenerationProgress();
          
          // 调用API生成日记
          const result = await this.callDiaryAPI(systemPrompt);
          
          let diaryContent = result;
          
          // 如果API调用失败或返回空结果，使用本地生成
          if (!diaryContent || !diaryContent.trim()) {
            console.log('[Diary Module] API调用失败，使用本地生成');
            diaryContent = this.generateLocalDiary(prompt, chatHistory);
          }
          
          // 去围栏（移除```html和```标记）
          let stripped = (diaryContent || '')
            .replace(/^```html\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          
          if (!stripped) {
            stripped = this.generateLocalDiary(prompt, chatHistory).trim();
          }
          
          // 最终HTML处理
          const finalResult = this.generateHTMLDiary(stripped);
          
          if (finalResult && finalResult.trim()) {
            console.log('[Diary Module] 后台日记生成成功，结果长度:', finalResult.length);
            
            // 标记后台任务完成
            this.backgroundGenerationTask.status = 'completed';
            this.backgroundGenerationTask.endTime = Date.now();
            this.backgroundGenerationTask.outputs = [finalResult];
            
            // 保存到历史记录
            this.addToHistory({
              prompt: prompt,
              result: finalResult,
              timestamp: new Date().toISOString()
            });

            // 更新最后输出
            this.saveLastOutputs([finalResult]);
            
            // 显示完成提示 + 提示音
            const successMessage = '日记生成成功！';
            this.showNotification(successMessage, 'success');
            if (window.playNotifySound) window.playNotifySound();
            // 仍然尝试系统通知（如果授权）
            this.showBrowserNotification(successMessage, '日记生成完成！');

            // 同步插入到聊天（系统消息）
            try {
              if (typeof addDiaryMessage === 'function') {
                addDiaryMessage(finalResult);
              }
            } catch (insertErr) {
              console.warn('[Diary Module] 插入聊天失败（已忽略）：', insertErr);
            }

            console.log('[Diary Module] 后台生成任务完成');

            // 更新按钮状态
            this.updateGenerationProgress();

            // 清除后台任务
            setTimeout(() => {
              this.backgroundGenerationTask = null;
              this.updateGenerationProgress(); // 再次更新确保按钮恢复正常
            }, 5000);
          } else {
            console.error('[Diary Module] 后台生成结果为空');
            const errorMessage = '生成失败：无法生成日记内容';
            this.showBrowserNotification(errorMessage, '日记生成失败');
            
            // 标记后台任务失败
            if (this.backgroundGenerationTask) {
              this.backgroundGenerationTask.status = 'failed';
              this.backgroundGenerationTask.error = errorMessage;
            }
          }

        } catch (error) {
          console.error('[Diary Module] 后台生成失败:', error);
          const errorMessage = '生成失败: ' + error.message;

          // 显示错误通知
          this.showBrowserNotification(errorMessage, '日记生成失败');

          // 标记后台任务失败
          if (this.backgroundGenerationTask) {
            this.backgroundGenerationTask.status = 'failed';
            this.backgroundGenerationTask.error = error.message;
          }
        }
      }

      // 调用API生成日记
      async callDiaryAPI(prompt) {
        console.log('[Diary Module] 开始调用API，prompt长度:', prompt.length);
        
        // 优先尝试使用 SillyTavern 内置生成（避免外部API配置问题）
        try {
          if (window.SillyTavern && typeof window.SillyTavern.generate === 'function') {
            console.log('[Diary Module] 使用 SillyTavern.generate');
            const result = await window.SillyTavern.generate({
              user_input: prompt,
              should_stream: false,
              max_chat_history: 'all',
            });
            console.log('[Diary Module] SillyTavern.generate 结果:', result ? '有结果' : '无结果');
            if (result) return result.trim();
          } else {
            console.log('[Diary Module] SillyTavern.generate 不可用');
          }
        } catch (e) {
          console.warn('[Diary Module] 使用 SillyTavern.generate 失败:', e);
        }

        // 后备：尝试全局 generate（若存在）
        try {
          if (typeof window.generate === 'function') {
            console.log('[Diary Module] 使用全局 generate');
            const result = await window.generate({ 
              user_input: prompt, 
              should_stream: false 
            });
            console.log('[Diary Module] 全局 generate 结果:', result ? '有结果' : '无结果');
            if (result) return result.trim();
          } else {
            console.log('[Diary Module] 全局 generate 不可用');
          }
        } catch (e) {
          console.error('[Diary Module] 使用后备 generate 失败:', e);
        }

        // 尝试外部API（如果配置了的话）
        try {
          if (this.isAPIAvailable()) {
            console.log('[Diary Module] 使用外部API');
            const messages = [
              {
                role: 'system',
                content: `你是一名角色，你可能会是char，也有可能是动物或者路人，至于是什么角色需要根据提示词来判定，要代入你的角色，根据上下文写你的日记。
要求：
1. 生成HTML内联代码片段，包含CSS样式，但严格禁止使用<html>、<head>、<body>等完整文档标签
2. 可以自由选择最适合当前日记内容和风格的格式，尝试多样化的美化方式。
3. 鼓励根据日记的情绪，使用不同的字体效果（粗体、斜体）、颜色、背景、边框、列表或区块划分等，来达到最好的效果
4. 当用户提示词里明确提到nsfw向的词语时，你不会回避nsfw向内容的生成，器官词汇拒绝隐晦，但需要注意不要太过粗俗，可以用一些女性向的词汇。
5. 输出为可直接渲染的HTML片段，不要解释文字与代码围栏
请直接返回HTML内联代码片段，不要包含任何解释文字。`,
              },
              { role: 'user', content: prompt },
            ];

            const response = await this.makeAPICall(messages);
            const result = response.content || response;
            console.log('[Diary Module] 外部API结果:', result ? '有结果' : '无结果');
            if (result) return result.trim();
          } else {
            console.log('[Diary Module] 外部API不可用');
          }
        } catch (e) {
          console.warn('[Diary Module] 外部API调用失败:', e);
        }
        
        console.log('[Diary Module] 所有API调用都失败，使用本地生成');
        return '';
      }

      // 检查API是否可用
      isAPIAvailable() {
        return this.apiConfig.enabled && this.apiConfig.apiUrl && this.apiConfig.model && this.apiConfig.apiKey;
      }

      // 执行API调用
      async makeAPICall(messages) {
        const provider = this.apiConfig.provider;
        let apiUrl = this.apiConfig.apiUrl;

        // 构建请求URL
        apiUrl = (apiUrl || '').toString();
        // 去除结尾多余斜杠
        apiUrl = apiUrl.replace(/\/+$/g, '');

        let requestUrl;
        if (provider === 'gemini') {
          // Gemini 端点通常不重复版本段
          requestUrl = `${apiUrl}/v1beta/models/${this.apiConfig.model}:generateContent?key=${this.apiConfig.apiKey}`;
        } else {
          // OpenAI 兼容端点：如果 base 已包含 /v{n}，则不要重复添加
          const hasVersion = /\/v\d+(?:\/|$)/.test(apiUrl);
          requestUrl = hasVersion
            ? `${apiUrl}/chat/completions`
            : `${apiUrl}/v1/chat/completions`;
          // 规范化重复斜杠（但保留协议部分 //）
          requestUrl = requestUrl.replace(/([^:])\/\/+/, '$1/');
        }

        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };
        if (provider !== 'gemini' && this.apiConfig.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiConfig.apiKey}`;
        }

        // 构建请求体
        const requestBody = this.buildRequestBody(provider, messages);

        console.log('[Diary Module] API请求:', {
          provider: provider,
          url: requestUrl.replace(this.apiConfig.apiKey || '', '[HIDDEN]'),
          headers: { ...headers, Authorization: headers.Authorization ? 'Bearer [HIDDEN]' : undefined },
        });

        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API调用失败: HTTP ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return this.parseAPIResponse(provider, data);
      }

      // 构建请求体
      buildRequestBody(provider, messages) {
        if (provider === 'gemini') {
          const contents = [];
          messages.forEach(msg => {
            if (msg.role === 'system') {
              if (contents.length === 0) {
                contents.push({
                  parts: [{ text: msg.content + '\n\n' }],
                });
              }
            } else if (msg.role === 'user') {
              const existingText = contents.length > 0 ? contents[contents.length - 1].parts[0].text : '';
              if (contents.length > 0 && !contents[contents.length - 1].role) {
                contents[contents.length - 1].parts[0].text = existingText + msg.content;
              } else {
                contents.push({
                  parts: [{ text: msg.content }],
                });
              }
            } else if (msg.role === 'assistant') {
              contents.push({
                role: 'model',
                parts: [{ text: msg.content }],
              });
            }
          });

          return {
            contents: contents,
            generationConfig: {
              maxOutputTokens: this.apiConfig.maxTokens,
              temperature: this.apiConfig.temperature,
            },
          };
        } else {
          return {
            model: this.apiConfig.model,
            messages: messages,
            max_tokens: this.apiConfig.maxTokens,
            temperature: this.apiConfig.temperature,
          };
        }
      }

      // 解析API响应
      parseAPIResponse(provider, data) {
        if (provider === 'gemini') {
          return {
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            usage: data.usageMetadata,
          };
        } else {
          return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage,
          };
        }
      }

      // 生成HTML格式的日记（无任何预设结构，仅最小包裹）
      generateHTMLDiary(content) {
        // 若已是HTML，直接返回，不添加任何额外结构
        if (/<[a-z][\s\S]*>/i.test(content)) return content;

        const lines = content.split('\n').filter(line => line.trim());
        // 仅用 <div> 包裹行，保持最小化
        return lines.map(line => {
          if (/[：:]/.test(line)) {
            const [speaker, ...rest] = line.split(/[：:]/);
            const dialogue = rest.join(':').trim();
            return `<div>${speaker.trim()}：${dialogue}</div>`;
          }
          return `<div>${line}</div>`;
        }).join('');
      }

      // 本地日记生成器：根据聊天历史和提示词生成简单的日记内容
      generateLocalDiary(userPrompt, chatHistory) {
        try {
          console.log('[Diary Module] 使用本地生成器');
          
          // 从聊天历史中提取角色信息
          const lines = (chatHistory || '').split('\n').filter(Boolean).slice(-5);
          const speakers = Array.from(new Set(lines
            .map(l => l.split(/[:：]/)[0]?.trim())
            .filter(Boolean)))
            .slice(0, 2);

          const mainCharacter = speakers[0] || '我';
          const topic = userPrompt || '今天发生的事情';
          
          // 生成简单的日记内容
          const diaryContent = `
            现在还没有日记呢~
          `;
          
          return diaryContent.trim();
        } catch (error) {
          console.warn('[Diary Module] 本地生成失败:', error);
          return `
            <div style="font-family: 'Microsoft YaHei', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
              <h3 style="color: #495057; text-align: center;">📝 日记</h3>
              <p style="color: #6c757d; line-height: 1.6;">喔噢...api似乎生成失败，再试一次吧</p>
            </div>
          `;
        }
      }

      getChatHistory() {
        try {
          if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
            const ctx = window.SillyTavern.getContext();
            if (ctx && Array.isArray(ctx.chat)) {
              return ctx.chat.slice(-10).map(msg => {
                const name = msg.name || (msg.is_user ? '用户' : '角色');
                return `${name}: ${msg.mes || msg.message || ''}`;
              }).join('\n');
            }
          }
          if (Array.isArray(window.chat)) {
            return window.chat.slice(-10).map(msg => {
              const name = msg.name || (msg.is_user ? '用户' : '角色');
              return `${name}: ${msg.mes || msg.message || ''}`;
            }).join('\n');
          }
        } catch (error) {
          console.warn('[Diary Module] 获取聊天历史失败:', error);
        }
        return '暂无聊天历史';
      }

      // 为预览中的图片设置 crossOrigin 以避免 CORS 污染画布
      setImagesCrossOrigin(root) {
        try {
          const images = root.querySelectorAll('img');
          images.forEach(img => {
            try {
              const url = new URL(img.getAttribute('src') || '', window.location.href);
              if (url.origin && url.origin !== window.location.origin) {
                if (img.crossOrigin !== 'anonymous') {
                  img.crossOrigin = 'anonymous';
                  const src = img.getAttribute('src');
                  img.src = src;
                }
              }
            } catch (_) {}
          });
        } catch (e) {
          console.warn('[Diary Module] 设置图片跨域属性失败（已忽略）:', e);
        }
      }

      // 等待容器内图片和字体加载完成
      async waitForAssets(root, timeoutMs = 15000) {
        const start = Date.now();
        const imgPromises = Array.from(root.querySelectorAll('img'))
          .filter(img => !(img.complete && img.naturalWidth > 0))
          .map(img => new Promise(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, Math.max(1000, timeoutMs / 2));
          }));

        const fontPromise = (document.fonts && document.fonts.ready)
          ? Promise.race([
              document.fonts.ready.catch(() => {}),
              new Promise(r => setTimeout(r, timeoutMs / 2)),
            ])
          : Promise.resolve();

        await Promise.race([
          Promise.allSettled([...imgPromises, fontPromise]),
          new Promise(r => setTimeout(r, Math.max(1500, timeoutMs - (Date.now() - start))))
        ]);
      }

      // 移动端截图辅助函数
      prepareMobileElementForScreenshot(element) {
        if (!element || window.innerWidth > 768) return element;
        
        // 创建临时容器来确保元素正确渲染
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
          width: ${window.innerWidth}px;
          height: auto;
          background: #ffffff;
          z-index: -1;
          overflow: visible;
        `;
        
        // 克隆元素
        const clone = element.cloneNode(true);
        
        // 重置所有可能影响渲染的样式
        clone.style.cssText = `
          position: static !important;
          transform: none !important;
          will-change: auto !important;
          max-width: none !important;
          max-height: none !important;
          overflow: visible !important;
          display: block !important;
          width: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        `;
        
        // 移除可能影响渲染的类
        clone.classList.remove('fullscreen', 'tg-fullscreen-overlay', 'tg-fullscreen-wrapper');
        
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);
        
        // 强制重新计算布局
        clone.offsetHeight;
        
        return { tempContainer, clone };
      }

      // 清理移动端截图辅助元素
      cleanupMobileScreenshotElements(tempContainer) {
        if (tempContainer && tempContainer.parentNode) {
          try {
            document.body.removeChild(tempContainer);
          } catch (e) {
            console.warn('[Diary Module] 清理临时元素失败:', e);
          }
        }
      }

      // 清理HTML内容，移除可能影响外部CSS的标签
      cleanHTMLContent(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string') return '';
        
        // 移除完整的HTML文档标签
        let cleaned = htmlContent
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<meta[^>]*>/gi, '')
          .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
          .replace(/<link[^>]*>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // 清理多余的空白字符
        cleaned = cleaned.trim();
        
        return cleaned;
      }

      renderPreviews(outputs) {
        const container = document.getElementById('diary-previews');
        if (!container) return;

        if (!outputs || outputs.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; border-radius: 8px; border: 2px dashed #dee2e6;">
              <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
              <h3 style="margin: 0 0 8px 0; color: #495057;">暂无日记内容</h3>
              <p style="margin: 0; font-size: 14px;">点击"生成日记"按钮开始创作</p>
            </div>
          `;
          return;
        }

        // 日记只显示一个预览，使用与小剧场相同的容器样式
        const output = outputs[0];
        container.innerHTML = '';
        
        const div = document.createElement('div');
        div.id = 'diary-html-preview';
        div.className = 'preview-container';
        div.style.cssText = 'border:1px solid #ddd;border-radius:8px;min-height:400px;max-height:70vh;overflow:auto;padding:12px;background:#fafafa;position:relative;display:block;';
        
        // 清理HTML内容，移除可能影响外部CSS的标签
        const cleanedOutput = this.cleanHTMLContent(output);
        div.innerHTML = cleanedOutput;
        container.appendChild(div);
        
        // 设置图片跨域属性以避免CORS污染
        this.setImagesCrossOrigin(div);
      }

      getCurrentPreviewElement() {
        return document.getElementById('diary-html-preview');
      }

      savePrompt() {
        const prompt = document.getElementById('diary-prompt').value.trim();
        if (!prompt) {
          this.showNotification('提示词不能为空', 'warning');
          return;
        }

        // 弹出输入预设名的对话框
        const presetName = window.prompt('请输入预设名称：', '');
        if (!presetName || !presetName.trim()) {
          this.showNotification('预设名称不能为空', 'warning');
          return;
        }

        // 获取现有自定义预设
        const customPresets = this.loadCustomPresets();
        
        // 检查是否已存在同名预设
        const existingIndex = customPresets.findIndex(preset => preset.name === presetName.trim());
        
        const newPreset = {
          name: presetName.trim(),
          content: prompt.trim(),
          timestamp: new Date().toISOString()
        };

        if (existingIndex >= 0) {
          // 更新现有预设
          customPresets[existingIndex] = newPreset;
          this.showNotification('预设已更新', 'success');
        } else {
          // 添加新预设
          customPresets.push(newPreset);
          this.showNotification('预设已保存', 'success');
        }

        // 保存到本地存储
        this.saveCustomPresets(customPresets);
        
        // 更新界面
        this.updatePresetSelect();
      }

      deletePreset() {
        const presetSelect = document.getElementById('diary-preset');
        const selectedValue = presetSelect.value;
        
        if (!selectedValue) {
          this.showNotification('请选择要删除的预设', 'warning');
          return;
        }

        // 确认删除
        if (!confirm('确定要删除这个预设吗？')) {
          return;
        }

        // 获取现有自定义预设
        const customPresets = this.loadCustomPresets();
        
        // 过滤掉要删除的预设
        const filteredPresets = customPresets.filter(preset => preset.content !== selectedValue);
        
        if (filteredPresets.length < customPresets.length) {
          this.saveCustomPresets(filteredPresets);
          this.showNotification('预设已删除', 'success');
          
          // 清空选择
          presetSelect.value = '';
          
          // 刷新界面
          this.updatePresetSelect();
        } else {
          this.showNotification('预设删除失败', 'error');
        }
      }

      updatePresetSelect() {
        // 直接更新预设选择框，不重新加载整个界面
        const presetSelect = document.getElementById('diary-preset');
        if (presetSelect) {
          const customPresets = this.loadCustomPresets();
          const customPresetOptions = customPresets.map(preset => 
            `<option value="${preset.content}">${preset.name}</option>`
          ).join('');
          
          // 保存当前选中的值
          const currentValue = presetSelect.value;
          
          // 更新选择框内容
          presetSelect.innerHTML = `
            <option value="">🎨 自定义</option>
            <option value="你作为char角色，根据上下文，创作一篇饱含感情的日志">小火默认日记预设</option>
            ${customPresetOptions}
          `;
          
          // 恢复之前选中的值（如果还存在）
          if (currentValue && presetSelect.querySelector(`option[value="${currentValue}"]`)) {
            presetSelect.value = currentValue;
          }
        }
      }

      addToHistory(item) {
        this.history.unshift(item);
        // 限制历史记录数量
        if (this.history.length > 50) {
          this.history = this.history.slice(0, 50);
        }
        this.saveHistory();
      }

      showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 6px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          max-width: 300px;
          word-wrap: break-word;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
        `;

        // 根据类型设置样式
        switch (type) {
          case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
          case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
          case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
          default:
            notification.style.backgroundColor = '#17a2b8';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          }
        }, 3000);
      }
      takeScreenshot() {
        try {
          const preview = document.getElementById('diary-html-preview');
          if (!preview) {
            this.showNotification('预览区域不存在', 'error');
            return;
          }

          // 检测是否为移动端
          const isMobile = window.innerWidth <= 768;
          console.log('[Diary Module] 截图环境检测:', {
            isMobile,
            devicePixelRatio: window.devicePixelRatio,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            previewScrollWidth: preview.scrollWidth,
            previewScrollHeight: preview.scrollHeight,
            previewClientWidth: preview.clientWidth,
            previewClientHeight: preview.clientHeight
          });

          // 确保按需加载 html2canvas
          const ensureHtml2canvas = () => new Promise((resolve, reject) => {
            if (window.html2canvas) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('html2canvas 加载失败'));
            document.head.appendChild(s);
          });

          ensureHtml2canvas()
            .then(() => {
              // 预处理跨域图片
              this.setImagesCrossOrigin(preview);
              
              // 移动端特殊处理：确保元素完全渲染
              if (isMobile) {
                // 强制重新计算样式
                preview.style.transform = 'translateZ(0)';
                preview.style.willChange = 'transform';
                // 等待一帧确保渲染完成
                return new Promise(resolve => {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                  });
                });
              }
            })
            .then(() => {
              // 移动端使用特殊处理
              if (isMobile) {
                const { tempContainer, clone } = this.prepareMobileElementForScreenshot(preview);
                const width = Math.max(clone.scrollWidth, clone.clientWidth, clone.offsetWidth);
                const height = Math.max(clone.scrollHeight, clone.clientHeight, clone.offsetHeight);
                
                console.log('[Diary Module] 移动端元素尺寸:', { width, height });
                
                return this.waitForAssets(clone).then(() => ({ 
                  cloneWrapper: tempContainer, 
                  clone, 
                  width, 
                  height,
                  isMobile: true 
                }));
              } else {
                // 桌面端使用原有逻辑
                const cloneWrapper = document.createElement('div');
                cloneWrapper.style.cssText = 'position:fixed;left:-100000px;top:0;background:#ffffff;z-index:-1;';
                const clone = preview.cloneNode(true);
                
                const width = Math.max(preview.scrollWidth, preview.clientWidth, preview.offsetWidth);
                const height = Math.max(preview.scrollHeight, preview.clientHeight, preview.offsetHeight);
                
                console.log('[Diary Module] 桌面端元素尺寸:', { width, height });
                
                clone.style.width = width + 'px';
                clone.style.height = height + 'px';
                clone.style.overflow = 'visible';
                cloneWrapper.appendChild(clone);
                document.body.appendChild(cloneWrapper);
                
                return this.waitForAssets(clone).then(() => ({ 
                  cloneWrapper, 
                  clone, 
                  width, 
                  height,
                  isMobile: false 
                }));
              }
            })
            .then(({ cloneWrapper, clone, width, height }) => {
              // 移动端使用更保守的缩放设置
              const scale = isMobile ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) : Math.max(1.5, Math.min(2, window.devicePixelRatio || 1));
              const safeW = Math.max(1, width || clone.scrollWidth || clone.clientWidth || 1);
              const safeH = Math.max(1, height || clone.scrollHeight || clone.clientHeight || 1);
              
              console.log('[Diary Module] Canvas配置:', { scale, safeW, safeH, isMobile });
              
              // 移动端特殊配置
              const canvasOptions = {
                backgroundColor: '#ffffff',
                scale,
                width: safeW,
                height: safeH,
                useCORS: true,
                allowTaint: false,
                imageTimeout: isMobile ? 20000 : 15000, // 减少超时时间提高速度
                foreignObjectRendering: false,
                logging: false, // 关闭日志提高速度
                scrollX: 0,
                scrollY: 0,
                windowWidth: safeW,
                windowHeight: safeH,
              };
              
              // 移动端额外配置
              if (isMobile) {
                canvasOptions.ignoreElements = (element) => {
                  // 忽略可能影响渲染的元素
                  return element.tagName === 'SCRIPT' || 
                         element.tagName === 'STYLE' ||
                         element.classList.contains('tg-fullscreen-overlay') ||
                         element.classList.contains('tg-fullscreen-wrapper');
                };
                canvasOptions.onclone = (clonedDoc) => {
                  // 确保克隆文档中的样式正确
                  const clonedPreview = clonedDoc.getElementById('diary-html-preview');
                  if (clonedPreview) {
                    clonedPreview.style.position = 'static';
                    clonedPreview.style.transform = 'none';
                    clonedPreview.style.willChange = 'auto';
                  }
                };
              }
              
              return window.html2canvas(clone, canvasOptions).finally(() => {
                // 清理临时元素
                if (isMobile) {
                  this.cleanupMobileScreenshotElements(cloneWrapper);
                } else {
                  try { document.body.removeChild(cloneWrapper); } catch (_) {}
                }
              });
            })
            .then(canvas => {
              console.log('[Diary Module] Canvas生成完成:', {
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                isMobile
              });
              
              // 检查Canvas是否为空
              if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('生成的Canvas尺寸为0，可能是移动端渲染问题');
              }
              
              // 移动端使用更保守的输出缩放
              const outputScale = isMobile ? Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) : Math.max(1.5, Math.min(2, window.devicePixelRatio || 1));
              const out = document.createElement('canvas');
              out.width = canvas.width * outputScale;
              out.height = canvas.height * outputScale;
              const ctx = out.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, out.width, out.height);
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'medium'; // 降低质量提高速度
              ctx.drawImage(canvas, 0, 0, out.width, out.height);

              // 简单去除底部空白
              const trimBottomWhitespace = (sourceCanvas, threshold = 250) => {
                try {
                  const w = sourceCanvas.width;
                  const h = sourceCanvas.height;
                  const ctx2 = sourceCanvas.getContext('2d');
                  const data = ctx2.getImageData(0, 0, w, h).data;
                  let bottom = h - 1;

                  const isWhite = (idx) => {
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
                    if (a === 0) return true; // 全透明视为空白
                    return r >= threshold && g >= threshold && b >= threshold;
                  };

                  // 从底部向上找非空白行
                  outerBottom: for (; bottom >= 0; bottom--) {
                    for (let x = 0; x < w; x++) {
                      const i = (bottom * w + x) * 4;
                      if (!isWhite(i)) break outerBottom;
                    }
                  }

                  const cropH = Math.max(1, bottom + 1);
                  if (cropH === h) return sourceCanvas; // 无需裁剪

                  const c = document.createElement('canvas');
                  c.width = w;
                  c.height = cropH;
                  c.getContext('2d').drawImage(sourceCanvas, 0, 0, w, cropH, 0, 0, w, cropH);
                  return c;
                } catch (e) {
                  console.warn('[Diary Module] 裁剪底部空白失败:', e);
                  return sourceCanvas;
                }
              };

              const finalCanvas = trimBottomWhitespace(out);
              
              // 生成文件名
              const pad = (n) => String(n).padStart(2, '0');
              const now = new Date();
              const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const filename = `diary-${timestamp}.png`;

              // 创建下载链接
              const link = document.createElement('a');
              link.download = filename;
              link.href = finalCanvas.toDataURL('image/png', 0.95);
              link.click();

              this.showNotification(`截图已保存: ${filename}`, 'success');
              console.log('[Diary Module] 截图保存完成:', { filename, size: `${finalCanvas.width}x${finalCanvas.height}` });
            })
            .catch(error => {
              console.error('[Diary Module] 截图失败:', error);
              this.showNotification(`截图失败: ${error.message}`, 'error');
            });
        } catch (error) {
          console.error('[Diary Module] 截图异常:', error);
          this.showNotification(`截图异常: ${error.message}`, 'error');
        }
      }

      openFullscreen(element) {
        if (!element) return;

        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'tg-fullscreen-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:transparent;display:flex;align-items:center;justify-content:center;';
        // 移动端全屏下移约100px
        if (window.innerWidth <= 768) {
          overlay.style.alignItems = 'flex-start';
          overlay.style.paddingTop = '50px';
        }

        // 包裹内容容器
        const wrapper = document.createElement('div');
        wrapper.className = 'tg-fullscreen-wrapper';
        wrapper.style.cssText = 'position:relative;width:90vw;height:85vh;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.35);overflow:auto;padding:12px;';

        // 关闭按钮（20px，半透明）
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tg-fullscreen-close';
        closeBtn.title = '关闭全屏';
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;width:20px;height:20px;border:none;border-radius:10px;background:rgba(0,0,0,0.4);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:20px;';

        // 克隆预览内容
        const clone = document.createElement('div');
        clone.className = 'tg-fullscreen-content';
        clone.innerHTML = element.innerHTML;
        clone.style.cssText = 'width:100%;height:100%;overflow:auto;background:#fafafa;border-radius:6px;';

        // 组装
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(clone);
        overlay.appendChild(wrapper);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // 关闭逻辑（仅按钮关闭）
        closeBtn.addEventListener('click', () => {
          try { document.body.removeChild(overlay); } catch (_) {}
          document.body.style.overflow = 'auto';
          this.showNotification('已退出全屏', 'info');
        });

        // 移动端高度修复（按 85% 视口高度，顶部偏移 50px）
        if (window.innerWidth <= 768) {
          try { wrapper.dataset.vhScale = '85'; wrapper.dataset.vhOffsetPx = '50'; } catch(_) {}
        } else {
          try { delete wrapper.dataset.vhScale; delete wrapper.dataset.vhOffsetPx; } catch(_) {}
        }
        this.fixMobileViewport(wrapper);
      }

      // 修复移动端视口高度问题（支持自定义比例与偏移）
      fixMobileViewport(element) {
        if (window.innerWidth <= 768) {
          const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            element.style.setProperty('--vh', `${vh}px`);
            const scaleStr = (element.dataset && element.dataset.vhScale) ? element.dataset.vhScale : '100';
            const offsetStr = (element.dataset && element.dataset.vhOffsetPx) ? element.dataset.vhOffsetPx : '0';
            const scale = Number(isNaN(Number(scaleStr)) ? 100 : Number(scaleStr));
            const offsetPx = Number(isNaN(Number(offsetStr)) ? 0 : Number(offsetStr));
            element.style.height = `calc((var(--vh, 1vh) * ${scale}) - ${offsetPx}px)`;
          };

          setViewportHeight();
          window.addEventListener('resize', setViewportHeight);
          window.addEventListener('orientationchange', setViewportHeight);

          // 清理事件监听器
          element.addEventListener('click', () => {
            window.removeEventListener('resize', setViewportHeight);
            window.removeEventListener('orientationchange', setViewportHeight);
          }, { once: true });
        }
      }

      updateGenerationProgress() {
        const generateBtn = document.getElementById('generate-diary');
        if (!generateBtn) return;

        // 检查是否有正在进行的生成任务
        if (this.backgroundGenerationTask && this.backgroundGenerationTask.status === 'running') {
          const task = this.backgroundGenerationTask;
          const progress = task.progress || 0;
          const total = task.total || 1;
          const percentage = Math.round((progress / total) * 100);
          
          // 更新按钮显示
          generateBtn.textContent = `生成中... ${progress}/${total} (${percentage}%)`;
          generateBtn.disabled = true;
          
          console.log('[Diary Module] 恢复生成进度显示:', progress, '/', total);
        } else {
          // 恢复正常状态
          generateBtn.textContent = '📝 生成日记';
          generateBtn.disabled = false;
        }
      }

      // 请求通知权限
      async requestNotificationPermission() {
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('[Diary Module] 通知权限请求结果:', permission);
            return permission === 'granted';
          }
          return Notification.permission === 'granted';
        }
        console.warn('[Diary Module] 浏览器不支持通知API');
        return false;
      }

      // 显示浏览器通知
      showBrowserNotification(message, title = '日记生成器') {
        console.log('[Diary Module] 尝试显示通知:', title, message);
        
        // 首先尝试浏览器原生通知
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const notification = new Notification(title, {
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><text y="18" font-size="18">📝</text></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><text y="18" font-size="18">📝</text></svg>',
                tag: 'diary-generation',
                requireInteraction: true
              });

              // 点击通知时聚焦到窗口
              notification.onclick = () => {
                window.focus();
                notification.close();
              };

              // 5秒后自动关闭
              setTimeout(() => {
                notification.close();
              }, 5000);

              console.log('[Diary Module] 浏览器通知已显示');
              return;
            } catch (error) {
              console.warn('[Diary Module] 浏览器通知显示失败:', error);
            }
          } else {
            console.warn('[Diary Module] 通知权限未授予');
          }
        }

        // 降级到页面内通知
        console.log('[Diary Module] 使用页面内通知');
        this.showNotification(message, 'success');
      }
    }
    // ========================================
    // 🖼️ 内嵌模块代码区域 - WallpaperModule
    // ========================================
    // 壁纸模块 - 独立的壁纸设置功能
    // 基于参考代码封装，集成API配置功能
    
    class WallpaperModule {
      constructor() {
        this.settings = this.loadSettings();
        this.wallpapers = this.loadWallpapers();
        this.apiConfig = this.loadAPIConfig();
        this.observerInitialized = false;
        this.init();
      }

      init() {
        console.log('[Wallpaper Module] 壁纸模块初始化');
        
        // 立即应用一次
        this.applyWallpaperSettings();
        this.applyInterfaceSettings();
        
        // 使用 MutationObserver 监听模态框的创建
        this.setupModalObserver();
        
        // 多次延迟应用，确保捕获到模态框
        const delays = [100, 500, 1000, 2000, 3000];
        delays.forEach(delay => {
          setTimeout(() => {
            this.applyWallpaperSettings();
            this.applyInterfaceSettings();
          }, delay);
        });
        
        // 监听页面可见性变化，当页面重新可见时应用壁纸
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('[Wallpaper Module] 页面变为可见，重新应用壁纸');
            this.applyWallpaperSettings();
            this.applyInterfaceSettings();
          }
        });
      }

      // 设置模态框观察器
      setupModalObserver() {
        if (this.observerInitialized) return;
        
        console.log('[Wallpaper Module] 设置模态框观察器');
        
        const observer = new MutationObserver((mutations) => {
          let shouldApply = false;
          
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // 元素节点
                // 检查是否是目标模态框
                const modalSelectors = [
                  '#theater-generator-modal',
                  '#api-settings-modal',
                  '#diary-module-modal',
                  '#theater-module-modal',
                  '#wallpaper-module-modal'
                ];
                
                const isTargetModal = modalSelectors.some(selector => {
                  return node.matches && node.matches(selector);
                });
                
                if (isTargetModal) {
                  console.log('[Wallpaper Module] 检测到模态框创建:', node.id);
                  shouldApply = true;
                }
              }
            });
          });
          
          if (shouldApply) {
            // 延迟一小段时间，确保模态框内部结构已完全渲染
            setTimeout(() => {
              this.applyWallpaperSettings();
              this.applyInterfaceSettings();
            }, 100);
          }
        });
        
        // 观察整个文档的子树变化
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        this.observerInitialized = true;
        console.log('[Wallpaper Module] 模态框观察器已启动');
      }

      loadSettings() {
        const defaultSettings = {
          currentWallpaper: '',
          opacity: 1.0,
          blur: 0,
          autoChange: false,
          changeInterval: 3600000,
          showAI: true,
          modalWidth: 400,
          modalHeight: 400,
          // 新增界面美化设置
          headerColor: '#000000', // 默认黑色
          headerOpacity: 100,
          customTitle: '🔥小剧场生成器',
          titleColor: '#ffffff',
          buttonColor: '#000000',
          buttonTextColor: '#ffffff',
          buttonOpacity: 100,
          buttonIcon1: '⚙️',
          buttonIcon2: '🔥',
          buttonIcon3: '📝',
          buttonIcon4: '🎭',
          buttonIcon5: '🖼️',
          buttonText1: 'API设置',
          buttonText2: '小火聊聊天',
          buttonText3: '日记生成器',
          buttonText4: '小剧场生成器',
          buttonText5: '壁纸设置'
        };

        try {
          const saved = localStorage.getItem('wallpaper_module_settings');
          const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
          console.log('[Wallpaper Module] 加载设置:', settings);
          return settings;
        } catch (error) {
          console.warn('[Wallpaper Module] 设置加载失败，使用默认设置:', error);
          return defaultSettings;
        }
      }

      saveSettings() {
        try {
          localStorage.setItem('wallpaper_module_settings', JSON.stringify(this.settings));
          console.log('[Wallpaper Module] 设置已保存:', this.settings);
          return true;
        } catch (error) {
          console.error('[Wallpaper Module] 设置保存失败:', error);
          return false;
        }
      }

      loadWallpapers() {
        try {
          const saved = localStorage.getItem('wallpaper_module_wallpapers');
          const wallpapers = saved ? JSON.parse(saved) : [];
          console.log('[Wallpaper Module] 加载壁纸列表:', wallpapers.length, '张');
          return wallpapers;
        } catch (error) {
          console.warn('[Wallpaper Module] 壁纸加载失败:', error);
          return [];
        }
      }

      saveWallpapers() {
        try {
          const data = JSON.stringify(this.wallpapers);
          
          // 检查数据大小
          const dataSize = new Blob([data]).size;
          const maxSize = 3 * 1024 * 1024; // 提高到3MB限制
          
          console.log(`[Wallpaper Module] 当前数据大小: ${Math.round(dataSize/1024)}KB`);
          
          if (dataSize > maxSize) {
            console.warn('[Wallpaper Module] 壁纸数据过大，尝试压缩...');
            // 如果数据过大，只保留最近上传的5张壁纸
            this.wallpapers = this.wallpapers.slice(-5);
            const compressedData = JSON.stringify(this.wallpapers);
            localStorage.setItem('wallpaper_module_wallpapers', compressedData);
            console.log('[Wallpaper Module] 壁纸已压缩保存');
            return true;
          }
          
          localStorage.setItem('wallpaper_module_wallpapers', data);
          console.log('[Wallpaper Module] 壁纸已保存');
          return true;
        } catch (error) {
          if (error.name === 'QuotaExceededError') {
            console.warn('[Wallpaper Module] localStorage空间不足，尝试激进清理...');
            this.aggressiveCleanup();
            try {
              const data = JSON.stringify(this.wallpapers);
              localStorage.setItem('wallpaper_module_wallpapers', data);
              console.log('[Wallpaper Module] 激进清理后壁纸已保存');
              return true;
            } catch (retryError) {
              console.error('[Wallpaper Module] 激进清理后仍无法保存:', retryError);
              this.showNotification('存储空间严重不足，请清理浏览器数据或使用更小的图片', 'error');
              return false;
            }
          } else {
            console.error('[Wallpaper Module] 壁纸保存失败:', error);
            this.showNotification('壁纸保存失败: ' + error.message, 'error');
            return false;
          }
        }
      }

      // 激进清理策略
      aggressiveCleanup() {
        console.log('[Wallpaper Module] 开始激进清理...');
        
        // 1. 清理所有其他localStorage项
        this.clearAllOtherStorage();
        
        // 2. 只保留1张最新壁纸
        if (this.wallpapers.length > 1) {
          const oldCount = this.wallpapers.length;
          this.wallpapers = this.wallpapers.slice(-1);
          console.log(`[Wallpaper Module] 激进清理：只保留1张壁纸，删除了${oldCount - 1}张`);
        }
        
        // 3. 压缩当前壁纸
        if (this.wallpapers.length > 0) {
          this.compressCurrentWallpaper();
        }
      }

      // 清理所有其他localStorage项
      clearAllOtherStorage() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.includes('wallpaper_module')) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`[Wallpaper Module] 删除了其他存储项: ${key}`);
        });
        
        console.log(`[Wallpaper Module] 清理了 ${keysToRemove.length} 个其他存储项`);
      }

      // 压缩当前壁纸
      compressCurrentWallpaper() {
        if (this.wallpapers.length === 0) return;
        
        const wallpaper = this.wallpapers[0];
        try {
          // 创建一个临时canvas来压缩图片
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            // 计算压缩后的尺寸，最大宽度600px，保持较好画质
            const maxWidth = 600;
            const maxHeight = 450;
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width *= ratio;
              height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 绘制压缩后的图片
            ctx.drawImage(img, 0, 0, width, height);
            
            // 转换为base64，使用中等质量
            const compressedUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // 更新壁纸URL
            wallpaper.url = compressedUrl;
            console.log(`[Wallpaper Module] 壁纸已压缩: ${width}x${height}`);
          };
          
          img.src = wallpaper.url;
        } catch (error) {
          console.warn('[Wallpaper Module] 压缩失败:', error);
        }
      }

      // 压缩图片方法
      compressImage(imageUrl, fileName) {
        return new Promise((resolve, reject) => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
              // 计算压缩后的尺寸，最大宽度800px，保持更好的画质
              const maxWidth = 800;
              const maxHeight = 600;
              let { width, height } = img;
              
              if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              // 绘制压缩后的图片
              ctx.drawImage(img, 0, 0, width, height);
              
              // 转换为base64，使用较高的质量
              const compressedUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              console.log(`[Wallpaper Module] 图片已压缩: ${width}x${height}, 原文件: ${fileName}`);
              resolve(compressedUrl);
            };
            
            img.onerror = () => {
              reject(new Error('图片加载失败'));
            };
            
            img.src = imageUrl;
          } catch (error) {
            reject(error);
          }
        });
      }

      // 清理旧壁纸，只保留最近上传的5张
      clearOldWallpapers() {
        if (this.wallpapers.length > 5) {
          const oldCount = this.wallpapers.length;
          this.wallpapers = this.wallpapers.slice(-5);
          console.log(`[Wallpaper Module] 清理了 ${oldCount - 5} 张旧壁纸，保留最新5张`);
        }
      }

      // 清理localStorage存储空间
      clearStorageSpace() {
        try {
          // 先显示当前存储使用情况
          this.showStorageUsage();
          
          // 清理其他可能的存储项
          const keysToCheck = [
            'theater_module_settings',
            'diary_module_settings', 
            'wallpaper_module_settings',
            'theater_module_history',
            'diary_module_history',
            'theater_module_prompts',
            'diary_module_prompts'
          ];
          
          let clearedCount = 0;
          let totalCleared = 0;
          keysToCheck.forEach(key => {
            if (localStorage.getItem(key)) {
              const data = localStorage.getItem(key);
              const size = new Blob([data]).size;
              if (size > 100 * 1024) { // 大于100KB的项
                localStorage.removeItem(key);
                clearedCount++;
                totalCleared += size;
                console.log(`[Wallpaper Module] 清理了 ${key} (${Math.round(size/1024)}KB)`);
              }
            }
          });
          
          if (clearedCount > 0) {
            console.log(`[Wallpaper Module] 清理了 ${clearedCount} 个存储项，释放了 ${Math.round(totalCleared/1024)}KB`);
            this.showNotification(`清理了 ${clearedCount} 个存储项，释放了 ${Math.round(totalCleared/1024)}KB`, 'info');
          } else {
            console.log('[Wallpaper Module] 没有找到需要清理的大文件');
            this.showNotification('存储空间正常', 'info');
          }
        } catch (error) {
          console.error('[Wallpaper Module] 清理存储空间失败:', error);
          this.showNotification('清理存储空间失败', 'error');
        }
      }

      // 显示存储使用情况
      showStorageUsage() {
        try {
          let totalSize = 0;
          let itemCount = 0;
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const data = localStorage.getItem(key);
              const size = new Blob([data]).size;
              totalSize += size;
              itemCount++;
              
              if (key.includes('wallpaper')) {
                console.log(`[Wallpaper Module] ${key}: ${Math.round(size/1024)}KB`);
              }
            }
          }
          
          const totalKB = Math.round(totalSize / 1024);
          const totalMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
          
          console.log(`[Wallpaper Module] 存储使用情况: ${totalKB}KB (${totalMB}MB), 共 ${itemCount} 项`);
          this.showNotification(`存储使用: ${totalMB}MB (${itemCount}项)`, 'info');
        } catch (error) {
          console.error('[Wallpaper Module] 检查存储使用情况失败:', error);
        }
      }

      loadAPIConfig() {
        try {
          const saved = localStorage.getItem('wallpaper_api_config');
          return saved ? JSON.parse(saved) : {};
        } catch (error) {
          return {};
        }
      }

      isAPIAvailable() {
        return this.apiConfig.enabled && this.apiConfig.apiUrl && this.apiConfig.model && this.apiConfig.apiKey;
      }

      // 获取HTML内容
      getContent() {
        return `
          <div class="tg-wallpaper-module-container" style="margin: 0 20px;">
            <div class="tg-wallpaper-header">
              <h2>🖼️ 壁纸设置</h2>
            </div>
            
            <div class="tg-wallpaper-content-wrapper">
              <div class="tg-wallpaper-content">
              <div class="tg-wallpaper-upload">
                <h3>上传壁纸</h3>
                <div class="tg-upload-area" id="upload-area">
                  <div class="tg-upload-icon">📁</div>
                  <p>点击或拖拽文件到此处上传</p>
                  <input type="file" id="wallpaper-file" accept="image/*" style="display: none;">
                </div>
                <div class="tg-form-group" style="margin-top:10px;">
                  <label for="wallpaper-url">在线URL：</label>
                  <div style="display:flex;gap:8px;">
                    <input type="text" id="wallpaper-url" placeholder="https://...jpg" style="flex:1;">
                    <button id="apply-url" class="tg-wallpaper-btn tg-secondary">应用URL</button>
                  </div>
                </div>
              </div>
              
              <div class="tg-wallpaper-settings">
                <h3>壁纸设置</h3>
                <div class="tg-form-group">
                  <label for="wallpaper-opacity">透明度：</label>
                  <input type="range" id="wallpaper-opacity" min="50" max="100" step="1" value="${Math.round(this.settings.opacity * 100)}">
                  <span class="tg-opacity-display">${Math.round(this.settings.opacity * 100)}%</span>
                </div>
                
                <div class="tg-form-group">
                  <label for="modal-width">界面宽度：</label>
                  <input type="range" id="modal-width" min="400" max="1200" step="50" value="${this.settings.modalWidth}">
                  <span class="tg-width-display">${this.settings.modalWidth}px</span>
                </div>
                
                <div class="tg-form-group">
                  <label for="modal-height">界面高度：</label>
                  <input type="range" id="modal-height" min="400" max="1000" step="50" value="${this.settings.modalHeight}">
                  <span class="tg-height-display">${this.settings.modalHeight}px</span>
                </div>
                
              </div>
              
              <div class="tg-interface-settings">
                <h3>界面美化设置</h3>
                
                <!-- 头部设置按钮 -->
                <div class="tg-collapsible-section">
                  <button class="tg-collapsible-btn" id="header-settings-btn">
                    <span class="tg-btn-icon">🎨</span>
                    <span class="tg-btn-text">头部设置</span>
                    <span class="tg-btn-arrow">▼</span>
                  </button>
                  <div class="tg-collapsible-content" id="header-settings-content" style="display: none;">
                    <div class="tg-form-group">
                      <label for="header-color">头部颜色：</label>
                      <input type="color" id="header-color" value="${this.settings.headerColor}">
                    </div>
                    
                    <div class="tg-form-group">
                      <label for="header-opacity">头部不透明度：</label>
                      <input type="range" id="header-opacity" min="0" max="100" step="1" value="${this.settings.headerOpacity}">
                      <span class="tg-header-opacity-display">${this.settings.headerOpacity}%</span>
                    </div>
                  </div>
                </div>
                
                <!-- 标题设置按钮 -->
                <div class="tg-collapsible-section">
                  <button class="tg-collapsible-btn" id="title-settings-btn">
                    <span class="tg-btn-icon">📝</span>
                    <span class="tg-btn-text">标题设置</span>
                    <span class="tg-btn-arrow">▼</span>
                  </button>
                  <div class="tg-collapsible-content" id="title-settings-content" style="display: none;">
                    <div class="tg-form-group">
                      <label for="custom-title">标题内容：</label>
                      <input type="text" id="custom-title" value="${this.settings.customTitle}" placeholder="🎭 小剧场生成器">
                    </div>
                    
                    <div class="tg-form-group">
                      <label for="title-color">标题颜色：</label>
                      <input type="color" id="title-color" value="${this.settings.titleColor}">
                    </div>
                  </div>
                </div>
                
                <!-- 按钮设置按钮 -->
                <div class="tg-collapsible-section">
                  <button class="tg-collapsible-btn" id="button-settings-btn">
                    <span class="tg-btn-icon">🔘</span>
                    <span class="tg-btn-text">按钮设置</span>
                    <span class="tg-btn-arrow">▼</span>
                  </button>
                  <div class="tg-collapsible-content" id="button-settings-content" style="display: none;">
                    <div class="tg-form-group">
                      <label for="button-color">按钮颜色：</label>
                      <input type="color" id="button-color" value="${this.settings.buttonColor}">
                    </div>
                    
                    <div class="tg-form-group">
                      <label for="button-text-color">按钮文字颜色：</label>
                      <input type="color" id="button-text-color" value="${this.settings.buttonTextColor}">
                    </div>
                    
                    <div class="tg-form-group">
                      <label for="button-opacity">按钮不透明度：</label>
                      <input type="range" id="button-opacity" min="0" max="100" step="1" value="${this.settings.buttonOpacity}">
                      <span class="tg-button-opacity-display">${this.settings.buttonOpacity}%</span>
                    </div>
                    
                    <div class="tg-form-group">
                      <label>按钮图标和文字设置：</label>
                      <div class="tg-button-settings">
                        <div class="tg-button-item">
                          <div class="tg-button-label">按钮1：</div>
                          <div class="tg-button-inputs">
                            <input type="text" id="button-icon-1" value="${this.settings.buttonIcon1}" placeholder="⚙️" title="图标">
                            <input type="text" id="button-text-1" value="${this.settings.buttonText1}" placeholder="API设置" title="文字">
                          </div>
                        </div>
                        <div class="tg-button-item">
                          <div class="tg-button-label">按钮2：</div>
                          <div class="tg-button-inputs">
                            <input type="text" id="button-icon-2" value="${this.settings.buttonIcon2}" placeholder="🔥" title="图标">
                            <input type="text" id="button-text-2" value="${this.settings.buttonText2}" placeholder="小火聊聊天" title="文字">
                          </div>
                        </div>
                        <div class="tg-button-item">
                          <div class="tg-button-label">按钮3：</div>
                          <div class="tg-button-inputs">
                            <input type="text" id="button-icon-3" value="${this.settings.buttonIcon3}" placeholder="📝" title="图标">
                            <input type="text" id="button-text-3" value="${this.settings.buttonText3}" placeholder="日记生成器" title="文字">
                          </div>
                        </div>
                        <div class="tg-button-item">
                          <div class="tg-button-label">按钮4：</div>
                          <div class="tg-button-inputs">
                            <input type="text" id="button-icon-4" value="${this.settings.buttonIcon4}" placeholder="🎭" title="图标">
                            <input type="text" id="button-text-4" value="${this.settings.buttonText4}" placeholder="小剧场生成器" title="文字">
                          </div>
                        </div>
                        <div class="tg-button-item">
                          <div class="tg-button-label">按钮5：</div>
                          <div class="tg-button-inputs">
                            <input type="text" id="button-icon-5" value="${this.settings.buttonIcon5}" placeholder="🖼️" title="图标">
                            <input type="text" id="button-text-5" value="${this.settings.buttonText5}" placeholder="壁纸设置" title="文字">
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="tg-form-actions" style="display:flex;gap:8px;margin-top:20px;">
                <button id="reset-wallpaper" class="tg-wallpaper-btn tg-secondary">重置设置</button>
                <button id="clear-wallpaper" class="tg-wallpaper-btn tg-danger">清除壁纸</button>
                <button id="clear-storage" class="tg-wallpaper-btn tg-warning">清理存储</button>
              </div>
              </div>
            </div>
            <div style="margin-bottom: 30px;"></div>
          </div>
        `;
      }
      // 绑定事件
      bindEvents() {
        // 透明度滑块
        const opacitySlider = document.getElementById('wallpaper-opacity');
        const opacityDisplay = document.querySelector('.tg-opacity-display');
        if (opacitySlider && opacityDisplay) {
          opacitySlider.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            opacityDisplay.textContent = `${value}%`;
            this.settings.opacity = value / 100;
            this.saveSettings();
            this.applyWallpaperSettings();
          });
        }

        // 界面宽度滑块
        const widthSlider = document.getElementById('modal-width');
        const widthDisplay = document.querySelector('.tg-width-display');
        if (widthSlider && widthDisplay) {
          widthSlider.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            widthDisplay.textContent = `${value}px`;
            this.settings.modalWidth = value;
            this.saveSettings();
            console.log('[Wallpaper Module] 宽度滑块变化，立即应用尺寸设置');
            this.applyModalSize();
          });
        }

        // 界面高度滑块
        const heightSlider = document.getElementById('modal-height');
        const heightDisplay = document.querySelector('.tg-height-display');
        if (heightSlider && heightDisplay) {
          heightSlider.addEventListener('input', e => {
            const value = parseInt(e.target.value);
            heightDisplay.textContent = `${value}px`;
            this.settings.modalHeight = value;
            this.saveSettings();
            console.log('[Wallpaper Module] 高度滑块变化，立即应用尺寸设置');
            this.applyModalSize();
          });
        }


        // 文件上传
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('wallpaper-file');

        if (uploadArea && fileInput) {
          uploadArea.addEventListener('click', () => fileInput.click());

          uploadArea.addEventListener('dragover', e => {
            e.preventDefault();
            uploadArea.classList.add('tg-drag-over');
          });

          uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('tg-drag-over');
          });

          uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.classList.remove('tg-drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              this.handleFileUpload(files[0]);
            }
          });

          fileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) {
              this.handleFileUpload(e.target.files[0]);
            }
          });
        }

        // 在线URL应用
        const applyUrlBtn = document.getElementById('apply-url');
        if (applyUrlBtn) {
          applyUrlBtn.addEventListener('click', () => {
            const urlInput = document.getElementById('wallpaper-url');
            const url = (urlInput?.value || '').trim();
            if (!url) {
              this.showNotification('请输入有效的图片URL', 'warning');
              return;
            }
            
            console.log('[Wallpaper Module] 应用URL壁纸:', url);
            
            // 创建新的壁纸对象
            const wallpaper = {
              id: Date.now().toString(),
              url: url,
              name: '在线壁纸',
              timestamp: new Date().toISOString(),
              type: 'url'
            };
            
            // 清除现有壁纸列表，只保留新的URL壁纸
            this.wallpapers = [wallpaper];
            this.saveWallpapers();
            this.setCurrentWallpaper(wallpaper.id);
            this.showNotification('URL壁纸已应用', 'success');
          });
        }

        // 重置设置
        const resetBtn = document.getElementById('reset-wallpaper');
        if (resetBtn)
          resetBtn.addEventListener('click', () => {
            // 重置壁纸设置
            this.settings.opacity = 1.0;
            this.settings.blur = 0;
            this.settings.modalWidth = 400;
            this.settings.modalHeight = 400;
            
            // 重置界面美化设置
            this.resetInterfaceSettings();
            
            this.saveSettings();
            this.applyWallpaperSettings();
            this.applyModalSize();
            
            // 更新UI显示
            const opacitySlider = document.getElementById('wallpaper-opacity');
            const opacityDisplay = document.querySelector('.tg-opacity-display');
            if (opacitySlider && opacityDisplay) {
              opacitySlider.value = 100;
              opacityDisplay.textContent = '100%';
            }
            
            const widthSlider = document.getElementById('modal-width');
            const widthDisplay = document.querySelector('.tg-width-display');
            if (widthSlider && widthDisplay) {
              widthSlider.value = 400;
              widthDisplay.textContent = '400px';
            }
            
            const heightSlider = document.getElementById('modal-height');
            const heightDisplay = document.querySelector('.tg-height-display');
            if (heightSlider && heightDisplay) {
              heightSlider.value = 400;
              heightDisplay.textContent = '400px';
            }
            
            this.showNotification('所有设置已重置为默认值', 'success');
          });

        // 清除壁纸
        const clearBtn = document.getElementById('clear-wallpaper');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            console.log('[Wallpaper Module] 清除壁纸');
            this.wallpapers = [];
            this.settings.currentWallpaper = '';
            this.saveWallpapers();
            this.saveSettings();
            this.applyWallpaperSettings();
            this.showNotification('壁纸已清除', 'success');
          });
        }

        // 清理存储空间
        const clearStorageBtn = document.getElementById('clear-storage');
        if (clearStorageBtn) {
          clearStorageBtn.addEventListener('click', () => {
            console.log('[Wallpaper Module] 清理存储空间');
            this.clearStorageSpace();
          });
        }

        // 折叠按钮功能
        this.setupCollapsibleButtons();

        // 头部颜色
        const headerColorInput = document.getElementById('header-color');
        if (headerColorInput) {
          headerColorInput.addEventListener('input', (e) => {
            this.settings.headerColor = e.target.value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 头部不透明度
        const headerOpacitySlider = document.getElementById('header-opacity');
        const headerOpacityDisplay = document.querySelector('.tg-header-opacity-display');
        if (headerOpacitySlider && headerOpacityDisplay) {
          headerOpacitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            headerOpacityDisplay.textContent = `${value}%`;
            this.settings.headerOpacity = value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 自定义标题
        const customTitleInput = document.getElementById('custom-title');
        if (customTitleInput) {
          customTitleInput.addEventListener('input', (e) => {
            this.settings.customTitle = e.target.value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 标题颜色
        const titleColorInput = document.getElementById('title-color');
        if (titleColorInput) {
          titleColorInput.addEventListener('input', (e) => {
            this.settings.titleColor = e.target.value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 按钮颜色
        const buttonColorInput = document.getElementById('button-color');
        if (buttonColorInput) {
          buttonColorInput.addEventListener('input', (e) => {
            this.settings.buttonColor = e.target.value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 按钮文字颜色
        const buttonTextColorInput = document.getElementById('button-text-color');
        if (buttonTextColorInput) {
          buttonTextColorInput.addEventListener('input', (e) => {
            this.settings.buttonTextColor = e.target.value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 按钮不透明度
        const buttonOpacitySlider = document.getElementById('button-opacity');
        const buttonOpacityDisplay = document.querySelector('.tg-button-opacity-display');
        if (buttonOpacitySlider && buttonOpacityDisplay) {
          buttonOpacitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            buttonOpacityDisplay.textContent = `${value}%`;
            this.settings.buttonOpacity = value;
            this.saveSettings();
            this.applyInterfaceSettings();
          });
        }

        // 按钮图标和文字设置
        for (let i = 1; i <= 5; i++) {
          const iconInput = document.getElementById(`button-icon-${i}`);
          const textInput = document.getElementById(`button-text-${i}`);
          
          if (iconInput) {
            iconInput.addEventListener('input', (e) => {
              this.settings[`buttonIcon${i}`] = e.target.value;
              this.saveSettings();
              this.applyInterfaceSettings();
            });
          }
          
          if (textInput) {
            textInput.addEventListener('input', (e) => {
              this.settings[`buttonText${i}`] = e.target.value;
              this.saveSettings();
              this.applyInterfaceSettings();
            });
          }
        }
      }

      // 设置折叠按钮功能
      setupCollapsibleButtons() {
        const buttons = [
          { id: 'header-settings-btn', content: 'header-settings-content' },
          { id: 'title-settings-btn', content: 'title-settings-content' },
          { id: 'button-settings-btn', content: 'button-settings-content' }
        ];

        buttons.forEach(({ id, content }) => {
          const btn = document.getElementById(id);
          const contentDiv = document.getElementById(content);
          
          if (btn && contentDiv) {
            btn.addEventListener('click', () => {
              const isVisible = contentDiv.style.display !== 'none';
              contentDiv.style.display = isVisible ? 'none' : 'block';
              
              // 更新aria-expanded属性
              btn.setAttribute('aria-expanded', !isVisible);
              
              const arrow = btn.querySelector('.tg-btn-arrow');
              if (arrow) {
                arrow.textContent = isVisible ? '▶' : '▼';
              }
            });
            
            // 初始化aria-expanded属性
            btn.setAttribute('aria-expanded', 'false');
          }
        });
      }

      handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
          this.showNotification('请选择图片文件', 'error');
          return;
        }

        // 检查文件大小（限制为2MB）
        const maxFileSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxFileSize) {
          this.showNotification('图片文件过大，请选择小于2MB的图片', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = e => {
          try {
            // 先压缩图片
            this.compressImage(e.target.result, file.name).then(compressedUrl => {
              // 生成基于文件名的静态ID，确保跨设备一致性
              const fileId = 'uploaded_' + file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
              const wallpaper = {
                id: fileId,
                url: compressedUrl,
                name: file.name,
                timestamp: new Date().toISOString(),
                type: 'uploaded',
              };

              console.log('[Wallpaper Module] 上传壁纸:', wallpaper);
              
              // 检查是否已存在相同ID的壁纸，如果存在则更新，否则添加
              const existingIndex = this.wallpapers.findIndex(w => w.id === fileId);
              if (existingIndex >= 0) {
                this.wallpapers[existingIndex] = wallpaper;
                this.showNotification('壁纸已更新', 'success');
              } else {
                this.wallpapers.push(wallpaper);
                this.showNotification('壁纸上传成功', 'success');
              }
              
              // 尝试保存，如果失败则清理旧壁纸
              if (!this.saveWallpapers()) {
                console.warn('[Wallpaper Module] 保存失败，尝试清理后重试');
                this.clearOldWallpapers();
                if (this.saveWallpapers()) {
                  this.showNotification('壁纸已保存（已清理旧壁纸）', 'warning');
                } else {
                  this.showNotification('存储空间不足，无法保存壁纸', 'error');
                  return;
                }
              }
              
              this.setCurrentWallpaper(wallpaper.id);
              this.refreshWallpaperGrid();
            }).catch(error => {
              console.error('[Wallpaper Module] 图片压缩失败:', error);
              this.showNotification('图片压缩失败: ' + error.message, 'error');
            });
          } catch (error) {
            console.error('[Wallpaper Module] 处理壁纸上传失败:', error);
            this.showNotification('壁纸处理失败: ' + error.message, 'error');
          }
        };

        reader.onerror = () => {
          console.error('[Wallpaper Module] 文件读取失败');
          this.showNotification('文件读取失败', 'error');
        };

        reader.readAsDataURL(file);
      }

      setCurrentWallpaper(id) {
        // 确保ID统一为字符串格式
        this.settings.currentWallpaper = String(id);
        console.log('[Wallpaper Module] 设置壁纸ID:', this.settings.currentWallpaper);
        console.log('[Wallpaper Module] 当前壁纸列表长度:', this.wallpapers.length);
        this.saveSettings();
        this.applyWallpaperSettings();
        this.showNotification('壁纸已设置', 'success');
      }

      applyWallpaperSettings() {
        try {
          console.log('[Wallpaper Module] 开始应用壁纸设置...');
          console.log('[Wallpaper Module] 当前壁纸ID:', this.settings.currentWallpaper, '(类型:', typeof this.settings.currentWallpaper + ')');
          console.log('[Wallpaper Module] 壁纸列表:', this.wallpapers.map(w => ({id: w.id, name: w.name, type: typeof w.id})));
          
          // 只有在有壁纸ID且壁纸列表不为空时才尝试查找
          if (this.settings.currentWallpaper && this.wallpapers.length > 0) {
            // 尝试多种方式查找壁纸，防止类型不匹配
            let current = this.wallpapers.find(w => w.id === this.settings.currentWallpaper);
            
            // 如果没找到，尝试转换为字符串再找
            if (!current) {
              console.log('[Wallpaper Module] 精确匹配失败，尝试字符串匹配');
              current = this.wallpapers.find(w => String(w.id) === String(this.settings.currentWallpaper));
            }
            
            // 如果还是没找到，尝试数字匹配
            if (!current) {
              console.log('[Wallpaper Module] 字符串匹配失败，尝试数字匹配');
              current = this.wallpapers.find(w => Number(w.id) === Number(this.settings.currentWallpaper));
            }
            
            if (current) {
              console.log('[Wallpaper Module] ✅ 找到壁纸:', current.name);
              const url = current.url;
              console.log('[Wallpaper Module] 应用壁纸URL:', url.substring(0, 50) + '...');
              this.applyWallpaperToPluginPanelsOnly(url);
              this.addPluginPanelWallpaperStyles(url);
            } else {
              console.log('[Wallpaper Module] ❌ 未找到壁纸，ID:', this.settings.currentWallpaper);
              console.log('[Wallpaper Module] 可用的壁纸ID:', this.wallpapers.map(w => w.id));
              console.log('[Wallpaper Module] 保持当前状态，不清除壁纸');
            }
          } else {
            console.log('[Wallpaper Module] 没有设置壁纸ID或壁纸列表为空，跳过壁纸应用');
          }
        } catch (e) {
          console.error('[Wallpaper Module] 应用壁纸时出错:', e);
        }
      }

      applyModalSize() {
        try {
          console.log('[Wallpaper Module] 开始应用界面尺寸设置:', {
            width: this.settings.modalWidth,
            height: this.settings.modalHeight
          });
          
          // 应用界面宽高设置到所有模块的模态框
          const panelSelectors = [
            '#theater-generator-modal',
            '#api-settings-modal',
            '#chat-module-modal',
            '#diary-module-modal',
            '#theater-module-modal',
            '#wallpaper-module-modal'
          ];

          let appliedCount = 0;
          panelSelectors.forEach(selector => {
            const modal = document.querySelector(selector);
            if (modal) {
              // 优先查找 .theater-modal-content，如果没有则查找 .theater-modal-body
              let modalContent = modal.querySelector('.theater-modal-content');
              if (!modalContent) {
                modalContent = modal.querySelector('.theater-modal-body');
              }
              
              if (modalContent) {
                // 强制设置样式，使用!important确保优先级
                modalContent.style.setProperty('width', `${this.settings.modalWidth}px`, 'important');
                modalContent.style.setProperty('height', `${this.settings.modalHeight}px`, 'important');
                modalContent.style.setProperty('max-width', '90vw', 'important');
                modalContent.style.setProperty('max-height', '80vh', 'important');
                
                console.log(`[Wallpaper Module] 已应用尺寸到 ${selector}:`, {
                  width: modalContent.style.width,
                  height: modalContent.style.height,
                  element: modalContent.className
                });
                appliedCount++;
              } else {
                console.warn(`[Wallpaper Module] 未找到 .theater-modal-content 或 .theater-modal-body 在 ${selector}`);
              }
            } else {
              console.warn(`[Wallpaper Module] 未找到模态框 ${selector}`);
            }
          });
          
          console.log(`[Wallpaper Module] 界面尺寸应用完成，共应用到 ${appliedCount} 个模态框`);
        } catch (e) {
          console.error('[Wallpaper Module] 应用界面尺寸时出错:', e);
        }
      }

      applyWallpaperToPluginPanelsOnly(url) {
        console.log('[Wallpaper Module] 开始应用壁纸到插件面板');
        
        const panelSelectors = [
          '#theater-generator-modal',
          '#api-settings-modal',
          '#diary-module-modal',
          '#theater-module-modal',
          '#wallpaper-module-modal'
        ];

        let appliedCount = 0;
        panelSelectors.forEach(selector => {
          const panel = document.querySelector(selector);
          if (panel) {
            console.log(`[Wallpaper Module] 找到面板: ${selector}`);
            this.applyWallpaperToPanel(panel, url);
            appliedCount++;
          }
        });

        console.log(`[Wallpaper Module] 已应用到 ${appliedCount} 个面板`);
      }

      applyWallpaperToPanel(panel, url) {
        const modalContent = panel.querySelector('.theater-modal-content');
        const modalBody = panel.querySelector('.theater-modal-body');
        const targetElement = modalContent || modalBody;
        
        if (!targetElement) {
          console.log(`[Wallpaper Module] 面板 ${panel.id} 没有找到目标元素`);
          return;
        }

        if (url) {
          targetElement.style.setProperty('background-image', `url('${url}')`, 'important');
          targetElement.style.setProperty('background-size', 'cover', 'important');
          targetElement.style.setProperty('background-position', 'center center', 'important');
          targetElement.style.setProperty('background-repeat', 'no-repeat', 'important');
          targetElement.style.setProperty('background-attachment', 'fixed', 'important');
          targetElement.style.setProperty('opacity', String(this.settings.opacity), 'important');
          targetElement.style.setProperty('filter', `blur(${this.settings.blur}px)`, 'important');
          
          // 移除遮罩
          const existingOverlay = targetElement.querySelector('.wallpaper-overlay');
          if (existingOverlay) {
            existingOverlay.remove();
          }
          
          console.log(`[Wallpaper Module] 壁纸已应用到 ${panel.id}`);
        } else {
          // 清除壁纸
          ['background-image', 'background-size', 'background-position', 
           'background-repeat', 'background-attachment', 'opacity', 'filter'].forEach(prop => {
            targetElement.style.removeProperty(prop);
          });
        }
      }
      addPluginPanelWallpaperStyles(url) {
        let styleElement = document.getElementById('theater-wallpaper-plugin-styles');
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'theater-wallpaper-plugin-styles';
          document.head.appendChild(styleElement);
        }

        const opacity = this.settings.opacity;
        const blur = this.settings.blur;
        
        if (url) {
          styleElement.textContent = `
            /* 插件面板壁纸样式 - 最高优先级 */
            #theater-generator-modal .theater-modal-content,
            #api-settings-modal .theater-modal-body,
            #chat-module-modal .theater-modal-body,
            #diary-module-modal .theater-modal-body,
            #theater-module-modal .theater-modal-body,
            #wallpaper-module-modal .theater-modal-body {
              background-image: url('${url}') !important;
              background-size: cover !important;
              background-position: center center !important;
              background-repeat: no-repeat !important;
              background-attachment: fixed !important;
              opacity: ${opacity} !important;
              filter: blur(${blur}px) !important;
            }
            
            /* 界面美化设置样式 */
            .tg-wallpaper-content-wrapper {
              background: rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              padding: 20px;
              margin-top: 15px;
              backdrop-filter: blur(10px);
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            
            .tg-wallpaper-content {
              color: #000000;
              font-size: 16px;
            }
            
            .tg-wallpaper-content h3 {
              color: #000000;
              margin-bottom: 15px;
              font-weight: 600;
              font-size: 18px;
            }
            
            .tg-wallpaper-content label {
              color: #000000;
              font-weight: 500;
              font-size: 16px;
            }
            
            .tg-wallpaper-content p {
              color: #000000;
              font-size: 16px;
            }
            
            .tg-wallpaper-content span {
              color: #000000;
              font-size: 16px;
            }
            
            .tg-interface-settings {
              margin-top: 20px;
              padding: 15px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              color: #000000;
              font-size: 16px;
            }
            
            .tg-interface-settings h3 {
              color: #000000;
              font-size: 18px;
              font-weight: 600;
            }
            
            .tg-interface-settings label {
              color: #000000;
              font-size: 16px;
              font-weight: 500;
            }
            
            .tg-collapsible-section {
              margin-bottom: 15px;
            }
            
            .tg-collapsible-btn {
              width: 100%;
              padding: 16px 20px;
              background: linear-gradient(135deg, #ffffff, #f8f9fa);
              border: 2px solid #e9ecef;
              border-radius: 12px;
              color: #000000;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: space-between;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              margin-bottom: 8px;
            }
            
            .tg-collapsible-btn::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
              transition: left 0.5s;
            }
            
            .tg-collapsible-btn:hover::before {
              left: 100%;
            }
            
            .tg-collapsible-btn:hover {
              background: linear-gradient(135deg, #f8f9fa, #e9ecef);
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
              border-color: #3498db;
            }
            
            .tg-collapsible-btn:active {
              transform: translateY(0);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .tg-btn-icon {
              font-size: 20px;
              margin-right: 12px;
              filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
            }
            
            .tg-btn-text {
              flex: 1;
              text-align: left;
              color: #000000;
              font-weight: 600;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            
            .tg-btn-arrow {
              font-size: 14px;
              color: #6c757d;
              transition: all 0.3s ease;
              font-weight: bold;
            }
            
            .tg-collapsible-btn:hover .tg-btn-arrow {
              color: #3498db;
              transform: scale(1.1);
            }
            
            .tg-collapsible-btn[aria-expanded="true"] .tg-btn-arrow {
              transform: rotate(180deg);
            }
            
            .tg-collapsible-content {
              padding: 15px;
              background: rgba(255, 255, 255, 0.2);
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-top: none;
              border-radius: 0 0 6px 6px;
              margin-top: -1px;
              color: #000000;
              font-size: 16px;
            }
            
            .tg-collapsible-content label {
              color: #000000;
              font-size: 16px;
              font-weight: 500;
            }
            
            .tg-button-settings {
              display: flex;
              flex-direction: column;
              gap: 12px;
              margin-top: 10px;
            }
            
            .tg-button-item {
              display: flex;
              flex-direction: column;
              gap: 8px;
              padding: 10px;
              background: rgba(255, 255, 255, 0.02);
              border-radius: 6px;
              border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .tg-button-label {
              font-size: 16px;
              color: #000000;
              font-weight: 500;
              margin-bottom: 4px;
            }
            
            .tg-button-inputs {
              display: grid;
              grid-template-columns: 1fr 2fr;
              gap: 8px;
            }
            
            .tg-button-inputs input {
              padding: 8px 10px;
              font-size: 16px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 4px;
              background: rgba(255, 255, 255, 0.05);
              color: #000000;
              transition: all 0.3s ease;
            }
            
            .tg-button-inputs input:focus {
              outline: none;
              border-color: #3498db;
              background: rgba(255, 255, 255, 0.08);
              box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
            }
            
            .tg-button-inputs input::placeholder {
              color: #333;
            }
            
            /* 通用输入框placeholder样式 */
            input::placeholder, textarea::placeholder {
              color: #333 !important;
            }
            
            /* 特定输入框的placeholder样式 */
            #chat-name::placeholder, #new-preset-name::placeholder {
              color: #333 !important;
            }
            
            /* 颜色选择器样式 */
            input[type="color"] {
              width: 40px !important;
              height: 40px !important;
              border: 2px solid rgba(255, 255, 255, 0.3) !important;
              border-radius: 8px !important;
              cursor: pointer !important;
              padding: 0 !important;
              background: none !important;
              transition: all 0.3s ease !important;
            }
            
            input[type="color"]:hover {
              border-color: #3498db !important;
              transform: scale(1.05) !important;
              box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3) !important;
            }
            
            input[type="color"]:focus {
              outline: none !important;
              border-color: #3498db !important;
              box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2) !important;
            }
            
            /* 确保颜色选择器在表单中正确对齐 */
            .tg-form-group input[type="color"] {
              margin-left: 10px;
              vertical-align: middle;
            }
            
            /* 修复btn-text字体颜色问题 - 移除固定颜色，让按钮文字颜色可以自定义 */
            .btn-text {
              font-size: 16px !important;
              font-weight: 500 !important;
            }
            
            .tg-btn-text {
              color: #000000 !important;
              font-size: 16px !important;
              font-weight: 500 !important;
            }
            
            /* 强制覆盖所有可能的文字颜色 */
            .tg-wallpaper-content * {
              color: #000000 !important;
            }
            
            .tg-interface-settings * {
              color: #000000 !important;
            }
            
            .tg-form-group {
              margin-bottom: 12px;
            }
            
            .tg-form-group label {
              display: block;
              margin-bottom: 5px;
              color: #bdc3c7;
              font-size: 12px;
              font-weight: 500;
            }
            
            .tg-form-group input[type="text"],
            .tg-form-group input[type="color"],
            .tg-form-group select {
              width: 100%;
              padding: 6px 8px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 4px;
              background: rgba(255, 255, 255, 0.1);
              color: #ecf0f1;
              font-size: 12px;
            }
            
            .tg-form-group input[type="range"] {
              width: calc(100% - 50px);
              margin-right: 10px;
            }
            
            .tg-form-group span {
              color: #95a5a6;
              font-size: 11px;
              font-weight: 500;
            }
            
            .tg-wallpaper-btn.tg-primary {
              background: linear-gradient(135deg, #3498db, #2980b9);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            
            .tg-wallpaper-btn.tg-primary:hover {
              background: linear-gradient(135deg, #2980b9, #1f4e79);
              transform: translateY(-1px);
            }
            
            .tg-wallpaper-btn.tg-danger {
              background: linear-gradient(135deg, #e74c3c, #c0392b);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            
            .tg-wallpaper-btn.tg-danger:hover {
              background: linear-gradient(135deg, #c0392b, #a93226);
              transform: translateY(-1px);
            }

            .tg-wallpaper-btn.tg-warning {
              background: linear-gradient(135deg, #f39c12, #e67e22);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s ease;
            }

            .tg-wallpaper-btn.tg-warning:hover {
              background: linear-gradient(135deg, #e67e22, #d35400);
              transform: translateY(-1px);
            }
          `;
          console.log('[Wallpaper Module] 全局样式已更新');
        } else {
          styleElement.textContent = '';
          console.log('[Wallpaper Module] 全局样式已清除');
        }
      }

      // 应用界面设置
      applyInterfaceSettings() {
        try {
          console.log('[Wallpaper Module] 开始应用界面设置...');
          
          // 应用头部设置
          this.applyHeaderSettings();
          
          // 应用标题设置
          this.applyTitleSettings();
          
          // 应用按钮设置
          this.applyButtonSettings();
          
          console.log('[Wallpaper Module] 界面设置应用完成');
        } catch (e) {
          console.error('[Wallpaper Module] 应用界面设置时出错:', e);
        }
      }

      // 应用标题设置
      applyTitleSettings() {
        const titleElements = document.querySelectorAll('.theater-modal-header h2, .theater-modal-header h3, .theater-modal-header .title');
        
        titleElements.forEach(titleElement => {
          // 应用标题内容
          if (this.settings.customTitle) {
            titleElement.textContent = this.settings.customTitle;
          }
          
          // 应用标题颜色
          titleElement.style.setProperty('color', this.settings.titleColor, 'important');
        });
        
        console.log('[Wallpaper Module] 标题设置已应用');
      }

      // 应用头部设置
      applyHeaderSettings() {
        const headers = document.querySelectorAll('.theater-modal-header');
        
        headers.forEach(header => {
          // 清除现有样式
          header.style.removeProperty('background-image');
          header.style.removeProperty('background-color');
          header.style.removeProperty('opacity');
          
          // 应用背景颜色
          header.style.setProperty('background-color', this.settings.headerColor, 'important');
          
          // 应用不透明度
          if (this.settings.headerOpacity < 100) {
            header.style.setProperty('opacity', (this.settings.headerOpacity / 100).toString(), 'important');
          }
        });
        
        console.log('[Wallpaper Module] 头部设置已应用');
      }

      // 应用按钮设置
      applyButtonSettings() {
        const buttons = document.querySelectorAll('.theater-function-btn');
        
        buttons.forEach((button, index) => {
          // 应用自定义图标和文字（根据按钮索引）
          const iconKey = `buttonIcon${index + 1}`;
          const textKey = `buttonText${index + 1}`;
          
          // 查找图标元素 - 使用更精确的选择器
          const iconElement = button.querySelector('.btn-icon');
          if (iconElement && this.settings[iconKey]) {
            iconElement.textContent = this.settings[iconKey];
          }
          
          // 查找文字元素 - 使用更精确的选择器
          const textElement = button.querySelector('.btn-text');
          if (textElement && this.settings[textKey]) {
            textElement.textContent = this.settings[textKey];
          }
        });
        
        // 添加CSS规则来强制覆盖所有样式
        this.addButtonOverrideStyles();
        
        console.log('[Wallpaper Module] 按钮设置已应用');
      }

      // 添加按钮样式覆盖规则
      addButtonOverrideStyles() {
        let styleElement = document.getElementById('tg-button-override-styles');
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'tg-button-override-styles';
          document.head.appendChild(styleElement);
        }
        
        // 计算hover和active状态的颜色（稍微变暗）
        const hoverColor = this.darkenColor(this.settings.buttonColor, 0.1);
        const activeColor = this.darkenColor(this.settings.buttonColor, 0.2);
        
        styleElement.textContent = `
          .theater-function-btn {
            background: ${this.settings.buttonColor} !important;
            background-color: ${this.settings.buttonColor} !important;
            color: ${this.settings.buttonTextColor} !important;
            opacity: ${this.settings.buttonOpacity / 100} !important;
          }
          
          .theater-function-btn:hover {
            background: ${hoverColor} !important;
            background-color: ${hoverColor} !important;
            color: ${this.settings.buttonTextColor} !important;
          }
          
          .theater-function-btn:active {
            background: ${activeColor} !important;
            background-color: ${activeColor} !important;
            color: ${this.settings.buttonTextColor} !important;
          }
          
          .theater-function-btn:focus {
            background: ${this.settings.buttonColor} !important;
            background-color: ${this.settings.buttonColor} !important;
            color: ${this.settings.buttonTextColor} !important;
          }
          
          /* 确保按钮文字颜色可以自定义 */
          .theater-function-btn .btn-text {
            color: ${this.settings.buttonTextColor} !important;
          }
          
          .theater-function-btn:hover .btn-text {
            color: ${this.settings.buttonTextColor} !important;
          }
          
          .theater-function-btn:active .btn-text {
            color: ${this.settings.buttonTextColor} !important;
          }
          
          .theater-function-btn:focus .btn-text {
            color: ${this.settings.buttonTextColor} !important;
          }
        `;
      }
      
      // 辅助函数：使颜色变暗
      darkenColor(color, amount) {
        // 移除#号
        color = color.replace('#', '');
        
        // 解析RGB值
        const r = parseInt(color.substr(0, 2), 16);
        const g = parseInt(color.substr(2, 2), 16);
        const b = parseInt(color.substr(4, 2), 16);
        
        // 计算变暗后的值
        const newR = Math.max(0, Math.floor(r * (1 - amount)));
        const newG = Math.max(0, Math.floor(g * (1 - amount)));
        const newB = Math.max(0, Math.floor(b * (1 - amount)));
        
        // 转换回十六进制
        const toHex = (n) => {
          const hex = n.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
      }

      // 重置界面设置
      resetInterfaceSettings() {
        this.settings.headerColor = '#000000';
        this.settings.headerOpacity = 100;
        this.settings.customTitle = '🔥小剧场生成器';
        this.settings.titleColor = '#ffffff';
        this.settings.buttonColor = '#000000';
        this.settings.buttonTextColor = '#ffffff';
        this.settings.buttonOpacity = 100;
        this.settings.buttonIcon1 = '⚙️';
        this.settings.buttonIcon2 = '🔥';
        this.settings.buttonIcon3 = '📝';
        this.settings.buttonIcon4 = '🎭';
        this.settings.buttonIcon5 = '🖼️';
        this.settings.buttonText1 = 'API设置';
        this.settings.buttonText2 = '小火聊聊天';
        this.settings.buttonText3 = '日记生成器';
        this.settings.buttonText4 = '小剧场生成器';
        this.settings.buttonText5 = '壁纸设置';
        
        this.saveSettings();
        this.applyInterfaceSettings();
        
        // 更新UI显示
        this.updateInterfaceUI();
      }

      // 更新界面UI显示
      updateInterfaceUI() {
        // 更新头部设置UI
        const headerColorInput = document.getElementById('header-color');
        const headerOpacitySlider = document.getElementById('header-opacity');
        const headerOpacityDisplay = document.querySelector('.tg-header-opacity-display');
        
        if (headerColorInput) headerColorInput.value = this.settings.headerColor;
        if (headerOpacitySlider && headerOpacityDisplay) {
          headerOpacitySlider.value = this.settings.headerOpacity;
          headerOpacityDisplay.textContent = `${this.settings.headerOpacity}%`;
        }
        
        // 更新标题设置UI
        const customTitleInput = document.getElementById('custom-title');
        const titleColorInput = document.getElementById('title-color');
        
        if (customTitleInput) customTitleInput.value = this.settings.customTitle;
        if (titleColorInput) titleColorInput.value = this.settings.titleColor;
        
        // 更新按钮设置UI
        const buttonColorInput = document.getElementById('button-color');
        const buttonTextColorInput = document.getElementById('button-text-color');
        const buttonOpacitySlider = document.getElementById('button-opacity');
        const buttonOpacityDisplay = document.querySelector('.tg-button-opacity-display');
        
        if (buttonColorInput) buttonColorInput.value = this.settings.buttonColor;
        if (buttonTextColorInput) buttonTextColorInput.value = this.settings.buttonTextColor;
        if (buttonOpacitySlider && buttonOpacityDisplay) {
          buttonOpacitySlider.value = this.settings.buttonOpacity;
          buttonOpacityDisplay.textContent = `${this.settings.buttonOpacity}%`;
        }
        
        // 更新按钮图标和文字设置UI
        for (let i = 1; i <= 5; i++) {
          const iconInput = document.getElementById(`button-icon-${i}`);
          const textInput = document.getElementById(`button-text-${i}`);
          if (iconInput) {
            iconInput.value = this.settings[`buttonIcon${i}`] || '';
          }
          if (textInput) {
            textInput.value = this.settings[`buttonText${i}`] || '';
          }
        }
      }

      showNotification(message, type = 'info') {
        if (window.showAPIStatus) {
          window.showAPIStatus(message, type);
        } else {
          console.log(`[Wallpaper Module] ${type.toUpperCase()}: ${message}`);
        }
      }
    }

    // ========================================
    // 🔧 内嵌模块初始化函数
    // ========================================
    // 初始化内嵌模块，替代外部脚本加载
    function initializeEmbeddedModules() {
        console.log('[小剧场生成器] 开始初始化内嵌模块...');
        
        // 将模块类注册到全局对象
        window.TheaterModule = TheaterModule;
        window.ChatModule = ChatModule;
        window.DiaryModule = DiaryModule;
        window.WallpaperModule = WallpaperModule;
        
        console.log('[小剧场生成器] 内嵌模块已注册到全局对象');
        console.log('- TheaterModule:', window.TheaterModule ? '✅ 已注册' : '❌ 未注册');
        console.log('- ChatModule:', window.ChatModule ? '✅ 已注册' : '❌ 未注册');
        console.log('- DiaryModule:', window.DiaryModule ? '✅ 已注册' : '❌ 未注册');
        console.log('- WallpaperModule:', window.WallpaperModule ? '✅ 已注册' : '❌ 未注册');
        
        // 立即检查模块类状态
        checkModuleClasses();
    }

    // 加载模块脚本 - 已改为内嵌模块初始化
    function loadModuleScripts() {
        console.log('[小剧场生成器] 使用内嵌模块，跳过外部脚本加载');
        
        // 直接初始化内嵌模块
        initializeEmbeddedModules();
    }

    // 检查模块类是否可用
    function checkModuleClasses() {
        console.log('[小剧场生成器] 检查模块类状态...');
        console.log('- TheaterModule:', window.TheaterModule ? '✅ 可用' : '❌ 不可用');
        console.log('- ChatModule:', window.ChatModule ? '✅ 可用' : '❌ 不可用');
        console.log('- DiaryModule:', window.DiaryModule ? '✅ 可用' : '❌ 不可用');
        console.log('- WallpaperModule:', window.WallpaperModule ? '✅ 可用' : '❌ 不可用');
        
        if (!window.TheaterModule || !window.ChatModule || !window.DiaryModule || !window.WallpaperModule) {
            console.warn('[小剧场生成器] 部分模块类未加载，尝试手动检查...');
            
            // 尝试手动执行模块代码
            if (!window.TheaterModule) {
                console.log('[小剧场生成器] 尝试手动加载TheaterModule...');
                try {
                    // 这里可以添加手动加载逻辑
                } catch (error) {
                    console.error('[小剧场生成器] 手动加载TheaterModule失败:', error);
                }
            }
            
            if (!window.ChatModule) {
                console.log('[小剧场生成器] 尝试手动加载ChatModule...');
                try {
                    // 这里可以添加手动加载逻辑
                } catch (error) {
                    console.error('[小剧场生成器] 手动加载ChatModule失败:', error);
                }
            }
            
            if (!window.DiaryModule) {
                console.log('[小剧场生成器] 尝试手动加载DiaryModule...');
                try {
                    // 这里可以添加手动加载逻辑
                } catch (error) {
                    console.error('[小剧场生成器] 手动加载DiaryModule失败:', error);
                }
            }
            
            if (!window.WallpaperModule) {
                console.log('[小剧场生成器] 尝试手动加载WallpaperModule...');
                try {
                    // 这里可以添加手动加载逻辑
                } catch (error) {
                    console.error('[小剧场生成器] 手动加载WallpaperModule失败:', error);
                }
            }
        } else {
            console.log('[小剧场生成器] 所有模块类已就绪！');
        }
    }

    // 初始化时加载模块
    loadModuleStyles();
    loadModuleScripts();
    
    // ========================================
    // 🔧 壁纸模块初始化
    // ========================================

    // 确保全局只有一个实例
    if (!window.wallpaperModule) {
      console.log('[小剧场生成器] 创建壁纸模块实例');
      window.wallpaperModule = new WallpaperModule();
    } else {
      console.log('[小剧场生成器] 壁纸模块实例已存在，重新应用设置');
      window.wallpaperModule.applyWallpaperSettings();
    }

    // 添加调试函数
    window.debugWallpaper = function() {
        console.log('=== 壁纸设置调试信息 ===');
        console.log('📁 localStorage 中的壁纸设置:');
        const settings = localStorage.getItem('wallpaper_module_settings');
        const wallpapers = localStorage.getItem('wallpaper_module_wallpapers');
        console.log('- 设置:', settings ? JSON.parse(settings) : '无');
        console.log('- 壁纸列表:', wallpapers ? JSON.parse(wallpapers) : '无');
        
        console.log('🔍 当前壁纸模块状态:');
        if (window.wallpaperModule) {
            console.log('- 模块实例:', window.wallpaperModule);
            console.log('- 当前设置:', window.wallpaperModule.settings);
            console.log('- 壁纸列表:', window.wallpaperModule.wallpapers);
        } else {
            console.log('- 壁纸模块实例: 未创建');
        }
        
        console.log('🎯 页面上的模态框:');
        const modals = [
            '#theater-generator-modal',
            '#api-settings-modal', 
            '#diary-module-modal',
            '#theater-module-modal',
            '#wallpaper-module-modal'
        ];
        modals.forEach(selector => {
            const modal = document.querySelector(selector);
            if (modal) {
                const content = modal.querySelector('.theater-modal-content') || modal.querySelector('.theater-modal-body');
                if (content) {
                    const bgImage = window.getComputedStyle(content).backgroundImage;
                    console.log(`- ${selector}: 存在，背景图片: ${bgImage !== 'none' ? '已设置' : '无'}`);
                } else {
                    console.log(`- ${selector}: 存在，但无内容元素`);
                }
            } else {
                console.log(`- ${selector}: 不存在`);
            }
        });
        
        console.log('=== 调试信息结束 ===');
    };

    // 强制应用壁纸
    window.forceApplyWallpaper = function() {
        if (window.wallpaperModule) {
            console.log('强制应用壁纸设置...');
            window.wallpaperModule.applyWallpaperSettings();
        } else {
            console.log('壁纸模块未初始化');
        }
    };

    console.log('[小剧场生成器] 扩展加载完成');
    console.log(`
💡 调试提示: 在控制台输入以下命令查看API配置状态:

🔧 查看配置状态: window.debugTheaterAPI()
🧹 清理配置: window.clearTheaterAPIConfig()
📤 导出配置: window.exportTheaterAPIConfig()
🔍 验证持久性: window.validateConfigPersistence()
🧪 简单保存测试: window.testSimpleSave()
🔧 localStorage测试: window.testLocalStorage()
📋 检查表单数据: window.checkFormData()
🔍 检查localStorage状态: window.checkLocalStorageStatus()
🔘 检查保存按钮: window.checkSaveButton()
💾 备份当前配置: window.backupCurrentConfig()
🔄 恢复真实配置: window.restoreRealConfig()

🔥 保存按钮调试专用:
🔘 检查保存按钮状态: window.checkSaveButton()
🧪 直接测试保存函数: window.testSaveFunction()
🔗 重新绑定保存按钮: window.rebindSaveButton()

🔧 核心函数调试:
📄 重新加载设置内容: window.loadAPISettingsContent()
🔗 重新绑定事件: window.bindAPISettingsEvents()
📥 加载设置: window.loadAPISettings()
💾 保存配置: window.saveAPIConfig()
🗑️ 清除配置: window.clearAPIConfig()

🎭 模块功能:
🎭 小剧场生成: 点击小剧场按钮
📝 日记生成: 点击日记按钮
🖼️ 壁纸设置: 点击壁纸按钮

🎭 内嵌模块调试:
🔍 检查模块状态: window.debugTheaterModules()
🔄 重新初始化模块: window.reloadTheaterModules()
📄 检查模块内容: window.checkScriptContent()
💥 强制重新初始化: window.forceReloadScripts()

🖼️ 壁纸设置调试:
🔍 检查壁纸状态: window.debugWallpaper()
🔄 强制应用壁纸: window.forceApplyWallpaper()
    `);

    // 添加模块调试函数
    window.debugTheaterModules = function() {
        console.log('=== 小剧场生成器模块调试信息 ===');
        console.log('📁 内嵌模块类状态:');
        console.log('- TheaterModule:', window.TheaterModule ? '✅ 已加载' : '❌ 未加载');
        console.log('- DiaryModule:', window.DiaryModule ? '✅ 已加载' : '❌ 未加载');
        console.log('- WallpaperModule:', window.WallpaperModule ? '✅ 已加载' : '❌ 未加载');
        
        console.log('📄 内嵌模块信息:');
        console.log('- 所有模块已内嵌到主文件中，无需外部脚本加载');
        console.log('- 模块位置: theater-generator.js 第2760-6127行');
        console.log('- TheaterModule: 第2765-3524行');
        console.log('- DiaryModule: 第4853-5616行');
        console.log('- WallpaperModule: 第5626-5931行');
        
        // 检查模块功能
        if (window.TheaterModule) {
            console.log('- TheaterModule 功能: ✅ 可用');
        }
        if (window.DiaryModule) {
            console.log('- DiaryModule 功能: ✅ 可用');
        }
        if (window.WallpaperModule) {
            console.log('- WallpaperModule 功能: ✅ 可用');
        }
        
        console.log('🎨 样式文件状态:');
        const styles = document.querySelectorAll('link[href*="theater-modules"], style[id*="theater-modules"]');
        console.log('- 样式文件:', styles.length > 0 ? '✅ 已加载' : '❌ 未加载');
        
        console.log('🔧 建议操作:');
        if (!window.TheaterModule) {
            console.log('- 小剧场模块未加载，请检查文件路径和服务器配置');
            console.log('- 尝试运行: window.reloadTheaterModules()');
        }
        if (!window.DiaryModule) {
            console.log('- 日记模块未加载，请检查文件路径和服务器配置');
            console.log('- 尝试运行: window.reloadTheaterModules()');
        }
        if (!window.WallpaperModule) {
            console.log('- 壁纸模块未加载，请检查文件路径和服务器配置');
            console.log('- 尝试运行: window.reloadTheaterModules()');
        }
    };

    // 重新加载模块
    window.reloadTheaterModules = function() {
        console.log('[小剧场生成器] 重新加载模块...');
        loadModuleScripts();
        setTimeout(() => {
            window.debugTheaterModules();
        }, 1000);
    };

    // 手动检查脚本内容
    window.checkScriptContent = function() {
        console.log('=== 检查脚本文件内容 ===');
        
        console.log('📄 内嵌模块检查:');
        console.log('- TheaterModule 类定义:', typeof TheaterModule);
        console.log('- WallpaperModule 类定义:', typeof WallpaperModule);
        
        console.log('🔍 检查全局对象:');
        console.log('- window.TheaterModule:', typeof window.TheaterModule);
        console.log('- window.WallpaperModule:', typeof window.WallpaperModule);
    };

    // 壁纸模块调试函数
    window.debugWallpaper = function() {
        console.log('=== 壁纸设置调试信息 ===');
        console.log('📁 localStorage 中的壁纸设置:');
        const settings = localStorage.getItem('wallpaper_module_settings');
        const wallpapers = localStorage.getItem('wallpaper_module_wallpapers');
        
        const parsedSettings = settings ? JSON.parse(settings) : null;
        const parsedWallpapers = wallpapers ? JSON.parse(wallpapers) : null;
        
        console.log('- 设置:', parsedSettings);
        console.log('- 壁纸列表:', parsedWallpapers);
        
        if (parsedSettings && parsedWallpapers) {
            console.log('🔍 ID匹配检查:');
            console.log('- 当前壁纸ID:', parsedSettings.currentWallpaper, '(类型:', typeof parsedSettings.currentWallpaper + ')');
            console.log('- 壁纸列表ID:');
            parsedWallpapers.forEach((w, i) => {
                const isMatch = w.id === parsedSettings.currentWallpaper || 
                               String(w.id) === String(parsedSettings.currentWallpaper);
                console.log(`  [${i}] ID: ${w.id} (类型: ${typeof w.id}) 名称: ${w.name} ${isMatch ? '✅ 匹配' : ''}`);
            });
        }
        
        console.log('🔍 当前壁纸模块状态:');
        if (window.wallpaperModule) {
            console.log('- 模块实例:', window.wallpaperModule);
            console.log('- 当前设置:', window.wallpaperModule.settings);
            console.log('- 壁纸列表:', window.wallpaperModule.wallpapers);
        } else {
            console.log('- 壁纸模块实例: 未创建');
        }
        
        console.log('🎯 页面上的模态框:');
        const modals = [
            '#theater-generator-modal',
            '#api-settings-modal', 
            '#diary-module-modal',
            '#theater-module-modal',
            '#wallpaper-module-modal'
        ];
        modals.forEach(selector => {
            const modal = document.querySelector(selector);
            if (modal) {
                const content = modal.querySelector('.theater-modal-content') || modal.querySelector('.theater-modal-body');
                if (content) {
                    const bgImage = window.getComputedStyle(content).backgroundImage;
                    console.log(`- ${selector}: 存在，背景图片: ${bgImage !== 'none' ? '已设置' : '无'}`);
                } else {
                    console.log(`- ${selector}: 存在，但无内容元素`);
                }
            } else {
                console.log(`- ${selector}: 不存在`);
            }
        });
        
        console.log('=== 调试信息结束 ===');
    };

    // 强制应用壁纸
    window.forceApplyWallpaper = function() {
        if (window.wallpaperModule) {
            console.log('强制应用壁纸设置...');
            window.wallpaperModule.applyWallpaperSettings();
        } else {
            console.log('壁纸模块未初始化');
        }
    };

    // 修复壁纸ID问题
    window.fixWallpaperID = function() {
        if (!window.wallpaperModule) {
            console.log('壁纸模块未初始化');
            return;
        }
        
        console.log('=== 修复壁纸ID问题 ===');
        const module = window.wallpaperModule;
        
        console.log('当前设置:', module.settings);
        console.log('壁纸列表长度:', module.wallpapers.length);
        
        if (module.wallpapers.length === 0) {
            console.log('❌ 没有可用的壁纸');
            return;
        }
        
        // 检查当前ID是否有效
        const currentId = module.settings.currentWallpaper;
        const found = module.wallpapers.find(w => 
            w.id === currentId || 
            String(w.id) === String(currentId) ||
            Number(w.id) === Number(currentId)
        );
        
        if (found) {
            console.log('✅ 当前壁纸ID有效:', found.name);
        } else {
            console.log('❌ 当前壁纸ID无效，选择第一个可用壁纸');
            const firstWallpaper = module.wallpapers[0];
            module.settings.currentWallpaper = firstWallpaper.id;
            module.saveSettings();
            console.log('已更新为:', firstWallpaper.name, '(ID:', firstWallpaper.id + ')');
        }
        
        // 重新应用设置
        module.applyWallpaperSettings();
        console.log('=== 修复完成 ===');
    };

    // 强制重新加载脚本 - 内嵌版本
    window.forceReloadScripts = function() {
        console.log('[小剧场生成器] 强制重新初始化内嵌模块...');
        
        // 清除全局对象
        delete window.TheaterModule;
        delete window.DiaryModule;
        delete window.WallpaperModule;
        
        // 重新初始化内嵌模块
        setTimeout(() => {
            initializeEmbeddedModules();
        }, 100);
    };

    // ========================================
    // 🔧 壁纸模块全局实例创建
    // ========================================
    
    // 确保全局只有一个实例
    if (!window.wallpaperModule) {
        console.log('[小剧场生成器] 创建壁纸模块实例');
        window.wallpaperModule = new WallpaperModule();
    } else {
        console.log('[小剧场生成器] 壁纸模块实例已存在，重新应用设置');
        window.wallpaperModule.applyWallpaperSettings();
    }

})();