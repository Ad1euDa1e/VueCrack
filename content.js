// 检测结果
let detectionResult = {
    detected: false,
    method: '',
    details: {},
    errorMsg: ''
};

// 路由分析结果
let routerAnalysisResult = null;

// 避免在同一页面重复注入 detector
let detectorInjectionInProgress = false;

// 注入页面上下文脚本
function injectDetector() {
    if (detectorInjectionInProgress) {
        return false;
    }

    try {
        detectorInjectionInProgress = true;
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('detector.js');
        script.onload = function() {
            this.remove();
        };
        script.onerror = function() {
            detectorInjectionInProgress = false;
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
        return true;
    } catch (e) {
        detectorInjectionInProgress = false;
        console.error("Failed to inject detector script:", e);
        detectionResult.errorMsg = e.toString();
        chrome.runtime.sendMessage({
            action: "vueDetectionError",
            error: e.toString()
        });
        return false;
    }
}

// 监听detector.js的消息
window.addEventListener('message', function(event) {
    if (event.source !== window) return;

    try {
        if (event.data.type === 'VUE_DETECTION_RESULT') {
            detectionResult = event.data.result;
            if (!detectionResult.detected) {
                detectorInjectionInProgress = false;
            }

            chrome.runtime.sendMessage({
                action: "vueDetectionResult",
                result: detectionResult
            });
        }
        else if (event.data.type === 'VUE_ROUTER_ANALYSIS_RESULT') {
            routerAnalysisResult = event.data.result;
            detectorInjectionInProgress = false;

            chrome.runtime.sendMessage({
                action: "vueRouterAnalysisResult",
                result: routerAnalysisResult
            });
        }
        else if (event.data.type === 'VUE_ROUTER_ANALYSIS_ERROR') {
            detectorInjectionInProgress = false;
            chrome.runtime.sendMessage({
                action: "vueRouterAnalysisError",
                error: event.data.error
            });
        }
        else if (event.data.type === 'VUECRACK_ALL_IN_STATUS' && event.data.source === 'vuecrack-all-in') {
            chrome.runtime.sendMessage({
                action: "vuecrackAllInStatus",
                status: event.data.status
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
            if (detectionResult.detected && !request.forceRefresh) {
                chrome.runtime.sendMessage({
                    action: "vueDetectionResult",
                    result: detectionResult
                });
                sendResponse({status: "cached"});
                return true;
            }

            sendResponse({status: "detecting"});
            injectDetector();
        }
        else if (request.action === "analyzeVueRouter") {
            if (routerAnalysisResult && !request.forceRefresh) {
                chrome.runtime.sendMessage({
                    action: "vueRouterAnalysisResult",
                    result: routerAnalysisResult
                });
            } else {
                injectDetector();
            }
            sendResponse({status: "analyzing"});
        }
        else if (request.action === "getAllInStatus") {
            window.postMessage({
                type: 'VUECRACK_GET_ALL_IN_STATUS',
                source: 'vuecrack-extension'
            }, '*');
            sendResponse({status: "requested"});
        }
    } catch (e) {
        console.error("Request handling error:", e);
        sendResponse({status: "error", error: e.toString()});
    }
    return true;
});
