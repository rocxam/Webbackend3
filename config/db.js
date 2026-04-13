require("dotenv").config();
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.log("❌ DB Error:", err);
    } else {
        console.log("✅ MySQL Connected");
        // Ensure auth table exists so login/register work on fresh databases.
        const createUsersTableSql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                program VARCHAR(100) NOT NULL,
                year VARCHAR(20) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'student',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        db.query(createUsersTableSql, (tableErr) => {
            if (tableErr) {
                console.log("❌ Users table init error:", tableErr);
                return;
            }
            console.log("✅ Users table ready");

            db.query(
                "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'",
                (alterErr) => {
                    if (alterErr && alterErr.code !== "ER_DUP_FIELDNAME") {
                        console.log("⚠️ users.role migration:", alterErr.message);
                    }

                    const createStudyGroupsSql = `
                CREATE TABLE IF NOT EXISTS study_groups (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    course_code VARCHAR(50) NOT NULL,
                    faculty VARCHAR(150) NOT NULL,
                    description TEXT,
                    meeting_location VARCHAR(255) NOT NULL,
                    leader_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_study_groups_leader FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `;

            db.query(createStudyGroupsSql, (gErr) => {
                if (gErr) {
                    console.log("❌ study_groups init error:", gErr);
                    return;
                }
                console.log("✅ study_groups table ready");

                const createMembersSql = `
                    CREATE TABLE IF NOT EXISTS group_members (
                        group_id INT NOT NULL,
                        user_id INT NOT NULL,
                        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (group_id, user_id),
                        CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
                        CONSTRAINT fk_gm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                `;

                db.query(createMembersSql, (mErr) => {
                    if (mErr) {
                        console.log("❌ group_members init error:", mErr);
                        return;
                    }
                    console.log("✅ group_members table ready");

                    const createSessionsSql = `
                        CREATE TABLE IF NOT EXISTS study_sessions (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            group_id INT NOT NULL,
                            session_date DATE NOT NULL,
                            session_time TIME NOT NULL,
                            location VARCHAR(255) NOT NULL,
                            description VARCHAR(500) NOT NULL DEFAULT '',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_sessions_group FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    `;

                    db.query(createSessionsSql, (sErr) => {
                        if (sErr) {
                            console.log("❌ study_sessions init error:", sErr);
                            return;
                        }
                        console.log("✅ study_sessions table ready");

                        const createPostsSql = `
                            CREATE TABLE IF NOT EXISTS group_posts (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                group_id INT NOT NULL,
                                user_id INT NOT NULL,
                                body VARCHAR(2000) NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                CONSTRAINT fk_gp_group FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
                                CONSTRAINT fk_gp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                        `;

                        db.query(createPostsSql, (pErr) => {
                            if (pErr) {
                                console.log("❌ group_posts init error:", pErr);
                                return;
                            }
                            console.log("✅ group_posts table ready");

                            const createJoinRequestsSql = `
                                CREATE TABLE IF NOT EXISTS group_join_requests (
                                    id INT AUTO_INCREMENT PRIMARY KEY,
                                    group_id INT NOT NULL,
                                    user_id INT NOT NULL,
                                    kind VARCHAR(20) NOT NULL DEFAULT 'apply',
                                    invited_by INT NULL,
                                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    CONSTRAINT fk_gjr_group FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
                                    CONSTRAINT fk_gjr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                                    CONSTRAINT fk_gjr_inviter FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
                                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                            `;

                            db.query(createJoinRequestsSql, (jrErr) => {
                                if (jrErr) {
                                    console.log("❌ group_join_requests init error:", jrErr);
                                    return;
                                }
                                console.log("✅ group_join_requests table ready");

                                const createActivitySql = `
                                    CREATE TABLE IF NOT EXISTS system_activity_log (
                                        id INT AUTO_INCREMENT PRIMARY KEY,
                                        occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                        actor_user_id INT NULL,
                                        action VARCHAR(120) NOT NULL,
                                        entity_type VARCHAR(50) NULL,
                                        entity_id INT NULL,
                                        summary VARCHAR(500) NULL,
                                        CONSTRAINT fk_sal_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
                                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                                `;

                                db.query(createActivitySql, (alErr) => {
                                    if (alErr) {
                                        console.log("❌ system_activity_log init error:", alErr);
                                    } else {
                                        console.log("✅ system_activity_log table ready");
                                    }
                                });
                            });
                        });
                    });
                });
            });
                });
        });
    }
});

module.exports = db;
