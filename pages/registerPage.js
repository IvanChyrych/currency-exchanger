module.exports = function (app, pool, baseHTML, bcrypt) {

    app.get('/register', function (req, res) {
        const errorMessage = req.query.error ? "Пользователь уже существует" : "";
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
            const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
            if (existingUser.length > 0) {
                return res.redirect('/register?error=true');
            }
            await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
            res.redirect('/login');
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).send('Internal Server Error');
        }
    });
};
