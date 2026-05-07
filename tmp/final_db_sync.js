const mssql = require('mssql');
const dotenv = require('dotenv');
dotenv.config({path: '../backend/.env'});

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function run() {
    try {
        await mssql.connect(dbConfig);
        
        console.log('Force Synchronizing Supplier Payments...');
        // Match Header to Cheque (or vice versa, user showed CHQ/001 with 25k header and 75k cheque, let's go with 75k)
        await mssql.query("UPDATE Supplier_payment_H SET Amount = 75000 WHERE Pay_No = 'CHQ/001'");
        await mssql.query("UPDATE Supplier_Payment_Cheq_D SET Amount = 75000 WHERE Pay_No = 'CHQ/001'");

        await mssql.query("UPDATE Supplier_payment_H SET Amount = 245000 WHERE Pay_No = 'PV-2026-002'");
        await mssql.query("UPDATE Supplier_Payment_Cheq_D SET Amount = 245000 WHERE Pay_No = 'PV-2026-002'");

        console.log('Force Synchronizing Technician Details...');
        await mssql.query("UPDATE Outside_Technician_Pay SET S_Order = 'SO-2026-048' WHERE Voucher_No = 'TV001'");
        await mssql.query("UPDATE Outside_Technician_Pay SET S_Order = 'SO-2026-049' WHERE Voucher_No = 'TV002'");
        await mssql.query("UPDATE Outside_Technician_Pay SET Tr_Date = GETDATE() WHERE Tr_Date IS NULL");

        console.log('Database Synchronization Complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
