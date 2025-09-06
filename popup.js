const routerAnalysisContainer = document.getElementById('routerAnalysisContainer');
const pathListContainer = document.getElementById('pathListContainer');

// 全局变量存储路由分析结果
let vueAnalysisResult = null;

// URL清理函数
function cleanUrl(url) {
    return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
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

// 初始化函数
function init() {
    showLoading("正在检测Vue.js...");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {action: "detectVue"}, function(response) {
            if (chrome.runtime.lastError) {
                showError("无法连接到页面，请刷新后重试。");
                return;
            }
        });
    });
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

// 显示Vue检测结果
function displayDetectionResult(result) {
    if (!result.detected) {
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
        return;
    }

    showLoading("正在分析Vue路由");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {action: "analyzeVueRouter"}, function(response) {
            if (chrome.runtime.lastError) {
                showError("无法分析路由，请刷新后重试。");
                return;
            }
        });
    });
}

// 显示Vue Router分析结果
function displayRouterAnalysis(result) {
    safeExecute(() => {
        vueAnalysisResult = result;

        if (!result.routerDetected) {
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

        let html = `<h3>Vue Router 分析 <span class="version-badge">${result.vueVersion || 'Unknown'}</span></h3>`;
        html += `<div class="status-indicators">`;

        if (result.modifiedRoutes && result.modifiedRoutes.length > 0) {
            html += `
                <div class="status-item info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
                        <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1" fill="#1976d2"/>
                    </svg>
                    已修改 ${result.modifiedRoutes.length} 个路由的 auth 字段
                </div>
            `;
        } else {
            html += `
                <div class="status-item success">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#2e7d32" stroke-width="2"/>
                        <path d="M8 12L11 15L16 9" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    没有需要修改的路由 auth 字段
                </div>
            `;
        }

        html += `
            <div class="status-item success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#2e7d32" stroke-width="2"/>
                    <path d="M8 12L11 15L16 9" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                路由守卫已清除
            </div>
        `;

        html += `</div>`;
        routerAnalysisContainer.innerHTML = html;

        // 修改这里，传递整个result对象而不是result.allRoutes
        displayUrlList(result.allRoutes || result);
    }, 'displayRouterAnalysis');
}

// 添加事件监听器
function addEventListeners() {
    safeExecute(() => {
        // 路径复制按钮
        const copyPathsBtn = document.getElementById('copyPathsBtn');
        if (copyPathsBtn) {
            copyPathsBtn.addEventListener('click', function() {
                const paths = vueAnalysisResult.allRoutes
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

        // URL复制按钮
        const copyUrlsBtn = document.getElementById('copyUrlsBtn');
        if (copyUrlsBtn) {
            copyUrlsBtn.addEventListener('click', function() {
                const basePathUrls = document.querySelectorAll('.base-path-urls .url-text');
                const standardUrls = document.querySelectorAll('.standard-urls .url-text');

                let urlsToUse = [];

                if (basePathUrls.length > 0) {
                    urlsToUse = Array.from(basePathUrls).map(el => el.textContent);
                    const basePathPaths = new Set();
                    Array.from(standardUrls).forEach(el => {
                        if (!Array.from(basePathUrls).some(baseEl =>
                            baseEl.textContent.includes(el.textContent.split('/').pop()))) {
                            urlsToUse.push(el.textContent);
                        }
                    });
                } else {
                    urlsToUse = Array.from(standardUrls).map(el => el.textContent);
                }

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

        // 单个URL复制按钮
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

        // 单个URL打开按钮
        const urlOpenBtns = document.querySelectorAll('.url-open-btn');
        urlOpenBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (!chrome.runtime.lastError) {
                        chrome.tabs.update(tabs[0].id, {url: url});
                    }
                });
            });
        });
    }, 'addEventListeners');
}

// 显示URL列表
function displayUrlList(routes) {
    // 数据验证和修复
    if (!routes) {
        pathListContainer.innerHTML = `<p>没有找到路由路径</p>`;
        return;
    }

    // 确保routes是数组
    let routeArray = [];
    if (Array.isArray(routes)) {
        routeArray = routes;
    } else if (routes.allRoutes && Array.isArray(routes.allRoutes)) {
        routeArray = routes.allRoutes;
    } else if (typeof routes === 'object' && routes !== null) {
        // 如果routes是对象，尝试提取路由信息
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

    // 过滤掉无效的路由
    const validRoutes = routeArray.filter(route =>
        route &&
        typeof route === 'object' &&
        route.path &&
        typeof route.path === 'string'
    );

    if (!validRoutes.length) {
        pathListContainer.innerHTML = `<p>没有找到有效的路由路径</p>`;
        return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            showError("无法获取当前标签页信息");
            return;
        }

        safeExecute(() => {
            const currentUrl = tabs[0].url;
            const urlObj = new URL(currentUrl);
            const domainBase = urlObj.origin;
            const currentPath = urlObj.pathname;

            let baseUrl = '';
            let isHistoryMode = false;

            if (currentUrl.includes('#/') || currentUrl.includes('#')) {
                const hashIndex = currentUrl.indexOf('#');
                baseUrl = currentUrl.substring(0, hashIndex + 1);
            } else {
                isHistoryMode = true;
                baseUrl = domainBase;
            }

            // 使用验证后的路由数组
            const paths = validRoutes.map(route => route.path).filter(Boolean);

            // 多层次基础路径检测
            let detectedBasePath = '';

            if (vueAnalysisResult?.routerBase) {
                detectedBasePath = vueAnalysisResult.routerBase;
            } else if (vueAnalysisResult?.pageAnalysis?.detectedBasePath) {
                detectedBasePath = vueAnalysisResult.pageAnalysis.detectedBasePath;
            } else {
                const pathSegments = currentPath.split('/').filter(Boolean);
                if (pathSegments.length > 1) {
                    detectedBasePath = '/' + pathSegments[0];
                }
            }

            const standardUrls = [];
            const basePathUrls = [];

            paths.forEach(path => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                let standardUrl;
                let basePathUrl = null;

                if (isHistoryMode) {
                    standardUrl = `${baseUrl}/${cleanPath}`;
                    if (detectedBasePath && !path.startsWith(detectedBasePath)) {
                        basePathUrl = `${baseUrl}${detectedBasePath}/${cleanPath}`;
                    }
                } else if (baseUrl.endsWith('#')) {
                    standardUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#/')) {
                    standardUrl = `${baseUrl}${cleanPath}`;
                } else {
                    standardUrl = `${baseUrl}#/${cleanPath}`;
                }

                standardUrl = cleanUrl(standardUrl);
                if (basePathUrl) {
                    basePathUrl = cleanUrl(basePathUrl);
                }

                standardUrls.push({ path: path, url: standardUrl });
                if (basePathUrl) {
                    basePathUrls.push({ path: path, url: basePathUrl });
                }
            });

            let html = `<h3>完整URL列表</h3>`;

            if (detectedBasePath && isHistoryMode) {
                html += `
                <div class="base-path-info">
                    <div class="status-item info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
                          <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
                          <circle cx="12" cy="16" r="1" fill="#1976d2"/>
                        </svg>
                        检测到基础路径: ${detectedBasePath}
                    </div>
                </div>`;
            }

            if (basePathUrls.length > 0) {
                html += `
                <div class="url-section">
                    <div class="url-section-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5"/>
                          <path d="M8 12L11 15L16 9" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>带基础路径的URL (推荐)</span>
                    </div>
                    <div class="full-urls-list base-path-urls">`;

                basePathUrls.forEach(item => {
                    html += `<div class="full-url-item">
                        <span class="url-text">${item.url}</span>
                        <button class="url-copy-btn" data-url="${item.url}">复制</button>
                        <button class="url-open-btn" data-url="${item.url}">打开</button>
                    </div>`;
                });

                html += `</div></div>`;
            }

            html += `
            <div class="url-section">
                <div class="url-section-header">
                    <span>标准URL</span>
                </div>
                <div class="full-urls-list standard-urls">`;

            standardUrls.forEach(item => {
                html += `<div class="full-url-item">
                    <span class="url-text">${item.url}</span>
                    <button class="url-copy-btn" data-url="${item.url}">复制</button>
                    <button class="url-open-btn" data-url="${item.url}">打开</button>
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
            setTimeout(addEventListeners, 100);

        }, 'displayUrlList');
    });
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    safeExecute(() => {
        if (request.action === "vueDetectionResult") {
            displayDetectionResult(request.result);
        }
        else if (request.action === "vueRouterAnalysisResult") {
            displayRouterAnalysis(request.result);
        }
        else if (request.action === "vueDetectionError" || request.action === "vueRouterAnalysisError") {
            showError(request.error || "检测过程中发生错误");
        }
    }, `Message handler: ${request.action}`);
});

// 初始化
document.addEventListener('DOMContentLoaded', init);