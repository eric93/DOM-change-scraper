var port = chrome.runtime.connect({name: "target"});
function getDomPosition(target) {
    if(!target.uniqueId) {
        throw new Error("Node does not have an id");
    }
    return target.uniqueId;
}

function findPos(parent, child) {
    return Array.prototype.indexOf.call(parent.childNodes, child);
}

uniqueId = 1;
function uniqueNodeId() {
    if(uniqueId == 122 || uniqueId == 121) {
        debugger;
    }
    return uniqueId++;
}

function getDOM() {
    serializeIds(document.documentElement);
    var ret = S.serializeToString(document);
    removeIdAttrs(document.documentElement);
    return ret;
}

seenValues = {}
docId = -1;
seenRemoved = {}
seenAdded = {}
function handleStateChange(m) {
    if(!seenValues[m.target.uniqueId]) {
        seenValues[m.target.uniqueId] = {attrs: {}, charData: {data: null}};
    }

    var changeType = (m.type == "attributes") ? "attrs" : ((m.type == "characterData") ? "charData" : undefined);
    var changeIdx = (m.type == "attributes") ? m.attributeName : ((m.type == "characterData") ? "data" : undefined);

    var values = seenValues[m.target.uniqueId][changeType][changeIdx]; 

    var curDOM = undefined;
    if (m.type == "attributes"){
        curDOM = m.target.attributes[m.attributeName] ? m.target.attributes[m.attributeName].value : null;
    } else if (m.type == "characterData") {
        curDOM = m.data;
    }

    if (!values) {
        seenValues[m.target.uniqueId][changeType][changeIdx] = [m.oldValue, curDOM];
        return;
    }

    // If we get here, values is already assigned so we might have to do a non-trivial
    // update to it.

    var curValue = values[values.length - 1];

    var oldValue = values[values.length - 2];

    if(curValue == curDOM  && m.oldValue != curValue) {
        // The DOM was updated before the mutation event was fired, so we need
        // to do some work to reconstruct the actual attribute change sequence
        values.splice(-1,0,m.oldValue);
    } else if (m.oldValue == curValue) {
        // DOM and mutations were updated in sync with each other.
        values.push(curDOM);
    } else {
        throw new Error("Unexpected situation; attribute: " + changeIdx + 
                " seen values: " + values
                + " current update: (" + m.oldValue + "," + curDOM +")");
    }
}

S = new XMLSerializer();
function serialize(nodeLst) {
    var res = [];
    for (var i = 0; i < nodeLst.length; i++) {
        res.push(serializeNode(nodeLst[i]));
    }
    return res;
};

function serializeNode(node) {
    serializeIds(node);
    var ret =  S.serializeToString(node);
    removeIdAttrs(node);
    return ret;
}

function serializeIds(node) {
    var type = node.nodeType;
    // Text and comments don't have attributes
    if(node.uniqueId && type != 3 && type != 8 && type != 7) {
        console.assert(!node.hasAttribute("data-uniqueid") ||
                node.getAttribute("data-uniqueid") == node.uniqueId);
        node.setAttribute("data-uniqueid", node.uniqueId);
    }
    for (var i = 0; i < node.childNodes.length; i++) {
        serializeIds(node.childNodes[i]);
    }
}

function removeIdAttrs(node) {
    var type = node.nodeType;
    // Text and comments don't have attributes
    if(node.uniqueId && type != 3 && type != 8 && type != 7) {
        console.assert(node.hasAttribute("data-uniqueid"));
        node.removeAttribute("data-uniqueid");
    }
    for (var i = 0; i < node.childNodes.length; i++) {
        removeIdAttrs(node.childNodes[i]);
    }
}

function sendStatesIfNeeded(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if(seenValues[node.uniqueId]) {
            var targetPos = getDomPosition(node);
            for (attr in seenValues[node.uniqueId].attrs) {
                var changes = seenValues[node.uniqueId].attrs[attr];
                for(var i = 1; i < changes.length; i++) {
                    var attrsChanged = {target: targetPos, attribute: attr, oldValue: changes[i-1], newValue: changes[i], type: "attributes"};
                    port.postMessage({dom: getDOM(), id: docId, changes: attrsChanged, newPage: false});
                }
            }

            if (seenValues[node.uniqueId].charData.data) {
                var charDataStates = seenValues[node.uniqueId].charData.data;
                var parentPos = getDomPosition(node.parentNode);
                var childPos = findPos(node.parentNode, node);
                for(var i = 1; i < charDataStates.length; i++) {
                    var dataChanged = {target: parentPos, childNum: childPos, oldValue: charDataStates[i-1], newValue: charDataStates[i], type: "characterData"};
                    port.postMessage({dom: getDOM(), id: docId, changes: dataChanged, newPage: false});
                }
            }

            // Invalidate seenValues in case of reparenting
            seenValues[node.uniqueId] = null;
        }

        sendStatesIfNeeded(node.childNodes);
    }
}
function handleTreeChange(m) {
    if (m.type == "childList") {

        for(var i = 0; i < m.addedNodes.length; i++) {
            addIdsToSubtree(m.addedNodes[i], true);
        }

        for(var i = 0; i < m.removedNodes.length; i++) {
            removeIdsFromSubtree(m.removedNodes[i]);
        }

        var targetPos = getDomPosition(m.target);
        var added = serialize(m.addedNodes);
        var removed = serialize(m.removedNodes);
        var prev = m.previousSibling ? m.previousSibling.uniqueId : -1;
        var next = m.nextSibling ? m.nextSibling.uniqueId : -1;
        for(var i = 0; i < m.target.childNodes.length; i++) {
            var type = m.target.childNodes[i].nodeType;
            // Text, comment, and processing instruction nodes
            // all have character data.
            if(type == 3 || type == 7 || type == 8) {
                if(m.target.childNodes[i].uniqueId) {
                    alert("Error: can't add/remove node with character data changes");
                    throw new Error("can't add/remove node with character data changes");
                }
            }
        }

        // If nodes have been removed, send their state changes before they're gone forever
        sendStatesIfNeeded(m.removedNodes);

        return {added: added, removed: removed, prev: prev,
            next: next, target: targetPos,
            type: m.type};
    } else {
        throw new Error("Unknown attribute type: " + m.type);
    }
}
port.onMessage.addListener(function(msg) {
    if(msg.newDocId != -1) {
        docId = msg.newDocId;
        observer = new MutationObserver(function (mutations, obs) {
            mutations.forEach(function(m) {
                // Attribute and character data changes are handled lazily since
                // there's no good way to get the "current" value at mutation time.
                if (m.type == "attributes" || m.type == "characterData") {
                    handleStateChange(m);
                } else {
                    port.postMessage({dom: getDOM(), id: docId, changes: handleTreeChange(m), newPage: false});
                }
            });
        });
        observer.observe(document, {    
            childList: true,
            attributes: true,
            characterData: true,
            subtree:true,
            attributeOldValue: true,
            characterDataOldValue: true
        });
    }
});

function addIdsToSubtree(subtree, mark) {
    // Text-data nodes have their position relative to their parents
    if(subtree.nodeType != 3 && subtree.nodeType != 7 && subtree.nodeType != 8) {
        if(subtree.uniqueId) {
            throw new Error("Node already has an id");
        } else {
            subtree.uniqueId = uniqueNodeId();
            if(mark){
                seenAdded[subtree.uniqueId] = true;
            }
        }
    }

    for(var i = 0; i < subtree.childNodes.length; i++) {
        addIdsToSubtree(subtree.childNodes[i], mark);
    }
}

function removeIdsFromSubtree(subtree) {
    // Text-data nodes have their position relative to their parents
    if(subtree.nodeType != 3 && subtree.nodeType != 7 && subtree.nodeType != 8) {
        if(subtree.uniqueId) {
            seenRemoved[subtree.uniqueId] = true;
            subtree.uniqueId = null;
        }
    }

    for(var i = 0; i < subtree.childNodes.length; i++) {
        removeIdsFromSubtree(subtree.childNodes[i]);
    }
}


window.addEventListener("load", function() {
    addIdsToSubtree(document.documentElement, false);
    port.postMessage({dom: getDOM(), newPage: true});
});

window.addEventListener("beforeunload", function() {
    sendStatesIfNeeded(document.documentElement);
});
