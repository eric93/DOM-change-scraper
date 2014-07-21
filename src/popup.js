debug = false
document.getElementById("off").addEventListener("click", function (){
    debug = false;
});

document.getElementById("debug").addEventListener("click", function (){
    debug = true;
});

document.getElementById("test").addEventListener("click", function (){
    var port = chrome.runtime.connect({name: "popup"});
    port.postMessage({test: true});
});
