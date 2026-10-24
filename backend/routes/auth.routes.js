const router = require("express").Router();
const { login, signup, me } = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/auth.middleware");

router.post("/login", login);
router.post("/signup", signup);
router.get("/me", verifyToken, me);

module.exports = router;
