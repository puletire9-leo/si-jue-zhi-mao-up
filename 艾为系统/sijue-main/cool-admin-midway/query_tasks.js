const mysql = require('mysql2/promise');

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '478168',
      database: 'listing_optimiser'
    });
    
    const [rows] = await connection.execute("SELECT id, name, cron, service, status, type FROM task_info");
    console.log(JSON.stringify(rows, null, 2));
    
    await connection.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();