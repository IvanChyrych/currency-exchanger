


const express = require('express');
const mysql2 = require('mysql2/promise');
const session = require('express-session');

const confirmExchangePage = require('./pages/confirmExchangePage')
const currencyPage = require('./pages/currencyPage')
const exchangeHistoryPage = require('./pages/exchangeHistoryPage')
const exchangePage = require('./pages/exchangePage')
const previewExchangePage = require('./pages/previewExchangePage')

const FileStore = require('session-file-store')(session);

const baseHTML = (title, content) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f0f2f5;
                margin: 0;
                padding: 0;
            }
            .container {
                width: 80%;
                margin: 20px auto;
                background: #fff;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            h1 {
                text-align: center;
                color: #333;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            th, td {
                padding: 12px 15px;
                border: 1px solid #ddd;
                text-align: left;
            }
            th {
                background-color: #f4f4f4;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            button {
                padding: 10px 15px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            .buy-button {
                background-color: #28a745;
                color: #fff;
            }
            .buy-button:hover {
                background-color: #218838;
            }
            .details-button {
                background-color: #007bff;
                color: #fff;
            }
            .details-button:hover {
                background-color: #0056b3;
            }
            form {
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-top: 20px;
            }
            label {
                margin: 10px 0;
            }
            input[type="text"], input[type="submit"] {
                padding: 10px;
                margin: 5px 0;
                width: 300px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
            input[type="submit"] {
                background-color: #007bff;
                color: #fff;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            input[type="submit"]:hover {
                background-color: #0056b3;
            }
        </style>
    </head>
    <body>
        <div class="container">
            ${content}
        </div>
    </body>
    </html>
`;

const pool = mysql2.createPool({
    host: 'localhost',
    user: 'root',
    database: 'tickets',
    password: '',
});

const app = express();

app.use(express.urlencoded({ extended: true }));

const fileStoreOptions = {
    path: './sessions',
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
};

app.use(session(fileStoreOptions));

function getUserId() {
    const userId = req.session.userId;
    return userId;
}

function requireLogin(req, res, next) {
    console.log(req.session);
    console.log(req.session.userId);
    if (req.session && req.session.userId) {
        next();
    } else {

        res.redirect('/login');
    }
}

async function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }

    try {
        const [roles] = await pool.query('SELECT * FROM roles WHERE user_id = ? AND role = ?', [req.session.userId, 'admin']);
        if (roles.length > 0) {
            next();
        } else {
            res.status(403).send('Access denied. Admins only.');
        }
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).send('Internal Server Error');
    }
}

app.get('/login', function (req, res) {
    const errorMessage = req.query.error ? "Invalid email or password" : "";
    res.send(`<!DOCTYPE html>
    <html>
        <head>
            <title>HTML Login Form</title>
            <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
        </head>
        <body>
            <div class="main">
                <h3>Enter your login credentials</h3>
                <p style="color: red">${errorMessage}</p>
                <form action="/login" method="POST">
                    <label for="first">
                        email:
                    </label>
                    <input type="text" 
                        id="first"
                        name="email" 
                        placeholder="Enter your email" required>

                    <label for="password">
                        Password:
                    </label>
                    <input type="password"
                        id="password" 
                        name="password" 
                        placeholder="Enter your Password" required>

                    <div class="wrap">
                        <button type="submit">
                            Submit
                        </button>
                    </div>
                </form>
                <p>Not registered? 
                    <a href="/register" 
                    style="text-decoration: none;">
                        Create an account
                    </a>
                </p>
            </div>
        </body>
    </html>`);
});

app.post('/login', async function (req, res) {
    const { email, password } = req.body;

    try {
        // Проверка наличия данных пользователя в базе данных
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        if (rows.length > 0) {
            const userId = rows[0].id;
            const [admins] = await pool.query('SELECT * FROM roles WHERE user_id = ? AND role = ?', [userId, 'admin']);
            req.session.userId = userId;
            console.log(req.session);
            console.log(req.session.userId);
            if (admins.length > 0) {
                res.redirect('/admin/currency');
            } else {
                res.redirect('/user/exchange');
            }
        } else {
            // Если логин или пароль неверны, перенаправляем обратно на страницу входа с сообщением об ошибке
            res.redirect('/login?error=true');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/register', function (req, res) {
    const errorMessage = req.query.error ? "User already exists or invalid input" : "";
    res.send(`<!DOCTYPE html>
    <html>
        <head>
            <title>HTML Registration Form</title>
            <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
        </head>
        <body>
            <div class="main">
                <h3>Create your account</h3>
                <p style="color: red">${errorMessage}</p>
                <form action="/register" method="POST">
                    <label for="email">
                        Email:
                    </label>
                    <input type="text" 
                        id="email"
                        name="email" 
                        placeholder="Enter your email" required>

                    <label for="password">
                        Password:
                    </label>
                    <input type="password"
                        id="password" 
                        name="password" 
                        placeholder="Enter your Password" required>

                    <div class="wrap">
                        <button type="submit">
                            Submit
                        </button>
                    </div>
                </form>
                <p>Already registered? 
                    <a href="/login" 
                    style="text-decoration: none;">
                        Login here
                    </a>
                </p>
            </div>
        </body>
    </html>`);
});

app.post('/register', async function (req, res) {
    const { email, password, phone } = req.body;

    try {
        // Проверка наличия пользователя с таким же email в базе данных
        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.redirect('/register?error=true');
        }

        // Создание нового пользователя в базе данных
        await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);

        // Перенаправление на страницу логина после успешной регистрации
        res.redirect('/login');
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(3000, function () {
    console.log('server started!');
});

confirmExchangePage(app, pool, requireLogin)
currencyPage(app, pool, requireAdmin, baseHTML)
exchangeHistoryPage(app, pool, requireAdmin, baseHTML)
exchangePage(app, requireLogin, pool, baseHTML)
previewExchangePage(app, requireLogin, baseHTML, pool)




   










