const router = require("express").Router();
const {
  createApplication,
  listApplications,
  updateApplicationStatus,
  deleteApplication,
} = require("../controllers/applications.controller");
const { verifyToken, requireAdmin } = require("../middleware/auth.middleware");

router.post("/", createApplication);
router.get("/", verifyToken, requireAdmin, listApplications);
router.patch("/:id/status", verifyToken, requireAdmin, updateApplicationStatus);
router.delete("/:id", verifyToken, requireAdmin, deleteApplication);

module.exports = router;
