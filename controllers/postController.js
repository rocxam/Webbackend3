const db = require("../config/db");
const { logActivity } = require("../utils/activityLog");

function requireMembership(userId, groupId, cb) {
    const sql = "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1";
    db.query(sql, [groupId, userId], (err, rows) => {
        if (err) return cb(err);
        if (rows.length === 0) return cb(null, false);
        cb(null, true);
    });
}

exports.listPosts = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    requireMembership(req.userId, groupId, (err, ok) => {
        if (err) return res.status(500).send(err);
        if (!ok) return res.status(403).json({ message: "You must be a group member to view posts" });

        const sql = `
            SELECT p.id,
                   p.body,
                   p.created_at AS createdAt,
                   u.id AS userId,
                   u.name AS authorName
            FROM group_posts p
            INNER JOIN users u ON u.id = p.user_id
            WHERE p.group_id = ?
            ORDER BY p.created_at DESC
            LIMIT 100
        `;
        db.query(sql, [groupId], (e2, rows) => {
            if (e2) return res.status(500).send(e2);
            res.json(rows);
        });
    });
};

exports.createPost = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const body = (req.body.body || "").trim();
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });
    if (!body) return res.status(400).json({ message: "body is required" });

    requireMembership(req.userId, groupId, (err, ok) => {
        if (err) return res.status(500).send(err);
        if (!ok) return res.status(403).json({ message: "You must be a group member to post" });

        const sql = "INSERT INTO group_posts (group_id, user_id, body) VALUES (?, ?, ?)";
        db.query(sql, [groupId, req.userId, body], (e2, result) => {
            if (e2) return res.status(500).send(e2);
            logActivity({
                actorUserId: req.userId,
                action: "post.created",
                entityType: "group_post",
                entityId: result.insertId,
                summary: `Group ${groupId}`,
            });
            res.status(201).json({ id: result.insertId, message: "Post created" });
        });
    });
};
