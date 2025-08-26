// 获取DOM元素
const routerAnalysisContainer = document.getElementById('routerAnalysisContainer');
const pathListContainer = document.getElementById('pathListContainer');

// 全局变量存储路由分析结果
let vueAnalysisResult = null;

// 初始化函数
function init() {
    showLoading("正在检测Vue.js...");

    // 向当前活动标签页发送检测Vue的消息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "detectVue"}, function(response) {
            // 如果没有响应，可能是content script还未加载或出错
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
                未检测到Vue.js
            </div>
        `;
        return;
    }

    showLoading("正在分析Vue Router...");

    // 已检测到Vue，发送分析路由的消息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "analyzeVueRouter"}, function(response) {
            // 同样处理可能的错误
            if (chrome.runtime.lastError) {
                showError("无法分析路由，请刷新后重试。");
                return;
            }
        });
    });
}

// 显示Vue Router分析结果
function displayRouterAnalysis(result) {
    // 保存结果到全局变量，以便其他函数使用
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

    // 显示Vue Router分析结果
    let html = `<h3>Vue Router 分析 <span class="version-badge">${result.vueVersion || 'Unknown'}</span></h3>`;
    html += `<div class="status-indicators">`;

    // 检查是否需要修改路由的auth字段
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

    // 显示路由路径列表
    displayUrlList(result.allRoutes);
}

// 仅显示完整URL列表
function displayUrlList(routes) {
    if (!routes || !routes.length) {
        pathListContainer.innerHTML = `<p>没有找到路由路径</p>`;
        return;
    }

    // 获取当前URL信息
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        let baseUrl = '';
        let isHistoryMode = false;

        // 提取域名和协议
        const urlObj = new URL(currentUrl);
        const domainBase = urlObj.origin; // 例如 https://www-ecs.didachuxing.com

        try {
            // 获取当前路径
            const currentPath = urlObj.pathname;
            console.log("当前路径:", currentPath);

            // 分析当前URL的路由模式
            if (currentUrl.includes('#/') || currentUrl.includes('#')) {
                // 针对带hash的URL (SPA常见格式) - Hash模式
                const hashIndex = currentUrl.indexOf('#');
                baseUrl = currentUrl.substring(0, hashIndex + 1); // 包含#
            } else {
                // 针对history模式的SPA或常规网站
                isHistoryMode = true;
                baseUrl = domainBase; // 使用域名作为基础URL
            }

            // 提取所有路径
            const paths = routes.map(route => route.path).filter(Boolean);

            // ======== 多层次基础路径检测 ========
            let detectedBasePath = '';

            // 1. 先检查router配置中的基础路径
            if (vueAnalysisResult && vueAnalysisResult.routerBase) {
                detectedBasePath = vueAnalysisResult.routerBase;
                console.log("从Router配置中检测到基础路径:", detectedBasePath);
            }

            // 2. 再检查页面链接分析结果
            if (!detectedBasePath && vueAnalysisResult &&
                vueAnalysisResult.pageAnalysis &&
                vueAnalysisResult.pageAnalysis.detectedBasePath) {
                detectedBasePath = vueAnalysisResult.pageAnalysis.detectedBasePath;
                console.log("从页面链接分析中检测到基础路径:", detectedBasePath);
            }

            // 3. 最后从当前URL中提取
            if (!detectedBasePath) {
                const pathSegments = currentPath.split('/').filter(Boolean);
                // 仅在有至少一个路径段且当前在一个子页面时考虑
                if (pathSegments.length > 1) {
                    detectedBasePath = '/' + pathSegments[0];
                    console.log("从当前URL中检测到可能的基础路径:", detectedBasePath);
                }
            }

            // ======= 准备URL列表 =======
            // 创建两个数组，分别存储标准URL和带基础路径的URL
            const standardUrls = [];
            const basePathUrls = [];

            // 处理每个路径
            paths.forEach(path => {
                // 确保路径格式正确
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;

                let standardUrl;
                let basePathUrl = null;

                if (isHistoryMode) {
                    // History模式 - 标准URL
                    standardUrl = `${baseUrl}/${cleanPath}`;

                    // 如果检测到基础路径，并且路径不是以它开头，则提供带基础路径的URL
                    if (detectedBasePath && !path.startsWith(detectedBasePath)) {
                        basePathUrl = `${baseUrl}${detectedBasePath}/${cleanPath}`;
                    }
                } else if (baseUrl.endsWith('#')) {
                    // Hash模式 - 如果baseUrl已经有#但没有/，则添加/
                    standardUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#/')) {
                    // Hash模式 - 如果baseUrl已经有#/，则直接添加路径
                    standardUrl = `${baseUrl}${cleanPath}`;
                } else {
                    // 其他情况 - 添加#/
                    standardUrl = `${baseUrl}#/${cleanPath}`;
                }

                // 清理多余的斜杠
                standardUrl = standardUrl.replace(/([^:]\/)\/+/g, '$1');
                if (basePathUrl) {
                    basePathUrl = basePathUrl.replace(/([^:]\/)\/+/g, '$1');
                }

                // 将URL存入对应数组
                standardUrls.push({
                    path: path,
                    url: standardUrl
                });

                if (basePathUrl) {
                    basePathUrls.push({
                        path: path,
                        url: basePathUrl
                    });
                }
            });

            // ======= 构建UI =======
            let html = `<h3>完整URL列表</h3>`;

            // 仅当检测到基础路径时才显示信息
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

            // 如果有基础路径URL，先显示它们
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

                // 添加带基础路径的URL
                basePathUrls.forEach(item => {
                    html += `<div class="full-url-item">
                        <span class="url-text">${item.url}</span>
                        <button class="url-copy-btn" data-url="${item.url}">复制</button>
                        <button class="url-open-btn" data-url="${item.url}">打开</button>
                    </div>`;
                });

                html += `</div></div>`;
            }

            // 显示标准URL
            html += `
            <div class="url-section">
                <div class="url-section-header">
                    <span>标准URL</span>
                </div>
                <div class="full-urls-list standard-urls">`;

            // 添加标准URL
            standardUrls.forEach(item => {
                html += `<div class="full-url-item">
                    <span class="url-text">${item.url}</span>
                    <button class="url-copy-btn" data-url="${item.url}">复制</button>
                    <button class="url-open-btn" data-url="${item.url}">打开</button>
                </div>`;
            });

            html += `</div></div>`;

            // 添加复制按钮
            html += `
                <div class="copy-actions">
                    <button id="copyPathsBtn" class="secondary-btn">复制所有路径</button>
                    <button id="copyUrlsBtn" class="secondary-btn">复制所有URL</button>
                </div>
            `;

            // 设置HTML内容
            pathListContainer.innerHTML = html;

            // 添加事件监听器
            setTimeout(() => {
                // 路径复制按钮
                const copyPathsBtn = document.getElementById('copyPathsBtn');
                if (copyPathsBtn) {
                    copyPathsBtn.addEventListener('click', function() {
                        const pathsText = paths.join('\n');
                        navigator.clipboard.writeText(pathsText).then(() => {
                            copyPathsBtn.textContent = '已复制!';
                            setTimeout(() => {
                                copyPathsBtn.textContent = '复制所有路径';
                            }, 2000);
                        }).catch(err => {
                            console.error('复制失败:', err);
                            copyPathsBtn.textContent = '复制失败';
                            setTimeout(() => {
                                copyPathsBtn.textContent = '复制所有路径';
                            }, 2000);
                        });
                    });
                }

                // URL复制按钮
                const copyUrlsBtn = document.getElementById('copyUrlsBtn');
                if (copyUrlsBtn) {
                    copyUrlsBtn.addEventListener('click', function() {
                        // 获取所有URL (优先使用带基础路径的URL)
                        let urlsToUse = [];

                        if (basePathUrls.length > 0) {
                            // 如果有带基础路径的URL，优先使用它们
                            urlsToUse = basePathUrls.map(item => item.url);

                            // 对于没有基础路径版本的路径，使用标准URL
                            const basePathPaths = new Set(basePathUrls.map(item => item.path));
                            standardUrls.forEach(item => {
                                if (!basePathPaths.has(item.path)) {
                                    urlsToUse.push(item.url);
                                }
                            });
                        } else {
                            // 否则使用所有标准URL
                            urlsToUse = standardUrls.map(item => item.url);
                        }

                        const urlsText = urlsToUse.join('\n');

                        navigator.clipboard.writeText(urlsText).then(() => {
                            copyUrlsBtn.textContent = '已复制!';
                            setTimeout(() => {
                                copyUrlsBtn.textContent = '复制所有URL';
                            }, 2000);
                        }).catch(err => {
                            console.error('复制失败:', err);
                            copyUrlsBtn.textContent = '复制失败';
                            setTimeout(() => {
                                copyUrlsBtn.textContent = '复制所有URL';
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
                        // 在当前标签页打开，而不是创建新标签页
                        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                            chrome.tabs.update(tabs[0].id, {url: url});
                            // 不关闭扩展窗口，方便用户继续操作
                        });
                    });
                });
            }, 100);
        } catch (error) {
            // 如果出现任何错误，回退到简单实现
            console.error("显示URL列表时出错:", error);
            let html = `<h3>完整URL列表</h3>`;
            html += `<div class="full-urls-list">`;

            // 提取所有路径
            const paths = routes.map(route => route.path).filter(Boolean);

            // 简单拼接URL
            paths.forEach(path => {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                let fullUrl;

                if (currentUrl.includes('#')) {
                    const hashIndex = currentUrl.indexOf('#');
                    const baseUrlWithHash = currentUrl.substring(0, hashIndex + 1);
                    fullUrl = `${baseUrlWithHash}/${cleanPath}`;
                } else {
                    fullUrl = `${domainBase}/${cleanPath}`;
                }

                // 清理多余的斜杠
                fullUrl = fullUrl.replace(/([^:]\/)\/+/g, '$1');

                html += `<div class="full-url-item">
                    <span class="url-text">${fullUrl}</span>
                    <button class="url-copy-btn" data-url="${fullUrl}">复制</button>
                    <button class="url-open-btn" data-url="${fullUrl}">打开</button>
                </div>`;
            });

            html += `</div>`;

            // 添加复制按钮
            html += `
                <div class="copy-actions">
                    <button id="copyPathsBtn" class="secondary-btn">复制所有路径</button>
                    <button id="copyUrlsBtn" class="secondary-btn">复制所有URL</button>
                </div>
            `;

            pathListContainer.innerHTML = html;
        }
    });
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "vueDetectionResult") {
        displayDetectionResult(request.result);
    }
    else if (request.action === "vueRouterAnalysisResult") {
        displayRouterAnalysis(request.result);
    }
    else if (request.action === "vueDetectionError" || request.action === "vueRouterAnalysisError") {
        showError(request.error || "检测过程中发生错误");
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', init);