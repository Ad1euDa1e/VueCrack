(function() {
    const INSTALL_KEY = '__VUECRACK_ALL_IN_INSTALLED__';
    const STATE_KEY = '__VUECRACK_ALL_IN_STATE__';

    if (window[INSTALL_KEY]) {
        return;
    }

    try {
        Object.defineProperty(window, INSTALL_KEY, {
            value: true,
            configurable: false,
            writable: false
        });
    } catch (error) {
        return;
    }

    const patchedRouters = new WeakSet();
    const patchedObjects = new WeakSet();
    const originalArrayPush = Array.prototype.push;
    const originalHistory = {
        back: history.back,
        forward: history.forward,
        go: history.go
    };

    const state = {
        injected: true,
        injectedAt: Date.now(),
        routersPatched: 0,
        guardRegistrationBlocked: 0,
        routerJumpBlocked: 0,
        browserJumpBlocked: 0,
        lastEvent: '已前置注入'
    };

    window[STATE_KEY] = state;

    function getStatus() {
        return {
            injected: state.injected,
            injectedAt: state.injectedAt,
            routersPatched: state.routersPatched,
            guardRegistrationBlocked: state.guardRegistrationBlocked,
            routerJumpBlocked: state.routerJumpBlocked,
            browserJumpBlocked: state.browserJumpBlocked,
            lastEvent: state.lastEvent
        };
    }

    function emitStatus() {
        try {
            window.postMessage({
                type: 'VUECRACK_ALL_IN_STATUS',
                source: 'vuecrack-all-in',
                status: getStatus()
            }, '*');
        } catch (error) {
            // 页面消息不可用时不影响拦截逻辑。
        }
    }

    function mark(eventName) {
        state.lastEvent = eventName;
        emitStatus();
    }

    function defineValue(target, key, value) {
        try {
            Object.defineProperty(target, key, {
                value,
                configurable: true,
                writable: true
            });
            return true;
        } catch (error) {
            try {
                target[key] = value;
                return true;
            } catch (innerError) {
                return false;
            }
        }
    }

    function maskToString(fn, name) {
        try {
            defineValue(fn, 'toString', function() {
                return `function ${name}() { [native code] }`;
            });
        } catch (error) {
            // 伪装失败不影响主流程。
        }
    }

    function makeGuardBlocker(name) {
        const blocker = function() {
            state.guardRegistrationBlocked += 1;
            mark(`已拦截 ${name}`);
            return function removeBlockedGuard() {};
        };
        maskToString(blocker, name);
        return blocker;
    }

    function makeRouterJumpBlocker(name) {
        const blocker = function() {
            state.routerJumpBlocked += 1;
            mark(`已拦截 router.${name}`);
            if (name === 'push' || name === 'replace') {
                return Promise.resolve(false);
            }
            return undefined;
        };
        maskToString(blocker, name);
        return blocker;
    }

    function makeBrowserJumpBlocker(name) {
        const blocker = function() {
            state.browserJumpBlocked += 1;
            mark(`已拦截 ${name}`);
            return undefined;
        };
        maskToString(blocker, name.split('.').pop());
        return blocker;
    }

    function isAuthTrue(value) {
        return value === true || value === 'true' || value === 1 || value === '1';
    }

    function patchRouteMeta(route) {
        if (!route || typeof route !== 'object') {
            return;
        }

        if (route.meta && typeof route.meta === 'object') {
            Object.keys(route.meta).forEach(key => {
                const lowerKey = key.toLowerCase();
                if ((lowerKey.includes('auth') || lowerKey.includes('login') || lowerKey.includes('permission')) && isAuthTrue(route.meta[key])) {
                    route.meta[key] = false;
                }
            });
        }

        if (Array.isArray(route.children)) {
            route.children.forEach(patchRouteMeta);
        }
    }

    function patchRoutes(router) {
        try {
            if (typeof router.getRoutes === 'function') {
                router.getRoutes().forEach(patchRouteMeta);
            }

            if (Array.isArray(router.options?.routes)) {
                router.options.routes.forEach(patchRouteMeta);
            }

            if (Array.isArray(router.matcher?.getRoutes?.())) {
                router.matcher.getRoutes().forEach(patchRouteMeta);
            }
        } catch (error) {
            // 路由元信息失败不影响其他强拦截。
        }
    }

    function clearGuardContainer(value) {
        try {
            if (Array.isArray(value)) {
                value.length = 0;
                return true;
            }

            if (value instanceof Set || value instanceof Map) {
                value.clear();
                return true;
            }

            if (value && typeof value === 'object') {
                if (Array.isArray(value.list)) {
                    value.list.length = 0;
                    return true;
                }
                if (typeof value.reset === 'function') {
                    value.reset();
                    return true;
                }
            }
        } catch (error) {
            return false;
        }

        return false;
    }

    function clearKnownGuardContainers(router) {
        [
            'beforeGuards',
            'beforeResolveGuards',
            'afterGuards',
            'beforeHooks',
            'resolveHooks',
            'afterHooks',
            'beforeEachHooks',
            'beforeResolveHooks',
            'afterEachHooks'
        ].forEach(key => clearGuardContainer(router[key]));
    }

    function patchRouter(router) {
        if (!router || typeof router !== 'object' || patchedRouters.has(router)) {
            return false;
        }

        patchedRouters.add(router);

        ['beforeEach', 'beforeResolve', 'afterEach'].forEach(name => {
            if (typeof router[name] === 'function') {
                defineValue(router, name, makeGuardBlocker(name));
            }
        });

        ['push', 'replace', 'go'].forEach(name => {
            if (typeof router[name] === 'function') {
                defineValue(router, name, makeRouterJumpBlocker(name));
            }
        });

        clearKnownGuardContainers(router);
        patchRoutes(router);

        state.routersPatched += 1;
        mark('已接管 Router');
        return true;
    }

    function patchVueRouterPrototype() {
        try {
            const proto = window.VueRouter?.prototype;
            if (!proto || patchedObjects.has(proto)) {
                return;
            }

            patchedObjects.add(proto);

            ['beforeEach', 'beforeResolve', 'afterEach'].forEach(name => {
                if (typeof proto[name] === 'function') {
                    defineValue(proto, name, makeGuardBlocker(name));
                }
            });

            ['push', 'replace', 'go'].forEach(name => {
                if (typeof proto[name] === 'function') {
                    defineValue(proto, name, makeRouterJumpBlocker(name));
                }
            });
        } catch (error) {
            // VueRouter 全局对象不存在时跳过。
        }
    }

    function findVueRouterFromElement(element) {
        try {
            if (element.__vue_app__) {
                const app = element.__vue_app__;
                return app.config?.globalProperties?.$router ||
                    app._instance?.appContext?.config?.globalProperties?.$router ||
                    app._instance?.ctx?.$router ||
                    null;
            }

            if (element.__vue__) {
                const vue = element.__vue__;
                return vue.$router ||
                    vue.$root?.$router ||
                    vue.$root?.$options?.router ||
                    vue._router ||
                    null;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function scanRouters() {
        patchVueRouterPrototype();

        if (!document.documentElement) {
            return;
        }

        const queue = [document.documentElement];
        const visited = new Set();
        let scanned = 0;

        while (queue.length && scanned < 8000) {
            const node = queue.shift();
            scanned += 1;

            if (!node || visited.has(node)) {
                continue;
            }
            visited.add(node);

            if (node.nodeType === 1) {
                const router = findVueRouterFromElement(node);
                if (router) {
                    patchRouter(router);
                }

                if (node.childNodes && node.childNodes.length) {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        queue.push(node.childNodes[i]);
                    }
                }
            }
        }
    }

    function installArrayPushGuardBlocker() {
        const hookedPush = function() {
            if (arguments.length > 0 && typeof arguments[0] === 'function') {
                try {
                    const stack = new Error().stack || '';
                    if (
                        stack.includes('beforeEach') ||
                        stack.includes('beforeResolve') ||
                        stack.includes('afterEach')
                    ) {
                        state.guardRegistrationBlocked += 1;
                        mark('已阻止守卫注册');
                        return originalArrayPush.call(this);
                    }
                } catch (error) {
                    // stack 读取失败时放行，避免破坏普通数组。
                }
            }

            return originalArrayPush.apply(this, arguments);
        };

        maskToString(hookedPush, 'push');
        defineValue(Array.prototype, 'push', hookedPush);
    }

    function installBrowserJumpBlockers() {
        if (typeof history.back === 'function') {
            defineValue(history, 'back', makeBrowserJumpBlocker('history.back'));
        }
        if (typeof history.forward === 'function') {
            defineValue(history, 'forward', makeBrowserJumpBlocker('history.forward'));
        }
        if (typeof history.go === 'function') {
            defineValue(history, 'go', makeBrowserJumpBlocker('history.go'));
        }

        try {
            const locationPrototype = Location.prototype;
            if (typeof locationPrototype.assign === 'function') {
                defineValue(locationPrototype, 'assign', makeBrowserJumpBlocker('location.assign'));
            }
            if (typeof locationPrototype.replace === 'function') {
                defineValue(locationPrototype, 'replace', makeBrowserJumpBlocker('location.replace'));
            }
        } catch (error) {
            // 某些页面不允许改 Location 原型。
        }

        if (typeof window.close === 'function') {
            defineValue(window, 'close', makeBrowserJumpBlocker('window.close'));
        }
    }

    let scanTimer = null;
    function scheduleScan(delay) {
        if (scanTimer) {
            return;
        }

        scanTimer = setTimeout(() => {
            scanTimer = null;
            scanRouters();
        }, delay);
    }

    function startObserver() {
        if (!document.documentElement || typeof MutationObserver !== 'function') {
            return;
        }

        const observer = new MutationObserver(() => {
            scheduleScan(80);
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    window.addEventListener('message', event => {
        if (event.source !== window || !event.data) {
            return;
        }

        if (event.data.type === 'VUECRACK_GET_ALL_IN_STATUS') {
            emitStatus();
        }
    });

    installArrayPushGuardBlocker();
    installBrowserJumpBlockers();
    emitStatus();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scanRouters();
            startObserver();
        });
    } else {
        scanRouters();
        startObserver();
    }

    [50, 150, 350, 800, 1500, 3000, 6000].forEach(delay => {
        setTimeout(scanRouters, delay);
    });
})();
