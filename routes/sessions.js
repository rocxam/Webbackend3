const router = require("express").Router();
const auth = require("../middleware/auth");
const sessionController = require("../controllers/sessionController");

router.get("/upcoming", auth, sessionController.getUpcomingForUser);
router.get("/group/:groupId", auth, sessionController.getSessionsForGroup);
router.post("/group/:groupId", auth, sessionController.createSession);

module.exports = router;
