const { Pool } = require('pg');
const config = require('../config/environment');

const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};