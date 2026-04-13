const router = require("express").Router();
const auth = require("../middleware/auth");
const groupController = require("../controllers/groupController");
const postController = require("../controllers/postController");

router.get("/search", auth, groupController.searchGroups);
router.get("/me", auth, groupController.getMyGroups);
router.get("/recent", auth, groupController.getRecentGroups);
router.post("/", auth, groupController.createGroup);

router.get("/:id/join-requests", auth, groupController.listJoinRequests);
router.post("/:id/join-requests/:requestId/accept", auth, groupController.acceptJoinRequest);
router.post("/:id/join-requests/:requestId/reject", auth, groupController.rejectJoinRequest);
router.post("/:id/request-join", auth, groupController.requestJoin);
router.post("/:id/invites", auth, groupController.inviteMember);
router.post("/:id/accept-invitation", auth, groupController.acceptInvitation);
router.post("/:id/decline-invitation", auth, groupController.declineInvitation);

router.get("/:id/posts", auth, postController.listPosts);
router.post("/:id/posts", auth, postController.createPost);
router.get("/:id/members", auth, groupController.getMembers);
router.delete("/:id/members/:userId", auth, groupController.removeMember);
router.put("/:id", auth, groupController.updateGroup);
router.get("/:id", auth, groupController.getGroupById);
router.post("/:id/join", auth, groupController.joinGroup);

module.exports = router;
