const router = require("express").Router();
const auth = require("../middleware/auth");
const userController = require("../controllers/userController");

router.get("/me", auth, userController.getMe);
router.patch("/me", auth, userController.updateMe);

module.exports = router;
