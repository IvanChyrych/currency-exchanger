const axios = require('axios');
const uri = 'https://api.nbrb.by/';
const ratesUrl = `${uri}ExRates/Rates?Periodicity=0`;
const Joi = require('joi'); // Для валидации

module.exports = function (app, pool, requireAdmin, baseHTML) {
    async function getMaxAmount(pool) {
        try {
            const [rows] = await pool.query('SELECT max_amount FROM exchange_settings WHERE id = 1');
            if (rows.length > 0) {
                return parseFloat(rows[0].max_amount);
            } else {
                await pool.query('INSERT INTO exchange_settings (id, max_amount) VALUES (1, ?)', [10000]);
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
            const [currencies_in] = await pool.query('SELECT * FROM currency_in_byn');
            const [currencies_from] = await pool.query('SELECT * FROM currency_from_byn');

            let apiRatesTable = '';
            apiRates.forEach(rate => {
                apiRatesTable += `
                <tr>
                    <td>${rate.Cur_Abbreviation}</td>
                    <td>BYN</td>
                    <td>${rate.Cur_OfficialRate}</td>
                </tr>`;
            });

            let currencyTableIn = '';
            currencies_in.forEach(currency => {
                currencyTableIn += `
                <tr>
                    <td>${currency.currency_in}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });

            let currencyTableFrom = '';
            currencies_from.forEach(currency => {
                currencyTableFrom += `
                <tr>
                    <td>${currency.currency_from}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });

            const content = `
            <button onclick="location.href='/admin/exchange-history'" class="history-button">История операций</button>
            <br>
            <h2>Доступное количество денег в обменнике: ${currentMax.toFixed(2)} BYN</h2>
            
            <!-- Новая форма для изменения currentMax -->
            <form action="/admin/currency/max" method="POST">
                <label for="max_amount">Изменить доступное количество денег (BYN):</label>
                <input type="number" step="0.01" id="max_amount" name="max_amount" min="0" required>
                <button type="submit" class="history-button">Обновить</button>
            </form>

            <h1>Админ панель</h1>
            

                <form action="/admin/currency/purchase" method="POST">
                    <label for="currency_from">Покупка валюты относительно BYN:</label>
                    <input type="text" id="currency_from" name="currency_from" pattern="[A-Z]{3}" title="Введите 3 буквы верхнего регистра" required>
                    <label for="rate">Курс:</label>
                    <input type="number" step="0.0001" id="rate" name="rate" required>
                    <button type="submit" class="history-button">Добавить валюту</button>
                </form>

                <form action="/admin/currency/sale" method="POST">
                    <label for="currency_to">Продажа валюты относительно BYN:</label>
                    <input type="text" id="currency_to" name="currency_to" pattern="[A-Z]{3}" title="Введите 3 буквы верхнего регистра" required>
                    <label for="rate">Курс:</label>
                    <input type="number" step="0.0001" id="rate" name="rate" required>
                    <button type="submit" class="history-button">Добавить валюту</button>
                </form>

                <h2>Валюты из базы данных</h2>
                <h3>Покупка</h3>
                <table>
                    <tr>
                        <th>Валюта</th>
                        <th>Курс</th>
                    </tr>
                    ${currencyTableIn}
                </table>
                
                <h3>Продажа</h3>
                <table>
                    <tr>
                        <th>Валюта</th>
                        <th>Курс</th>
                    </tr>
                    ${currencyTableFrom}
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
                
            `;
            res.send(baseHTML('Админ панель', content));
        } catch (error) {
            console.error('Ошибка при отображении страницы управления валютами:', error);
            res.status(500).send('Внутренняя ошибка сервера');
        }
    });

    // Обработчик для покупки валют
    app.post('/admin/currency/purchase', requireAdmin, async function (req, res) {
        const { currency_from, rate } = req.body;
        // Валидация данных
        const schema = Joi.object({
            currency_from: Joi.string().length(3).uppercase().required(),
            rate: Joi.number().positive().precision(4).required()
        });
        const { error, value } = schema.validate({ currency_from, rate });
        if (error) {
            return res.status(400).send(`Ошибка валидации: ${error.details[0].message}`);
        }

        try {
            const [currencyInResults] = await pool.query(
                'SELECT * FROM currency_in_byn WHERE currency_in = ?',
                [value.currency_from]
            );

            if (currencyInResults.length > 0) {
                await pool.query(
                    'UPDATE currency_in_byn SET rate = ? WHERE currency_in = ?',
                    [value.rate, value.currency_from]
                );
            } else {
                await pool.query(
                    'INSERT INTO currency_in_byn (currency_in, rate) VALUES (?, ?)',
                    [value.currency_from, value.rate]
                );
            }

            res.redirect('/admin/currency');
        } catch (error) {
            console.error('Ошибка при добавлении/обновлении покупки валют:', error);
            res.status(500).send('Не удалось добавить/обновить валюту для покупки');
        }
    });

    // Обработчик для продажи валют
    app.post('/admin/currency/sale', requireAdmin, async function (req, res) {
        const { currency_to, rate } = req.body;
        // Валидация данных
        const schema = Joi.object({
            currency_to: Joi.string().length(3).uppercase().required(),
            rate: Joi.number().positive().precision(4).required()
        });
        const { error, value } = schema.validate({ currency_to, rate });
        if (error) {
            return res.status(400).send(`Ошибка валидации: ${error.details[0].message}`);
        }

        try {
            const [currencyToResults] = await pool.query(
                'SELECT * FROM currency_from_byn WHERE currency_from = ?',
                [value.currency_to]
            );

            if (currencyToResults.length > 0) {
                await pool.query(
                    'UPDATE currency_from_byn SET rate = ? WHERE currency_from = ?',
                    [value.rate, value.currency_to]
                );
            } else {
                await pool.query(
                    'INSERT INTO currency_from_byn (currency_from, rate) VALUES (?, ?)',
                    [value.currency_to, value.rate]
                );
            }

            res.redirect('/admin/currency');
        } catch (error) {
            console.error('Ошибка при добавлении/обновлении продажи валют:', error);
            res.status(500).send('Не удалось добавить/обновить валюту для продажи');
        }
    });

    // **Новый обработчик для изменения currentMax**
    app.post('/admin/currency/max', requireAdmin, async function (req, res) {
        const { max_amount } = req.body;
        
        // Валидация данных с использованием Joi
        const schema = Joi.object({
            max_amount: Joi.number().positive().precision(2).required()
        });
        const { error, value } = schema.validate({ max_amount });
        if (error) {
            return res.status(400).send(`Ошибка валидации: ${error.details[0].message}`);
        }
        
        try {
            // Проверяем, существует ли запись с id = 1
            const [rows] = await pool.query('SELECT * FROM exchange_settings WHERE id = 1');
            if (rows.length > 0) {
                // Обновляем существующую запись
                await pool.query('UPDATE exchange_settings SET max_amount = ? WHERE id = 1', [value.max_amount]);
            } else {
                // Вставляем новую запись, если ее нет
                await pool.query('INSERT INTO exchange_settings (id, max_amount) VALUES (1, ?)', [value.max_amount]);
            }
            
            res.redirect('/admin/currency');
        } catch (error) {
            console.error('Ошибка при обновлении max_amount:', error);
            res.status(500).send('Не удалось обновить доступное количество денег');
        }
    });
}
