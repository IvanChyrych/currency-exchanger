module.exports = function (app, pool, baseHTML, bcrypt) {
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
            const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
            if (rows.length > 0) {
                const user = rows[0];
                const match = await bcrypt.compare(password, user.password);
                if (match) {
                    const userId = user.id;
                    req.session.userId = userId;
                    const [admins] = await pool.query('SELECT * FROM roles WHERE user_id = ? AND role = ?', [userId, 'admin']);
                    if (admins.length > 0) {
                        res.redirect('/admin/currency');
                    } else {
                        res.redirect('/user/exchange');
                    }
                } else {
                    res.redirect('/login?error=true');
                }
            } else {
                res.redirect('/login?error=true');
            }
        } catch (error) {
            console.error('Error during login:', error);
            res.status(500).send('Internal Server Error');
        }
    });
};
