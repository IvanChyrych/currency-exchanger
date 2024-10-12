const express = require('express');
const mysql2 = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');

const loginPage = require('./pages/loginPage')
const registerPage = require('./pages/registerPage')
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

app.listen(3000, function () {
    console.log('server started!');
});


loginPage(app, pool, baseHTML, bcrypt)
registerPage(app, pool, baseHTML, bcrypt)
adminPage(app, pool, requireAdmin, baseHTML)
adminHistoryPage(app, pool, requireAdmin, baseHTML)
userPage(app, requireLogin, pool, baseHTML)
userSessionPage(app, requireLogin, baseHTML)

























