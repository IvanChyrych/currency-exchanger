const axios = require('axios');
const uri = 'https://api.nbrb.by/';
const ratesUrl = `${uri}ExRates/Rates?Periodicity=0`;

module.exports = function (app, pool, requireAdmin, baseHTML) {
    async function getMaxAmount(pool) {
        try {
            const [rows] = await pool.query('SELECT max_amount FROM exchange_settings WHERE id = 1');
            if (rows.length > 0) {
                return parseFloat(rows[0].max_amount);
            } else { 
                await pool.query('INSERT INTO exchange_settings (max_amount) VALUES (?)', [10000]);
                return 10000;
            }
        } catch (error) {
            console.error('Ошибка при получении MAX_AMOUNT из базы данных:', error);
            throw error;
        }
    }

    async function fetchRates() {
        try {
            const response = await axios.get(ratesUrl);
            return response.data;
        } catch (error) {
            console.error('Ошибка при получении курсов валют из API:', error);
            return [];
        }
    }

    app.get('/admin/currency', requireAdmin, async function (req, res) {
        try {
            const apiRates = await fetchRates();
            const currentMax = await getMaxAmount(pool);
            const [currencies] = await pool.query('SELECT * FROM currency_in');

            let apiRatesTable = '';
            apiRates.forEach(rate => {
                apiRatesTable += `
                <tr>
                    <td>${rate.Cur_Abbreviation}</td>
                    <td>BYN</td>
                    <td>${rate.Cur_OfficialRate}</td>
                </tr>`;
            });

            let currencyTable = '';
            currencies.forEach(currency => {
                currencyTable += `
                <tr>
                    <td>${currency.currency_from}</td>
                    <td>${currency.currency_to}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });


            const content = `
            <h2>Доступное количество денег в обменнике: ${currentMax.toFixed(2)} BYN</h2>
            <h1>Админ панель</h1>
                <form action="/admin/currency" method="POST">
                <label for="currency_from">Покупаемая валюта (пример: USD):</label>
                <input type="text" id="currency_from" name="currency_from" pattern="[A-Z]{3}" title="Введите 3 буквы верхнего регистра" required>
                <label for="currency_to">Обмениваемая валюта (пример: RUB):</label>
                <input type="text" id="currency_to" name="currency_to" pattern="[A-Z]{3}" title="Введите 3 буквы верхнего регистра" required>
                <label for="rate">Курс:</label>
                <input type="number" step="0.0001" id="rate" name="rate" required>
                <button type="submit" class="history-button">Добавить валюту</button>
                </form>
                <h2>Валюты из базы данных</h2>
                <table>
                    <tr>
                        <th>В</th>
                        <th>Из</th>
                        <th>Курс</th>
                    </tr>
                    ${currencyTable}
                </table>
                <h2>Актуальные курсы валют из NBRB</h2>
                <table>
                    <tr>
                        <th>Валюта</th>
                        <th>Относительно</th>
                        <th>Курс</th>
                    </tr>
                    ${apiRatesTable}
                </table>
                <button onclick="location.href='/admin/exchange-history'" class="history-button">История операций</button>
            `;
            res.send(baseHTML('Админ панель', content));
        } catch (error) {
            console.error('Error displaying currency management page:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    app.post('/admin/currency', requireAdmin, async function (req, res) {
        const { currency_from, currency_to, rate } = req.body;
        try {
            const [existingCurrency] = await pool.query(
                'SELECT * FROM currency_in WHERE currency_from = ? AND currency_to = ?',
                [currency_from, currency_to]
            );
            if (existingCurrency.length > 0) {
                await pool.query(
                'UPDATE currency_in SET rate = ? WHERE currency_from = ? AND currency_to = ?',
                [rate, currency_from, currency_to]
                );
            } else {
                await pool.query(
                'INSERT INTO currency_in (currency_from, currency_to, rate) VALUES (?, ?, ?)',
                [currency_from, currency_to, rate]
                );
            }
            res.redirect('/admin/currency'); 
        } catch (error) {
            console.error('Error adding/updating currency:', error);
            res.status(500).send('Failed to add/update currency');
        }
    });
}
