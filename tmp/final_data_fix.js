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
        await mssql.query('DELETE FROM Supplier_Payment_Cheq_D');
        const q1 = "INSERT INTO Supplier_Payment_Cheq_D (Pay_No, Acc_No, Chq_No, DOR, Amount) VALUES ('CHQ/001', '900456', 'SUPP-CHQ-1', GETDATE(), 75000)";
        const q2 = "INSERT INTO Supplier_Payment_Cheq_D (Pay_No, Acc_No, Chq_No, DOR, Amount) VALUES ('PV-2026-002', '900457', 'SUPP-CHQ-2', GETDATE(), 45000)";
        await mssql.query(q1);
        await mssql.query(q2);
        console.log('Final Data Insertion Successful');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
