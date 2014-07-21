var uniqueId = 0; // Used to give unique id to each DOM

/*
 *  Debugging mode state
 */
var doms = [];              // Closures to lazily apply mutations to DOMs
var mostRecentDoms = [];    // Actual DOMs from pages.

P = new DOMParser();
function reconstruct(dom) {
    var new_dom = P.parseFromString(dom,"text/xml");
    extractIds(new_dom.documentElement);
    return new_dom;
}

function extractIds(dom) {
    if(dom.nodeType == 1 && dom.hasAttribute("data-uniqueid")) {
        dom.uniqueId = dom.getAttribute("data-uniqueid");
        dom.removeAttribute("data-uniqueid");
    }

    for(var i = 0; i < dom.childNodes.length; i++) {
        extractIds(dom.childNodes[i]);
    }
}

//TODO
function update_dom(old_dom, change) {
    return old_dom;
}

function same_dom(dom1, dom2) {
    dom1 = reconstruct(dom1);
    dom2 = reconstruct(dom2);
    return same_dom_helper(dom1.documentElement, dom2.documentElement);
}
function same_dom_helper(dom1, dom2) {

    // Ignore comments
    if(dom1.nodeType == 8 && dom2.nodeType == 8) {
        if(dom1.childNodes.length != dom2.childNodes.length) {
            return false;
        }
        for (var i = 0; i < dom1.childNodes.length; i++) {
            if(!same_dom_helper(dom1.childNodes[i], dom2.childNodes[i])) {
                return false;
            }
        }
        return true;
    } else if (dom1.nodeType != dom2.nodeType) {
        return false;
    }

    // Text nodes
    if (dom1.nodeType == 3) {
        if (dom2.nodeType == 3){
            return dom1.textContent == dom2.textContent;
        } else {
            return false;
        }
    } else if (dom1.nodeType == 1) { // Element nodes
        if (dom2.nodeType != 1){
            return false;
        }
    } else {
        throw Error("Unsupported DOM node type: " + dom1.nodeType);
    }

    if (dom2.nodeType != 1 && dom2.nodeType != 3) {
        throw Error("Unsupported DOM node type: " + dom1.nodeType);
    }

    if(dom1.attributes.length != dom2.attributes.length) {
        return false;
    }
    for (var i = 0; i < dom1.attributes.length; i++) {
        var key = dom1.attributes[i].name;
        if (dom1.getAttribute(key) != dom2.getAttribute(key)) {
            return false;
        }
    }

    if(dom1.childNodes.length != dom2.childNodes.length) {
        return false;
    }
    for (var i = 0; i < dom1.childNodes.length; i++) {
        if(!same_dom_helper(dom1.childNodes[i], dom2.childNodes[i])) {
            return false;
        }
    }

    return true;
}

chrome.runtime.onConnect.addListener(function(port) {
    if (port.name == "target") {
        port.onMessage.addListener(function(msg) {
            if(msg.newPage) {
                console.assert(doms.length == uniqueId);
                port.postMessage({newDocId: uniqueId});
                uniqueId++;

                doms.push(function() { return msg.dom; });
                mostRecentDoms.push(msg.dom);
            } else {
                var old_fn = doms[msg.id];
                var fn = function() { return update_dom(old_fn(), msg.change); };
                doms[msg.id] = fn;

                mostRecentDoms[msg.id] = msg.dom;
            }
        });
    } else if (port.name == "popup") {
        port.onMessage.addListener(function(msg) {
            if(msg.test) {
                console.assert(doms.length == mostRecentDoms.length);
                for(var i = 0; i < doms.length; i++) {
                    if(!same_dom(doms[i](), mostRecentDoms[i])) {
                        alert("DOM " + (i+1) + "/" + doms.length + " is inconsistent");
                    }
                }
            }
        });
    }
});
