const urlUSD = 'https://api.nbrb.by/exrates/rates/USD?parammode=2';
const urlEUR = 'https://api.nbrb.by/exrates/rates/EUR?parammode=2';

module.exports = function (app, pool, requireAdmin, baseHTML) {
    // Маршрут для отображения страницы управления валютами
    app.get('/admin/currency', requireAdmin, async function (req, res) {
        try {
            // Выполнение GET-запроса к API
            const responseUSD = await fetch(urlUSD);
            const responseEUR = await fetch(urlEUR);
            if (!responseUSD.ok || !responseEUR.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            const apiDataUSD = await responseUSD.json(); // Получаем данные API
            const apiDataEUR = await responseEUR.json();


            const [currencies] = await pool.query('SELECT * FROM currency');
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
            <h2>Официальный курс:</h2>
                ${apiDataUSD.Cur_Name}: <b>${apiDataUSD.Cur_OfficialRate}</b>
                <br>
                ${apiDataEUR.Cur_Name}: <b>${apiDataEUR.Cur_OfficialRate}</b>
                <br>
                <h1>Админ панель</h1>
                <form action="/admin/currency" method="POST">
                    <label for="currency_from">Обмениваемая валюта (пример: USD):</label>
                    <input type="text" id="currency_from" name="currency_from" required>
                    <label for="currency_to">Покупаемая валюта (привер: RUB):</label>
                    <input type="text" id="currency_to" name="currency_to" required>
                    <label for="rate">Курс:</label>
                    <input type="number" step="0.0001" id="rate" name="rate" required>
                    <button type="submit">Добавить валюту</button>
                </form>

                <h2>Валюты</h2>
                <table>
                    <tr>
                        <th>Из</th>
                        <th>В</th>
                        <th>Курс</th>
                    </tr>
                    ${currencyTable}
                </table>

                <button onclick="location.href='/admin/exchange-history'">История операций</button>
            `;

            res.send(baseHTML('Manage Currency', content));
        } catch (error) {
            console.error('Error displaying currency management page:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    // Маршрут для обработки POST-запроса при добавлении/обновлении валюты
    app.post('/admin/currency', requireAdmin, async function (req, res) {
        const { currency_from, currency_to, rate } = req.body;
        try {
            // Проверка, существует ли валюта уже
            const [existingCurrency] = await pool.query(
                'SELECT * FROM currency WHERE currency_from = ? AND currency_to = ?',
                [currency_from, currency_to]
            );
            if (existingCurrency.length > 0) {
                // Обновляем обменный курс для существующей валютной пары
                await pool.query(
                    'UPDATE currency SET rate = ? WHERE currency_from = ? AND currency_to = ?',
                    [rate, currency_from, currency_to]
                );
            } else {
                // Добавляем новую валютную пару
                await pool.query(
                    'INSERT INTO currency (currency_from, currency_to, rate) VALUES (?, ?, ?)',
                    [currency_from, currency_to, rate]
                );
            }
            res.redirect('/admin/currency'); // Обновляем страницу
        } catch (error) {
            console.error('Error adding/updating currency:', error);
            res.status(500).send('Failed to add/update currency');
        }
    });
}

