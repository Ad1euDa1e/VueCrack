document.addEventListener('DOMContentLoaded', function() {
    const routerAnalysisContainer = document.getElementById('routerAnalysisContainer');
    const pathListContainer = document.getElementById('pathListContainer');

    // 渲染路由分析结果
    function renderRouterAnalysis(result) {
        if (!result.vueDetected) {
            routerAnalysisContainer.innerHTML = `<div class="status-item info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
          <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="#1976d2"/>
        </svg>
        未检测到Vue实例
      </div>`;
            pathListContainer.innerHTML = '';
            return;
        }

        let html = `<h3>Vue Router 分析 <span class="version-badge">${result.vueVersion}</span></h3>`;

        if (!result.routerDetected) {
            html += `<div class="status-item info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
          <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="#1976d2"/>
        </svg>
        未检测到Vue Router实例
      </div>`;
            routerAnalysisContainer.innerHTML = html;
            pathListContainer.innerHTML = '';
            return;
        }

        // 添加简洁的状态信息
        html += `<div class="status-indicators">`;

        // 检查是否有修改路由auth字段的信息
        const hasModifiedRoutes = result.modifiedRoutes && result.modifiedRoutes.length > 0;
        if (hasModifiedRoutes) {
            html += `<div class="status-item success">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 11.0857V12.0057C21.9988 14.1621 21.3005 16.2604 20.0093 17.9875C18.7182 19.7147 16.9033 20.9782 14.8354 21.5896C12.7674 22.201 10.5573 22.1276 8.53447 21.3803C6.51168 20.633 4.78465 19.2518 3.61096 17.4428C2.43727 15.6338 1.87979 13.4938 2.02168 11.342C2.16356 9.19029 2.99721 7.14205 4.39828 5.5028C5.79935 3.86354 7.69279 2.72111 9.79619 2.24587C11.8996 1.77063 14.1003 1.98806 16.07 2.86572" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 4L12 14L9 11" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        已修改路由鉴权字段
      </div>`;
        } else {
            html += `<div class="status-item info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#1976d2" stroke-width="2"/>
          <path d="M12 8V12" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="#1976d2"/>
        </svg>
        没有需要修改的路由 auth 字段
      </div>`;
        }

        // 路由守卫清除状态
        html += `<div class="status-item success">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 11.0857V12.0057C21.9988 14.1621 21.3005 16.2604 20.0093 17.9875C18.7182 19.7147 16.9033 20.9782 14.8354 21.5896C12.7674 22.201 10.5573 22.1276 8.53447 21.3803C6.51168 20.633 4.78465 19.2518 3.61096 17.4428C2.43727 15.6338 1.87979 13.4938 2.02168 11.342C2.16356 9.19029 2.99721 7.14205 4.39828 5.5028C5.79935 3.86354 7.69279 2.72111 9.79619 2.24587C11.8996 1.77063 14.1003 1.98806 16.07 2.86572" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 4L12 14L9 11" stroke="#2e7d32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      路由守卫已清除
    </div>`;

        html += `</div>`;

        routerAnalysisContainer.innerHTML = html;

        // 仅显示完整URL列表，移除路由路径列表
        if (result.allRoutes && result.allRoutes.length) {
            displayUrlList(result.allRoutes);
        } else {
            pathListContainer.innerHTML = '<p>没有找到路由路径</p>';
        }
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
            const domainBase = urlObj.origin; // 例如 https://ih.qcylxyg.com

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

            // 直接显示完整URL列表
            let html = `<h3>完整URL列表</h3>`;
            html += `<div class="full-urls-list">`;

            // 生成完整URL
            paths.forEach(path => {
                // 确保路径格式正确
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;

                let fullUrl;

                if (isHistoryMode) {
                    // History模式 - 直接将路径添加到域名后
                    fullUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#')) {
                    // Hash模式 - 如果baseUrl已经有#但没有/，则添加/
                    fullUrl = `${baseUrl}/${cleanPath}`;
                } else if (baseUrl.endsWith('#/')) {
                    // Hash模式 - 如果baseUrl已经有#/，则直接添加路径
                    fullUrl = `${baseUrl}${cleanPath}`;
                } else {
                    // 其他情况 - 添加#/
                    fullUrl = `${baseUrl}#/${cleanPath}`;
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

            // 添加复制按钮 - 包括"复制所有路径"按钮
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
                        // 获取所有URL
                        const urlElements = document.querySelectorAll('.url-text');
                        const urls = Array.from(urlElements).map(el => el.textContent);
                        const urlsText = urls.join('\n');

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

                // 复制所有URL按钮（底部的大按钮）
                const copyAllUrlsBtn = document.getElementById('copyAllUrlsBtn');
                if (copyAllUrlsBtn) {
                    copyAllUrlsBtn.addEventListener('click', function() {
                        // 获取所有URL
                        const urlElements = document.querySelectorAll('.url-text');
                        const urls = Array.from(urlElements).map(el => el.textContent);
                        const urlsText = urls.join('\n');

                        navigator.clipboard.writeText(urlsText).then(() => {
                            copyAllUrlsBtn.textContent = '已复制!';
                            setTimeout(() => {
                                copyAllUrlsBtn.textContent = '复制所有URL';
                            }, 2000);
                        }).catch(err => {
                            console.error('复制失败:', err);
                            copyAllUrlsBtn.textContent = '复制失败';
                            setTimeout(() => {
                                copyAllUrlsBtn.textContent = '复制所有URL';
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
        });
    }

    // 自动执行检测和分析 - 提高速度
    function autoDetectAndAnalyze() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tabId = tabs[0].id;

            // 显示加载中状态
            routerAnalysisContainer.innerHTML = `
        <div class="status-item info">
          <div class="loading-spinner"></div>
          正在分析页面...
        </div>
      `;

            // 使用Promise同时尝试多种检测方法
            Promise.race([
                // 方法1: 通过content script
                new Promise((resolve) => {
                    chrome.tabs.sendMessage(tabId, {action: "detectVue", fastMode: true}, function(response) {
                        if (!chrome.runtime.lastError && response) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                    // 设置超时以加快响应
                    setTimeout(() => resolve(false), 300);
                }),

                // 方法2: 直接执行脚本
                new Promise((resolve) => {
                    chrome.scripting.executeScript({
                        target: {tabId: tabId},
                        files: ['detector.js']
                    }).then(() => resolve(true))
                        .catch(() => resolve(false));

                    // 设置超时
                    setTimeout(() => resolve(false), 300);
                })
            ]).then(result => {
                // 如果快速检测失败，尝试使用延迟检测
                if (!result) {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {action: "detectVue"}, function(response) {
                            if (chrome.runtime.lastError) {
                                // 最后尝试
                                chrome.scripting.executeScript({
                                    target: {tabId: tabId},
                                    files: ['detector.js']
                                });
                            }
                        });
                    }, 300);
                }
            });
        });
    }

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "vueRouterAnalysisResult") {
            renderRouterAnalysis(request.result);
        } else if (request.action === "vueRouterAnalysisError") {
            routerAnalysisContainer.innerHTML = `
        <div class="status-item info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
            <path d="M12 8V12" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="#d32f2f"/>
          </svg>
          路由分析错误: ${request.error}
        </div>
      `;
            pathListContainer.innerHTML = '';
        } else if (request.action === "vueDetectionResult") {
            const result = request.result;

            if (result.detected) {
                // 检测到Vue，尝试分析路由
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: "analyzeVueRouter"});
                });
            } else {
                routerAnalysisContainer.innerHTML = `
          <div class="status-item info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#d32f2f" stroke-width="2"/>
              <path d="M12 8V12" stroke="#d32f2f" stroke-width="2" stroke-linecap="round"/>
              <circle cx="12" cy="16" r="1" fill="#d32f2f"/>
            </svg>
            未检测到Vue.js
          </div>
        `;
                pathListContainer.innerHTML = '';
            }
        }
    });

    // 自动执行检测
    autoDetectAndAnalyze();
});