/* POLYFILL-POINTER: pe telefoane/tablete vechi fără "pointer events", traduce atingerile în evenimente pointer */
(function () {
    if (window.PointerEvent) return;
    if (!Element.prototype.setPointerCapture) { Element.prototype.setPointerCapture = function () {}; Element.prototype.releasePointerCapture = function () {}; }
    function fire(type, e, t) {
        var ev = document.createEvent('MouseEvents');
        ev.initMouseEvent(type, true, true, window, 0, t.screenX, t.screenY, t.clientX, t.clientY, false, false, false, false, 0, null);
        ev.pointerId = t.identifier + 1; ev.pointerType = 'touch'; ev.isPrimary = true;
        (e.target || document).dispatchEvent(ev);
    }
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (n) {
        var map = { touchstart: 'pointerdown', touchmove: 'pointermove', touchend: 'pointerup', touchcancel: 'pointercancel' };
        document.addEventListener(n, function (e) { var t = e.changedTouches[0]; if (t) fire(map[n], e, t); }, true);
    });
})();

/* Adaugă butonul "Înapoi" în paginile de joc. Ținta e citită din <meta name="joc-inapoi"> */
(function () {
    var m = document.querySelector('meta[name="joc-inapoi"]');
    var tinta = (m && m.content) || 'jocuri.html';
    var a = document.createElement('a');
    a.className = 'joc-inapoi';
    a.href = tinta;
    a.setAttribute('aria-label', 'Înapoi la lista de jocuri');
    a.innerHTML = '<span aria-hidden="true">←</span><span class="txt">Înapoi</span>';
    document.body.appendChild(a);
})();
