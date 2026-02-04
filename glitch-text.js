/**
 * Wraps a random subset of characters in .main-bio-text in spans with a glitch animation,
 * so only non-link text glitches subtly (Kraft-style).
 */
(function () {
  var glitchFraction = 0.06; // ~6% of chars
  var maxDelay = 5;

  function wrapGlitchChars(container) {
    if (!container || !container.childNodes) return;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('a')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(function (textNode) {
      var text = textNode.textContent;
      if (!text || !text.trim()) return;
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch === ' ' || ch === '\n') {
          fragment.appendChild(document.createTextNode(ch));
          continue;
        }
        if (Math.random() > glitchFraction) {
          fragment.appendChild(document.createTextNode(ch));
          continue;
        }
        var span = document.createElement('span');
        span.className = 'glitch-char';
        span.style.setProperty('--glitch-delay', (Math.random() * maxDelay) + 's');
        span.textContent = ch;
        fragment.appendChild(span);
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  function init() {
    var bio = document.getElementById('main-bio');
    if (!bio) return;
    var textEl = bio.querySelector('.main-bio-text');
    if (!textEl) return;
    wrapGlitchChars(textEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
