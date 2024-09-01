import { $bankHost } from "./index";


export const fetchExrates = async () => {
    const { data } = await $bankHost.get('https://api.nbrb.by/exrates/currencies/456')
    return data
}

