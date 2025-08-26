// 检测结果
let detectionResult = {
    detected: false,
    method: '',
    details: {},
    errorMsg: ''
};

// 路由分析结果
let routerAnalysisResult = null;

// 注入页面上下文脚本
function injectDetector() {
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('detector.js');
        script.onload = function() {
            this.remove(); // 加载后移除
        };
        (document.head || document.documentElement).appendChild(script);
    } catch (e) {
        console.error("Failed to inject detector script:", e);
        detectionResult.errorMsg = e.toString();
        chrome.runtime.sendMessage({
            action: "vueDetectionError",
            error: e.toString()
        });
    }
}

// 监听detector.js的消息
window.addEventListener('message', function(event) {
    if (event.source !== window) return;

    if (event.data.type === 'VUE_DETECTION_RESULT') {
        detectionResult = event.data.result;

        // 发送结果到popup
        chrome.runtime.sendMessage({
            action: "vueDetectionResult",
            result: detectionResult
        });
    }
    else if (event.data.type === 'VUE_ROUTER_ANALYSIS_RESULT') {
        routerAnalysisResult = event.data.result;

        // 发送路由分析结果到popup
        chrome.runtime.sendMessage({
            action: "vueRouterAnalysisResult",
            result: routerAnalysisResult
        });
    }
    else if (event.data.type === 'VUE_ROUTER_ANALYSIS_ERROR') {
        chrome.runtime.sendMessage({
            action: "vueRouterAnalysisError",
            error: event.data.error
        });
    }
});

// 快速的Vue检测方法 - 针对性能优化
function fastVueDetection() {
    // 1. 检查全局对象 (最快)
    if (window.Vue || window.$nuxt || window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
        return true;
    }

    // 2. 检查几个关键Vue挂载点 (较快)
    const commonMountPoints = ['#app', '#__nuxt', '#__layout', '#q-app'];
    for (const selector of commonMountPoints) {
        const el = document.querySelector(selector);
        if (el && (el.__vue__ || el.__vue_app__)) {
            return true;
        }
    }

    // 3. 简单的DOM特征检查 (较快)
    if (document.querySelector('[v-cloak], [v-show], [v-if], [data-v-]')) {
        return true;
    }

    return false;
}

// 增强的Vue检测方法
function enhancedVueDetection() {
    // 1. 尝试直接访问Vue实例
    function checkVueInstance() {
        // 常见Vue 3挂载点
        const vue3MountPoints = [
            document.querySelector('[data-v-app]'),
            document.querySelector('#app'),
            document.querySelector('#__nuxt'),
            document.querySelector('#__layout'),
            document.querySelector('#q-app')
        ].filter(Boolean);

        for (const el of vue3MountPoints) {
            if (el.__vue_app__ || el.__vue__ || el._vnode) {
                return true;
            }
        }

        // 扫描所有DOM元素查找Vue实例
        const elements = document.querySelectorAll('*');
        const maxCheck = Math.min(elements.length, 500); // 减少检查数量以提高速度
        for (let i = 0; i < maxCheck; i++) {
            if (elements[i].__vue_app__ || elements[i].__vue__ ||
                elements[i]._vnode || elements[i].__vue_module__) {
                return true;
            }
        }

        return false;
    }

    // 2. 检查Vue特有的DOM属性和样式
    function checkVueDOMFeatures() {
        const vueDirectives = [
            '[v-cloak]', '[v-show]', '[v-if]', '[v-else]', '[v-for]',
            '[v-bind]', '[v-model]', '[v-on]', '[v-html]', '[v-text]',
            '[data-v-]', '.__vue__'
        ];

        for (const selector of vueDirectives) {
            try {
                if (document.querySelector(selector)) {
                    return true;
                }
            } catch (e) {
            }
        }

        return false;
    }

    // 3. 检查是否存在Vue Devtools标记
    function checkVueDevtools() {
        return !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    }

    // 4. 检查全局Vue对象
    function checkGlobalVue() {
        return !!window.Vue || !!window.$nuxt;
    }

    return checkVueInstance() ||
        checkVueDOMFeatures() ||
        checkVueDevtools() ||
        checkGlobalVue();
}

// 通过页面文本直接检测
function detectFromPageText(fastMode = false) {
    // 快速模式使用更简单的检测
    const vueDetected = fastMode ? fastVueDetection() : enhancedVueDetection();

    if (vueDetected) {
        detectionResult = {
            detected: true,
            method: fastMode ? 'Fast detection' : 'Enhanced detection'
        };

        chrome.runtime.sendMessage({
            action: "vueDetectionResult",
            result: detectionResult
        });

        // 检测到Vue后，注入脚本分析路由
        injectDetector();

        return true;
    }
    return false;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "detectVue") {
        // 根据请求决定使用快速模式/标准模式
        const fastMode = request.fastMode === true;

        sendResponse({status: "detecting"});

        if (!detectFromPageText(fastMode)) {
            injectDetector();
        }
    }
    else if (request.action === "analyzeVueRouter") {
        if (routerAnalysisResult) {
            chrome.runtime.sendMessage({
                action: "vueRouterAnalysisResult",
                result: routerAnalysisResult
            });
        } else {
            injectDetector();
        }

        sendResponse({status: "analyzing"});
    }
    return true;
});

// 初始化检测 - 优化为并行处理
function initDetection() {
    // 立即开始快速检测
    if (detectFromPageText(true)) {
        return;
    }

    // 如果快速检测失败，尝试注入detector.js
    injectDetector();

    // 同时进行更全面但较慢的检测
    setTimeout(() => {
        if (!detectionResult.detected) {
            detectFromPageText(false);
        }
    }, 200);
}

// 根据页面加载状态执行检测
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetection);
} else {
    initDetection();
}