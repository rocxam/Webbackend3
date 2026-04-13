const db = require("../config/db");
const { logActivity } = require("../utils/activityLog");

exports.createGroup = (req, res) => {
    const { name, courseCode, faculty, description, meetingLocation } = req.body;
    const leaderId = req.userId;

    if (!name || !courseCode || !meetingLocation) {
        return res.status(400).json({ message: "name, courseCode, and meetingLocation are required" });
    }

    const fac = (faculty || "Computing & Technology").trim();
    const desc = (description || "").trim();
    const sql = `INSERT INTO study_groups (name, course_code, faculty, description, meeting_location, leader_id)
                 VALUES (?, ?, ?, ?, ?, ?)`;

    db.query(
        sql,
        [name.trim(), String(courseCode).trim(), fac, desc, meetingLocation.trim(), leaderId],
        (err, result) => {
            if (err) return res.status(500).send(err);

            const groupId = result.insertId;
            const memberSql = "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)";
            db.query(memberSql, [groupId, leaderId], (e2) => {
                if (e2) return res.status(500).send(e2);
                logActivity({
                    actorUserId: leaderId,
                    action: "group.create",
                    entityType: "group",
                    entityId: groupId,
                    summary: `${name.trim()} (${String(courseCode).trim()})`,
                });
                res.status(201).json({ id: groupId, message: "Study group created" });
            });
        }
    );
};

exports.searchGroups = (req, res) => {
    const q = (req.query.q || req.query.title || "").trim();
    const course = (req.query.course || "").trim();
    const faculty = (req.query.faculty || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 50);

    const conditions = [];
    const params = [];

    if (q) {
        conditions.push("(g.name LIKE ? OR g.course_code LIKE ? OR g.description LIKE ? OR g.faculty LIKE ?)");
        const like = `%${q}%`;
        params.push(like, like, like, like);
    }
    if (course) {
        conditions.push("g.course_code LIKE ?");
        params.push(`%${course}%`);
    }
    if (faculty) {
        conditions.push("g.faculty LIKE ?");
        params.push(`%${faculty}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
        SELECT g.id,
               g.name AS title,
               g.course_code AS course,
               g.faculty,
               g.description,
               g.meeting_location AS location,
               (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members
        FROM study_groups g
        ${where}
        ORDER BY g.created_at DESC
        LIMIT ${limit}
    `;

    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows);
    });
};

exports.getMyGroups = (req, res) => {
    const userId = req.userId;
    const sql = `
        SELECT g.id,
               g.name,
               g.course_code AS courseCode,
               CASE WHEN g.leader_id = ? THEN 'Group leader' ELSE 'Member' END AS role
        FROM study_groups g
        INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
        ORDER BY g.name ASC
    `;
    db.query(sql, [userId, userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows.map((r) => ({ id: r.id, name: r.name, course: r.courseCode, role: r.role })));
    });
};

exports.getRecentGroups = (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const sql = `
        SELECT g.id,
               g.name AS title,
               g.course_code AS course,
               g.faculty,
               g.description,
               g.meeting_location AS location,
               (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members
        FROM study_groups g
        ORDER BY g.created_at DESC
        LIMIT ${limit}
    `;
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows);
    });
};

exports.getGroupById = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const sql = `
        SELECT g.id,
               g.name,
               g.course_code AS courseCode,
               g.faculty,
               g.description,
               g.meeting_location AS meetingLocation,
               g.leader_id AS leaderId,
               g.created_at AS createdAt,
               (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members,
               EXISTS (
                   SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = ?
               ) AS isMember,
               (g.leader_id = ?) AS isLeader,
               EXISTS (
                   SELECT 1 FROM group_join_requests r
                   WHERE r.group_id = g.id AND r.user_id = ? AND r.kind = 'apply' AND r.status = 'pending'
               ) AS hasPendingJoinRequest,
               EXISTS (
                   SELECT 1 FROM group_join_requests r2
                   WHERE r2.group_id = g.id AND r2.user_id = ? AND r2.kind = 'invite' AND r2.status = 'pending'
               ) AS hasPendingInvite
        FROM study_groups g
        WHERE g.id = ?
    `;
    db.query(sql, [req.userId, req.userId, req.userId, req.userId, groupId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) return res.status(404).json({ message: "Group not found" });
        const row = rows[0];
        res.json({
            id: row.id,
            name: row.name,
            courseCode: row.courseCode,
            faculty: row.faculty,
            description: row.description,
            meetingLocation: row.meetingLocation,
            leaderId: row.leaderId,
            createdAt: row.createdAt,
            members: row.members,
            isMember: Boolean(row.isMember),
            isLeader: Boolean(row.isLeader),
            hasPendingJoinRequest: Boolean(row.hasPendingJoinRequest),
            hasPendingInvite: Boolean(row.hasPendingInvite),
        });
    });
};

exports.updateGroup = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const { name, courseCode, faculty, description, meetingLocation } = req.body;

    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });
    if (!name || !courseCode || !meetingLocation) {
        return res.status(400).json({ message: "name, courseCode, and meetingLocation are required" });
    }

    const check = "SELECT id FROM study_groups WHERE id = ? AND leader_id = ?";
    db.query(check, [groupId, req.userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(403).json({ message: "Only the group leader can edit this group" });
        }

        const fac = (faculty || "Computing & Technology").trim();
        const desc = (description || "").trim();
        const sql = `UPDATE study_groups
                     SET name = ?, course_code = ?, faculty = ?, description = ?, meeting_location = ?
                     WHERE id = ?`;
        db.query(
            sql,
            [String(name).trim(), String(courseCode).trim(), fac, desc, String(meetingLocation).trim(), groupId],
            (e2) => {
                if (e2) return res.status(500).send(e2);
                logActivity({
                    actorUserId: req.userId,
                    action: "group.update",
                    entityType: "group",
                    entityId: groupId,
                    summary: String(name).trim(),
                });
                res.json({ message: "Group updated" });
            }
        );
    });
};

exports.getMembers = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const memSql = "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?";
    db.query(memSql, [groupId, req.userId], (err, ok) => {
        if (err) return res.status(500).send(err);
        if (ok.length === 0) {
            return res.status(403).json({ message: "You must be a member to view the member list" });
        }

        const sql = `
            SELECT u.id,
                   u.name,
                   u.email,
                   u.program,
                   u.year,
                   (g.leader_id = u.id) AS isLeader
            FROM group_members gm
            INNER JOIN users u ON u.id = gm.user_id
            INNER JOIN study_groups g ON g.id = gm.group_id
            WHERE gm.group_id = ?
            ORDER BY isLeader DESC, u.name ASC
        `;
        db.query(sql, [groupId], (e2, rows) => {
            if (e2) return res.status(500).send(e2);
            res.json(
                rows.map((r) => ({
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    program: r.program,
                    year: r.year,
                    isLeader: Boolean(r.isLeader),
                }))
            );
        });
    });
};

exports.removeMember = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (Number.isNaN(groupId) || Number.isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid group or user id" });
    }

    const leaderSql = "SELECT leader_id FROM study_groups WHERE id = ? AND leader_id = ?";
    db.query(leaderSql, [groupId, req.userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(403).json({ message: "Only the group leader can remove members" });
        }

        const lid = rows[0].leader_id;
        if (targetUserId === lid) {
            return res.status(400).json({ message: "Cannot remove the group leader from the group" });
        }

        const del = "DELETE FROM group_members WHERE group_id = ? AND user_id = ?";
        db.query(del, [groupId, targetUserId], (e2, result) => {
            if (e2) return res.status(500).send(e2);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Member not found in this group" });
            }
            logActivity({
                actorUserId: req.userId,
                action: "group.member_removed",
                entityType: "group",
                entityId: groupId,
                summary: `Removed member user id ${targetUserId}`,
            });
            res.json({ message: "Member removed" });
        });
    });
};

/** Student asks to join; leader accepts via acceptJoinRequest (PDF: browse, then accept members). */
exports.requestJoin = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.userId;
    if (Number.isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group id" });
    }

    const existsSql = "SELECT id, leader_id FROM study_groups WHERE id = ?";
    db.query(existsSql, [groupId], (err, found) => {
        if (err) return res.status(500).send(err);
        if (found.length === 0) {
            return res.status(404).json({ message: "Group not found" });
        }
        if (found[0].leader_id === userId) {
            return res.status(400).json({ message: "You are already the group leader" });
        }

        const memberSql = "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?";
        db.query(memberSql, [groupId, userId], (e1, mem) => {
            if (e1) return res.status(500).send(e1);
            if (mem.length > 0) {
                return res.status(400).json({ message: "You are already a member of this group" });
            }

            const pendingSql =
                "SELECT id FROM group_join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'";
            db.query(pendingSql, [groupId, userId], (e2, pend) => {
                if (e2) return res.status(500).send(e2);
                if (pend.length > 0) {
                    return res.status(400).json({ message: "You already have a pending request or invitation for this group" });
                }

                const ins =
                    "INSERT INTO group_join_requests (group_id, user_id, kind, invited_by, status) VALUES (?, ?, 'apply', NULL, 'pending')";
                db.query(ins, [groupId, userId], (e3, result) => {
                    if (e3) return res.status(500).send(e3);
                    logActivity({
                        actorUserId: userId,
                        action: "group.join_requested",
                        entityType: "group",
                        entityId: groupId,
                        summary: `Request id ${result.insertId}`,
                    });
                    res.status(201).json({ id: result.insertId, message: "Join request sent. The group leader will review it." });
                });
            });
        });
    });
};

/** Legacy path: same as requestJoin */
exports.joinGroup = exports.requestJoin;

exports.listJoinRequests = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const leaderSql = "SELECT id FROM study_groups WHERE id = ? AND leader_id = ?";
    db.query(leaderSql, [groupId, req.userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(403).json({ message: "Only the group leader can view join requests" });
        }

        const sql = `
            SELECT r.id,
                   r.kind,
                   r.status,
                   r.created_at AS createdAt,
                   r.invited_by AS invitedById,
                   u.id AS userId,
                   u.name,
                   u.email,
                   u.program,
                   u.year,
                   inviter.name AS invitedByName
            FROM group_join_requests r
            INNER JOIN users u ON u.id = r.user_id
            LEFT JOIN users inviter ON inviter.id = r.invited_by
            WHERE r.group_id = ? AND r.status = 'pending'
            ORDER BY r.created_at ASC
        `;
        db.query(sql, [groupId], (e2, list) => {
            if (e2) return res.status(500).send(e2);
            res.json(list);
        });
    });
};

exports.acceptJoinRequest = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const requestId = parseInt(req.params.requestId, 10);
    if (Number.isNaN(groupId) || Number.isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid group or request id" });
    }

    const fetchSql = `
        SELECT r.id, r.user_id AS applicantId, r.kind, r.status
        FROM group_join_requests r
        INNER JOIN study_groups g ON g.id = r.group_id AND g.leader_id = ?
        WHERE r.id = ? AND r.group_id = ? AND r.status = 'pending'
    `;
    db.query(fetchSql, [req.userId, requestId, groupId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Request not found or you are not the leader" });
        }
        const row = rows[0];
        if (row.kind !== "apply") {
            return res.status(400).json({
                message: "This row is an invitation. The invited student must accept it from their account.",
            });
        }

        const addMember = "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)";
        db.query(addMember, [groupId, row.applicantId], (e2) => {
            if (e2 && e2.code !== "ER_DUP_ENTRY") {
                return res.status(500).send(e2);
            }
            db.query("UPDATE group_join_requests SET status = 'accepted' WHERE id = ?", [requestId], (e3) => {
                if (e3) return res.status(500).send(e3);
                logActivity({
                    actorUserId: req.userId,
                    action: "group.join_accepted",
                    entityType: "user",
                    entityId: row.applicantId,
                    summary: `Group ${groupId}, request ${requestId}`,
                });
                res.json({ message: "Member accepted into the group" });
            });
        });
    });
};

exports.rejectJoinRequest = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const requestId = parseInt(req.params.requestId, 10);
    if (Number.isNaN(groupId) || Number.isNaN(requestId)) {
        return res.status(400).json({ message: "Invalid group or request id" });
    }

    const sql = `
        UPDATE group_join_requests r
        INNER JOIN study_groups g ON g.id = r.group_id AND g.leader_id = ?
        SET r.status = 'rejected'
        WHERE r.id = ? AND r.group_id = ? AND r.status = 'pending'
    `;
    db.query(sql, [req.userId, requestId, groupId], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Request not found or already processed" });
        }
        logActivity({
            actorUserId: req.userId,
            action: "group.join_rejected",
            entityType: "group",
            entityId: groupId,
            summary: `Request ${requestId} rejected or invite cancelled`,
        });
        res.json({ message: "Request rejected" });
    });
};

exports.inviteMember = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const email = (req.body.email || "").trim().toLowerCase();
    if (Number.isNaN(groupId) || !email) {
        return res.status(400).json({ message: "Valid email is required" });
    }

    const leaderSql = "SELECT id, leader_id FROM study_groups WHERE id = ? AND leader_id = ?";
    db.query(leaderSql, [groupId, req.userId], (err, gRows) => {
        if (err) return res.status(500).send(err);
        if (gRows.length === 0) {
            return res.status(403).json({ message: "Only the group leader can send invitations" });
        }

        db.query("SELECT id FROM users WHERE email = ?", [email], (e1, users) => {
            if (e1) return res.status(500).send(e1);
            if (users.length === 0) {
                return res.status(404).json({ message: "No user registered with that email" });
            }
            const inviteeId = users[0].id;
            if (inviteeId === req.userId) {
                return res.status(400).json({ message: "You cannot invite yourself" });
            }

            db.query("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", [groupId, inviteeId], (e2, mem) => {
                if (e2) return res.status(500).send(e2);
                if (mem.length > 0) {
                    return res.status(400).json({ message: "That student is already a member" });
                }

                const pend = "SELECT id FROM group_join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'";
                db.query(pend, [groupId, inviteeId], (e3, pRows) => {
                    if (e3) return res.status(500).send(e3);
                    if (pRows.length > 0) {
                        return res.status(400).json({ message: "This student already has a pending request or invitation" });
                    }

                    const ins =
                        "INSERT INTO group_join_requests (group_id, user_id, kind, invited_by, status) VALUES (?, ?, 'invite', ?, 'pending')";
                    db.query(ins, [groupId, inviteeId, req.userId], (e4, result) => {
                        if (e4) return res.status(500).send(e4);
                        logActivity({
                            actorUserId: req.userId,
                            action: "group.invite_sent",
                            entityType: "group",
                            entityId: groupId,
                            summary: `To ${email} (user ${inviteeId})`,
                        });
                        res.status(201).json({ id: result.insertId, message: "Invitation sent" });
                    });
                });
            });
        });
    });
};

exports.acceptInvitation = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.userId;
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const sel =
        "SELECT id FROM group_join_requests WHERE group_id = ? AND user_id = ? AND kind = 'invite' AND status = 'pending' LIMIT 1";
    db.query(sel, [groupId, userId], (err, rows) => {
        if (err) return res.status(500).send(err);
        if (rows.length === 0) {
            return res.status(404).json({ message: "No pending invitation found for you in this group" });
        }
        const requestId = rows[0].id;

        const addMember = "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)";
        db.query(addMember, [groupId, userId], (e2) => {
            if (e2 && e2.code !== "ER_DUP_ENTRY") {
                return res.status(500).send(e2);
            }
            db.query("UPDATE group_join_requests SET status = 'accepted' WHERE id = ?", [requestId], (e3) => {
                if (e3) return res.status(500).send(e3);
                logActivity({
                    actorUserId: userId,
                    action: "group.invite_accepted",
                    entityType: "group",
                    entityId: groupId,
                    summary: `Request ${requestId}`,
                });
                res.json({ message: "You have joined the group" });
            });
        });
    });
};

exports.declineInvitation = (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.userId;
    if (Number.isNaN(groupId)) return res.status(400).json({ message: "Invalid group id" });

    const sql =
        "UPDATE group_join_requests SET status = 'rejected' WHERE group_id = ? AND user_id = ? AND kind = 'invite' AND status = 'pending'";
    db.query(sql, [groupId, userId], (err, result) => {
        if (err) return res.status(500).send(err);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "No pending invitation to decline" });
        }
        logActivity({
            actorUserId: userId,
            action: "group.invite_declined",
            entityType: "group",
            entityId: groupId,
            summary: "Student declined invitation",
        });
        res.json({ message: "Invitation declined" });
    });
};
