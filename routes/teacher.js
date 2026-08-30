var express = require("express");
var router = express.Router();
const teacherHelper = require("../helpers/teacher-helper");

function verifyTeacher(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "teacher") {
    return res.redirect("/doubts");
  }

  next();
}

function takeNotice(req) {
  const notice = req.session.teacherNotice || null;
  delete req.session.teacherNotice;
  return notice;
}

async function teacherSubject(req) {
  const teacher = await teacherHelper.getTeacherById(req.session.user._id);
  if (!teacher || teacher.active === false) {
    return null;
  }
  return teacher.subject || null;
}

router.get("/", verifyTeacher, async (req, res) => {
  const subject = await teacherSubject(req);
  const [pendingCount, recentPending] = await Promise.all([
    teacherHelper.countPendingAnswers(subject),
    teacherHelper.listRecentPending(subject, 8),
  ]);

  res.render("teacher/dashboard", {
    teacherName: req.session.user.name,
    teacherSubject: subject,
    pendingCount,
    recentPending,
  });
});

router.get("/review", verifyTeacher, async (req, res) => {
  const subject = await teacherSubject(req);
  const item = await teacherHelper.getNextPending(subject);
  const notice = takeNotice(req);

  if (!item) {
    return res.render("teacher/review", {
      caughtUp: true,
      notice,
      teacherSubject: subject,
    });
  }

  res.render("teacher/review", {
    item,
    notice,
    teacherSubject: subject,
  });
});

router.get("/review/:id", verifyTeacher, async (req, res) => {
  const subject = await teacherSubject(req);
  const item = await teacherHelper.getPendingById(req.params.id, subject);
  const notice = takeNotice(req);

  if (!item) {
    const nextItem = await teacherHelper.getNextPending(subject);
    if (!nextItem) {
      return res.render("teacher/review", {
        caughtUp: true,
        notice,
        teacherSubject: subject,
      });
    }
    return res.render("teacher/review", {
      item: nextItem,
      notice,
      teacherSubject: subject,
    });
  }

  res.render("teacher/review", {
    item,
    notice,
    teacherSubject: subject,
  });
});

router.post("/review/:id/verify", verifyTeacher, async (req, res) => {
  const subject = await teacherSubject(req);
  const result = await teacherHelper.verifyAnswer(
    req.params.id,
    req.session.user._id,
    subject
  );

  if (result.ok) {
    req.session.teacherNotice = "Answer verified.";
  }

  res.redirect("/teacher/review");
});

router.post("/review/:id/reject", verifyTeacher, async (req, res) => {
  const subject = await teacherSubject(req);
  const result = await teacherHelper.rejectAnswer(
    req.params.id,
    req.session.user._id,
    subject
  );

  if (result.ok) {
    req.session.teacherNotice = "Answer rejected.";
  }

  res.redirect("/teacher/review");
});

module.exports = router;
