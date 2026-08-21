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