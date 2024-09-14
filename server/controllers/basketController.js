// const { Device, BasketDevice, Basket } = require("../models/models")

// class BasketController {
//     // ------ CRUD корзины ------ //

//     async addToBasket(req,res,next){
//         const user = req.user
//         const {deviceId} = req.body
//         const basket = await BasketDevice.create({basketId : user.id, deviceId : deviceId})
//         return res.json(basket)
//     }

//     async getBasketUser(req,res){
//         const {id} = req.user
//         const basket = await BasketDevice.findAll({include: {
//                 model: Device
//             }, where: {basketId: id}})

//         return res.json(basket)
//     }

// }

// module.exports = new BasketController()


const { Device, BasketDevice, Basket } = require("../models/models");

class BasketController {
    async addToBasket(req, res, next) {
        const user = req.user; // Получаем пользователя из авторизации
        const { basket_id, device_id, amount, currency } = req.body; // Получаем параметры из тела запроса

        // Создаём запись в таблице BasketDevice
        const basket = await BasketDevice.create({
            basket_id: basket_id,
            device_id: device_id,
            amount: amount, // Сохраняем количество
            currency: currency // Сохраняем id валюты
        });

        return res.json(basket);
    }

    async getBasketUser(req, res) {
        const { id } = req.user;
        const basket = await BasketDevice.findAll({
            include: [
                { model: Device },
                { model: Currency }  // Добавляем информацию о валюте
            ],
            where: { basket_id: id }
        });

        return res.json(basket);
    }
}

module.exports = new BasketController();