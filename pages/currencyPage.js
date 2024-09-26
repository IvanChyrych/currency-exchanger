
// URL для запроса
const url = 'https://api.nbrb.by/exrates/currencies/456';





module.exports = function (app, pool, requireAdmin, baseHTML) {
    let val
    // Выполнение GET-запроса
    fetch(url)
    .then(response => {
        // Проверка статуса ответа
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json(); // Преобразование ответа в JSON
    })
    .then(data => {
        val=data
        // Обработка полученных данных
        console.log(val);
        
    })
    .catch(error => {
        // Обработка ошибок
        console.error('There has been a problem with your fetch operation:', error);
    });
 
    


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
            ${val.Cur_Name}
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
                                  </tr>
                ${currencyTable}
            </table>

            <script>
                function editCurrency(id) {
                    // Implement a way to pre-fill the form with selected currency details for editing
                    // You can either fetch data dynamically or use hidden inputs
                }
            </script>
            <button onclick="location.href='/admin/exchange-history'">Exchange history</button>
        `;

            res.send(baseHTML('Manage Currency', content));
        } catch (error) {
            console.error('Error displaying currency management page:', error);
            res.status(500).send('Internal Server Error');
        }
    });

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
}

console.log('123');