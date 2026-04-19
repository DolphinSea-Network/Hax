// ==UserScript==
// @name         PC+移动端通用 | Hax&Woiden双站抢机工具
// @namespace    http://tampermonkey.net/
// @version      1.0Max
// @description  悬浮球菜单，自动填表+全勾协议+自动刷新
// @author       Doubao
// @author       Qwen
// @match        *://hax.co.id/*
// @match        *://woiden.id/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ====================== 1. 环境与站点识别 ======================
    const getCurrentSite = () => {
        const host = window.location.host;
        if (host.includes('hax.co.id')) return 'hax';
        if (host.includes('woiden.id')) return 'woiden';
        return 'unknown';
    };
    const CURRENT_SITE = getCurrentSite();
    if (CURRENT_SITE === 'unknown') return;

    // 环境判断
    const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const BALL_SIZE = 50; // 悬浮球尺寸，固定值避免计算误差

    // ====================== 2. 双站完整配置 ======================
    const SITE_CONFIG = {
        hax: {
            name: "Hax.co.id",
            default: {
                location: "US-OpenVZ-2",
                os: "Ubuntu 24",
                purpose: "Learn Linux",
                password: "",
                refreshEnable: true,
                refreshSec: 50
            },
            options: {
                location: ["EU-1", "US-OpenVZ-2", "US-OpenVZ-3"],
                os: ["Ubuntu 20", "Ubuntu 22", "Ubuntu 24", "Debian 11", "Debian 12", "Centos 7", "Centos 8", "Almalinux 8", "Almalinux 9", "Suse 13.2"]
            }
        },
        woiden: {
            name: "Woiden.id",
            default: {
                location: "EU-1 - Germany - Hetzner - SSD + Dedicated IPv6",
                os: "Ubuntu 22",
                purpose: "Learn Linux",
                password: "",
                refreshEnable: true,
                refreshSec: 50
            },
            options: {
                location: ["EU-1 - Germany - Hetzner - SSD + Dedicated IPv6"],
                os: ["Ubuntu 20", "Ubuntu 22", "Centos 7.9", "Debian 11", "Debian 10", "Almalinux 8.4", "Suse 13.2"]
            }
        }
    };

    // 配置持久化
    let config = JSON.parse(localStorage.getItem("hw_1.0Max_config")) || {
        hax: {...SITE_CONFIG.hax.default},
        woiden: {...SITE_CONFIG.woiden.default}
    };
    const currentConfig = config[CURRENT_SITE];
    const currentMeta = SITE_CONFIG[CURRENT_SITE];

    // 全局变量
    let countdownTimer = null;
    let remainTime = currentConfig.refreshSec;
    let fillRetryCount = 0;
    const MAX_FILL_RETRY = 10;
    let autoClickMonitor = null; // 自动点击监控定时器

    // 拖拽核心状态（修复Edge拖拽的核心变量）
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let ballStartLeft = 0;
    let ballStartTop = 0;
    let ballElement = null;
    let panelElement = null;

    // ====================== 3. 核心修复：Edge兼容CSS（彻底解决拖拽冲突） ======================
    function initStyle() {
        const style = document.createElement('style');
        // 核心修复：PC端彻底移除transform，用margin实现居中，避免和top/left定位冲突
        style.textContent = `
            /* 悬浮球核心样式 - 双端兼容，无transform冲突 */
            #hw-max-ball{
                position: fixed !important;
                z-index: 2147483647 !important;
                width: ${BALL_SIZE}px !important;
                height: ${BALL_SIZE}px !important;
                line-height: ${BALL_SIZE}px !important;
                border-radius: 50% !important;
                background: ${CURRENT_SITE === 'hax' ? '#007bff' : '#28a745'} !important;
                color: #ffffff !important;
                text-align: center !important;
                font-weight: bold !important;
                font-size: 14px !important;
                box-shadow: 0 2px 12px rgba(0,0,0,0.3) !important;
                user-select: none !important;
                touch-action: none !important;
                cursor: pointer !important;
                transition: transform 0.2s ease !important;
                /* 核心修复：PC端用margin居中，彻底移除transform，避免拖拽冲突 */
                ${IS_MOBILE
                    ? 'right: 15px !important; bottom: 80px !important;'
                    : 'right: 20px !important; top: 50% !important; margin-top: -25px !important;'}
            }
            #hw-max-ball:hover{
                transform: scale(1.1) !important;
            }
            /* 拖拽时禁用hover动画，避免卡顿 */
            #hw-max-ball.dragging{
                transition: none !important;
                transform: none !important;
                margin-top: 0 !important;
            }

            /* 面板样式 */
            #hw-max-panel{
                position: fixed !important;
                z-index: 2147483647 !important;
                width: ${IS_MOBILE ? '280px' : '320px'} !important;
                background: #ffffff !important;
                border-radius: 10px !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
                padding: 15px !important;
                display: none !important;
                box-sizing: border-box !important;
                max-height: 80vh !important;
                overflow-y: auto !important;
                /* 面板初始位置和悬浮球对齐 */
                ${IS_MOBILE
                    ? 'right: 75px !important; bottom: 80px !important;'
                    : 'right: 80px !important; top: 50% !important; margin-top: -180px !important;'}
            }
            #hw-max-panel.show{
                display: block !important;
            }

            /* 面板内部样式 */
            .hw-title{
                font-size: 16px !important;
                font-weight: bold !important;
                text-align: center !important;
                color: ${CURRENT_SITE === 'hax' ? '#007bff' : '#28a745'} !important;
                margin-bottom: 12px !important;
            }
            .hw-item{
                margin-bottom: 10px !important;
            }
            .hw-label{
                display: block !important;
                font-size: 13px !important;
                color: #333333 !important;
                margin-bottom: 4px !important;
            }
            .hw-input, .hw-select{
                width: 100% !important;
                box-sizing: border-box !important;
                padding: 8px 10px !important;
                border: 1px solid #dddddd !important;
                border-radius: 6px !important;
                font-size: 14px !important;
                background: #ffffff !important;
                color: #333333 !important;
            }
            .hw-apply-btn{
                width: 100% !important;
                padding: 12px 0 !important;
                background: ${CURRENT_SITE === 'hax' ? '#007bff' : '#28a745'} !important;
                color: #ffffff !important;
                border: none !important;
                border-radius: 8px !important;
                font-size: 17px !important;
                font-weight: bold !important;
                margin: 10px 0 !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            }
            .hw-apply-btn:hover{
                filter: brightness(0.9) !important;
            }
            .hw-tip{
                text-align: center !important;
                font-size: 12px !important;
                color: #666666 !important;
                word-break: keep-all !important;
            }
            /* 标签页样式 */
            .hw-tabs{
                display: flex !important;
                gap: 4px !important;
                margin-bottom: 12px !important;
                flex-wrap: wrap !important;
            }
            .hw-tab{
                flex: 1 !important;
                padding: 6px 4px !important;
                border: none !important;
                background: #f0f0f0 !important;
                color: #666 !important;
                border-radius: 4px !important;
                font-size: 11px !important;
                font-weight: bold !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
            }
            .hw-tab:hover{
                background: #e0e0e0 !important;
            }
            .hw-tab.active{
                background: ${CURRENT_SITE === 'hax' ? '#007bff' : '#28a745'} !important;
                color: #ffffff !important;
            }
            .hw-tab-content{
                display: none !important;
            }
            .hw-tab-content.active{
                display: block !important;
            }
            /* 数学题显示区域 */
            .hw-captcha-display{
                background: #f8f9fa !important;
                border: 1px solid #dee2e6 !important;
                border-radius: 6px !important;
                padding: 10px !important;
                text-align: center !important;
                font-size: 18px !important;
                font-weight: bold !important;
                color: #333 !important;
                margin-bottom: 8px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ====================== 4. UI注入 ======================
    function initUI() {
        // 注入悬浮球
        ballElement = document.createElement('div');
        ballElement.id = 'hw-max-ball';
        ballElement.textContent = CURRENT_SITE.toUpperCase();
        document.body.appendChild(ballElement);

        // 注入面板 - 带分类标签
        let panelHTML = `<div class="hw-title">${currentMeta.name} 抢机工具</div>`;
        
        // 标签页导航
        panelHTML += `
            <div class="hw-tabs">
                <button class="hw-tab active" data-tab="create">Create</button>
                <button class="hw-tab" data-tab="power">Power</button>
                <button class="hw-tab" data-tab="info">Info</button>
                <button class="hw-tab" data-tab="renew">Renew</button>
                <button class="hw-tab" data-tab="remove">Remove</button>
            </div>
        `;
        
        // Create 标签页内容
        panelHTML += `<div class="hw-tab-content active" id="hw-tab-create">`;
        panelHTML += `
            <div class="hw-item">
                <label class="hw-label">数据中心/区域</label>
                <select class="hw-select" id="hw-location">
                    ${currentMeta.options.location.map(item => `<option value="${item}">${item}</option>`).join('')}
                </select>
            </div>
        `;
        panelHTML += `
            <div class="hw-item">
                <label class="hw-label">操作系统</label>
                <select class="hw-select" id="hw-os">
                    ${currentMeta.options.os.map(item => `<option value="${item}">${item}</option>`).join('')}
                </select>
            </div>
            <div class="hw-item">
                <label class="hw-label">VPS密码</label>
                <input type="password" class="hw-input" id="hw-password" placeholder="请输入VPS密码">
            </div>
            <div class="hw-item">
                <label class="hw-label">刷新间隔(秒)</label>
                <input type="number" class="hw-input" id="hw-refresh" value="${currentConfig.refreshSec}" min="10">
            </div>
            <button class="hw-apply-btn" id="hw-apply">✅ 应用配置</button>
            <div class="hw-tip" id="hw-tip">自动刷新已关闭</div>
        </div>`;
        
        // Power 标签页（预留）
        panelHTML += `<div class="hw-tab-content" id="hw-tab-power">
            <div class="hw-tip">Power 功能开发中...</div>
        </div>`;
        
        // Info 标签页（预留）
        panelHTML += `<div class="hw-tab-content" id="hw-tab-info">
            <div class="hw-tip">Info 功能开发中...</div>
        </div>`;
        
        // Renew 标签页
        panelHTML += `<div class="hw-tab-content" id="hw-tab-renew">
            <div class="hw-item">
                <label class="hw-label">网站地址</label>
                <input type="text" class="hw-input" id="hw-renew-web" value="${CURRENT_SITE === 'hax' ? 'hax.co.id' : 'woiden.id'}" placeholder="hax.co.id">
            </div>
            <button class="hw-apply-btn" id="hw-renew-apply" style="background: #9c27b0 !important;">🔄 自动续期VPS</button>
            <div class="hw-tip" id="hw-renew-tip">等待操作</div>
        </div>`;
        
        // Remove 标签页
        panelHTML += `<div class="hw-tab-content" id="hw-tab-remove">
            <div class="hw-item">
                <label class="hw-label">确认删除</label>
                <input type="text" class="hw-input" id="hw-remove-confirm" value="AGREE" readonly>
            </div>
            <button class="hw-apply-btn" id="hw-remove-apply" style="background: #f44336 !important;">🗑️ 自动删除VPS</button>
            <div class="hw-tip" id="hw-remove-tip">等待操作</div>
        </div>`;

        panelElement = document.createElement('div');
        panelElement.id = 'hw-max-panel';
        panelElement.innerHTML = panelHTML;
        document.body.appendChild(panelElement);

        // 绑定双端事件
        bindDragEvents();
        bindClickEvents();
        bindTabEvents();
        
        // Woiden 数学题后台自动计算
        if (CURRENT_SITE === 'woiden') {
            monitorWoidenCaptcha();
        }
    }

    // ====================== 5. 核心修复：Edge拖拽事件（彻底解决上下拖动问题） ======================
    function bindDragEvents() {
        // ============= PC端鼠标拖拽事件 =============
        // 鼠标按下：记录初始位置
        ballElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isDragging = false;
            // 记录鼠标按下时的坐标
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            // 核心修复：获取当前实际视觉位置，并清除margin-top偏移
            const ballRect = ballElement.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(ballElement);
            const marginTop = parseFloat(computedStyle.marginTop) || 0;
            ballStartLeft = ballRect.left;
            ballStartTop = ballRect.top - marginTop;
            // 拖拽时禁用动画，添加拖拽标记，清除margin偏移
            ballElement.classList.add('dragging');
            ballElement.style.marginTop = '0';
        });

        // 鼠标移动：实时计算位置（绑定到window，Edge不会丢失事件）
        window.addEventListener('mousemove', (e) => {
            // 只有按下鼠标才触发拖拽
            if (!ballElement.classList.contains('dragging')) return;

            // 计算鼠标移动距离
            const moveX = e.clientX - dragStartX;
            const moveY = e.clientY - dragStartY;

            // 移动超过3px判定为拖拽，避免和点击冲突
            if (Math.abs(moveX) > 3 || Math.abs(moveY) > 3) {
                isDragging = true;
            }
            if (!isDragging) return;

            // 计算新位置
            let newLeft = ballStartLeft + moveX;
            let newTop = ballStartTop + moveY;

            // 边界判断（实时获取窗口大小，确保不会拖出屏幕）
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            newLeft = Math.max(0, Math.min(newLeft, winWidth - BALL_SIZE));
            newTop = Math.max(0, Math.min(newTop, winHeight - BALL_SIZE));

            // 核心修复：直接用left和top定位，彻底清除transform和margin，避免冲突
            ballElement.style.left = newLeft + 'px';
            ballElement.style.top = newTop + 'px';
            ballElement.style.right = 'auto';
            ballElement.style.bottom = 'auto';
            ballElement.style.margin = '0';
            ballElement.style.transform = 'none';

            // 同步面板位置
            panelElement.style.right = 'auto';
            panelElement.style.left = (newLeft - panelElement.offsetWidth - 10) + 'px';
            panelElement.style.top = newTop + 'px';
            panelElement.style.margin = '0';
            panelElement.style.transform = 'none';
        });

        // 鼠标抬起：结束拖拽
        window.addEventListener('mouseup', (e) => {
            if (!ballElement.classList.contains('dragging')) return;
            // 移除拖拽标记
            ballElement.classList.remove('dragging');
            // 非拖拽行为：触发点击展开/收起面板
            if (!isDragging) {
                panelElement.classList.toggle('show');
            }
            // 重置拖拽状态
            isDragging = false;
            dragStartX = dragStartY = ballStartLeft = ballStartTop = 0;
        });

        // ============= 移动端触摸拖拽事件 =============
        ballElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            isDragging = false;
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            const ballRect = ballElement.getBoundingClientRect();
            ballStartLeft = ballRect.left;
            ballStartTop = ballRect.top;
            ballElement.classList.add('dragging');
        });

        ballElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!ballElement.classList.contains('dragging')) return;
            const touch = e.touches[0];
            const moveX = touch.clientX - dragStartX;
            const moveY = touch.clientY - dragStartY;

            if (Math.abs(moveX) > 3 || Math.abs(moveY) > 3) {
                isDragging = true;
            }
            if (!isDragging) return;

            let newLeft = ballStartLeft + moveX;
            let newTop = ballStartTop + moveY;
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            newLeft = Math.max(0, Math.min(newLeft, winWidth - BALL_SIZE));
            newTop = Math.max(0, Math.min(newTop, winHeight - BALL_SIZE));

            ballElement.style.left = newLeft + 'px';
            ballElement.style.top = newTop + 'px';
            ballElement.style.right = 'auto';
            ballElement.style.bottom = 'auto';
            ballElement.style.margin = '0';
            ballElement.style.transform = 'none';

            panelElement.style.right = 'auto';
            panelElement.style.left = (newLeft - panelElement.offsetWidth - 10) + 'px';
            panelElement.style.top = newTop + 'px';
            panelElement.style.margin = '0';
            panelElement.style.transform = 'none';
        });

        ballElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            ballElement.classList.remove('dragging');
            if (!isDragging) {
                panelElement.classList.toggle('show');
            }
            isDragging = false;
            dragStartX = dragStartY = ballStartLeft = ballStartTop = 0;
        });
    }

    // ====================== 6. 点击事件绑定 ======================
    function bindClickEvents() {
        // 点击面板外区域关闭面板
        document.addEventListener('click', (e) => {
            if (!ballElement.contains(e.target) && !panelElement.contains(e.target)) {
                panelElement.classList.remove('show');
            }
        });

        // 应用配置按钮点击
        document.querySelector('#hw-apply').addEventListener('click', (e) => {
            e.stopPropagation();
            saveConfig();
            fillForm();
            startRefreshTimer();
        });
        
        // Renew VPS 按钮
        const renewBtn = document.querySelector('#hw-renew-apply');
        if (renewBtn) {
            renewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleRenewVPS();
            });
        }
        
        // Remove VPS 按钮
        const removeBtn = document.querySelector('#hw-remove-apply');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleRemoveVPS();
            });
        }
    }
    
    // ====================== 6.1 标签页切换事件 ======================
    function bindTabEvents() {
        const pageRoutes = {
            create: '/create-vps/',
            power: '/vps-control/',
            info: '/vps-info/',
            renew: '/vps-renew/',
            remove: '/remove-vps/'
        };
        
        document.querySelectorAll('.hw-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabName = e.target.dataset.tab;
                
                // 切换标签激活状态
                document.querySelectorAll('.hw-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // 切换内容显示
                document.querySelectorAll('.hw-tab-content').forEach(c => c.classList.remove('active'));
                document.querySelector(`#hw-tab-${tabName}`).classList.add('active');
                
                // 检查当前页面是否匹配，不匹配则跳转
                const currentPath = window.location.pathname;
                const targetPath = pageRoutes[tabName];
                
                if (targetPath && !currentPath.includes(targetPath.replace(/\//g, ''))) {
                    window.location.href = targetPath;
                }
            });
        });
    }
    
    // ====================== 6.2 Woiden 数学题后台自动计算 ======================
    function monitorWoidenCaptcha() {
        let captchaMonitor = null;
        let lastCaptchaSrc = '';
        
        function checkCaptcha() {
            const captchaRow = document.querySelector('.form-group.row');
            if (!captchaRow) return;
            
            const imgElements = captchaRow.querySelectorAll('img');
            if (imgElements.length < 2) return;
            
            const currentSrc = imgElements[0]?.src || '';
            if (currentSrc && currentSrc !== lastCaptchaSrc) {
                lastCaptchaSrc = currentSrc;
                
                const num1 = extractNumberFromUrl(imgElements[0].src);
                const num2 = extractNumberFromUrl(imgElements[1].src);
                const operator = extractOperator(captchaRow);
                
                if (num1 !== null && num2 !== null && operator) {
                    const answer = calculateAnswer(num1, num2, operator);
                    if (answer !== null) {
                        syncCaptchaToPage(answer);
                    }
                }
            }
        }
        
        captchaMonitor = setInterval(checkCaptcha, 500);
        
        setTimeout(() => {
            if (captchaMonitor) clearInterval(captchaMonitor);
        }, 30000);
    }
    
    function extractNumberFromUrl(url) {
        const match = url.match(/-(\d)\d+\.\d+\.\d+\.\d+\.jpg/);
        if (match) {
            return parseInt(match[1]);
        }
        return null;
    }
    
    function extractOperator(container) {
        const imgElements = container.querySelectorAll('img');
        if (imgElements.length < 2) return null;
        
        const firstImg = imgElements[0];
        let nextNode = firstImg.nextSibling;
        
        while (nextNode) {
            if (nextNode.nodeType === Node.TEXT_NODE) {
                const text = nextNode.textContent.trim();
                const match = text.match(/[+×÷Xx\*]/);
                if (match) {
                    const op = match[0];
                    if (op === 'X' || op === 'x' || op === '*') return '×';
                    if (op === '÷') return '÷';
                    return op;
                }
            }
            nextNode = nextNode.nextSibling;
        }
        
        return '×';
    }
    
    function calculateAnswer(num1, num2, operator) {
        switch (operator) {
            case '+':
                return num1 + num2;
            case '-':
                return num1 - num2;
            case '×':
            case 'X':
            case 'x':
            case '*':
                return num1 * num2;
            case '÷':
            case '/':
                return num2 !== 0 ? Math.floor(num1 / num2) : null;
            default:
                return null;
        }
    }
    
    function syncCaptchaToPage(answer) {
        const pageCaptchaInput = document.querySelector('#captcha');
        if (pageCaptchaInput && answer) {
            pageCaptchaInput.value = answer;
            pageCaptchaInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // ====================== 7. 核心填表功能 ======================
    function fillForm() {
        // 获取页面元素
        const passwordEl = document.querySelector('#password');
        const osEl = document.querySelector('#os');
        const locationEl = document.querySelector('#datacenter');
        const purposeEl = document.querySelector('#purpose');
        const agreementEls = document.querySelectorAll('input[name="agreement[]"]');

        // 元素未加载完成，重试
        if (!passwordEl || !osEl || !locationEl || agreementEls.length === 0) {
            if (fillRetryCount < MAX_FILL_RETRY) {
                fillRetryCount++;
                setTimeout(fillForm, 500);
            }
            return;
        }

        try {
            // 1. 选择区域
            for (let opt of locationEl.options) {
                const optText = opt.textContent.trim();
                if (optText === currentConfig.location || optText.includes(currentConfig.location)) {
                    locationEl.value = opt.value;
                    locationEl.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }

            // 2. 选择操作系统
            for (let opt of osEl.options) {
                const optText = opt.textContent.trim();
                if (optText === currentConfig.os || optText.includes(currentConfig.os)) {
                    osEl.value = opt.value;
                    osEl.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }

            // 3. 选择用途
            if (purposeEl) {
                for (let opt of purposeEl.options) {
                    const optText = opt.textContent.trim();
                    if (optText === currentConfig.purpose || optText.includes(currentConfig.purpose)) {
                        purposeEl.value = opt.value;
                        purposeEl.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            }

            // 4. 填写密码
            if (currentConfig.password) {
                passwordEl.value = currentConfig.password;
            }

            // 5. 全勾选所有协议
            agreementEls.forEach(checkbox => {
                if (!checkbox.checked) checkbox.checked = true;
            });

            showTip("✅ 配置已应用：区域+OS+密码+全勾选协议");
            fillRetryCount = 0;
            
            // 自动启动 Cloudflare 检测并点击 CREATE VPS
            setTimeout(() => {
                const createVPSBtn = document.querySelector('button[name="submit_button"]');
                if (createVPSBtn) {
                    startAutoClickMonitor(createVPSBtn);
                }
            }, 500);
        } catch (e) {
            showTip("❌ 填表失败");
            console.error("填表错误：", e);
        }
    }

    // ====================== 8. CREATE VPS 辅助点击 + Cloudflare 自动检测 ======================
    function handleCreateVPSClick() {
        const createVPSBtn = document.querySelector('button[name="submit_button"]');
        
        if (!createVPSBtn) {
            showTip("❌ 未找到 CREATE VPS 按钮");
            return;
        }

        startAutoClickMonitor(createVPSBtn);
    }

    function startAutoClickMonitor(createVPSBtn) {
        if (autoClickMonitor) {
            clearInterval(autoClickMonitor);
        }

        let monitorCount = 0;
        const maxMonitor = 240;
        let hasNotifiedPending = false;

        showTip("🔍 自动检测 Cloudflare 验证状态...");

        autoClickMonitor = setInterval(() => {
            monitorCount++;
            const cfStatus = checkCloudflareChallenge();

            if (cfStatus === 'loading') {
                if (monitorCount % 10 === 0) {
                    showTip("⏳ Cloudflare 验证加载中...");
                }
            } else if (cfStatus === 'pending') {
                if (!hasNotifiedPending) {
                    showTip("⚠️ 检测到人机验证，请完成验证");
                    hasNotifiedPending = true;
                }
            } else if (cfStatus === 'success') {
                clearInterval(autoClickMonitor);
                showTip("✅ Cloudflare 验证通过，正在创建VPS...");
                triggerCreateVPS(createVPSBtn);
            } else if (cfStatus === 'not_found') {
                clearInterval(autoClickMonitor);
                showTip("🚀 无需验证，直接创建VPS...");
                triggerCreateVPS(createVPSBtn);
            }

            if (monitorCount >= maxMonitor) {
                clearInterval(autoClickMonitor);
                showTip("⏱ 监控超时，请手动点击 CREATE VPS 按钮");
            }
        }, 500);
    }

    function checkCloudflareChallenge() {
        const turnstileWidget = document.querySelector('.cf-turnstile');
        
        if (!turnstileWidget) {
            return 'not_found';
        }

        const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
        const cfIframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        
        if (turnstileResponse && turnstileResponse.value && turnstileResponse.value.length > 0) {
            return 'success';
        }

        if (cfIframe && cfIframe.offsetHeight > 0) {
            if (turnstileWidget.classList.contains('success') || 
                turnstileWidget.querySelector('.success')) {
                return 'success';
            }
            return 'pending';
        }

        return 'loading';
    }

    function triggerCreateVPS(createVPSBtn) {
        requestAnimationFrame(() => {
            try {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: createVPSBtn.getBoundingClientRect().x + 10,
                    clientY: createVPSBtn.getBoundingClientRect().y + 10
                });
                
                createVPSBtn.dispatchEvent(clickEvent);
                showTip("🚀 已发送创建VPS请求");
                
                setTimeout(() => {
                    showTip("✅ VPS创建请求已提交");
                }, 1000);
            } catch (e) {
                showTip("❌ 点击失败");
                console.error("CREATE VPS 点击错误：", e);
            }
        });
    }

    // ====================== 9. Renew VPS 功能 ======================
    function handleRenewVPS() {
        const webAddress = document.querySelector('#hw-renew-web')?.value?.trim();
        if (!webAddress) {
            showRenewTip("❌ 请输入网站地址");
            return;
        }

        const webAddressEl = document.querySelector('#web_address');
        if (!webAddressEl) {
            showRenewTip("❌ 未找到输入框，请确认页面已加载");
            return;
        }

        webAddressEl.value = webAddress;
        webAddressEl.dispatchEvent(new Event('input', { bubbles: true }));

        const agreementEl = document.querySelector('input[name="agreement"]');
        if (agreementEl && !agreementEl.checked) {
            agreementEl.checked = true;
        }

        showRenewTip("✅ 已填写信息，等待 Cloudflare 验证...");

        const renewBtn = document.querySelector('button[name="submit_button"]');
        if (!renewBtn) {
            showRenewTip("❌ 未找到 Renew VPS 按钮");
            return;
        }

        startRenewMonitor(renewBtn);
    }

    function startRenewMonitor(renewBtn) {
        let monitorCount = 0;
        const maxMonitor = 240;
        let hasNotifiedPending = false;

        const monitorInterval = setInterval(() => {
            monitorCount++;
            const cfStatus = checkCloudflareChallenge();

            if (cfStatus === 'loading') {
                if (monitorCount % 10 === 0) {
                    showRenewTip("⏳ Cloudflare 验证加载中...");
                }
            } else if (cfStatus === 'pending') {
                if (!hasNotifiedPending) {
                    showRenewTip("⚠️ 请完成 Cloudflare 人机验证");
                    hasNotifiedPending = true;
                }
            } else if (cfStatus === 'success') {
                clearInterval(monitorInterval);
                showRenewTip("✅ Cloudflare 验证通过，正在续期VPS...");
                triggerRenewVPS(renewBtn);
            } else if (cfStatus === 'not_found') {
                clearInterval(monitorInterval);
                showRenewTip("🚀 无需验证，直接续期VPS...");
                triggerRenewVPS(renewBtn);
            }

            if (monitorCount >= maxMonitor) {
                clearInterval(monitorInterval);
                showRenewTip("⏱ 监控超时，请手动点击 Renew VPS 按钮");
            }
        }, 500);
    }

    function triggerRenewVPS(renewBtn) {
        requestAnimationFrame(() => {
            try {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: renewBtn.getBoundingClientRect().x + 10,
                    clientY: renewBtn.getBoundingClientRect().y + 10
                });
                
                renewBtn.dispatchEvent(clickEvent);
                showRenewTip("� 已发送续期请求");
                
                setTimeout(() => {
                    showRenewTip("✅ VPS续期请求已提交");
                }, 1000);
            } catch (e) {
                showRenewTip("❌ 续期失败");
                console.error("Renew VPS 点击错误：", e);
            }
        });
    }

    function showRenewTip(text) {
        const tipEl = document.querySelector('#hw-renew-tip');
        if (tipEl) {
            tipEl.textContent = text;
        }
    }

    // ====================== 10. Remove VPS 功能 ======================
    function handleRemoveVPS() {
        const confirmText = document.querySelector('#hw-remove-confirm')?.value?.trim();
        if (!confirmText || confirmText !== 'AGREE') {
            showRemoveTip("❌ 必须输入 AGREE 才能删除");
            return;
        }

        const removeInput = document.querySelector('#remove');
        if (!removeInput) {
            showRemoveTip("❌ 未找到输入框，请确认页面已加载");
            return;
        }

        removeInput.value = 'AGREE';
        removeInput.dispatchEvent(new Event('input', { bubbles: true }));

        const agreementEl = document.querySelector('input[name="agreement"]');
        if (agreementEl && !agreementEl.checked) {
            agreementEl.checked = true;
        }

        showRemoveTip("✅ 已填写确认信息，等待 Cloudflare 验证...");

        const removeBtn = document.querySelector('button[name="submit_button"]');
        if (!removeBtn) {
            showRemoveTip("❌ 未找到 Remove VPS 按钮");
            return;
        }

        startRemoveMonitor(removeBtn);
    }

    function startRemoveMonitor(removeBtn) {
        let monitorCount = 0;
        const maxMonitor = 240;
        let hasNotifiedPending = false;

        const monitorInterval = setInterval(() => {
            monitorCount++;
            const cfStatus = checkCloudflareChallenge();

            if (cfStatus === 'loading') {
                if (monitorCount % 10 === 0) {
                    showRemoveTip("⏳ Cloudflare 验证加载中...");
                }
            } else if (cfStatus === 'pending') {
                if (!hasNotifiedPending) {
                    showRemoveTip("⚠️ 请完成 Cloudflare 人机验证");
                    hasNotifiedPending = true;
                }
            } else if (cfStatus === 'success') {
                clearInterval(monitorInterval);
                showRemoveTip("🗑️ Cloudflare 验证通过，正在删除VPS...");
                triggerRemoveVPS(removeBtn);
            } else if (cfStatus === 'not_found') {
                clearInterval(monitorInterval);
                showRemoveTip("🗑️ 无需验证，直接删除VPS...");
                triggerRemoveVPS(removeBtn);
            }

            if (monitorCount >= maxMonitor) {
                clearInterval(monitorInterval);
                showRemoveTip("⏱ 监控超时，请手动点击 Remove VPS 按钮");
            }
        }, 500);
    }

    function triggerRemoveVPS(removeBtn) {
        requestAnimationFrame(() => {
            try {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: removeBtn.getBoundingClientRect().x + 10,
                    clientY: removeBtn.getBoundingClientRect().y + 10
                });
                
                removeBtn.dispatchEvent(clickEvent);
                showRemoveTip("🗑️ 已发送删除请求");
                
                setTimeout(() => {
                    showRemoveTip("⚠️ VPS删除请求已提交，数据将被清除");
                }, 1000);
            } catch (e) {
                showRemoveTip("❌ 删除失败");
                console.error("Remove VPS 点击错误：", e);
            }
        });
    }

    function showRemoveTip(text) {
        const tipEl = document.querySelector('#hw-remove-tip');
        if (tipEl) {
            tipEl.textContent = text;
        }
    }

    // ====================== 9. 自动刷新功能 ======================
    function startRefreshTimer() {
        clearInterval(countdownTimer);
        if (!currentConfig.refreshEnable) {
            updateTipText();
            return;
        }

        remainTime = currentConfig.refreshSec;
        updateTipText();

        countdownTimer = setInterval(() => {
            remainTime--;
            updateTipText();
            if (remainTime <= 0) {
                window.location.reload();
            }
        }, 1000);
    }

    function updateTipText() {
        const tipEl = document.querySelector('#hw-tip');
        if (!tipEl) return;
        tipEl.textContent = currentConfig.refreshEnable
            ? `⏱ ${remainTime}秒后自动刷新`
            : "自动刷新已关闭";
    }

    function showTip(text) {
        const tipEl = document.querySelector('#hw-tip');
        if (!tipEl) return;
        tipEl.textContent = text;
        setTimeout(() => updateTipText(), 2500);
    }

    // ====================== 9. 配置持久化 ======================
    function saveConfig() {
        // 读取面板配置
        currentConfig.location = document.querySelector('#hw-location').value;
        currentConfig.os = document.querySelector('#hw-os').value;
        currentConfig.password = document.querySelector('#hw-password').value;
        currentConfig.refreshSec = parseInt(document.querySelector('#hw-refresh').value) || 50;
        currentConfig.refreshEnable = true;
        // 保存到本地
        config[CURRENT_SITE] = currentConfig;
        localStorage.setItem("hw_1.0Max_config", JSON.stringify(config));
    }

    function backfillConfigToPanel() {
        // 回填配置到面板
        document.querySelector('#hw-location').value = currentConfig.location;
        document.querySelector('#hw-os').value = currentConfig.os;
        document.querySelector('#hw-password').value = currentConfig.password;
        document.querySelector('#hw-refresh').value = currentConfig.refreshSec;
    }

    // ====================== 10. 入口初始化 ======================
    const init = () => {
        try {
            initStyle();
            initUI();
            backfillConfigToPanel();
            // 页面加载完成自动填表
            setTimeout(() => {
                fillForm();
                if (currentConfig.refreshEnable) {
                    startRefreshTimer();
                }
                // Create 页面自动创建VPS
                if (window.location.pathname.includes('create-vps')) {
                    setTimeout(() => {
                        handleCreateVPSClick();
                    }, 2000);
                }
            }, 1000);
        } catch (e) {
            console.error("脚本初始化失败：", e);
        }
    };

    // 兼容所有浏览器的加载时机
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 500);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 500);
        });
    }

    // 页面卸载前清除定时器
    window.addEventListener('beforeunload', () => {
        clearInterval(countdownTimer);
    });

})();
