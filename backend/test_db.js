const mssql = require('mssql');
require('dotenv').config({ path: '.env' });

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: { encrypt: true, trustServerCertificate: true }
};

async function run() {
    try {
        await mssql.connect(dbConfig);
        console.log("Checking OutStanding table...");

        const result = await mssql.query("SELECT * FROM OutStanding");
        console.log("Rows count:", result.recordset.length);
        if (result.recordset.length > 0) {
            console.log("First row keys:", Object.keys(result.recordset[0]));
            console.log("First row data:", result.recordset[0]);
        } else {
            console.log("TABLE IS EMPTY according to mssql library.");
        }
    } catch (err) {
        console.error("QUERY ERROR:", err.message);
    } finally {
        mssql.close();
    }
}

run();
