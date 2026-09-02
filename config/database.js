const mysql = require("mysql2");

const db = mysql.createPool({
    host: "hostel-management-vishug0708.c.aivencloud.com",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "defaultdb",
    port: 27913,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

console.log("🔗 MySQL Host:", "hostel-management-vishug0708.c.aivencloud.com");
console.log("🔗 MySQL Port:", 27913);
console.log("🔗 MySQL Database:", "defaultdb");
console.log("🔐 MySQL SSL: ENABLED");

db.getConnection()
    .then((connection) => {
        console.log("✅ MySQL Database Connected");
        connection.release();
    })
    .catch((error) => {
        console.error("❌ MySQL Connection Error:", error.message);
    });

module.exports = db;