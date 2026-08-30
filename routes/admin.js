var express = require("express");
var router = express.Router();
const adminHelper = require("../helpers/admin-helper");
const subjects = require("../config/subjects");

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "admin") {
    if (req.session.user.role === "teacher") {
      return res.redirect("/teacher");
    }
    return res.redirect("/doubts");
  }

  next();
}

router.use(requireAdmin);

function takeFlash(req) {
  const notice = req.session.adminNotice || null;
  const error = req.session.adminError || null;
  delete req.session.adminNotice;
  delete req.session.adminError;
  return { notice, error };
}

function handle(action, redirectTo) {
  return async (req, res) => {
    try {
      const result = await action(req);
      if (result && result.ok === false) {
        req.session.adminError = result.error || "Something went wrong.";
      } else if (result && result.message) {
        req.session.adminNotice = result.message;
      }
    } catch (err) {
      console.error(err);
      req.session.adminError = "Something went wrong.";
    }
    res.redirect(redirectTo);
  };
}

router.get("/", async (req, res, next) => {
  try {
    const counts = await adminHelper.getCounts();
    const flash = takeFlash(req);
    res.render("admin/dashboard", {
      nav: "dashboard",
      adminName: req.session.user.name,
      ...counts,
      ...flash,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/teachers", async (req, res, next) => {
  try {
    const teachers = await adminHelper.listTeachers();
    const flash = takeFlash(req);
    const form = req.session.adminTeacherForm || {};
    delete req.session.adminTeacherForm;
    res.render("admin/teachers", {
      nav: "teachers",
      teachers,
      form,
      subjects,
      ...flash,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/teachers", async (req, res) => {
  try {
    const result = await adminHelper.createTeacher(req.body);
    if (!result.ok) {
      req.session.adminError = result.error;
      req.session.adminTeacherForm = {
        name: req.body.name,
        email: req.body.email,
        subject: req.body.subject,
      };
    } else {
      req.session.adminNotice = "Teacher added.";
    }
  } catch (err) {
    console.error(err);
    req.session.adminError = "Could not add teacher.";
  }
  res.redirect("/admin/teachers");
});

router.post(
  "/teachers/:id/deactivate",
  handle(
    async (req) => {
      const result = await adminHelper.setTeacherActive(req.params.id, false);
      if (result.ok) {
        result.message = "Teacher deactivated.";
      }
      return result;
    },
    "/admin/teachers"
  )
);

router.post(
  "/teachers/:id/activate",
  handle(
    async (req) => {
      const result = await adminHelper.setTeacherActive(req.params.id, true);
      if (result.ok) {
        result.message = "Teacher activated.";
      }
      return result;
    },
    "/admin/teachers"
  )
);

router.get("/students", async (req, res, next) => {
  try {
    const students = await adminHelper.listStudents();
    const flash = takeFlash(req);
    res.render("admin/students", {
      nav: "students",
      students,
      ...flash,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/students/:id/deactivate",
  handle(
    async (req) => {
      const result = await adminHelper.setStudentActive(req.params.id, false);
      if (result.ok) {
        result.message = "Student deactivated.";
      }
      return result;
    },
    "/admin/students"
  )
);

router.post(
  "/students/:id/activate",
  handle(
    async (req) => {
      const result = await adminHelper.setStudentActive(req.params.id, true);
      if (result.ok) {
        result.message = "Student activated.";
      }
      return result;
    },
    "/admin/students"
  )
);

router.get("/content", async (req, res, next) => {
  try {
    const [doubts, answers] = await Promise.all([
      adminHelper.listDoubts(),
      adminHelper.listAnswers(),
    ]);
    const flash = takeFlash(req);
    res.render("admin/content", {
      nav: "content",
      doubts,
      answers,
      ...flash,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/doubts/:id/delete",
  handle(
    async (req) => {
      const result = await adminHelper.deleteDoubt(req.params.id);
      if (result.ok) {
        result.message = "Doubt deleted.";
      }
      return result;
    },
    "/admin/content"
  )
);

router.post(
  "/answers/:id/delete",
  handle(
    async (req) => {
      const result = await adminHelper.deleteAnswer(req.params.id);
      if (result.ok) {
        result.message = "Answer deleted.";
      }
      return result;
    },
    "/admin/content"
  )
);

module.exports = router;
