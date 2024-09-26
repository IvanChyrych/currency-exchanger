module.exports = function (app,requireLogin,baseHTML,pool) {

app.post('/user/preview-exchange', requireLogin, async function (req, res) {
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
            <form action="/user/confirm-exchange" method="POST">
                <input type="hidden" name="currency_id" value="${currency_id}">
                <input type="hidden" name="amount" value="${amount}">
                <button type="submit" class="confirm-button">Confirm Exchange</button>
            </form>
            <a href="/user/exchange">Cancel</a>
        `;
        res.send(baseHTML('Confirm Exchange', content));
    } catch (error) {
        console.error('Error previewing exchange:', error);
        res.status(500).send('Failed to preview exchange.');
    }
});
}