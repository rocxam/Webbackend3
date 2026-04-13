const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logActivity } = require("../utils/activityLog");

// REGISTER
exports.register = (req, res) => {
    const { name, email, password, program, year } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql =
        "INSERT INTO users (name, email, password, program, year, role) VALUES (?, ?, ?, ?, ?, 'student')";

    db.query(sql, [name, normalizedEmail, hashedPassword, program, year], (err, result) => {
        if (err) return res.status(500).send(err);

        const newId = result.insertId;
        logActivity({
            actorUserId: newId,
            action: "user.register",
            entityType: "user",
            entityId: newId,
            summary: `New account: ${normalizedEmail}`,
        });
        res.json({ message: "User registered successfully" });
    });
};

// LOGIN
exports.login = (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
    }

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [normalizedEmail], (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];

        const valid = bcrypt.compareSync(password, user.password);

        if (!valid) {
            return res.status(400).json({ message: "Wrong password" });
        }

        const envAdmin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        const finish = () => {
            const role = user.role || "student";
            logActivity({
                actorUserId: user.id,
                action: "user.login",
                entityType: "user",
                entityId: user.id,
                summary: `Login: ${user.email}`,
            });
            const token = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
            res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    program: user.program,
                    year: user.year,
                    role,
                },
            });
        };

        if (envAdmin && normalizedEmail === envAdmin) {
            db.query("UPDATE users SET role = 'admin' WHERE id = ?", [user.id], () => {
                user.role = "admin";
                logActivity({
                    actorUserId: user.id,
                    action: "user.promoted_admin",
                    entityType: "user",
                    entityId: user.id,
                    summary: "Account matched ADMIN_EMAIL; role set to admin",
                });
                finish();
            });
        } else {
            finish();
        }
    });
};
