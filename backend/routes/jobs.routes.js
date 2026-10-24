const router = require("express").Router();
const { getAllJobs, getJobById, createJob, deleteJob } = require("../controllers/jobs.controller");
const { verifyToken, requireAdmin } = require("../middleware/auth.middleware");

router.get("/", getAllJobs);
router.get("/:id", getJobById);
router.post("/", verifyToken, requireAdmin, createJob);
router.delete("/:id", verifyToken, requireAdmin, deleteJob);

module.exports = router;
