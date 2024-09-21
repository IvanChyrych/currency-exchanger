const express = require('express');
const mysql2 = require('mysql2/promise');

const pool = mysql2.createPool({
	host: 'localhost',
	user: 'root',
	database: 'tickets',
	password: '',
});

app.use(express.urlencoded({ extended: true }));

const app = express();

app.get('/login', function(req, res) {
		res.send(`<!DOCTYPE html>
<html>
<head>
    <title>HTML Login Form</title>
    <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
</head>
<body>
    <div class="main">
        <h3>Enter your login credentials</h3>
        <form action="">
            <label for="first">
                  Username:
              </label>
            <input type="text" 
                   id="first"
                   name="first" 
                   placeholder="Enter your Username" required>

            <label for="password">
                  Password:
              </label>
            <input type="password"
                   id="password" 
                   name="password" 
                   placeholder="Enter your Password" required>

            <div class="wrap">
                <button type="submit"
                        onclick="solve()">
                    Submit
                </button>
            </div>
        </form>
        <p>Not registered? 
              <a href="#" 
               style="text-decoration: none;">
                Create an account
            </a>
        </p>
    </div>
</body>
</html>`);
	});
	
	app.post('/login', csrfProtection, async function(req, res) {
    const { username, password } = req.body;
    
    // Проверка наличия данных пользователя в базе данных
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (rows.length > 0) {
        res.send('Login successful');
    } else {
        res.status(401).send('Invalid username or password');
    }
});

app.listen(3000, function() {
	console.log('server started!');
});