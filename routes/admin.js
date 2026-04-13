const router = require("express").Router();
const adminOnly = require("../middleware/adminOnly");
const adminController = require("../controllers/adminController");

router.get("/stats", adminOnly, adminController.getStats);
router.get("/activity", adminOnly, adminController.getActivity);

module.exports = router;
