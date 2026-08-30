document.addEventListener("DOMContentLoaded", () => {

    const profBtn = document.getElementById("profBtn");
    const profDd = document.getElementById("profDd");

    if (!profBtn || !profDd) {
        return;
    }
    profBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        profDd.classList.toggle("open");
    });

    profDd.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    document.addEventListener("click", () => {
        profDd.classList.remove("open");
    });

});