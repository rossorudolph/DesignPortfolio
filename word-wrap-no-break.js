/**
 * Wraps every word in .main-bio-text in a span with white-space: nowrap
 * so no word is ever split across lines. Run before glitch-text.js.
 */
(function () {
  function wrapWordsInNode(textNode) {
    var text = textNode.textContent;
    if (!text) return;
    var parts = text.split(/(\s+)/);
    if (parts.length === 0) return;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (/^\s+$/.test(part) || part === '') {
        fragment.appendChild(document.createTextNode(part));
      } else {
        var span = document.createElement('span');
        span.className = 'word-no-break';
        span.textContent = part;
        fragment.appendChild(span);
      }
    }
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function walkAndWrap(el) {
    if (!el) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(wrapWordsInNode);
  }

  function init() {
    var textEl = document.querySelector('.main-bio-text');
    if (!textEl) return;
    walkAndWrap(textEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
