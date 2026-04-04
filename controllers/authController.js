const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
exports.register = (req, res) => {
    const { name, email, password, program, year } = req.body;

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = "INSERT INTO users (name, email, password, program, year) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [name, email, hashedPassword, program, year], (err, result) => {
        if (err) return res.status(500).send(err);

        res.json({ message: "User registered successfully" });
    });
};

// LOGIN
exports.login = (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];

        const valid = bcrypt.compareSync(password, user.password);

        if (!valid) {
            return res.status(400).json({ message: "Wrong password" });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ token });
    });
};