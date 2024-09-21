const express = require('express');
const mysql2 = require('mysql2/promise');
const session = require('express-session');

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
                res.redirect('/AdminMenu');
            } else {
                res.redirect('/UserMenu');
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
//---------------------------------------------------------------------------Admin-------------------------------------------------------
app.get('/add', requireAdmin, function (req, res) {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Add Event</title>
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
                justify-content: center;
                margin-top: 20px;
            }
        </style>
        </head>
        <body>
            <h1>Add Event</h1>
            <form id="addEventForm" action="/add" method="POST">
                <label for="name">Name:</label><br>
                <input type="text" id="name" name="name" required><br><br>
                <br></br>
                <label for="description">Description:</label><br>
                <textarea id="description" name="description" required></textarea><br><br>
                <br></br>
                <label for="date">Date:</label><br>
                <input type="date" id="date" name="date" required><br><br>
                <br></br>
                <label for="time">Time:</label><br>
                <input type="time" id="time" name="time" required><br><br>
                <br></br>
                <label for="place">Place:</label><br>
                <input type="text" id="place" name="place" required><br><br>
                <br></br>
                <label for="tickets_count">Tickets Count:</label><br>
                <input type="number" id="tickets_count" name="tickets_count" min="1" required><br><br>
                <br></br>
                <label for="price">Price:</label><br>
                <input type="number" id="price" name="price" min="0" required><br><br>
                <br></br>
                <button type="submit">Add Event</button>
            </form>
        
            <script src="index.js"></script>
        </body>
        </html>
    `);
});

app.post('/add', requireAdmin, async function (req, res) {
    const { name, description, date, time, place, tickets_count, price, price_general } = req.body;

    const datetime = `${date} ${time}`;

    try {

        const [result] = await pool.query('INSERT INTO events (name, description, date, place, tickets_count, price) VALUES (?, ?, ?, ?, ?, ?)', [name, description, datetime, place, tickets_count, price]);

        res.send('Event added successfully');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to add event');
    }
});

app.get('/AdminMenu', requireAdmin, async function (req, res) {
    try {
        const { name, date, place } = req.query;
        let query = `
            SELECT e.*, (e.tickets_count - COUNT(t.id)) AS available_tickets
            FROM events e
            LEFT JOIN tickets t ON e.id = t.event_id
            WHERE e.date >= NOW()
        `;

        const params = [];
        if (name) {
            query += ` AND e.name LIKE ?`;
            params.push(`%${name}%`);
        }
        if (date) {
            query += ` AND DATE(e.date) = ?`;
            params.push(date);
        }
        if (place) {
            query += ` AND e.place LIKE ?`;
            params.push(`%${place}%`);
        }

        query += ` GROUP BY e.id HAVING available_tickets > 0`;

        const [events] = await pool.query(query, params);

        let eventsTable = '';
        events.forEach(event => {
            eventsTable += `<tr>
                <td>${event.name}</td>
                <td>${event.description}</td>
                <td>${event.date}</td>
                <td>${event.place}</td>
                <td>${event.price}</td>
                <td>${event.price * event.available_tickets}</td>
                <td>${event.available_tickets}</td>
                <td>
                    <button onclick="location.href='/event/${event.id}'" class="details-button">View Details</button>
                    <button onclick="deleteEvent(${event.id})" class="delete-button">Delete</button>
                </td>
            </tr>`;
        });

        const content = `
            <h1>Admin Dashboard</h1>
            <div style="text-align: center;">
                <button onclick="location.href='/add'" class="admin-button">Create Event</button>
                <button onclick="location.href='/admin/users'" class="admin-button">Manage Users</button>
            </div>
            <h2>Available Events</h2>
            <div class="search-form">
                <form method="get" action="/AdminMenu">
                    <input type="text" name="name" placeholder="Event Name">
                    <input type="date" name="date" placeholder="Event Date">
                    <input type="text" name="place" placeholder="Event Place">
                    <input type="submit" value="Search">
                </form>
            </div>
            <table>
                <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Place</th>
                    <th>Price</th>
                    <th>Price_general</th>
                    <th>Tickets Available</th>
                    <th>Action</th>
                </tr>
                ${eventsTable}
            </table>
            <button onclick="location.href='/admin/currency'" class="admin-button">Manage Currency</button>
            <script>
                async function deleteEvent(eventId) {
                    const confirmed = confirm('Are you sure you want to delete this event?');
                    if (confirmed) {
                        try {
                            const response = await fetch('/delete-event/' + eventId, { method: 'DELETE' });
                            if (response.ok) {
                                alert('Event deleted successfully');
                                location.reload();
                            } else {
                                alert('Failed to delete event');
                            }
                        } catch (error) {
                            console.error('Error deleting event:', error);
                            alert('Failed to delete event');
                        }
                    }
                }
            </script>
        `;
        res.send(baseHTML('Admin Dashboard', content));
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Failed to load admin dashboard');
    }
});

// Route to handle event deletion
app.delete('/delete-event/:id', requireAdmin, async function (req, res) {
    try {
        const eventId = req.params.id;
        await pool.query('DELETE FROM events WHERE id = ?', [eventId]);
        res.status(200).send('Event deleted');
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).send('Failed to delete event');
    }
});

app.get('/admin/users', requireAdmin, async function (req, res) {
    try {
        const [users] = await pool.query('SELECT * FROM users');
        let usersTable = '';
        users.forEach(user => {
            usersTable += `<tr>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td><button onclick="location.href='/admin/user/${user.id}'">View Details</button></td>
            </tr>`;
        });
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>All Users</title>
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
                justify-content: center;
                margin-top: 20px;
            }
        </style>
            </head>
            <body>
                <h1>All Users</h1>
                <table border="1">
                    <tr>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Action</th>
                    </tr>
                    ${usersTable}
                </table>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Failed to load users');
    }
});

app.get('/admin/user/:userId', requireAdmin, async function (req, res) {
    const { userId } = req.params;
    try {
        const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [tickets] = await pool.query('SELECT t.id as ticket_id, e.id as event_id, e.name, e.date, e.place FROM tickets t JOIN events e ON t.event_id = e.id WHERE t.user_id = ?', [userId]);

        if (user.length > 0) {
            let ticketsTable = '';
            tickets.forEach(ticket => {
                ticketsTable += `<tr>
                    <td>${ticket.name}</td>
                    <td>${ticket.date}</td>
                    <td>${ticket.place}</td>
                </tr>`;
            });
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>User Details</title>
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
                justify-content: center;
                margin-top: 20px;
            }
        </style>
                </head>
                <body>
                    <h1>User Details</h1>
                    <p>Email: ${user[0].email}</p>
                    <p>Phone: ${user[0].phone}</p>
                    <h2>Tickets</h2>
                    <table border="1">
                        <tr>
                            <th>Event Name</th>
                            <th>Date</th>
                            <th>Place</th>
                        </tr>
                        ${ticketsTable}
                    </table>
                    <button onclick="location.href='/admin/users'">Back to Users</button>
                </body>
                </html>
            `);
        } else {
            res.send('User not found');
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send('Failed to load user details');
    }
});


//--------------------------------------------------------------------------User-------------------------------------------------------------------
app.get('/events', async function (req, res) {
    try {
        const { name, date, place } = req.query;
        let query = `
            SELECT e.*, (e.tickets_count - COUNT(t.id)) AS available_tickets
            FROM events e
            LEFT JOIN tickets t ON e.id = t.event_id
            WHERE e.date >= NOW()
        `;

        const params = [];
        if (name) {
            query += ` AND e.name LIKE ?`;
            params.push(`%${name}%`);
        }
        if (date) {
            query += ` AND DATE(e.date) = ?`;
            params.push(date);
        }
        if (place) {
            query += ` AND e.place LIKE ?`;
            params.push(`%${place}%`);
        }

        query += ` GROUP BY e.id HAVING available_tickets > 0`;

        const [events] = await pool.query(query, params);

        let eventsTable = '';
        events.forEach(event => {
            eventsTable += `<tr>
                <td>${event.name}</td>
                <td>${event.description}</td>
                <td>${event.date}</td>
                <td>${event.place}</td>
                <td>${event.price}</td>
                <td>
                total:
                <input type="text">
                
               
                
                </td>
            <td>${event.available_tickets}</td>
                <td>
                    <button onclick="location.href='/buy/${event.id}'" class="buy-button">Buy Ticket</button>
                    <button onclick="location.href='/event/${event.id}'" class="details-button">View Details</button>
                </td>
            </tr>`;
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Available Events</title>
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
                    .search-form {
                        display: flex;
                        justify-content: center;
                        margin-bottom: 20px;
                    }
                    .search-form input[type="text"], .search-form input[type="date"], .search-form input[type="submit"] {
                        padding: 10px;
                        margin: 5px;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                    }
                    .search-form input[type="submit"] {
                        background-color: #007bff;
                        color: #fff;
                        cursor: pointer;
                        transition: background-color 0.3s ease;
                    }
                    .search-form input[type="submit"]:hover {
                        background-color: #0056b3;
                    }
                </style>
            </head>
            <body>
                <h1>Available Events</h1>
                <div class="search-form">
                    <form method="get" action="/events">
                        <input type="text" name="name" placeholder="Event Name">
                        <input type="date" name="date" placeholder="Event Date">
                        <input type="text" name="place" placeholder="Event Place">
                        <input type="submit" value="Search">
                    </form>
                </div>
                <table>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Place</th>
                        <th>Price</th>
                        <th>Price_general</th>
                        <th>Tickets Available</th>
                        <th>Action</th>
                    </tr>
                    ${eventsTable}
                </table>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Failed to load events');
    }
});

app.get('/buy/:eventId', requireLogin, async function (req, res) {
    const { eventId } = req.params;
    try {
        const [event] = await pool.query('SELECT e.*, (e.tickets_count - COUNT(t.id)) AS available_tickets FROM events e LEFT JOIN tickets t ON e.id = t.event_id WHERE e.id = ? GROUP BY e.id HAVING available_tickets > 0 AND e.date >= NOW()', [eventId]);
        if (event.length > 0) {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Buy Ticket</title>
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
                        form {
                            display: flex;
                            justify-content: center;
                        }
                        button {
                            padding: 10px 20px;
                            border: none;
                            background-color: #28a745;
                            color: #fff;
                            border-radius: 5px;
                            cursor: pointer;
                            transition: background-color 0.3s ease;
                        }
                        button:hover {
                            background-color: #218838;
                        }
                    </style>
                </head>
                <body>
                    <h1>Buy Ticket for ${event[0].name}</h1>
                    <form action="/buy/${eventId}" method="POST">
                        <button type="submit">Confirm Purchase</button>
                    </form>
                </body>
                </html>
            `);
        } else {
            res.send('Event not available or tickets sold out');
        }
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).send('Failed to load event');
    }
});

app.post('/buy/:eventId', requireLogin, async function (req, res) {
    const { eventId } = req.params;
    const userId = req.session.userId;
    try {
        const [event] = await pool.query('SELECT e.*, (e.tickets_count - COUNT(t.id)) AS available_tickets FROM events e LEFT JOIN tickets t ON e.id = t.event_id WHERE e.id = ? GROUP BY e.id HAVING available_tickets > 0 AND e.date >= NOW()', [eventId]);
        if (event.length > 0) {
            await pool.query('INSERT INTO tickets (user_id, event_id, date) VALUES (?, ?, NOW())', [userId, eventId]);
            res.send('Ticket purchased successfully');
        } else {
            res.send('Event not available or tickets sold out');
        }
    } catch (error) {
        console.error('Error purchasing ticket:', error);
        res.status(500).send('Failed to purchase ticket');
    }
});

app.get('/UserMenu', function (req, res) {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Menu</title>
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
                justify-content: center;
                margin-top: 20px;
            }
        </style>
        </head>
        <body>
             <div class="menu">
				<button onclick="location.href='/events'">Events list</button>
				<button onclick="location.href='/my-tickets'">Ordered tickets</button>
				<button onclick="location.href='/user'">Ack info</button>
			</div>
        </body>
        </html>
    `);
});

app.get('/event/:eventId', async function (req, res) {
    const { eventId } = req.params;
    try {
        const [event] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
        if (event.length > 0) {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Event Details</title>
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
                        p {
                            line-height: 1.6;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <h1>${event[0].name}</h1>
                    <p>${event[0].description}</p>
                    <p>Date: ${event[0].date}</p>
                    <p>Place: ${event[0].place}</p>
                    <p>Price: ${event[0].price}</p>
                    <p>Tickets Available: ${event[0].tickets_count}</p>
                </body>
                </html>
            `);
        } else {
            res.send('Event not found');
        }
    } catch (error) {
        console.error('Error fetching event details:', error);
        res.status(500).send('Failed to load event details');
    }
});


app.get('/my-tickets', requireLogin, async function (req, res) {
    const userId = req.session.userId;
    try {
        const [tickets] = await pool.query('SELECT t.id as ticket_id, e.id as event_id, e.name, e.date, e.place FROM tickets t JOIN events e ON t.event_id = e.id WHERE t.user_id = ?', [userId]);
        let ticketsTable = '';
        tickets.forEach(ticket => {
            ticketsTable += `<tr>
                <td>${ticket.name}</td>
                <td>${ticket.date}</td>
                <td>${ticket.place}</td>
                <td><button onclick="location.href='/event/${ticket.event_id}'">View Details</button></td>
            </tr>`;
        });
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>My Tickets</title>
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
                justify-content: center;
                margin-top: 20px;
            }
        </style>
            </head>
            <body>
                <h1>My Tickets</h1>
                <table border="1">
                    <tr>
                        <th>Event Name</th>
                        <th>Date</th>
                        <th>Place</th>
                        <th>Action</th>
                    </tr>
                    ${ticketsTable}
                </table>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).send('Failed to load tickets');
    }
});

app.get('/user', requireLogin, async function (req, res) {
    const userId = req.session.userId; // Предполагаем, что ID пользователя хранится в req.user после аутентификации
    try {
        const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (user.length > 0) {
            const content = `
                <h1>User Information</h1>
                <form action="/user" method="POST">
                    <label for="name">Name: ${user[0].name}</label>
                    <label for="email">Email: ${user[0].email}</label>
                    <label for="phone">Phone:</label>
                    <input type="text" id="phone" name="phone" value="${user[0].phone}" required>
                    <input type="submit" value="Update Phone">
                </form>
            `;
            res.send(baseHTML('User Information', content));
        } else {
            res.send(baseHTML('User Information', '<p>User not found</p>'));
        }
    } catch (error) {
        console.error('Error fetching user information:', error);
        res.status(500).send('Failed to load user information');
    }
});

app.post('/user', requireLogin, async function (req, res) {
    const userId = req.session.userId; // Предполагаем, что ID пользователя хранится в req.user после аутентификации
    const { phone } = req.body;
    try {
        await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);
        res.redirect('/user');
    } catch (error) {
        console.error('Error updating phone number:', error);
        res.status(500).send('Failed to update phone number');
    }
});

// Admin - Add/Edit Currency
app.get('/admin/currency', requireAdmin, async function (req, res) {
    try {
        // Fetch existing currencies to display for editing
        const [currencies] = await pool.query('SELECT * FROM currency');

        let currencyTable = '';
        currencies.forEach(currency => {
            currencyTable += `<tr>
                <td>${currency.currency_from}</td>
                <td>${currency.currency_to}</td>
                <td>${currency.rate}</td>
                <td>
                    <button onclick="editCurrency(${currency.id})">Edit</button>
                </td>
            </tr>`;
        });

        const content = `
            <h1>Manage Currency Exchange Rates</h1>
            <form action="/admin/currency" method="POST">
                <label for="currency_from">Currency From (e.g., USD):</label>
                <input type="text" id="currency_from" name="currency_from" required>
                <label for="currency_to">Currency To (e.g., RUB):</label>
                <input type="text" id="currency_to" name="currency_to" required>
                <label for="rate">Exchange Rate:</label>
                <input type="number" step="0.0001" id="rate" name="rate" required>
                <button type="submit">Add/Update Currency</button>
            </form>

            <h2>Existing Currencies</h2>
            <table>
                <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Exchange Rate</th>
                    <th>Action</th>
                </tr>
                ${currencyTable}
            </table>

            <script>
                function editCurrency(id) {
                    // Implement a way to pre-fill the form with selected currency details for editing
                    // You can either fetch data dynamically or use hidden inputs
                }
            </script>
        `;

        res.send(baseHTML('Manage Currency', content));
    } catch (error) {
        console.error('Error displaying currency management page:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Admin - Add or Update Currency
app.post('/admin/currency', requireAdmin, async function (req, res) {
    const { currency_from, currency_to, rate } = req.body;

    try {
        // Check if currency already exists
        const [existingCurrency] = await pool.query(
            'SELECT * FROM currency WHERE currency_from = ? AND currency_to = ?',
            [currency_from, currency_to]
        );

        if (existingCurrency.length > 0) {
            // Update exchange rate for existing currency pair
            await pool.query(
                'UPDATE currency SET rate = ? WHERE currency_from = ? AND currency_to = ?',
                [rate, currency_from, currency_to]
            );
        } else {
            // Add new currency pair
            await pool.query(
                'INSERT INTO currency (currency_from, currency_to, rate) VALUES (?, ?, ?)',
                [currency_from, currency_to, rate]
            );
        }

        res.redirect('/admin/currency'); // Refresh the page
    } catch (error) {
        console.error('Error adding/updating currency:', error);
        res.status(500).send('Failed to add/update currency');
    }
});


app.get('/exchange', requireLogin, async function (req, res) {
    try {
        const [currencies] = await pool.query('SELECT * FROM currency');

        let currencyTable = '';
        currencies.forEach(currency => {
            currencyTable += `
                <tr>
                    <td>${currency.currency_from}</td>
                    <td>${currency.currency_to}</td>
                    <td>${currency.rate}</td>
                    <td>${currency.count}</td>
                    <td>
                        <form action="/preview-exchange" method="POST">
                            <input type="hidden" name="currency_id" value="${currency.id}">
                            <input type="number" name="amount" min="1"  placeholder="Amount" required>
                            <button type="submit" class="exchange-button">Preview Exchange</button>
                        </form>
                    </td>
                </tr>`;
        });

        const content = `
            <h1>Available Currencies for Exchange</h1>
            <table>
                <tr>
                    <th>From Currency</th>
                    <th>To Currency</th>
                    <th>Rate</th>
                    <th>Available Quantity</th>
                    <th>Action</th>
                </tr>
                ${currencyTable}
            </table>
            <br>
            <a href="/exchange-history" class="history-button">View Session Exchange History</a>
        `;
        res.send(baseHTML('Currency Exchange', content));
    } catch (error) {
        console.error('Error fetching currencies:', error);
        res.status(500).send('Failed to load currencies.');
    }
});

app.post('/preview-exchange', requireLogin, async function (req, res) {
    const { currency_id, amount } = req.body;

    try {
        // Retrieve the selected currency
        const [currency] = await pool.query('SELECT * FROM currency WHERE id = ?', [currency_id]);
        if (currency.length === 0) {
            return res.status(404).send('Currency not found');
        }

        const exchangeRate = currency[0].rate;
        const availableCount = currency[0].count;

        // Ensure the requested amount doesn't exceed the available quantity
        if (amount > availableCount) {
            return res.status(400).send('Insufficient currency available for exchange');
        }

        // Calculate the amount the user will receive
        const receivedAmount = amount * exchangeRate;

        // Display the result and offer the user the option to confirm or cancel
        const content = `
            <h2>Preview Exchange</h2>
            <p>You are exchanging ${amount} units of ${currency[0].currency_from}.</p>
            <p>At a rate of ${exchangeRate}, you will receive ${receivedAmount} units of ${currency[0].currency_to}.</p>
            <form action="/confirm-exchange" method="POST">
                <input type="hidden" name="currency_id" value="${currency_id}">
                <input type="hidden" name="amount" value="${amount}">
                <button type="submit" class="confirm-button">Confirm Exchange</button>
            </form>
            <a href="/exchange">Cancel</a>
        `;
        res.send(baseHTML('Confirm Exchange', content));
    } catch (error) {
        console.error('Error previewing exchange:', error);
        res.status(500).send('Failed to preview exchange.');
    }
});

app.post('/confirm-exchange', requireLogin, async function (req, res) {
    const { currency_id, amount } = req.body;

    try {
        // Retrieve the selected currency
        const [currency] = await pool.query('SELECT * FROM currency WHERE id = ?', [currency_id]);
        if (currency.length === 0) {
            return res.status(404).send('Currency not found');
        }

        const exchangeRate = currency[0].rate;
        const availableCount = currency[0].count;

        // Ensure the requested amount doesn't exceed the available quantity
        if (amount > availableCount) {
            return res.status(400).send('Insufficient currency available for exchange');
        }

        // Update the currency table by reducing the available count
        // await pool.query('UPDATE currency SET count = count - ? WHERE id = ?', [amount, currency_id]);

        // Insert the exchange into the history table with the current date and time
        const currentDate = new Date();
        await pool.query('INSERT INTO history (date, rate, amount, currency, user) VALUES (?, ?, ?, ?, ?)',
            [currentDate, exchangeRate, amount, currency_id, req.session.userId]);

        // Save the exchange in the session history
        if (!req.session.exchangeHistory) {
            req.session.exchangeHistory = [];  // Initialize session history if not present
        }

        req.session.exchangeHistory.push({
            date: currentDate,
            rate: exchangeRate,
            amount: amount,
            currency: currency[0].currency_to
        });

        res.send('Exchange successful and recorded in history!');
    } catch (error) {
        console.error('Error processing exchange:', error);
        res.status(500).send('Failed to process exchange.');
    }
});

app.post('/exchange', requireLogin, async function (req, res) {
    const { currency_id, amount } = req.body;

    try {
        // Retrieve the selected currency
        const [currency] = await pool.query('SELECT * FROM currency WHERE id = ?', [currency_id]);
        if (currency.length === 0) {
            return res.status(404).send('Currency not found');
        }

        const exchangeRate = currency[0].rate;


        // Insert the exchange into the history table with the current date and time
        const currentDate = new Date();
        await pool.query('INSERT INTO history (date, rate, amount, currency, user) VALUES (?, ?, ?, ?, ?)',
            [currentDate, exchangeRate, amount, currency_id, req.session.userId]);

        res.send('Exchange successful and recorded in history!');
    } catch (error) {
        console.error('Error processing exchange:', error);
        res.status(500).send('Failed to process exchange.');
    }
});


app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
    try {
        // Fetch all exchange history with user and currency details
        const [history] = await pool.query(`
            SELECT h.id, h.date, h.rate, h.amount, c.currency_to AS currency, user
            FROM history h
            JOIN currency c ON h.currency = c.id
            JOIN users ON user = users.id
        `);

        // Render the history with search and filter options (UI part comes next)
        let historyTable = `
            <table>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Rate</th>
                    <th>User</th>
                </tr>
        `;

        history.forEach(entry => {
            historyTable += `
                <tr>
                    <td>${entry.id}</td>
                    <td>${new Date(entry.date).toLocaleString()}</td>
                    <td>${entry.amount}</td>
                    <td>${entry.currency}</td>
                    <td>${entry.rate}</td>
                    <td>${entry.user}</td>
                </tr>
            `;
        });

        historyTable += '</table>';

        const content = `
            <h1>All Exchange History</h1>
            ${historyTable}
            <br>
            <form method="GET" action="/admin/exchange-history">
    <input type="date" name="date" placeholder="Date" value="<%= date || '' %>">
    <input type="text" name="user" placeholder="User" value="<%= user || '' %>">
    <input type="text" name="currency" placeholder="Currency" value="<%= currency || '' %>">
    <button type="submit">Filter</button>
</form>

            <a href="/admin">Back to Admin Panel</a>
        `;

        res.send(baseHTML('Admin Exchange History', content));
    } catch (error) {
        console.error('Error fetching exchange history:', error);
        res.status(500).send('Failed to load exchange history.');
    }
});

app.get('/admin/exchange-history', requireAdmin, async function (req, res) {
    const { date, user, currency, sort } = req.query;

    let query = `
        SELECT h.id, h.date, h.rate, h.amount, c.currency_to AS currency, u.username AS user
        FROM history h
        JOIN currency c ON h.currency = c.id
        JOIN users u ON h.user = u.id
        WHERE 1=1
    `;

    const params = [];

    // Filter by date
    if (date) {
        query += ` AND DATE(h.date) = ?`;
        params.push(date);
    }

    // Filter by user
    if (user) {
        query += ` AND u.username LIKE ?`;
        params.push(`%${user}%`);
    }

    // Filter by currency
    if (currency) {
        query += ` AND c.currency_to LIKE ?`;
        params.push(`%${currency}%`);
    }

    // Sorting
    if (sort) {
        if (sort === 'date') query += ` ORDER BY h.date`;
        if (sort === 'user') query += ` ORDER BY u.username`;
        if (sort === 'currency') query += ` ORDER BY c.currency_to`;
    } else {
        query += ` ORDER BY h.date DESC`; // Default sorting by date, newest first
    }

    try {
        const [history] = await pool.query(query, params);

        let historyTable = `
            <table>
                <tr>
                    <th><a href="/admin/exchange-history?sort=id">ID</a></th>
                    <th><a href="/admin/exchange-history?sort=date">Date</a></th>
                    <th>Amount</th>
                    <th><a href="/admin/exchange-history?sort=currency">Currency</a></th>
                    <th>Rate</th>
                    <th><a href="/admin/exchange-history?sort=user">User</a></th>
                </tr>
        `;

        history.forEach(entry => {
            historyTable += `
                <tr>
                    <td>${entry.id}</td>
                    <td>${new Date(entry.date).toLocaleString()}</td>
                    <td>${entry.amount}</td>
                    <td>${entry.currency}</td>
                    <td>${entry.rate}</td>
                    <td>${entry.user}</td>
                </tr>
            `;
        });

        historyTable += '</table>';

        const content = `
            <h1>All Exchange History</h1>
            <form method="GET" action="/admin/exchange-history">
                <input type="date" name="date" placeholder="Date" value="${date || ''}">
                <input type="text" name="user" placeholder="User" value="${user || ''}">
                <input type="text" name="currency" placeholder="Currency" value="${currency || ''}">
                <button type="submit">Filter</button>
            </form>
            ${historyTable}
            <br>
            <a href="/admin">Back to Admin Panel</a>
        `;

        res.send(baseHTML('Admin Exchange History', content));
    } catch (error) {
        console.error('Error fetching exchange history:', error);
        res.status(500).send('Failed to load exchange history.');
    }
});

function getUserId() {
    const userId = req.session.userId;
    return userId;
}
