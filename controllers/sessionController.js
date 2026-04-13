const db = require("../config/db");
const { logActivity } = require("../utils/activityLog");

exports.getUpcomingForUser = (req, res) => {
    const userId = req.userId;
    const sql = `
        SELECT s.id,
               COALESCE(NULLIF(TRIM(s.description), ''), 'Study session') AS title,
               g.name AS \`group\`,
               DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date,
               DATE_FORMAT(s.session_time, '%H:%i') AS time,
               s.location
        FROM study_sessions s
        INNER JOIN study_groups g ON g.id = s.group_id
        INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
        WHERE s.session_date >= CURDATE()
        ORDER BY s.session_date ASC, s.session_time ASC
        LIMIT 50
    `;
    db.query(sql, [userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows);
    });
};

exports.getSessionsForGroup = (req, res) => {
    const groupId = parseInt(req.params.groupId, 10);
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const mem = "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?";
    db.query(mem, [groupId, req.userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(403).json({ message: "You must be a group member to view sessions" });
        }

        const sql = `
            SELECT s.id,
                   COALESCE(NULLIF(TRIM(s.description), ''), 'Study session') AS title,
                   DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date,
                   DATE_FORMAT(s.session_time, '%H:%i') AS time,
                   s.location
            FROM study_sessions s
            WHERE s.group_id = ?
            ORDER BY s.session_date ASC, s.session_time ASC
        `;
        db.query(sql, [groupId], (e2, sessions) => {
            if (e2) return res.status(500).send(e2);
            res.json(sessions);
        });
    });
};

exports.createSession = (req, res) => {
    const groupId = parseInt(req.params.groupId, 10);
    const { sessionDate, sessionTime, location, description } = req.body;
    const leaderId = req.userId;

    if (Number.isNaN(groupId) || !sessionDate || !sessionTime || !location) {
        return res.status(400).json({ message: "sessionDate, sessionTime, and location are required" });
    }

    const desc = (description || "").trim();
    const checkLeader = "SELECT id FROM study_groups WHERE id = ? AND leader_id = ?";
    db.query(checkLeader, [groupId, leaderId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(403).json({ message: "Only the group leader can schedule sessions" });
        }

        const insertSql = `INSERT INTO study_sessions (group_id, session_date, session_time, location, description)
                           VALUES (?, ?, ?, ?, ?)`;
        db.query(insertSql, [groupId, sessionDate, sessionTime, location.trim(), desc], (e2, result) => {
            if (e2) return res.status(500).send(e2);
            logActivity({
                actorUserId: leaderId,
                action: "session.created",
                entityType: "study_session",
                entityId: result.insertId,
                summary: `Group ${groupId} on ${sessionDate}`,
            });
            res.status(201).json({ id: result.insertId, message: "Study session created" });
        });
    });
};
