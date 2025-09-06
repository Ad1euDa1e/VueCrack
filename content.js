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
            this.remove();
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

    try {
        if (event.data.type === 'VUE_DETECTION_RESULT') {
            detectionResult = event.data.result;

            chrome.runtime.sendMessage({
                action: "vueDetectionResult",
                result: detectionResult
            });
        }
        else if (event.data.type === 'VUE_ROUTER_ANALYSIS_RESULT') {
            routerAnalysisResult = event.data.result;

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
    } catch (e) {
        console.error("Message handling error:", e);
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    try {
        if (request.action === "detectVue") {
            sendResponse({status: "detecting"});
            injectDetector();
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
    } catch (e) {
        console.error("Request handling error:", e);
        sendResponse({status: "error", error: e.toString()});
    }
    return true;
});

// 初始化检测
function initDetection() {
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(injectDetector, 100);
            });
        } else {
            setTimeout(injectDetector, 100);
        }
    } catch (e) {
        console.error("Init detection error:", e);
    }
}

// 启动初始化
initDetection();