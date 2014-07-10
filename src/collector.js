window.addEventListener("load", function() {
    var s = new XMLSerializer();
    var str = s.serializeToString(document);
    var port = chrome.runtime.connect();
    port.postMessage({txt: str});
});
