require("dotenv").config();
const pool = require("./db/pool");

async function checks(req, res) {
    try {
        const result = await pool.query("Select NOW() as now ");
        const text = "DB connected : " + result.rows[0].now;
        return text;
    } catch (err) {
        return err.message;
    }
}

(async() => {
    const msg = await checks() ;
    console.log(msg) ;
})() ;


// app.get("/checkdb",checks) ; // just example
// checks().then(console.log)
