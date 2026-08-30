var express = require("express");
var router = express.Router();
const teacherHelper = require("../helpers/teacher-helper");

function verifyTeacher(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }

    if (req.session.user.role !== "teacher") {
        return res.redirect("/teacher");
    }

    next();
}

router.get("/",verifyTeacher, async (req, res) => {
  const [pendingCount, recentPending] = await Promise.all([
    teacherHelper.countPendingAnswers(),
    teacherHelper.listRecentPending(8),
  ]);

  res.render("teacher/dashboard", {
    teacherName: req.session.user.name,
    pendingCount,
    recentPending,
  });
});

router.get("/review",verifyTeacher, async (req, res) => {
  const item = await teacherHelper.getNextPending();


  if (!item) {
    return res.render("teacher/review", {
      caughtUp: true,
      notice,
    });
  }

  res.render("teacher/review", {
    item
  });
});

router.get("/review/:id",verifyTeacher, async (req, res) => {
  const item = await teacherHelper.getPendingById(req.params.id);
  const notice = takeNotice(req);

  if (!item) {
    const nextItem = await teacherHelper.getNextPending();
    if (!nextItem) {
      return res.render("teacher/review", {
        caughtUp: true,
        notice,
      });
    }
    return res.render("teacher/review", {
      item: nextItem,
      notice,
    });
  }

  res.render("teacher/review", {
    item,
    notice,
  });
});

router.post("/review/:id/verify",verifyTeacher, async (req, res) => {
  const result = await teacherHelper.verifyAnswer(
    req.params.id,
    req.session.user._id
  );

  if (result.ok) {
    req.session.teacherNotice = "Answer verified.";
  }

  res.redirect("/teacher/review");
});

router.post("/review/:id/reject",verifyTeacher, async (req, res) => {
  const result = await teacherHelper.rejectAnswer(
    req.params.id,
    req.session.user._id
  );

  if (result.ok) {
    req.session.teacherNotice = "Answer rejected.";
  }

  res.redirect("/teacher/review");
});

module.exports = router;
