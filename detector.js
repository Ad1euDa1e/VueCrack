(function() {
    // 发送结果到content script
    function sendResult(result) {
        window.postMessage({
            type: 'VUE_DETECTION_RESULT',
            result: result
        }, '*');
    }

    // 执行Vue路由分析代码
    function analyzeVueRouter() {
        try {
            const routerAnalysisResult = (function () {
                // ======== 工具函数 ========
                // 广度优先查找 Vue 根实例（Vue2/3）- 优化版本
                function findVueRoot(root, maxDepth = 1000) {
                    // 优先检查常见的Vue根元素ID
                    const commonRoots = [
                        document.getElementById('app'),
                        document.getElementById('__nuxt'),
                        document.getElementById('__layout'),
                        document.getElementById('q-app')
                    ].filter(Boolean);

                    for (const node of commonRoots) {
                        if (node.__vue_app__ || node.__vue__ || node._vnode) {
                            return node;
                        }
                    }

                    // 查找所有带data-v-*属性的元素
                    const dataVElements = document.querySelectorAll('[data-v]');
                    for (let i = 0; i < dataVElements.length; i++) {
                        if (dataVElements[i].__vue__ || dataVElements[i].__vue_app__) {
                            return dataVElements[i];
                        }
                    }

                    // 广度优先搜索
                    const queue = [{ node: root, depth: 0 }];
                    const visited = new Set(); // 防止循环引用

                    while (queue.length && queue.length < 1000) { // 限制队列大小以提高性能
                        const { node, depth } = queue.shift();
                        if (depth > maxDepth) break;

                        if (visited.has(node)) continue;
                        visited.add(node);

                        if (node.__vue_app__ || node.__vue__ || node._vnode) {
                            return node;
                        }

                        if (node.nodeType === 1 && node.childNodes && depth < 3) { // 只检查前3层
                            for (let i = 0; i < node.childNodes.length; i++) {
                                queue.push({ node: node.childNodes[i], depth: depth + 1 });
                            }
                        }
                    }

                    return null;
                }

                // 快速定位 Vue Router 实例
                function findVueRouter(vueRoot) {
                    try {
                        // 快速检查全局对象
                        if (window.$nuxt && window.$nuxt.$router) {
                            return window.$nuxt.$router;
                        }

                        if (vueRoot.__vue_app__) {
                            // Vue3 + Router4
                            const app = vueRoot.__vue_app__;
                            if (app.config && app.config.globalProperties && app.config.globalProperties.$router) {
                                return app.config.globalProperties.$router;
                            }

                            // 尝试获取Vue 3组件实例
                            const instance = app._instance;
                            if (instance && instance.appContext && instance.appContext.config.globalProperties.$router) {
                                return instance.appContext.config.globalProperties.$router;
                            }
                        }

                        if (vueRoot.__vue__) {
                            // Vue2 + Router2/3
                            const vue = vueRoot.__vue__;
                            // 尝试常见的路由位置
                            return vue.$router || vue.$root.$router || vue.$root.$options.router || vue._router;
                        }
                    } catch (e) {
                        console.warn('Error finding Vue Router:', e);
                    }
                    return null;
                }

                // 遍历路由数组及其子路由
                function walkRoutes(routes, cb) {
                    if (!Array.isArray(routes)) return;

                    routes.forEach(route => {
                        cb(route);
                        if (Array.isArray(route.children) && route.children.length) {
                            walkRoutes(route.children, cb);
                        }
                    });
                }

                // 判断 meta 字段值是否表示"真"（需要鉴权）
                function isAuthTrue(val) {
                    return val === true || val === 'true' || val === 1 || val === '1';
                }

                // 尝试从Router实例中提取基础路径
                function extractRouterBase(router) {
                    try {
                        // Vue Router 3.x/4.x
                        if (router.options && router.options.base) {
                            return router.options.base;
                        }

                        // 其他可能的位置
                        if (router.history && router.history.base) {
                            return router.history.base;
                        }

                        return '';
                    } catch (e) {
                        console.warn('提取Router基础路径时出错:', e);
                        return '';
                    }
                }

                // 分析页面中的链接
                function analyzePageLinks() {
                    const result = {
                        detectedBasePath: '',
                        commonPrefixes: []
                    };

                    try {
                        // 收集页面上所有链接
                        const links = Array.from(document.querySelectorAll('a[href]'))
                            .map(a => a.getAttribute('href'))
                            .filter(href =>
                                href &&
                                href.startsWith('/') &&
                                !href.startsWith('//') &&
                                !href.includes('.') // 排除静态资源
                            );

                        if (links.length < 3) return result; // 链接太少，不足以分析

                        // 解析所有链接的路径段
                        const pathSegments = links.map(link => link.split('/').filter(Boolean));

                        // 检查第一段路径是否有共同的前缀
                        const firstSegments = {};
                        pathSegments.forEach(segments => {
                            if (segments.length > 0) {
                                const first = segments[0];
                                firstSegments[first] = (firstSegments[first] || 0) + 1;
                            }
                        });

                        // 按出现频率排序
                        const sortedPrefixes = Object.entries(firstSegments)
                            .sort((a, b) => b[1] - a[1])
                            .map(entry => ({ prefix: entry[0], count: entry[1] }));

                        result.commonPrefixes = sortedPrefixes;

                        // 如果最常见的前缀出现频率超过50%，认为它是基础路径
                        if (sortedPrefixes.length > 0 &&
                            sortedPrefixes[0].count / links.length > 0.5) {
                            result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
                        }
                    } catch (e) {
                        console.warn('分析页面链接时出错:', e);
                    }

                    return result;
                }

                // ======== 修改路由 meta ========
                function patchAllRouteAuth(router) {
                    const modified = [];
                    function patchMeta(route) {
                        if (route.meta && typeof route.meta === 'object') {
                            Object.keys(route.meta).forEach(key => {
                                // 识别所有包含 "auth" 字眼的字段
                                if (key.toLowerCase().includes('auth') && isAuthTrue(route.meta[key])) {
                                    route.meta[key] = false;
                                    modified.push({ path: route.path, name: route.name });
                                }
                            });
                        }
                    }

                    // 先尝试Vue Router 4.x / 3.5+ 的getRoutes()方法
                    if (typeof router.getRoutes === 'function') {
                        router.getRoutes().forEach(patchMeta);
                    }
                    // 尝试路由options
                    else if (router.options && Array.isArray(router.options.routes)) {
                        walkRoutes(router.options.routes, patchMeta);
                    }
                    // 尝试matcher
                    else if (router.matcher) {
                        if (typeof router.matcher.getRoutes === 'function') {
                            router.matcher.getRoutes().forEach(patchMeta);
                        }
                        // 检查matcher.match方法
                        else if (router.matcher.match && router.history && router.history.current) {
                            const currentRoute = router.history.current;
                            if (currentRoute.matched && Array.isArray(currentRoute.matched)) {
                                currentRoute.matched.forEach(patchMeta);
                            }
                        }
                    }
                    else {
                        console.warn('🚫 未识别的 Vue Router 版本，跳过 Route Auth Patch');
                    }

                    if (modified.length) {
                        console.log('🚀 已修改的路由 auth meta：');
                        console.table(modified);
                    } else {
                        console.log('ℹ️ 没有需要修改的路由 auth 字段');
                    }
                    return modified;
                }

                // ======== 清除路由守卫 ========
                function patchRouterGuards(router) {
                    ['beforeEach', 'beforeResolve', 'afterEach'].forEach(hook => {
                        if (typeof router[hook] === 'function') {
                            // 清除现有的守卫函数
                            if (Array.isArray(router['beforeHooks'])) router['beforeHooks'].length = 0;
                            if (Array.isArray(router['resolveHooks'])) router['resolveHooks'].length = 0;
                            if (Array.isArray(router['afterHooks'])) router['afterHooks'].length = 0;

                            // 重写守卫方法为空函数
                            router[hook] = function() { return function() {}; };
                        }
                    });

                    // Vue Router 4 内部存储的守卫队列
                    if (Array.isArray(router.beforeGuards)) router.beforeGuards.length = 0;
                    if (Array.isArray(router.beforeResolveGuards)) router.beforeResolveGuards.length = 0;
                    if (Array.isArray(router.afterGuards)) router.afterGuards.length = 0;

                    // Vue Router 2/3的守卫
                    if (router.beforeHooks) router.beforeHooks.length = 0;
                    if (router.resolveHooks) router.resolveHooks.length = 0;
                    if (router.afterHooks) router.afterHooks.length = 0;

                    console.log('✅ 路由守卫已清除');
                }

                // ======== 列出所有路由（完整路径） ========
                function listAllRoutes(router) {
                    const list = [];
                    // 辅助拼接完整路径
                    function joinPath(base, path) {
                        if (!path) return base || '/';
                        if (path.startsWith('/')) return path;
                        if (!base || base === '/') return '/' + path;
                        return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
                    }

                    // 优先尝试 Vue Router 4 (getRoutes)
                    if (typeof router.getRoutes === 'function') {
                        try {
                            router.getRoutes().forEach(r => {
                                list.push({
                                    name: r.name,
                                    path: r.path,    // 在 Vue Router 4 中，r.path 为完整路径
                                    meta: r.meta
                                });
                            });
                            return list; // 如果成功，直接返回
                        } catch (e) {
                            console.warn('获取路由列表时出错:', e);
                        }
                    }

                    // 尝试从options获取路由
                    if (router.options && Array.isArray(router.options.routes)) {
                        function traverse(routes, basePath) {
                            routes.forEach(r => {
                                const fullPath = joinPath(basePath, r.path);
                                list.push({ name: r.name, path: fullPath, meta: r.meta });
                                if (Array.isArray(r.children) && r.children.length) {
                                    traverse(r.children, fullPath);
                                }
                            });
                        }
                        traverse(router.options.routes, '');
                        return list; // 如果成功，直接返回
                    }

                    // 尝试从matcher获取路由
                    if (router.matcher && typeof router.matcher.getRoutes === 'function') {
                        const routes = router.matcher.getRoutes();
                        routes.forEach(r => {
                            list.push({ name: r.name, path: r.path, meta: r.meta });
                        });
                        return list; // 如果成功，直接返回
                    }

                    // 尝试从历史记录中获取当前路由和其匹配项
                    if (router.history && router.history.current) {
                        const currentRoute = router.history.current;
                        if (currentRoute.matched && Array.isArray(currentRoute.matched)) {
                            currentRoute.matched.forEach(r => {
                                list.push({ name: r.name, path: r.path, meta: r.meta });
                            });
                            return list; // 如果成功，直接返回
                        }
                    }

                    console.warn('🚫 无法列出路由信息');
                    return list; // 返回可能为空的列表
                }

                // ======== 主流程 ========
                const result = {
                    vueDetected: false,
                    vueVersion: null,
                    routerDetected: false,
                    logs: [],
                    modifiedRoutes: [],
                    allRoutes: [],
                    routerBase: '',
                    pageAnalysis: {
                        detectedBasePath: '',
                        commonPrefixes: []
                    },
                    currentPath: window.location.pathname
                };

                // 捕获控制台输出
                const originalLog = console.log;
                const originalWarn = console.warn;
                const originalError = console.error;
                const originalTable = console.table;

                console.log = function(...args) {
                    result.logs.push({type: 'log', message: args.join(' ')});
                    originalLog.apply(console, args);
                };
                console.warn = function(...args) {
                    result.logs.push({type: 'warn', message: args.join(' ')});
                    originalWarn.apply(console, args);
                };
                console.error = function(...args) {
                    result.logs.push({type: 'error', message: args.join(' ')});
                    originalError.apply(console, args);
                };
                console.table = function(data, columns) {
                    if (Array.isArray(data)) {
                        result.logs.push({type: 'table', data: [...data]});
                    } else {
                        result.logs.push({type: 'table', data: {...data}});
                    }
                    originalTable.apply(console, arguments);
                };

                // 尝试查找Vue根实例
                const vueRoot = findVueRoot(document.body);
                if (!vueRoot) {
                    console.error('❌ 未检测到 Vue 实例');
                    // 恢复控制台
                    console.log = originalLog;
                    console.warn = originalWarn;
                    console.error = originalError;
                    console.table = originalTable;
                    return result;
                }

                result.vueDetected = true;

                // 尝试检测Vue版本
                try {
                    if (vueRoot.__vue_app__) {
                        result.vueVersion = vueRoot.__vue_app__.version || 'Vue 3.x';
                    } else if (vueRoot.__vue__) {
                        result.vueVersion = vueRoot.__vue__.$root?.$options?._base?.version || 'Vue 2.x';
                    } else if (window.Vue) {
                        result.vueVersion = window.Vue.version || 'unknown';
                    } else {
                        result.vueVersion = 'unknown';
                    }
                } catch (e) {
                    result.vueVersion = 'unknown';
                }

                // 查找Vue Router实例
                const router = findVueRouter(vueRoot);
                if (!router) {
                    console.error('❌ 未检测到 Vue Router 实例');
                    // 恢复控制台
                    console.log = originalLog;
                    console.warn = originalWarn;
                    console.error = originalError;
                    console.table = originalTable;
                    return result;
                }

                result.routerDetected = true;
                console.log('✅ Vue 版本 ：', result.vueVersion);

                // 提取Router基础路径
                result.routerBase = extractRouterBase(router);
                console.log('📍 Router基础路径:', result.routerBase || '(无)');

                // 分析页面链接
                result.pageAnalysis = analyzePageLinks();
                if (result.pageAnalysis.detectedBasePath) {
                    console.log('🔍 从页面链接检测到基础路径:', result.pageAnalysis.detectedBasePath);
                }

                // 修改路由鉴权元信息并清除导航守卫
                result.modifiedRoutes = patchAllRouteAuth(router);
                patchRouterGuards(router);

                // 列出所有路由（含完整路径）
                result.allRoutes = listAllRoutes(router);

                // 恢复控制台
                console.log = originalLog;
                console.warn = originalWarn;
                console.error = originalError;
                console.table = originalTable;

                return result;
            })();

            // 发送路由分析结果
            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_RESULT',
                result: routerAnalysisResult
            }, '*');

        } catch (error) {
            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_ERROR',
                error: error.toString()
            }, '*');
        }
    }

    // 快速检测方法
    function quickVueDetection() {
        // 全局对象检查 (最快)
        if (window.Vue || window.$nuxt || window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            return true;
        }

        // 查找几个常见的挂载点
        const mountPoints = ['#app', '#__nuxt', '#__layout', '#q-app'];
        for (const id of mountPoints) {
            const el = document.getElementById(id.substring(1));
            if (el && (el.__vue__ || el.__vue_app__)) {
                return true;
            }
        }

        // 检查一些常见的Vue属性
        return !!document.querySelector('[v-cloak], [v-show], [v-if], [data-v-]');
    }

    // 主函数: 尝试所有可能的方式找出Vue
    try {
        // 首先尝试快速检测
        if (quickVueDetection()) {
            sendResult({
                detected: true,
                method: 'Quick detection'
            });

            // 立即开始路由分析
            analyzeVueRouter();
            return;
        }

        // 如果快速检测失败，进行更全面的检查
        const result = {
            detected: false,
            method: '',
            details: {}
        };

        // 1. 检查全局Vue对象
        if (window.Vue) {
            result.detected = true;
            result.method = 'Global Vue object';
            result.details.version = window.Vue.version;
        }

        // 2. 搜索所有元素是否有__vue__属性 (限制检查数量)
        if (!result.detected) {
            const elements = document.querySelectorAll('*');
            const maxElements = Math.min(elements.length, 200); // 限制检查数量
            for (let i = 0; i < maxElements; i++) {
                if (elements[i].__vue__ || elements[i].__vue_app__) {
                    result.detected = true;
                    result.method = 'Element __vue__ property';
                    break;
                }
            }
        }

        // 3. 检查Vue特有的属性和CSS类
        if (!result.detected) {
            const hasVueAttrs = !!(
                document.querySelector('[data-v-], [v-cloak], [v-show], [v-if], [v-else], [v-for]') ||
                document.querySelector('[v-bind], [v-model], [v-on], [v-html], [v-text]')
            );

            if (hasVueAttrs) {
                result.detected = true;
                result.method = 'Vue attributes';
            }
        }

        // 4. 检查Vue devtools标记
        if (!result.detected && window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            result.detected = true;
            result.method = 'Vue devtools hook';
        }

        // 发送检测结果
        sendResult(result);

        // 如果检测到Vue，尝试分析路由
        if (result.detected) {
            analyzeVueRouter();
        }
    } catch (error) {
        sendResult({
            detected: false,
            error: error.toString()
        });
    }
})();