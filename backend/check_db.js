const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: { encrypt: true, trustServerCertificate: true }
};

sql.connect(config).then(pool => {
  return pool.request().query('SELECT TOP 1 * FROM Pre_Costing')
    .then(res => {
      console.log('Pre_Costing:', res.recordset.length > 0 ? Object.keys(res.recordset[0]) : 'Empty');
      return pool.request().query('SELECT TOP 1 * FROM Quatation');
    })
    .then(res => {
      console.log('Quatation:', res.recordset.length > 0 ? Object.keys(res.recordset[0]) : 'Empty');
      process.exit(0);
    });
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
