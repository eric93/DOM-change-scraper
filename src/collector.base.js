uniqueId = 1;
S = new XMLSerializer();
window.addEventListener("load", function () {
    addIdsToSubtree(document.documentElement,false);
    original_dom = getDOM();
});
changes = [];

function getDomPosition(target) {
    if(!target.hasAttribute("data-uniqueid")) {
        throw new Error("Node does not have an id");
    }
    return target.getAttribute("data-uniqueid");
}

function findPos(parent, child) {
    return Array.prototype.indexOf.call(parent.children, child);
}

function findPosNodes(parent, child) {
    return Array.prototype.indexOf.call(parent.childNodes, child);
}

function uniqueNodeId() {
    return uniqueId++;
}

function getDOM() {
    var ret = S.serializeToString(document);
    return ret;
}

function serialize(nodeLst) {
    var res = [];
    for (var i = 0; i < nodeLst.length; i++) {
        res.push(serializeNode(nodeLst[i]));
    }
    return res;
};

function serializeNode(node) {
    var ret =  S.serializeToString(node);
    return ret;
}

P = new DOMParser();
function reconstruct(dom) {
    var new_dom = P.parseFromString(dom,"text/xml");
    extractIds(new_dom.documentElement);
    new_dom.documentElement.removeAttribute("xmlns");
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

function addNode(dom, p, newNode, childNum) {
    parentNode = findNode(dom,p);
    if(childNum == parentNode.children.length) {
        parentNode.appendChild(reconstruct(newNode).documentElement);
    } else {
        parentNode.insertBefore(reconstruct(newNode).documentElement, parentNode.children[childNum]);
    }
}

function removeNode(dom,p,childNum) {
    parentNode = findNode(dom,p);
    if(childNum >= parentNode.children.length) {
        parentNode.removeChild(parentNode.lastChild);
    } else {
        parentNode.removeChild(parentNode.children[childNum]);
    }
}

function updateAttribute(dom, change) {
    var node = findNode(dom, change.target);
    if(node.getAttribute(change.attr) != change.oldVal && !(!node.hasAttribute(change.attr) && change.prevVal == "")) {
        console.log("Warning: old attribute value not the same as recorded");
    }

    if(!change.newVal) {
        node.removeAttribute(change.attr);
    } else {
        node.setAttribute(change.attr, change.newVal);
    }
}

function updateCharacterData(dom, change) {
    var node = findNode(dom, change.target);
    var child = node.childNodes[change.childNum];
    console.assert(child.nodeType == 7 || child.nodeType == 8 || child.nodeType == 3, "Invalid character data change");

    if(child.data != change.oldVal) {
        console.log("Warning: old character data value not the same as recorded");
    }

    child.data = change.newVal;
}

function sameDom(dom1, dom2) {
    return same_dom_helper(dom1.documentElement, dom2.documentElement);
}

function same_dom_helper(dom1, dom2) {

    // Ignore comments
    if(dom1.nodeType == 8 && dom2.nodeType == 8) {
        return true;
    } else if (dom1.nodeType != dom2.nodeType) {
        debugger;
        // return false;
    }

    // Text nodes
    if (dom1.nodeType == 3) {
        if (dom2.nodeType == 3){
            return dom1.textContent == dom2.textContent;
        } else {
            debugger;
            // return false;
        }
    } else if(dom1.nodeType != 1) {
        throw new Error("Unsupported DOM node type: " + dom1.nodeType);
    }

    if (dom2.nodeType != 1 && dom2.nodeType != 3) {
        throw new Error("Unsupported DOM node type: " + dom1.nodeType);
    }

    if(dom1.attributes.length != dom2.attributes.length) {
        debugger;
        // return false;
    }
    for (var i = 0; i < dom1.attributes.length; i++) {
        var key = dom1.attributes[i].name;
        if (dom1.getAttribute(key) != dom2.getAttribute(key)) {
            debugger;
            // return false;
        }
    }

    var children1 = dom1.children;
    var children2 = dom2.children;
    if(children1.length != children2.length) {
        debugger;
        // return false;
    }
    for (var i = 0; i < children1.length; i++) {
        if(!same_dom_helper(children1[i], children2[i])) {
            return false;
        }
    }

    return true;
}

function addIdsToSubtree(subtree, strict) {
    // Text-data nodes have their position relative to their parents
    if(subtree.nodeType != 3 && subtree.nodeType != 7 && subtree.nodeType != 8) {
        if(subtree.hasAttribute("data-uniqueid") && strict) {
            throw new Error("Node already has an id");
        } else if (!subtree.hasAttribute("data-uniqueid")) {
            subtree.setAttribute("data-uniqueid", uniqueNodeId());
        }
    }

    for(var i = 0; i < subtree.childNodes.length; i++) {
        addIdsToSubtree(subtree.childNodes[i], strict);
    }
}

function removeIdsFromSubtree(subtree,strict) {
    // Text-data nodes have their position relative to their parents
    if(subtree.nodeType != 3 && subtree.nodeType != 7 && subtree.nodeType != 8) {
        if(subtree.hasAttribute("data-uniqueid")) {
            subtree.removeAttribute("data-uniqueid");
        } else if (strict){
            throw new Error("Node does not have id");
        }
    }

    for(var i = 0; i < subtree.childNodes.length; i++) {
        removeIdsFromSubtree(subtree.childNodes[i], strict);
    }
}


window.addEventListener("DOMNodeInserted", function(m) {
    if(m.target.nodeType != 1 || !m.relatedNode.hasAttribute("data-uniqueid"))
        return;
    var childNum = findPos(m.relatedNode,m.target);
    console.assert(childNum >= 0, "Invalid change");
    addIdsToSubtree(m.target, false);

    changes.push({type: "insertion", target: m.relatedNode.getAttribute("data-uniqueid"), added: serializeNode(m.target), childNum: childNum});
});

window.addEventListener("DOMNodeRemoved", function(m) {
    if(m.target.nodeType != 1 || !m.relatedNode.hasAttribute("data-uniqueid"))
        return;

    var childNum = findPos(m.relatedNode,m.target);
    console.assert(childNum >= 0, "Invalid change");
    removeIdsFromSubtree(m.target, false);

    changes.push({type: "removal", target: m.relatedNode.getAttribute("data-uniqueid"), childNum: childNum});
});

window.addEventListener("DOMAttrModified", function(m) {
    if(!m.target.hasAttribute("data-uniqueid"))
        return;

    if(m.attrName == "data-uniqueid" || m.attrName == "xmlns") {
        return;
    }


    if(m.attrChange == 3) {
        changes.push({type:"attribute", target: m.target.getAttribute("data-uniqueid"), attr: m.attrName, oldVal: m.prevValue, newVal: null});
    } else {
        changes.push({type:"attribute", target: m.target.getAttribute("data-uniqueid"), attr: m.attrName, oldVal: m.prevValue, newVal: m.newValue});
    }
});

window.addEventListener("DOMCharacterDataModified", function(m) {
    return;
    var childNum = findPosNodes(m.relatedNode,m.target);
    changes.push({type: "character", target: m.relatedNode, childNum: childNum, oldVal: m.prevValue, newVal: m.newValue});
});

window.addEventListener("keydown", function(e) {
    if(e.key == "`")
        run()
});
function run() {
    var myDom = reconstruct(original_dom);
    for(var i = 0; i < changes.length; i++) {
        if(changes[i].type == "insertion") {
            addNode(myDom, changes[i].target, changes[i].added, changes[i].childNum);
        } else if (changes[i].type == "removal") {
            removeNode(myDom, changes[i].target, changes[i].childNum);
        } else if (changes[i].type == "attribute") {
            updateAttribute(myDom, changes[i]);
        } else if (changes[i].type == "character") {
            updateCharacterData(myDom, changes[i]);
        }
    }

    removeIdsFromSubtree(document.documentElement, true);

    try {
        if (sameDom(myDom, document)) {
            console.log("DOM is consistent");
        } else {
            console.log("DOM is inconsistent");
        }
    } catch(e) {
        console.log(e);
    }

    var domReq = new XMLHttpRequest();
    var url = "http://localhost:8080/store/" + document.domain + "/originaldom";
    domReq.open("POST",url,true);
    domReq.setRequestHeader("Content-type", "text/plain");
    domReq.setRequestHeader("Content-length", original_dom.length);
    domReq.setRequestHeader("Connection", "close");

    domReq.send(original_dom);

    var changesStr = JSON.stringify(changes);
    var changesReq = new XMLHttpRequest();
    var url2 = "http://localhost:8080/store/" + document.domain + "/changes";
    changesReq.open("POST",url2,true);
    changesReq.setRequestHeader("Content-type", "text/plain");
    changesReq.setRequestHeader("Content-length", changesStr.length);
    changesReq.setRequestHeader("Connection", "close");

    changesReq.send(changesStr);

};
