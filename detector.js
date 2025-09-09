(function() {
    // ======== 通用工具函数 ========

    // 广度优先查找 Vue 根实例（Vue2/3）
    function findVueRoot(root, maxDepth = 1000) {
        const queue = [{ node: root, depth: 0 }];
        while (queue.length) {
            const { node, depth } = queue.shift();
            if (depth > maxDepth) break;

            if (node.__vue_app__ || node.__vue__ || node._vnode) {
                return node;
            }

            if (node.nodeType === 1 && node.childNodes) {
                for (let i = 0; i < node.childNodes.length; i++) {
                    queue.push({ node: node.childNodes[i], depth: depth + 1 });
                }
            }
        }
        return null;
    }

    // 统一错误处理
    function handleError(error, context, shouldStop = false) {
        const errorMsg = `${context}: ${error.toString()}`;
        console.warn(errorMsg);

        if (shouldStop) {
            sendError(errorMsg);
            return false;
        }
        return true;
    }

    // 恢复控制台函数
    function restoreConsole(originals) {
        console.log = originals.log;
        console.warn = originals.warn;
        console.error = originals.error;
        console.table = originals.table;
    }

    // URL清理函数
    function cleanUrl(url) {
        return url.replace(/([^:]\/)\/+/g, '$1').replace(/\/$/, '');
    }

    // 获取Vue版本
    function getVueVersion(vueRoot) {
        let version = vueRoot.__vue_app__?.version ||
            vueRoot.__vue__?.$root?.$options?._base?.version;

        if (!version || version === 'unknown') {
            // 尝试从全局Vue对象获取
            if (window.Vue && window.Vue.version) {
                version = window.Vue.version;
            }
            // 尝试从Vue DevTools获取
            else if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__ &&
                window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue) {
                version = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue.version;
            }
        }

        return version || 'unknown';
    }

    // ======== 消息发送函数 ========

    function sendResult(result) {
        window.postMessage({
            type: 'VUE_DETECTION_RESULT',
            result: result
        }, '*');
    }

    function sendRouterResult(result) {
        try {
            // 预处理 - 确保 allRoutes 是正确格式的数组
            if (result && result.allRoutes) {
                if (!Array.isArray(result.allRoutes)) {
                    // 如果不是数组，转换为数组
                    if (typeof result.allRoutes === 'object') {
                        const routeArray = [];
                        for (const key in result.allRoutes) {
                            if (result.allRoutes.hasOwnProperty(key)) {
                                const route = result.allRoutes[key];
                                if (route && typeof route === 'object') {
                                    routeArray.push({
                                        name: route.name || key,
                                        path: route.path || key,
                                        meta: route.meta || {}
                                    });
                                }
                            }
                        }
                        result.allRoutes = routeArray;
                    } else {
                        result.allRoutes = [];
                    }
                } else {
                    // 确保数组中的每个元素都有正确的结构
                    result.allRoutes = result.allRoutes.map(route => {
                        if (typeof route === 'object' && route !== null) {
                            return {
                                name: route.name || '',
                                path: route.path || '',
                                meta: route.meta || {}
                            };
                        }
                        return { name: '', path: route || '', meta: {} };
                    });
                }
            } else {
                result.allRoutes = [];
            }

            // 序列化清理结果数据
            const sanitizedResult = sanitizeForPostMessage(result);

            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_RESULT',
                result: sanitizedResult
            }, '*');
        } catch (error) {
            console.warn('Failed to send router result:', error);
            // 发送最简化版本
            window.postMessage({
                type: 'VUE_ROUTER_ANALYSIS_RESULT',
                result: {
                    vueDetected: result?.vueDetected || false,
                    routerDetected: result?.routerDetected || false,
                    vueVersion: result?.vueVersion || 'Unknown',
                    modifiedRoutes: result?.modifiedRoutes || [],
                    error: 'Serialization failed',
                    allRoutes: []
                }
            }, '*');
        }
    }

    function sendError(error) {
        window.postMessage({
            type: 'VUE_ROUTER_ANALYSIS_ERROR',
            error: error
        }, '*');
    }

    // ======== Vue检测函数 ========

    function simpleVueDetection() {
        const vueRoot = findVueRoot(document.body);
        return vueRoot;
    }

    // ======== Vue Router相关函数 ========

    // 定位 Vue Router 实例
    function findVueRouter(vueRoot) {
        try {
            if (vueRoot.__vue_app__) {
                // Vue3 + Router4
                const app = vueRoot.__vue_app__;

                if (app.config?.globalProperties?.$router) {
                    return app.config.globalProperties.$router;
                }

                const instance = app._instance;
                if (instance?.appContext?.config?.globalProperties?.$router) {
                    return instance.appContext.config.globalProperties.$router;
                }

                if (instance?.ctx?.$router) {
                    return instance.ctx.$router;
                }
            }

            if (vueRoot.__vue__) {
                // Vue2 + Router2/3
                const vue = vueRoot.__vue__;
                return vue.$router ||
                    vue.$root?.$router ||
                    vue.$root?.$options?.router ||
                    vue._router;
            }
        } catch (e) {
            handleError(e, 'findVueRouter');
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

    // 路径拼接函数
    function joinPath(base, path) {
        if (!path) return base || '/';
        if (path.startsWith('/')) return path;
        if (!base || base === '/') return '/' + path;
        return (base.endsWith('/') ? base.slice(0, -1) : base) + '/' + path;
    }

    // 提取Router基础路径
    function extractRouterBase(router) {
        try {
            if (router.options?.base) {
                return router.options.base;
            }
            if (router.history?.base) {
                return router.history.base;
            }
            return '';
        } catch (e) {
            handleError(e, '提取Router基础路径');
            return '';
        }
    }

    // 链接缓存
    const linkCache = new Map();

    // 获取缓存的链接
    function getCachedLinks() {
        const cacheKey = 'page-links';
        if (linkCache.has(cacheKey)) {
            return linkCache.get(cacheKey);
        }

        const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(href =>
                href &&
                href.startsWith('/') &&
                !href.startsWith('//') &&
                !href.includes('.')
            );

        linkCache.set(cacheKey, links);
        return links;
    }

    // 分析页面中的链接
    function analyzePageLinks() {
        const result = {
            detectedBasePath: '',
            commonPrefixes: []
        };

        try {
            const links = getCachedLinks();

            if (links.length < 3) return result;

            const pathSegments = links.map(link => link.split('/').filter(Boolean));
            const firstSegments = {};

            pathSegments.forEach(segments => {
                if (segments.length > 0) {
                    const first = segments[0];
                    firstSegments[first] = (firstSegments[first] || 0) + 1;
                }
            });

            const sortedPrefixes = Object.entries(firstSegments)
                .sort((a, b) => b[1] - a[1])
                .map(entry => ({ prefix: entry[0], count: entry[1] }));

            result.commonPrefixes = sortedPrefixes;

            if (sortedPrefixes.length > 0 &&
                sortedPrefixes[0].count / links.length > 0.6) {
                result.detectedBasePath = '/' + sortedPrefixes[0].prefix;
            }
        } catch (e) {
            handleError(e, '分析页面链接');
        }

        return result;
    }

    // 修改路由 meta
    function patchAllRouteAuth(router) {
        const modified = [];

        function patchMeta(route) {
            if (route.meta && typeof route.meta === 'object') {
                Object.keys(route.meta).forEach(key => {
                    if (key.toLowerCase().includes('auth') && isAuthTrue(route.meta[key])) {
                        route.meta[key] = false;
                        modified.push({ path: route.path, name: route.name });
                    }
                });
            }
        }

        try {
            if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(patchMeta);
            }
            else if (router.options?.routes) {
                walkRoutes(router.options.routes, patchMeta);
            }
            else if (router.matcher) {
                if (typeof router.matcher.getRoutes === 'function') {
                    router.matcher.getRoutes().forEach(patchMeta);
                }
                else if (router.matcher.match && router.history?.current?.matched) {
                    router.history.current.matched.forEach(patchMeta);
                }
            }
            else {
                console.warn('🚫 未识别的 Vue Router 版本，跳过 Route Auth Patch');
            }
        } catch (e) {
            handleError(e, 'patchAllRouteAuth');
        }

        if (modified.length) {
            console.log('🚀 已修改的路由 auth meta：');
            console.table(modified);
        } else {
            console.log('ℹ️ 没有需要修改的路由 auth 字段');
        }

        return modified;
    }

    // 清除路由守卫
    function patchRouterGuards(router) {
        try {
            ['beforeEach', 'beforeResolve', 'afterEach'].forEach(hook => {
                if (typeof router[hook] === 'function') {
                    router[hook] = () => {};
                }
            });

            const guardProps = [
                'beforeGuards', 'beforeResolveGuards', 'afterGuards',
                'beforeHooks', 'resolveHooks', 'afterHooks'
            ];

            guardProps.forEach(prop => {
                if (Array.isArray(router[prop])) {
                    router[prop].length = 0;
                }
            });

            console.log('✅ 路由守卫已清除');
        } catch (e) {
            handleError(e, 'patchRouterGuards');
        }
    }

    // 数据序列化过滤函数
    function sanitizeForPostMessage(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'function') {
            return '[Function]';
        }

        if (obj instanceof Promise) {
            return '[Promise]';
        }

        if (typeof obj === 'object') {
            if (obj.constructor && obj.constructor.name &&
                !['Object', 'Array'].includes(obj.constructor.name)) {
                return `[${obj.constructor.name}]`;
            }

            const sanitized = Array.isArray(obj) ? [] : {};

            try {
                for (const key in obj) {
                    if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                        const value = obj[key];

                        // 特殊处理 allRoutes 数组
                        if (key === 'allRoutes' && Array.isArray(value)) {
                            sanitized[key] = value.map(route => {
                                if (typeof route === 'object' && route !== null) {
                                    return {
                                        name: route.name || '',
                                        path: route.path || '',
                                        meta: route.meta ? sanitizeRouteObject(route.meta) : {}
                                    };
                                }
                                return route;
                            });
                            continue;
                        }

                        // 跳过可能导致循环引用的属性
                        if (key.startsWith('_') || key.startsWith('$') ||
                            key === 'parent' || key === 'router' || key === 'matched') {
                            continue;
                        }

                        if (typeof value === 'function') {
                            sanitized[key] = '[Function]';
                        } else if (value instanceof Promise) {
                            sanitized[key] = '[Promise]';
                        } else if (Array.isArray(value)) {
                            // 处理数组 - 检查是否是路由数组
                            if (value.length > 0 && value[0] && typeof value[0] === 'object' && value[0].path !== undefined) {
                                // 这是路由数组
                                sanitized[key] = value.map(item => {
                                    if (typeof item === 'object' && item !== null) {
                                        return {
                                            name: item.name || '',
                                            path: item.path || '',
                                            meta: item.meta ? sanitizeRouteObject(item.meta) : {}
                                        };
                                    }
                                    return item;
                                });
                            } else {
                                // 普通数组
                                sanitized[key] = value.map(item => {
                                    if (typeof item === 'object' && item !== null) {
                                        return sanitizeRouteObject(item);
                                    }
                                    return item;
                                });
                            }
                        } else if (typeof value === 'object' && value !== null) {
                            // 简单对象递归处理，避免深度过大
                            if (key === 'meta' || key === 'query' || key === 'params') {
                                sanitized[key] = sanitizeRouteObject(value);
                            } else {
                                sanitized[key] = '[Object]';
                            }
                        } else {
                            sanitized[key] = value;
                        }
                    }
                }
            } catch (e) {
                return '[Object - Serialization Error]';
            }

            return sanitized;
        }

        return obj;
    }

    // 专门处理路由对象的函数
    function sanitizeRouteObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const sanitized = {};

        try {
            for (const key in obj) {
                if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                    const value = obj[key];

                    if (typeof value === 'function') {
                        sanitized[key] = '[Function]';
                    } else if (value instanceof Promise) {
                        sanitized[key] = '[Promise]';
                    } else if (typeof value === 'object' && value !== null) {
                        // 避免深度递归
                        sanitized[key] = '[Object]';
                    } else {
                        sanitized[key] = value;
                    }
                }
            }
        } catch (e) {
            return '[Route Object - Serialization Error]';
        }

        return sanitized;
    }

    // 列出所有路由
    function listAllRoutes(router) {
        const list = [];

        try {
            // Vue Router 4
            if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(r => {
                    list.push({
                        name: r.name,
                        path: r.path,
                        meta: r.meta
                    });
                });
                return list;
            }

            // Vue Router 2/3
            if (router.options?.routes) {
                function traverse(routes, basePath = '') {
                    routes.forEach(r => {
                        const fullPath = joinPath(basePath, r.path);
                        list.push({ name: r.name, path: fullPath, meta: r.meta });
                        if (Array.isArray(r.children) && r.children.length) {
                            traverse(r.children, fullPath);
                        }
                    });
                }
                traverse(router.options.routes);
                return list;
            }

            // 从matcher获取
            if (router.matcher?.getRoutes) {
                const routes = router.matcher.getRoutes();
                routes.forEach(r => {
                    list.push({ name: r.name, path: r.path, meta: r.meta });
                });
                return list;
            }

            // 从历史记录获取
            if (router.history?.current?.matched) {
                router.history.current.matched.forEach(r => {
                    list.push({ name: r.name, path: r.path, meta: r.meta });
                });
                return list;
            }

            console.warn('🚫 无法列出路由信息');
        } catch (e) {
            handleError(e, 'listAllRoutes');
        }

        return list;
    }

    // ======== 完整分析函数 ========

    function performFullAnalysis() {
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

        // 保存原始控制台函数
        const originals = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            table: console.table
        };

        try {
            // 拦截控制台输出
            console.log = function(...args) {
                result.logs.push({type: 'log', message: args.join(' ')});
                originals.log.apply(console, args);
            };
            console.warn = function(...args) {
                result.logs.push({type: 'warn', message: args.join(' ')});
                originals.warn.apply(console, args);
            };
            console.error = function(...args) {
                result.logs.push({type: 'error', message: args.join(' ')});
                originals.error.apply(console, args);
            };
            console.table = function(data, columns) {
                if (Array.isArray(data)) {
                    result.logs.push({type: 'table', data: [...data]});
                } else {
                    result.logs.push({type: 'table', data: {...data}});
                }
                originals.table.apply(console, arguments);
            };

            // 查找Vue根实例
            const vueRoot = findVueRoot(document.body);
            if (!vueRoot) {
                console.error('❌ 未检测到 Vue 实例');
                restoreConsole(originals);
                return result;
            }

            result.vueDetected = true;

            // 查找Vue Router
            const router = findVueRouter(vueRoot);
            if (!router) {
                console.error('❌ 未检测到 Vue Router 实例');
                restoreConsole(originals);
                return result;
            }

            result.routerDetected = true;

            // 获取Vue版本
            result.vueVersion = getVueVersion(vueRoot);
            console.log('✅ Vue 版本：', result.vueVersion);

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

            // 列出所有路由
            result.allRoutes = listAllRoutes(router);
            console.log('🔍 当前所有路由：');
            console.table(result.allRoutes);

            restoreConsole(originals);
            return result;

        } catch (error) {
            restoreConsole(originals);
            handleError(error, 'performFullAnalysis', true);
            return {
                vueDetected: false,
                routerDetected: false,
                error: error.toString()
            };
        }
    }

    // ======== 延迟检测机制 ========
    function delayedDetection(delay = 0, retryCount = 0) {
        // 改为最大重试3次
        if (retryCount >= 3) {
            sendResult({
                detected: false,
                method: 'Max retry limit reached (3 attempts)'
            });
            return;
        }

        setTimeout(() => {
            const vueRoot = simpleVueDetection();

            if (vueRoot) {
                // 找到Vue实例的处理...
            } else if (delay === 0) {
                delayedDetection(300, retryCount + 1);    // 第1次重试：300ms
            } else if (delay === 300) {
                delayedDetection(600, retryCount + 1);    // 第2次重试：600ms
            } else {
                sendResult({
                    detected: false,
                    method: `All delayed detection failed (${retryCount + 1} attempts)`
                });
            }
        }, delay);
    }

    // ======== 主执行逻辑 ========
    try {
        const vueRoot = simpleVueDetection();

        if (vueRoot) {
            sendResult({
                detected: true,
                method: 'Immediate detection'
            });

            setTimeout(() => {
                const analysisResult = performFullAnalysis();
                sendRouterResult(analysisResult);
            }, 50);
        } else {
            delayedDetection(0, 0); // 添加初始重试计数
        }
    } catch (error) {
        handleError(error, 'Main execution', false);
        delayedDetection(500, 0); // 添加初始重试计数
    }
})();