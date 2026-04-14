const db = require("../config/db");

/**
 * Fire-and-forget audit row for administrator monitoring (PDF: system administrator).
 */
function logActivity({ actorUserId, action, entityType, entityId, summary }) {
    const sql = `INSERT INTO system_activity_log (actor_user_id, action, entity_type, entity_id, summary)
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [
        actorUserId == null || actorUserId === undefined ? null : actorUserId,
        String(action || "unknown").slice(0, 120),
        entityType == null ? null : String(entityType).slice(0, 50),
        entityId == null || Number.isNaN(Number(entityId)) ? null : Number(entityId),
        summary == null ? null : String(summary).slice(0, 500),
    ];
    db.query(sql, params, () => {});
}

module.exports = { logActivity };
