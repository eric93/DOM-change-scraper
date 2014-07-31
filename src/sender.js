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

function findNodeRecur(curNode, nodeId) {
    if(curNode.uniqueId == nodeId) {
        return curNode;
    }

    if(curNode.childNodes) {
        for(var i = 0; i < curNode.childNodes.length; i++) {
            var tmp = findNodeRecur(curNode.childNodes[i], nodeId);
            if(tmp)
                return tmp;
        }
    }

    return null;
}

function findNode(dom, nodeId) {
    if(!dom.cache) {
        dom.cache = {};
    }

    if(!dom.cache[nodeId]){
        node = findNodeRecur(dom.documentElement, nodeId);
        dom.cache[nodeId] = node;
        return node;
    }

    return dom.cache[nodeId];
}

function changeTreeStructure(dom, added, removed, target, prev, next) {
    var parentNode = findNode(dom, target);
    if(added.length > 0) {
        if(next == -1) {
            if(prev == -1) {
                console.assert(parentNode.childNodes.length == 0, "Invalid tree-change mutation");
            } else {
                for (var i = 0; i < parentNode.childNodes.length; i++) {
                    if (parentNode.childNodes[i].uniqueId == prev) {
                        console.assert(i == parentNode.childNodes.length - 1, "Invalid tree-change mutation");
                    }
                }
            }

            for (var i = 0; i < added.length; i++) {
                parentNode.appendChild(reconstruct(added[i]).documentElement);
            }
        } else {
            var nextNode = null;
            for(var i = 0; i < parentNode.childNodes.length; i++) {
                if(parentNode.childNodes[i].uniqueId == next) {
                    console.assert(nextNode == null, "Multiple nodes with same id");
                    nextNode = i;
                }
            }

            if(prev == -1) {
                console.assert(nextNode == 0, "Invalid tree-change mutation");
            } else {
                var prevNode = null;
                for(var i = 0; i < parentNode.childNodes.length; i++) {
                    if(parentNode.childNodes[i].uniqueId == next) {
                        console.assert(prevNode == null, "Multiple nodes with same id");
                        prevNode = i;
                    }
                }

                console.assert(prevNode + 1 == nextNode, "Invalid tree-change mutation");
            }

            for(var i = 0; i < added.length; i++) {
                var nextSibling = parentNode.childNodes[nextNode];
                parentNode.insertBefore(reconstruct(added[i]).docuentElement, nextSibling);
            }
        }
    } else if (removed.length > 0) {
        for (var i = 0; i < removed.length; i++) {
            var removedNode = parentNode.removeChild(parentNode.childNodes[idx+1]);
            console.assert(same_dom_helper(removedNode, reconstruct(removed[i]).documentElement), "Invalid removal.");
        }
    } else {
        throw new Error("Invalid tree-change mutation");
    }

    return dom;
}

function updateAttribute(dom, change) {
    var node = findNode(dom, change.target);
    if(node.getAttribute(change.attribute) != change.oldValue) {
        console.log("Warning: old attribute value not the same as recorded");
    }

    node.setAttribute(change.attribute, change.newValue);
    return dom;
}

function updateCharacterData(dom, change) {
    var node = findNode(dom, change.target);
    var child = node.childNodes[change.childNum];
    console.assert(child.nodeType == 7 || child.nodeType == 8 || child.nodeType == 3, "Invalid character data change");

    if(child.data != change.oldValue) {
        console.log("Warning: old character data value not the same as recorded");
    }

    child.data = change.newValue;
}

function update_dom(old_dom, change) {
    if(change.type == "childList"){
        return changeTreeStructure(old_dom, change.added, change.removed, change.target,change.prev,change.next);
    } else if (change.type == "attributes") {
        return updateAttribute(old_dom, change);
    } else if (change.type == "characterData") {
        return updateCharacterData(old_dom, change);
    }
    return old_dom;
}

function same_dom(dom1, dom2) {
    return same_dom_helper(dom1.documentElement, dom2.documentElement);
}
function same_dom_helper(dom1, dom2) {

    // Ignore comments
    if(dom1.nodeType == 8 && dom2.nodeType == 8) {
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
        throw new Error("Unsupported DOM node type: " + dom1.nodeType);
    }

    if (dom2.nodeType != 1 && dom2.nodeType != 3) {
        throw new Error("Unsupported DOM node type: " + dom1.nodeType);
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

                doms.push(function() { return reconstruct(msg.dom); });
                mostRecentDoms.push(reconstruct(msg.dom));
            } else {
                var old_fn = doms[msg.id];
                var fn = function() { return update_dom(old_fn(), msg.changes); };
                doms[msg.id] = fn;

                mostRecentDoms[msg.id] = reconstruct(msg.dom);
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
