module.exports = function (app,pool,requireLogin) {

    app.post('/user/confirm-exchange', requireLogin, async function (req, res) {
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

            res.send(`<!DOCTYPE html>
                    <html>
                        <head>
                            <title>HTML Login Form</title>
                            <link rel="stylesheet" type="text/css"  href="http://localhost/phpmyadmin/styles/login_style.css">
                        </head>
                        <body>
                            <div class="main">
                                <h3>Exchange successful and recorded in history!</h3>
                                <button onclick="location.href='/user/exchange'">Back to Users</button>
                            </div>
                        </body>
                    </html>`);
        } catch (error) {
            console.error('Error processing exchange:', error);
            res.status(500).send('Failed to process exchange.');
        }
    });

}
