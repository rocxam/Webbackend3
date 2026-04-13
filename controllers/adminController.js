const db = require("../config/db");

exports.getActivity = (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.min(Math.max(parseInt(req.query.offset, 10) || 0, 0), 50000);
    const actionFilter = (req.query.action || "").trim().replace(/[%_\\]/g, "");

    let whereClause = "";
    const params = [];
    if (actionFilter) {
        whereClause = "WHERE l.action LIKE ?";
        params.push(`%${actionFilter}%`);
    }

    const countSql = `SELECT COUNT(*) AS total FROM system_activity_log l ${whereClause}`;
    db.query(countSql, params, (err, countRows) => {
        if (err) return res.status(500).send(err);
        const total = countRows[0].total;

        const listSql = `
            SELECT l.id,
                   l.occurred_at AS occurredAt,
                   l.action,
                   l.entity_type AS entityType,
                   l.entity_id AS entityId,
                   l.summary,
                   u.name AS actorName,
                   u.email AS actorEmail
            FROM system_activity_log l
            LEFT JOIN users u ON u.id = l.actor_user_id
            ${whereClause}
            ORDER BY l.occurred_at DESC
            LIMIT ? OFFSET ?
        `;
        db.query(listSql, [...params, limit, offset], (e2, rows) => {
            if (e2) return res.status(500).send(e2);
            res.json({ total, items: rows });
        });
    });
};

exports.getStats = (req, res) => {
    const qUsers = "SELECT COUNT(*) AS total FROM users";
    const qGroups = "SELECT COUNT(*) AS total FROM study_groups";
    const qCourses = `
        SELECT course_code AS courseCode, COUNT(*) AS groupCount
        FROM study_groups
        GROUP BY course_code
        ORDER BY groupCount DESC
        LIMIT 10
    `;

    db.query(qUsers, (err, uRows) => {
        if (err) return res.status(500).send(err);
        db.query(qGroups, (e2, gRows) => {
            if (e2) return res.status(500).send(e2);
            db.query(qCourses, (e3, cRows) => {
                if (e3) return res.status(500).send(e3);
                res.json({
                    totalUsers: uRows[0].total,
                    totalStudyGroups: gRows[0].total,
                    mostActiveCourses: cRows,
                });
            });
        });
    });
};
