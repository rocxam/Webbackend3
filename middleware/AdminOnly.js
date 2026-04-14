const auth = require("./auth");
const db = require("../config/db");

module.exports = function adminOnly(req, res, next) {
    auth(req, res, () => {
        db.query("SELECT role FROM users WHERE id = ?", [req.userId], (err, rows) => {
            if (err) return res.status(500).send(err);
            if (!rows[0] || rows[0].role !== "admin") {
                return res.status(403).json({ message: "Admin access required" });
            }
            next();
        });
    });
}
