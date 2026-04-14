const db = require("../config/db");
const { logActivity } = require("../utils/activityLog");

exports.getMe = (req, res) => {
    const sql = "SELECT id, name, email, program, year, role, created_at AS createdAt FROM users WHERE id = ?";
    db.query(sql, [req.userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(rows[0]);
    });
};

exports.updateMe = (req, res) => {
    const { name, program, year } = req.body;
    if (!name || !program || !year) {
        return res.status(400).json({ message: "name, program, and year are required" });
    }
    const sql = "UPDATE users SET name = ?, program = ?, year = ? WHERE id = ?";
    db.query(sql, [String(name).trim(), String(program).trim(), String(year).trim(), req.userId], (err) => {
        if (err) return res.status(500).send(err);
        logActivity({
            actorUserId: req.userId,
            action: "user.profile_update",
            entityType: "user",
            entityId: req.userId,
            summary: "Profile name/program/year updated",
        });
        exports.getMe(req, res);
    });
};
