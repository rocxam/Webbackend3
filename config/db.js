require("dotenv").config();
const mysql = require("mysql2");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnection: true, 
    connectionLimit: 10,
    queueLimit: 0
});

const promisepool = pool.promise();

pool.getConnection((err, connection) => {
    if (err) {
        console.log("❌ DB Error:", err);
    } else {
        console.log("✅ MySQL Connected!");
        connection.release();
    }
});

module.exports = promisePool;