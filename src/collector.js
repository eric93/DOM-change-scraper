var port = chrome.runtime.connect({name: "target"});
function getDomPosition(target) {
    if(!target.uniqueId) {
        target.uniqueId = uniqueNodeId();
    }
    return target.uniqueId;
}

function findPos(parent, child) {
        return Array.prototype.indexOf.call(parent.childNodes, child);
}

uniqueId = 1;
function uniqueNodeId() {
    return uniqueId++;
}

function getDOM() {
    serializeIds(document.documentElement);
    return S.serializeToString(document);
}

seenValues = {}
function handleStateChange(m) {
    if(!m.target.uniqueId) {
        m.target['uniqueId'] = uniqueNodeId();
    }
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
        Error("Unexpected situation; attribute: " + changeIdx + 
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
    return S.serializeToString(node);
}

function serializeIds(node) {
    if(node.uniqueId) {
        console.assert(!node.hasAttribute("data-uniqueid") ||
            node.getAttribute("data-uniqueid") == node.uniqueId);
        node.setAttribute("data-uniqueid", node.uniqueId);
    }
    for (var i = 0; i < node.childNodes.length; i++) {
        serializeIds(node.childNodes[i]);
    }
}

function sendStatesIfNeeded(nodes) {
    for (node in nodes) {
        if(node.uniqueId) {
            var targetPos = getDomPosition(node);
            for (attr in seenValues[node.uniqueId].attrs) {
                var changes = seenValues[node.uniqueId].attrs[attr];
                for(var i = 1; i < changes.length; i++) {
                    var attrsChanged = {target: targetPos, attribute: attr, oldValue: changes[i-1], newValue: changes[i]};
                    port.postMessage({dom: getDOM(), id: docId, changes: attrsChanged, newPage: false});
                }
            }

            if (seenValues[node.uniqueId].charData) {
                var charDataStates = seenValues[node.uniqueId].charData;
                for(var i = 1; i < charDataStates.length; i++) {
                    var dataChanged = {target: targetPos, attribute: "characterData", oldValue: charDataStates[i-1], newValue: charDataStates[i]};
                    port.postMessage({dom: getDOM(), id: docId, changes: attrsChanged, newPage: false});
                }
            }

            // In case this node is reparented, we don't want to hold on to
            // its attribute change list.
            node.uniqueId = null;
        }

        sendStatesIfNeeded(node.childNodes);
    }
}
function handleTreeChange(m) {
    if (m.type == "childList") {
        var targetPos = getDomPosition(m.target);
        var added = serialize(m.addedNodes);
        var removed = serialize(m.removedNodes);
        var prev = m.previousSibling ? findPos(m.target, m.previousSibling) : 0;
        var next = m.previousSibling ? findPos(m.target, m.previousSibling) : (m.target.childNodes.length - 1);

        // If nodes have been removed, send their state changes before they're gone forever
        sendStatesIfNeeded(m.removedNodes);

        return {added: added, removed: removed, prev: prev, next: next,
            target: targetPos,
            type: m.type};
    } else {
        Error("Unknown attribute type: " + m.type);
    }
}
port.onMessage.addListener(function(msg) {
    if(msg.newDocId != -1) {
        var docId = msg.newDocId;
        var observer = new MutationObserver(function (mutations, obs) {
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
window.addEventListener("load", function() {
    port.postMessage({dom: getDOM(), newPage: true});
});

window.addEventListener("beforeunload", function() {
    sendStatesIfNeeded(document.documentElement);
});
