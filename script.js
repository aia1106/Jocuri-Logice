document.addEventListener("DOMContentLoaded", function () {
    const menuBtn = document.querySelector(".menu-btn");
    const menu = document.querySelector(".menu");
    const selectClassBtn = document.getElementById("select-class-btn");
    const popup = document.getElementById("class-selection-popup");
    const closePopup = document.querySelector(".close-popup");

    menuBtn.addEventListener("click", function () {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    selectClassBtn.addEventListener("click", function () {
        popup.style.display = "block"; // Afișează popup-ul
    });

    closePopup.addEventListener("click", function () {
        popup.style.display = "none"; // Închide popup-ul
    });

    window.addEventListener("click", function(event) {
        if (event.target === popup) {
            popup.style.display = "none"; // Închide popup-ul dacă se face clic în afara acestuia
        }
    });
});

function navigateToClass(clasa) {
    if (clasa === 'Jocuri') {
        window.location.href = 'jocuri.html';
    } else if (clasa === '0,1,2,3,4') {
        window.location.href = 'clasa0.html';
    } else {
        window.location.href = 'clasa' + clasa + '.html';
    }
}

