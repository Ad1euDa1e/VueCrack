const routerAnalysisContainer = document.getElementById('routerAnalysisContainer');
const pathListContainer = document.getElementById('pathListContainer');
const allInToggle = document.getElementById('allInToggle');
const allInStatus = document.getElementById('allInStatus');

// 全局变量存储路由分析结果
let vueAnalysisResult = null;
let currentTabId = null;
let currentTabUrl = '';
let pendingNavigationUrl = '';

const ANALYSIS_CACHE_PREFIX = 'vuecrack_analysis_cache:';
const LAST_OPENED_ROUTE_PREFIX = 'vuecrack_last_opened_route:';
const ALL_IN_STORAGE_KEY = 'vuecrack_all_in_enabled';
const ALL_IN_SITES_STORAGE_KEY = 'vuecrack_all_in_sites';
const MAX_CACHE_ENTRIES = 15;
const MAX_ROUTE_MEMORY_ENTRIES = 50;

let allInEnabled = false;
let latestAllInStatus = null;
let allInSiteKey = '';
let allInModeInitialized = false;
const basePathModeByOrigin = {};

// URL清理函数
function cleanUrl(url) {
    return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
}

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }

    return cleanUrl(url.trim());
}

function urlsEqual(left, right) {
    return normalizeUrl(left) === normalizeUrl(right);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function normalizeBasePath(basePath) {
    if (!basePath || typeof basePath !== 'string') {
        return '';
    }

    let normalized = basePath.trim().replace(/\\/g, '/');

    if (!normalized || normalized === '/' || normalized.includes('#')) {
        return '';
    }

    if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalized)) {
        return '';
    }

    const queryIndex = normalized.indexOf('?');
    if (queryIndex >= 0) {
        normalized = normalized.substring(0, queryIndex);
    }

    if (!normalized.startsWith('/')) {
        normalized = `/${normalized}`;
    }

    normalized = cleanUrl(normalized);
    return normalized === '/' ? '' : normalized;
}

function getBaseModeKey(url) {
    try {
        return new URL(url).origin;
    } catch (error) {
        return normalizeUrl(url);
    }
}

function splitUrlForDisplay(url) {
    try {
        const parsed = new URL(url);
        return {
            domain: parsed.origin,
            path: `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
        };
    } catch (error) {
        return {
            domain: '',
            path: url || ''
        };
    }
}

function getAllInSiteKey(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
            return '';
        }

        return parsed.hostname.toLowerCase();
    } catch (error) {
        return '';
    }
}

function getCacheKey(url) {
    return `${ANALYSIS_CACHE_PREFIX}${encodeURIComponent(normalizeUrl(url))}`;
}

function getRouteMemoryKey(url) {
    try {
        const parsed = new URL(url);
        return `${LAST_OPENED_ROUTE_PREFIX}${parsed.origin}`;
    } catch (error) {
        return `${LAST_OPENED_ROUTE_PREFIX}${encodeURIComponent(normalizeUrl(url))}`;
    }
}

function pruneAnalysisCache() {
    try {
        const entries = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(ANALYSIS_CACHE_PREFIX)) {
                continue;
            }

            try {
                const parsed = JSON.parse(localStorage.getItem(key));
                entries.push({
                    key,
                    savedAt: parsed?.savedAt || 0
                });
            } catch (error) {
                localStorage.removeItem(key);
            }
        }

        if (entries.length <= MAX_CACHE_ENTRIES) {
            return;
        }

        entries
            .sort((a, b) => b.savedAt - a.savedAt)
            .slice(MAX_CACHE_ENTRIES)
            .forEach(entry => localStorage.removeItem(entry.key));
    } catch (error) {
        console.warn('清理分析缓存失败:', error);
    }
}

function pruneRouteMemory() {
    try {
        const entries = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LAST_OPENED_ROUTE_PREFIX)) {
                continue;
            }

            try {
                const rawValue = localStorage.getItem(key);
                const parsed = rawValue ? JSON.parse(rawValue) : null;
                entries.push({
                    key,
                    savedAt: parsed?.savedAt || 0
                });
            } catch (error) {
                entries.push({
                    key,
                    savedAt: 0
                });
            }
        }

        if (entries.length <= MAX_ROUTE_MEMORY_ENTRIES) {
            return;
        }

        entries
            .sort((a, b) => b.savedAt - a.savedAt)
            .slice(MAX_ROUTE_MEMORY_ENTRIES)
            .forEach(entry => localStorage.removeItem(entry.key));
    } catch (error) {
        console.warn('清理上次打开路由缓存失败:', error);
    }
}

function readCachedAnalysis(url) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        return null;
    }

    try {
        const cached = localStorage.getItem(getCacheKey(normalizedUrl));
        if (!cached) {
            return null;
        }

        const parsed = JSON.parse(cached);
        return parsed?.result ? parsed : null;
    } catch (error) {
        console.warn('读取分析缓存失败:', error);
        return null;
    }
}

function writeCachedAnalysis(url, result) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl || !result) {
        return;
    }

    try {
        localStorage.setItem(getCacheKey(normalizedUrl), JSON.stringify({
            url: normalizedUrl,
            savedAt: Date.now(),
            result
        }));

        pruneAnalysisCache();
    } catch (error) {
        console.warn('保存分析缓存失败:', error);
    }
}

function clearCachedAnalysis(url) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        return;
    }

    try {
        localStorage.removeItem(getCacheKey(normalizedUrl));
    } catch (error) {
        console.warn('清理分析缓存失败:', error);
    }
}

function writeLastOpenedRoute(pageUrl, routeUrl) {
    if (!pageUrl || !routeUrl) {
        return;
    }

    try {
        localStorage.setItem(getRouteMemoryKey(pageUrl), JSON.stringify({
            routeUrl: normalizeUrl(routeUrl),
            savedAt: Date.now()
        }));
        pruneRouteMemory();
    } catch (error) {
        console.warn('保存上次打开路由失败:', error);
    }
}

function readLastOpenedRoute(pageUrl) {
    if (!pageUrl) {
        return '';
    }

    try {
        const rawValue = localStorage.getItem(getRouteMemoryKey(pageUrl));
        if (!rawValue) {
            return '';
        }

        try {
            const parsed = JSON.parse(rawValue);
            return parsed?.routeUrl || '';
        } catch (error) {
            return rawValue;
        }
    } catch (error) {
        console.warn('读取上次打开路由失败:', error);
        return '';
    }
}

function normalizeRoutePath(path) {
    if (!path || typeof path !== 'string') {
        return '/';
    }

    const trimmed = path.trim();
    if (!trimmed) {
        return '/';
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return cleanUrl(withLeadingSlash) || '/';
}

function dedupeRoutes(routes) {
    const seenPaths = new Set();

    return routes.reduce((accumulator, route) => {
        if (!route || typeof route !== 'object' || !route.path || typeof route.path !== 'string') {
            return accumulator;
        }

        const normalizedPath = normalizeRoutePath(route.path);
        if (seenPaths.has(normalizedPath)) {
            return accumulator;
        }

        seenPaths.add(normalizedPath);
        accumulator.push({
            ...route,
            path: normalizedPath
        });
        return accumulator;
    }, []);
}

function dedupeUrlItems(items) {
    const seenUrls = new Set();

    return items.filter(item => {
        const normalized = normalizeUrl(item?.url || '');
        if (!normalized || seenUrls.has(normalized)) {
            return false;
        }

        seenUrls.add(normalized);
        item.url = normalized;
        return true;
    });
}

function normalizeAnalysisResult(result) {
    if (!result || typeof result !== 'object') {
        return result;
    }

    const normalizedRoutes = dedupeRoutes(Array.isArray(result.allRoutes) ? result.allRoutes : []);

    return {
        ...result,
        allRoutes: normalizedRoutes,
        routeCount: normalizedRoutes.length
    };
}

function ensureActiveRouteVisible(activeItem) {
    if (!activeItem) {
        return;
    }

    const rect = activeItem.getBoundingClientRect();
    const topSafeMargin = 12;
    const bottomSafeMargin = 16;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const isAboveViewport = rect.top < topSafeMargin;
    const isBelowViewport = rect.bottom > (viewportHeight - bottomSafeMargin);

    if (!isAboveViewport && !isBelowViewport) {
        return;
    }

    activeItem.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest'
    });
}

function setAllInStatusText(message) {
    if (allInStatus) {
        allInStatus.textContent = message;
    }
}

function renderAllInStatus() {
    if (!allInEnabled) {
        setAllInStatusText('已关闭');
        return;
    }

    if (latestAllInStatus?.injected) {
        const guardCount = latestAllInStatus.guardRegistrationBlocked || 0;
        const routerJumpCount = latestAllInStatus.routerJumpBlocked || 0;
        const browserJumpCount = latestAllInStatus.browserJumpBlocked || 0;
        setAllInStatusText(`已注入 · 守卫 ${guardCount} · Router ${routerJumpCount} · 浏览器 ${browserJumpCount}`);
        return;
    }

    setAllInStatusText('已开启，刷新后生效');
}

function requestAllInStatus() {
    if (!currentTabId) {
        return;
    }

    chrome.tabs.sendMessage(currentTabId, {action: "getAllInStatus"}, () => {
        if (chrome.runtime.lastError) {
            renderAllInStatus();
        }
    });
}

function normalizeAllInSites(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.keys(value).reduce((accumulator, key) => {
        if (value[key] === true) {
            accumulator[key] = true;
        }
        return accumulator;
    }, {});
}

function initializeAllInMode(pageUrl = currentTabUrl) {
    if (!allInToggle) {
        return;
    }

    allInSiteKey = getAllInSiteKey(pageUrl);

    if (!allInSiteKey) {
        allInEnabled = false;
        latestAllInStatus = null;
        allInToggle.checked = false;
        allInToggle.disabled = true;
        setAllInStatusText('当前页面不支持');
        return;
    }

    allInToggle.disabled = false;

    chrome.storage.local.get([ALL_IN_SITES_STORAGE_KEY], result => {
        const sites = normalizeAllInSites(result[ALL_IN_SITES_STORAGE_KEY]);
        allInEnabled = sites[allInSiteKey] === true;
        allInToggle.checked = allInEnabled;
        latestAllInStatus = null;
        renderAllInStatus();
    });

    if (allInModeInitialized) {
        return;
    }

    allInModeInitialized = true;

    allInToggle.addEventListener('change', () => {
        const siteKey = allInSiteKey;

        if (!siteKey) {
            allInToggle.checked = false;
            allInEnabled = false;
            setAllInStatusText('当前页面不支持');
            return;
        }

        allInEnabled = allInToggle.checked;
        latestAllInStatus = null;
        renderAllInStatus();

        chrome.storage.local.get([ALL_IN_SITES_STORAGE_KEY], result => {
            const sites = normalizeAllInSites(result[ALL_IN_SITES_STORAGE_KEY]);

            if (allInEnabled) {
                sites[siteKey] = true;
            } else {
                delete sites[siteKey];
            }

            chrome.storage.local.set({
                [ALL_IN_STORAGE_KEY]: false,
                [ALL_IN_SITES_STORAGE_KEY]: sites
            }, () => {
                chrome.runtime.sendMessage({action: "syncAllInMode"}, () => {
                    if (chrome.runtime.lastError) {
                        return;
                    }
                    requestAllInStatus();
                });
            });
        });
    });
}

// 安全的错误处理
function safeExecute(fn, context = 'Unknown') {
    try {
        return fn();
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        showError(`${context}执行出错: ${error.message}`);
        return null;
    }
}

// 显示加载中状态
function showLoading(message) {
    routerAnalysisContainer.innerHTML = `
        <div class="status-item info">
            <span class="loading-spinner"></span>
            ${message}
        </div>
    `;
}

// 显示错误信息
function showError(message) {
    routerAnalysisContainer.innerHTML = `
        <div class="status-item error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
            </svg>
            ${message}
        </div>
    `;
}

function updateCurrentTabInfo(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) {
            showError("无法获取当前标签页信息");
            return;
        }

        currentTabId = tabs[0].id;
        currentTabUrl = tabs[0].url || '';

        if (typeof callback === 'function') {
            callback(tabs[0]);
        }
    });
}

function restoreCachedAnalysis(url) {
    const cached = readCachedAnalysis(url);
    if (!cached?.result) {
        return false;
    }

    const normalizedResult = normalizeAnalysisResult(cached.result);
    vueAnalysisResult = normalizedResult;
    displayRouterAnalysis(normalizedResult);
    return true;
}

function requestCurrentTabAnalysis({preserveUi = false, forceRefresh = true} = {}) {
    if (!currentTabId) {
        showError("无法获取当前标签页信息");
        return;
    }

    if (!preserveUi || !vueAnalysisResult) {
        showLoading("正在分析Vue路由...");
    }

    chrome.tabs.sendMessage(currentTabId, {
        action: "analyzeVueRouter",
        forceRefresh
    }, function() {
        if (!chrome.runtime.lastError) {
            return;
        }

        console.warn('分析请求发送失败:', chrome.runtime.lastError.message);

        if (!preserveUi && !vueAnalysisResult) {
            showError("无法连接到页面，请刷新后重试。");
        }
    });
}

function navigateToUrl(url) {
    if (!currentTabId) {
        showError("无法获取当前标签页信息");
        return;
    }

    pendingNavigationUrl = normalizeUrl(url);
    writeLastOpenedRoute(currentTabUrl, url);

    chrome.tabs.update(currentTabId, {url}, function() {
        if (chrome.runtime.lastError) {
            pendingNavigationUrl = '';
            showError(`打开失败: ${chrome.runtime.lastError.message}`);
        }
    });
}

// 初始化函数
function init() {
    showLoading("正在分析Vue路由...");

    updateCurrentTabInfo(function(tab) {
        initializeAllInMode(tab.url);
        const restored = restoreCachedAnalysis(tab.url);
        requestAllInStatus();
        requestCurrentTabAnalysis({
            preserveUi: restored,
            forceRefresh: true
        });
    });
}

// 显示Vue检测结果
function displayDetectionResult(result) {
    if (result.detected) {
        if (!vueAnalysisResult) {
            showLoading("正在分析Vue路由...");
        }
        return;
    }

    vueAnalysisResult = null;
    clearCachedAnalysis(currentTabUrl);

    routerAnalysisContainer.innerHTML = `
        <div class="status-item error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
            </svg>
            未检测到Vue
        </div>
    `;

    pathListContainer.innerHTML = '';
}

// 显示Vue Router分析结果
function displayRouterAnalysis(result) {
    safeExecute(() => {
        const normalizedResult = normalizeAnalysisResult(result);
        vueAnalysisResult = normalizedResult;

        if (!normalizedResult.routerDetected) {
            routerAnalysisContainer.innerHTML = `
                <div class="status-item error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
                        <path d="M15 9L9 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                        <path d="M9 9L15 15" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    未检测到Vue Router
                </div>
            `;
            return;
        }

        const html = `<h3>当前Vue版本： <span class="version-badge">${normalizedResult.vueVersion || 'Unknown'}</span></h3>`;
        routerAnalysisContainer.innerHTML = html;

        displayUrlList(normalizedResult.allRoutes || normalizedResult);
    }, 'displayRouterAnalysis');
}

// 添加事件监听器
function addEventListeners() {
    safeExecute(() => {
        const copyPathsBtn = document.getElementById('copyPathsBtn');
        if (copyPathsBtn) {
            copyPathsBtn.addEventListener('click', function() {
                const paths = dedupeRoutes(vueAnalysisResult?.allRoutes || [])
                    .map(route => route.path)
                    .filter(Boolean);
                const pathsText = paths.join('\n');

                navigator.clipboard.writeText(pathsText).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '复制失败';
                    setTimeout(() => {
                        this.textContent = '复制所有路径';
                    }, 2000);
                });
            });
        }

        const copyUrlsBtn = document.getElementById('copyUrlsBtn');
        if (copyUrlsBtn) {
            copyUrlsBtn.addEventListener('click', function() {
                const displayedUrls = document.querySelectorAll('.displayed-urls .url-text');
                const urlsToUse = Array.from(displayedUrls).map(el => el.textContent);
                const urlsText = urlsToUse.join('\n');

                navigator.clipboard.writeText(urlsText).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制所有URL';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '复制失败';
                    setTimeout(() => {
                        this.textContent = '复制所有URL';
                    }, 2000);
                });
            });
        }

        const pathModeBtns = document.querySelectorAll('.path-mode-btn');
        pathModeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const mode = this.getAttribute('data-mode');
                const modeKey = this.getAttribute('data-mode-key');

                if (!modeKey || !['standard', 'base'].includes(mode)) {
                    return;
                }

                basePathModeByOrigin[modeKey] = mode;
                displayUrlList(vueAnalysisResult?.allRoutes || []);
            });
        });

        const urlCopyBtns = document.querySelectorAll('.url-copy-btn');
        urlCopyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                navigator.clipboard.writeText(url).then(() => {
                    this.textContent = '已复制!';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                }).catch(err => {
                    console.error('复制失败:', err);
                    this.textContent = '失败';
                    setTimeout(() => {
                        this.textContent = '复制';
                    }, 2000);
                });
            });
        });

        const urlOpenBtns = document.querySelectorAll('.url-open-btn');
        urlOpenBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                navigateToUrl(url);
            });
        });
    }, 'addEventListeners');
}

// 显示URL列表
function displayUrlList(routes) {
    if (!routes) {
        pathListContainer.innerHTML = `<p>没有找到路由路径</p>`;
        return;
    }

    let routeArray = [];
    if (Array.isArray(routes)) {
        routeArray = routes;
    } else if (routes.allRoutes && Array.isArray(routes.allRoutes)) {
        routeArray = routes.allRoutes;
    } else if (typeof routes === 'object' && routes !== null) {
        const keys = Object.keys(routes);
        routeArray = keys.map(key => {
            const route = routes[key];
            return {
                path: route.path || key,
                name: route.name || key
            };
        });
    } else {
        pathListContainer.innerHTML = `<p>路由数据格式错误</p>`;
        return;
    }

    const validRoutes = dedupeRoutes(routeArray);

    if (!validRoutes.length) {
        pathListContainer.innerHTML = `<p>没有找到有效的路由路径</p>`;
        return;
    }

    updateCurrentTabInfo(function(tab) {
        safeExecute(() => {
            const currentUrl = tab.url;
            const lastOpenedRoute = readLastOpenedRoute(currentUrl);
            const urlObj = new URL(currentUrl);
            const domainBase = urlObj.origin;

            let baseUrl = '';
            let isHistoryMode = false;

            if (currentUrl.includes('#/') || currentUrl.includes('#')) {
                const hashIndex = currentUrl.indexOf('#');
                baseUrl = currentUrl.substring(0, hashIndex + 1);
            } else {
                isHistoryMode = true;
                baseUrl = domainBase;
            }

            const paths = validRoutes.map(route => route.path).filter(Boolean);
            const trustedBasePath = normalizeBasePath(vueAnalysisResult?.routerBase || '');
            const candidateBasePath = trustedBasePath ? '' : normalizeBasePath(vueAnalysisResult?.pageAnalysis?.detectedBasePath || '');
            const availableBasePath = trustedBasePath || candidateBasePath;
            const canUseBaseMode = !!(isHistoryMode && availableBasePath);
            const modeKey = getBaseModeKey(currentUrl);
            const defaultMode = trustedBasePath ? 'base' : 'standard';

            function buildUrl(path, modeBasePath = '') {
                const normalizedPath = normalizeRoutePath(path);
                const cleanPath = normalizedPath === '/' ? '' : normalizedPath.substring(1);

                if (isHistoryMode) {
                    if (modeBasePath) {
                        if (normalizedPath === modeBasePath || normalizedPath.startsWith(`${modeBasePath}/`)) {
                            return `${baseUrl}${normalizedPath}`;
                        }

                        return `${baseUrl}${modeBasePath}${cleanPath ? `/${cleanPath}` : ''}`;
                    }

                    return `${baseUrl}${cleanPath ? `/${cleanPath}` : '/'}`;
                }

                if (baseUrl.endsWith('#')) {
                    return `${baseUrl}/${cleanPath}`;
                }

                if (baseUrl.endsWith('#/')) {
                    return `${baseUrl}${cleanPath}`;
                }

                return `${baseUrl}#/${cleanPath}`;
            }

            const standardUrls = dedupeUrlItems(paths.map(path => ({
                path,
                url: buildUrl(path)
            })));
            const baseModeUrls = canUseBaseMode ? dedupeUrlItems(paths.map(path => ({
                path,
                url: buildUrl(path, availableBasePath)
            }))) : [];
            let activeMode = canUseBaseMode ? (basePathModeByOrigin[modeKey] || '') : 'standard';

            if (!activeMode && lastOpenedRoute && canUseBaseMode) {
                if (baseModeUrls.some(item => urlsEqual(item.url, lastOpenedRoute))) {
                    activeMode = 'base';
                } else if (standardUrls.some(item => urlsEqual(item.url, lastOpenedRoute))) {
                    activeMode = 'standard';
                }
            }

            if (!activeMode) {
                activeMode = canUseBaseMode ? defaultMode : 'standard';
            }

            if (!['standard', 'base'].includes(activeMode) || (activeMode === 'base' && !canUseBaseMode)) {
                activeMode = canUseBaseMode ? defaultMode : 'standard';
            }

            const displayedUrls = activeMode === 'base' ? baseModeUrls : standardUrls;
            const displayRouteCount = displayedUrls.length;
            const baseModeLabel = trustedBasePath ? `带基础路径 ${trustedBasePath}` : `候选 ${candidateBasePath}`;
            const sectionTitle = activeMode === 'base'
                ? (trustedBasePath ? `带基础路径URL：${trustedBasePath}` : `候选基础路径URL：${candidateBasePath}`)
                : '标准URL';

            let html = `<h3><span>完整URL列表</span><span class="route-count-badge">${displayRouteCount} 条路由</span></h3>`;

            if (canUseBaseMode) {
                html += `
                <div class="path-mode-selector" role="group" aria-label="URL 生成模式">
                    <button type="button" class="path-mode-btn${activeMode === 'standard' ? ' active' : ''}" data-mode="standard" data-mode-key="${escapeHtml(modeKey)}">标准</button>
                    <button type="button" class="path-mode-btn${activeMode === 'base' ? ' active' : ''}" data-mode="base" data-mode-key="${escapeHtml(modeKey)}" title="${escapeHtml(baseModeLabel)}">${escapeHtml(baseModeLabel)}</button>
                </div>`;
            }

            html += `
            <div class="url-section">
                <div class="url-section-header">
                    <span>${escapeHtml(sectionTitle)}</span>
                </div>
                <div class="full-urls-list displayed-urls">`;

            displayedUrls.forEach(item => {
                const safeUrl = escapeHtml(item.url);
                const displayParts = splitUrlForDisplay(item.url);
                const safeDomain = escapeHtml(displayParts.domain);
                const safePath = escapeHtml(displayParts.path);
                const displayUrl = safeDomain
                    ? `<span class="url-domain">${safeDomain}</span><span class="url-path">${safePath}</span>`
                    : `<span class="url-path">${safePath}</span>`;
                const isActiveRoute = !!(lastOpenedRoute && urlsEqual(item.url, lastOpenedRoute));
                html += `<div class="full-url-item${isActiveRoute ? ' current-route' : ''}">
                    <div class="url-main" title="${safeUrl}">
                        <span class="url-text">${displayUrl}</span>
                        <span class="route-status-slot">
                            ${isActiveRoute ? '<span class="route-status-badge current">当前</span>' : ''}
                        </span>
                    </div>
                    <div class="route-actions">
                        <button class="url-copy-btn" data-url="${safeUrl}">复制</button>
                        <button class="url-open-btn" data-url="${safeUrl}">打开</button>
                    </div>
                </div>`;
            });

            html += `</div></div>`;

            html += `
                <div class="copy-actions">
                    <button id="copyPathsBtn" class="secondary-btn">复制所有路径</button>
                    <button id="copyUrlsBtn" class="secondary-btn">复制所有URL</button>
                </div>
            `;

            pathListContainer.innerHTML = html;
            setTimeout(() => {
                addEventListeners();

                const activeItem = pathListContainer.querySelector('.full-url-item.current-route');

                if (activeItem) {
                    ensureActiveRouteVisible(activeItem);
                }
            }, 100);
        }, 'displayUrlList');
    });
}

chrome.runtime.onMessage.addListener(function(request, sender) {
    safeExecute(() => {
        if (!sender?.tab || currentTabId === null || sender.tab.id !== currentTabId) {
            return;
        }

        const senderUrl = sender.tab.url || '';

        if (pendingNavigationUrl && senderUrl && !urlsEqual(senderUrl, pendingNavigationUrl)) {
            return;
        }

        if (senderUrl) {
            currentTabUrl = senderUrl;
        }

        if (request.action === "vueDetectionResult") {
            displayDetectionResult(request.result);
        }
        else if (request.action === "vueRouterAnalysisResult") {
            const normalizedResult = normalizeAnalysisResult(request.result);
            writeCachedAnalysis(currentTabUrl, normalizedResult);
            displayRouterAnalysis(normalizedResult);
            pendingNavigationUrl = '';
        }
        else if (request.action === "vueDetectionError" || request.action === "vueRouterAnalysisError") {
            showError(request.error || "检测过程中发生错误");
            pendingNavigationUrl = '';
        }
        else if (request.action === "vuecrackAllInStatus") {
            latestAllInStatus = request.status || null;
            renderAllInStatus();
        }
    }, `Message handler: ${request.action}`);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (currentTabId === null || tabId !== currentTabId) {
        return;
    }

    if (changeInfo.url) {
        currentTabUrl = changeInfo.url;
    }

    if (changeInfo.status !== 'complete') {
        return;
    }

    currentTabUrl = tab?.url || currentTabUrl;

    const restored = restoreCachedAnalysis(currentTabUrl);
    requestCurrentTabAnalysis({
        preserveUi: restored || !!vueAnalysisResult,
        forceRefresh: true
    });
});

document.addEventListener('DOMContentLoaded', init);
