document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll(".like-btn").forEach(button => {

        button.addEventListener("click",async () => {
        const icon = button.querySelector("i");
            const doubtId = button.dataset.doubtId;

            console.log("Clicked:", doubtId);
            const response=await fetch(`/doubts/${doubtId}/like`,{method:"POST"})
            const result=await response.json();
            if(result.liked){
                icon.classList.remove("bi-heart");
                icon.classList.add("bi-heart-fill");
                console.log("liked successs")
            }else{
                icon.classList.remove("bi-heart-fill");
                icon.classList.add("bi-heart");
            }
            console.log("server responds as:",result)
            const likeCount=button.querySelector(".like-count");
            likeCount.textContent=result.likeCount
        });

    });
});
fetch("/verification-notification")
  .then(res => res.json())
  .then(data => {

    if (data.show) {

      Swal.fire({
        icon: "success",
        title: "🎉 Congratulations!",
        text: data.count === 1
          ? "Your answer has been verified by a teacher!"
          : `${data.count} of your answers have been verified by a teacher!`,
        html: `<b>⭐ You earned ${data.count * data.xp} XP</b>`,
        confirmButtonText: "Awesome! ⭐"
      });

    }

  })
  .catch(err => {
    console.error("Verification notification error:", err);
  });