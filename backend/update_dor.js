const mssql = require('mssql');
require('dotenv').config({ path: 'backend/.env' });

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
        console.log("Connected to DB");

        try {
            await mssql.query(`ALTER TABLE Supplier_payment_H ADD DOR DATETIME;`);
            console.log("Added DOR column to Supplier_payment_H");
        } catch (e) {
            console.log("Column DOR already exists or error: " + e.message);
        }

        const res = await mssql.query(`
            UPDATE h
            SET h.DOR = c.DOR
            FROM Supplier_payment_H h
            INNER JOIN (
                SELECT Pay_No, MAX(DOR) as DOR 
                FROM Supplier_Payment_Cheq_D 
                GROUP BY Pay_No
            ) c ON h.Pay_No = c.Pay_No
        `);
        console.log("Synced DOR: " + res.rowsAffected + " rows updated.");
    } catch (err) {
        console.error(err);
    } finally {
        mssql.close();
    }
}

run();
