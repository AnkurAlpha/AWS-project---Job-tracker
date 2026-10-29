const { Pool } = require("pg")
const { databaseConfig } = require("./config.cjs");

const pool = new Pool(databaseConfig());


module.exports = pool;
