// ==UserScript==
// @name          DOM Change Scraper
// @namespace     http://berkeley.edu/
// @description   Logs mutation events to the DOM
// @include       *
// @version       0.9
// @run-at        document-end
// @grant         GM_log
// ==/UserScript==
script = document.createElement("script");
script.setAttribute("type", "text/javascript");
script.setAttribute("src", "http://localhost:8080/collector.js");

this.unsafeWindow.document.body.appendChild(script);
