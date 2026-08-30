document.addEventListener("DOMContentLoaded", () => {

    const profBtn = document.getElementById("profBtn");
    const profDd = document.getElementById("profDd");

    if (!profBtn || !profDd) {
        console.log("Profile elements not found");
        return;
    }

    console.log("Profile dropdown ready");

    profBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        profDd.classList.toggle("open");

        console.log(
            "Dropdown:",
            profDd.classList.contains("open") ? "OPEN" : "CLOSED"
        );
    });

    profDd.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    document.addEventListener("click", () => {
        profDd.classList.remove("open");
    });

});