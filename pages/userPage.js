module.exports = function (app, requireLogin, pool, baseHTML) {

    function saveActionInSession(req, action) {
        if (!req.session.actions) {
            req.session.actions = [];
        }
        req.session.actions.push({
            action,
            timestamp: new Date()
        });
    }

    async function getMaxAmount(pool) {
        try {
            const [rows] = await pool.query('SELECT max_amount FROM exchange_settings WHERE id = 1');
            if (rows.length > 0) {
                return parseFloat(rows[0].max_amount);
            } else {
                // Если запись отсутствует, создайте её с дефолтным значением
                await pool.query('INSERT INTO exchange_settings (max_amount) VALUES (?)', [10000]);
                return 10000;
            }
        } catch (error) {
            console.error('Ошибка при получении MAX_AMOUNT из базы данных:', error);
            throw error;
        }
    }

    async function updateMaxAmount(pool, newAmount) {
        try {
            await pool.query('UPDATE exchange_settings SET max_amount = ? WHERE id = 1', [newAmount]);
        } catch (error) {
            console.error('Ошибка при обновлении MAX_AMOUNT в базе данных:', error);
            throw error;
        }
    }

    app.post('/user/exchange', requireLogin, async function (req, res) {
        const { fromCurrency, toCurrency, amount } = req.body;
        try {
            await pool.query('START TRANSACTION');
            const currentMax = await getMaxAmount(pool);
            if (parseFloat(amount) <= 0) {
                await pool.query('ROLLBACK');
                return res.status(400).send('Сумма обмена должна быть положительной.');
            }
            if (amount > currentMax) {
                await pool.query('ROLLBACK');
                return res.status(400).send(`Сумма обмена не может превышать ${currentMax.toFixed(2)} BYN`);
            }
            if (fromCurrency === toCurrency) {
                await pool.query('ROLLBACK');
                return res.status(400).send('Исходная и целевая валюты не могут быть одинаковыми.');
            }

            const [fromCurrencyData] = await pool.query('SELECT * FROM currency_in WHERE id = ?', [fromCurrency]);
            const [toCurrencyData] = await pool.query('SELECT * FROM currency_to WHERE id = ?', [toCurrency]);

            if (fromCurrencyData.length === 0 || toCurrencyData.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).send('Валюта не найдена');
            }

            const fromCurrencyRate = parseFloat(fromCurrencyData[0].rate);
            const toCurrencyRate = parseFloat(toCurrencyData[0].rate);

            const fromCurrencyName = fromCurrencyData[0].currency_from;
            const toCurrencyName = toCurrencyData[0].currency_to;



            console.log(fromCurrencyName);

            const amountInBYN = parseFloat(amount) * fromCurrencyRate;

            if (amountInBYN > currentMax) {
                await pool.query('ROLLBACK');
                return res.status(400).send(`Обмен невозможен. Требуемая сумма в BYN (${amountInBYN.toFixed(2)}) превышает доступные средства (${currentMax.toFixed(2)} BYN).`);
            }
            let sumInTargetCurrency=0
            if (fromCurrencyName === 'BYN') {
                 sumInTargetCurrency = parseFloat(amount) * fromCurrencyRate;
            } else {
                 sumInTargetCurrency = amountInBYN * toCurrencyRate;
            }








            const newMax = currentMax - amountInBYN;
            await updateMaxAmount(pool, newMax);

            const currentDate = new Date();
            await pool.query(
                'INSERT INTO history (fromCurrencyName, toCurrencyName, date, rate, purchased_currency, selling_currency, user) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                fromCurrencyName,
                toCurrencyName,
                currentDate,
                toCurrencyRate,
                sumInTargetCurrency,
                fromCurrency,
                req.session.userId
            ]
            );


            saveActionInSession(req, `
                Получено ${sumInTargetCurrency.toFixed(2)}  ${toCurrencyName}
                <br>
                Продано ${amount} ${fromCurrencyName}
                <br>
                Дата: ${currentDate.toLocaleString()}
            `);

            await pool.query('COMMIT');
            const content = `
                <br>
                Обмен произведен и сохранен в историю! 
                <br>
                Получено ${sumInTargetCurrency.toFixed(2)} ${toCurrencyName}
                <br>
                Продано ${amount} ${fromCurrencyName}
                <br>
                <button onclick="location.href='/user/exchange'">Вернуться на страницу обмена валют</button>
            `;
            res.send(baseHTML('Обмен произведен и сохранен в историю!', content));
        } catch (error) {
            try {
                await pool.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Ошибка при откате транзакции:', rollbackError);
            }
            console.error('Ошибка при обработке обмена:', error);
            res.status(500).send('Не удалось обработать обмен.');
        }
    });

    app.get('/user/exchange', requireLogin, async function (req, res) {
        try {
            const [currencies_in] = await pool.query('SELECT * FROM currency_in');
            const [currencies_to] = await pool.query('SELECT * FROM currency_to');
            const currentMax = await getMaxAmount(pool);

            let currencyTableIn = '';
            currencies_in.forEach(currency => {
                currencyTableIn += `
                <tr>
                    <td>${currency.currency_from}</td>
                    <td>${currency.currency_to}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });

            let currencyTableTo = '';
            currencies_to.forEach(currency => {
                currencyTableTo += `
                <tr>
                    <td>${currency.currency_from}</td>
                    <td>${currency.currency_to}</td>
                    <td>${currency.rate}</td>
                </tr>`;
            });

            let currencyOptionsFrom = '';
            currencies_in.forEach(currency => {
                currencyOptionsFrom += `<option value="${currency.id}">${currency.currency_from}</option>`;
            });

            let currencyOptionsTo = '';
            currencies_to.forEach(currency => {
                currencyOptionsTo += `<option value="${currency.id}">${currency.currency_to}</option>`;
            });

            const content = `
                <h2>Доступное количество денег в обменнике: ${currentMax.toFixed(2)} BYN</h2>
                <h2>Валюты из базы данных</h2>
                <table>
                    <tr>
                        <th>В</th>
                        <th>Из</th>
                        <th>Курс</th>
                    </tr>
                    ${currencyTableIn}
                    ${currencyTableTo}
                </table>


                <h1>Доступные валюты для обмена:</h1>
                <form action="/user/exchange" method="POST">
                <label for="fromCurrency">Из:</label>
                    <select name="fromCurrency" id="fromCurrency" required>
                        ${currencyOptionsFrom}
                    </select>
                <input type="number" name="amount" min="1" step="0.01" placeholder="Сумма" required>
                <label for="toCurrency">В:</label>
                    <select name="toCurrency" id="toCurrency" required>
                        ${currencyOptionsTo}
                    </select>                   
                <button type="submit">Обмен</button>
                </form>
                <br>
                <button onclick="location.href='/user/session-history'" class="history-button">История операций за сессию</button>
            `;

            res.send(baseHTML('Обмен валют', content));
        } catch (error) {
            console.error('Ошибка при получении валют:', error);
            res.status(500).send('Не удалось загрузить валюты.');
        }
    });
};
