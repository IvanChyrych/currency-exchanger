import {makeAutoObservable} from "mobx";
export default class ExrateStore {
    constructor() {
        this._types = []
        this._brands = []
        this._exrates = []
        this._baskets = []
        this._selectedType = {}
        this._selectedBrand = {}
        this._page = 1
        this._totalCount = 0
        this._limit = 2
        makeAutoObservable(this)
    }
    setTypes(types) {
        this._types = types
    }
    setBrands(brands) {
        this._brands = brands
    }
    setExrates(_exrates) {
        this._exrates = _exrates
    }


    setBaskets(basket){
        this._baskets = basket
    }

    setSelectedType(type) {
        this.setPage(1)
        this._selectedType = type
    }
    setSelectedBrand(brand) {
        this.setPage(1)
        this._selectedBrand = brand
    }
    setPage(page) {
        this._page = page
    }
    setTotalCount(count) {
        this._totalCount = count
    }
    get types() {
        return this._types
    }
    get brands() {
        return this._brands
    }
    get exrates() {
        return this._exrates
    }


    get basket() {
        return this._baskets
    }
    get selectedType() {
        return this._selectedType
    }
    get selectedBrand() {
        return this._selectedBrand
    }
    get totalCount() {
        return this._totalCount
    }
    get page() {
        return this._page
    }
    get limit() {
        return this._limit
    }
}