// Small helper: fetch + JSON with proper error handling
async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

function openModal(modalId) {
    const modalElement = document.querySelector(modalId);
    if (!modalElement) {
        console.error("Modal element not found:", modalId);
        return;
    }
    // Reuses the existing instance instead of creating a new one each time
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

document.addEventListener("DOMContentLoaded", () => {

    /* ---------- Like buttons ---------- */
    document.querySelectorAll(".like-btn").forEach(likeBtn => {
        likeBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            if (likeBtn.disabled) return;
            likeBtn.disabled = true; // prevent double-click spam

            const icon = likeBtn.querySelector("i");
            const likeCount = likeBtn.querySelector(".like-count");
            const doubtId = likeBtn.dataset.doubtId;

            try {
                const result = await fetchJSON(`/doubts/${doubtId}/like`, { method: "POST" });

                icon.classList.toggle("bi-heart-fill", result.liked);
                icon.classList.toggle("bi-heart", !result.liked);

                if (likeCount) likeCount.textContent = result.likeCount;
            } catch (err) {
                console.error("Like error:", err);
            } finally {
                likeBtn.disabled = false;
            }
        });
    });

    /* ---------- Verification notification ---------- */
    fetchJSON("/verification-notification")
        .then(data => {
            if (!data.show) return;

            const message = data.count === 1
                ? "Your answer has been verified by a teacher!"
                : `${data.count} of your answers have been verified by a teacher!`;

            Swal.fire({
                icon: "success",
                title: "🎉 Congratulations!",
                // text is ignored when html is set, so combine them
                html: `${message}<br><b>⭐ You earned ${data.count * data.xp} XP</b>`,
                confirmButtonText: "Awesome! ⭐"
            });
        })
        .catch(err => console.error("Verification notification error:", err));

    /* ---------- Rating submit ---------- */
    const submitButton = document.querySelector(".submit-button");
    if (submitButton) {
        submitButton.addEventListener("click", async () => {
            const selectedRating = document.querySelector('input[name="rating"]:checked');
            const doubtIdInput = document.querySelector('input[name="doubtId"]');

            if (!selectedRating || !doubtIdInput) {
                Swal.fire({
                    icon: "warning",
                    title: "Please select a rating",
                    toast: true,
                    position: "top-end",
                    showConfirmButton: false,
                    timer: 2000
                });
                return;
            }

            try {
                const data = await fetchJSON(`/doubt/${doubtIdInput.value}/rating`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating: selectedRating.value })
                });

                if (data.success) {
                    Swal.fire({
                        icon: "success",
                        title: "Thank you!",
                        text: "Thanks for your feedback.",
                        toast: true,
                        position: "top-end",
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            } catch (err) {
                console.error("Rating submit error:", err);
            }
        });
    }
 });
    const ratingBox = document.querySelector(".rating-box");

if (ratingBox) {
    const rating = ratingBox.dataset.userRating;

    if (rating) {
        const star = ratingBox.querySelector(
            `input[name="rating"][value="${rating}"]`
        );

        if (star) {
            star.checked = true;
        }
    }
}