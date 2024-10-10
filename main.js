const express = require('express');
const mysql2 = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');


const adminPage = require('./pages/adminPage')
const adminHistoryPage = require('./pages/adminHistoryPage')
const userPage = require('./pages/userPage');
const userSessionPage = require('./pages/userSessionPage');

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
            .history-button{
                margin-top: 10px;
            }
            .login_button{
                text-align: right;
                background-color: red;
                justify-content: center;
                color:white
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
        <button onclick="location.href='/login/'" class="login_button">Сменить пользователя</button>
            ${content}
        </div>
    </body>
    </html>
`;

const pool = mysql2.createPool({
    host: 'localhost',
    user: 'root',
    database: 'exchanger',
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
    const errorMessage = req.query.error ? "Неверный email или пароль" : "";
    const content = `<!DOCTYPE html>
    <html>
        <head>
            <title>HTML Login Form</title>
            <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
        </head>
        <body>
            <div class="main">
                <h3>Введите свой логин</h3>
                <p style="color: red">${errorMessage}</p>
                <form action="/login" method="POST">
                    <label for="first">
                        Электронная почта:
                    </label>
                    <input type="text" 
                        id="first"
                        name="email" 
                        placeholder="Enter your email" required>

                    <label for="password">
                        Пароль:
                    </label>
                    <input type="password"
                        id="password" 
                        name="password" 
                        placeholder="Enter your Password" required>

                    <div class="wrap">
                        <button type="submit" class="history-button">
                            Войти
                        </button>
                    </div>
                </form>
                <p>Нет аккаунта? 
                    <a href="/register" 
                    style="text-decoration: none;">
                        Создать аккаунт
                    </a>
                </p>
            </div>
        </body>
    </html>`
    res.send(baseHTML('Введите логин', content));
});





app.post('/login', async function (req, res) {
    const { email, password } = req.body;

    try {
        // Поиск пользователя по email
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length > 0) {
            // Сравнение введённого пароля с хэшированным
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                const userId = user.id;
                req.session.userId = userId;

                // Проверка роли администратора
                const [admins] = await pool.query('SELECT * FROM roles WHERE user_id = ? AND role = ?', [userId, 'admin']);

                if (admins.length > 0) {
                    res.redirect('/admin/currency');
                } else {
                    res.redirect('/user/exchange');
                }
            } else {
                // Неверный пароль
                res.redirect('/login?error=true');
            }
        } else {
            // Пользователь не найден
            res.redirect('/login?error=true');
        }

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});








app.get('/register', function (req, res) {
    const errorMessage = req.query.error ? "User already exists or invalid input" : "";
    const content = `<!DOCTYPE html>
    <html>
        <head>
            <title>HTML Registration Form</title>
            <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
        </head>
        <body>
            <div class="main">
                <h3>Создать аккаунт</h3>
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
                        Пароль:
                    </label>
                    <input type="password"
                        id="password" 
                        name="password" 
                        placeholder="Enter your Password" required>

                    <div class="wrap">
                        <button type="submit">
                            Подтвердить
                        </button>
                    </div>
                </form>
                <p>Уже зарегистрированы? 
                    <a href="/login" 
                    style="text-decoration: none;">
                        Введите логин
                    </a>
                </p>
            </div>
        </body>
    </html>`
    res.send(baseHTML('Регистрация', content));
});




app.post('/register', async function (req, res) {

    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);



    try {
        // Проверка наличия пользователя с таким же email в базе данных
        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.redirect('/register?error=true');
        }

        // Создание нового пользователя в базе данных
        await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

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

adminPage(app, pool, requireAdmin, baseHTML)
userSessionPage(app, requireLogin, baseHTML)
adminHistoryPage(app, pool, requireAdmin, baseHTML)
userPage(app, requireLogin, pool, baseHTML)
















