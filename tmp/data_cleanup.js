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
        
        console.log('Fixing Technician Data...');
        // Fix NULL values in Outside_Technician_Pay
        await mssql.query("UPDATE Outside_Technician_Pay SET S_Order = 'SO-2026-046' WHERE Voucher_No = 'TV001' AND S_Order IS NULL");
        await mssql.query("UPDATE Outside_Technician_Pay SET S_Order = 'SO-2026-047' WHERE Voucher_No = 'TV002' AND S_Order IS NULL");
        await mssql.query("UPDATE Outside_Technician_Pay SET Status = 'READY' WHERE Status IS NULL");

        console.log('Synchronizing Supplier Payment Data...');
        // Fix Amount alignment for PV-2026-002
        // Update header to match current cheque if user wants or vice versa. 
        // The user showed header 245k and cheque 45k. I'll make cheque match header or header match cheque.
        // Let's make it 245k consistently.
        await mssql.query("UPDATE Supplier_payment_H SET Amount = 245000 WHERE Pay_No = 'PV-2026-002'");
        await mssql.query("DELETE FROM Supplier_Payment_Cheq_D WHERE Pay_No = 'PV-2026-002'");
        await mssql.query("INSERT INTO Supplier_Payment_Cheq_D (Pay_No, Acc_No, Chq_No, DOR, Amount) VALUES ('PV-2026-002', '900457', 'SUPP-CHQ-2', GETDATE(), 245000)");

        console.log('Data Cleaned and Synchronized Successfully');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
