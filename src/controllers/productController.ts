import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import { BaseQuery, newProductRequestBody, searchRequestQuery } from "../types/types.js";
import { product } from "../models/productSchema.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import { invalidateCache } from "../utils/features.js";

export const getLatestProduct = TryCatch(async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    let products = []
    if (myCache.has("latest-product")) {
        products = JSON.parse(myCache.get("latest-product") as string)
    }
    else {
        products = await product.find({}).sort({ createdAt: -1 }).limit(5)
        myCache.set("latest-product", JSON.stringify(products))
    }
    return res.status(200).json({
        success: true,
        products
    })
})

export const getAllCategories = TryCatch(async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    let categories;
    if (myCache.has("categories")) {
        categories = JSON.parse(myCache.get("categories") as string)
    }
    else {
        categories = await product.distinct('category')
        myCache.set("categories", JSON.stringify(categories))
    }
    return res.status(200).json({
        success: true,
        categories
    })
})

export const getAdminProduct = TryCatch(async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    let products;
    if (myCache.has("all-products")) {
        products = JSON.parse(myCache.get("all-products") as string)
    }
    else {
        products = await product.find({})
        myCache.set("all-products", JSON.stringify(products))
    }
    return res.status(200).json({
        success: true,
        products
    })
})

export const getSingleProduct = TryCatch(async (req, res, next) => {
    const id = req.params.id
    let products;
    if (myCache.has(`products-${id}`)) {
        products = JSON.parse(myCache.get(`products-${id}`) as string)
    }
    else {
        products = await product.findById(id)
        if (!products) {
            return next(new ErrorHandler("Product not found", 404))
        }
        myCache.set(`products-${id}`, JSON.stringify(products))
    }
    return res.status(200).json({
        success: true,
        products
    })
})

export const newProduct = TryCatch(async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    const { name, category, price, stock } = req.body;
    const photo = req.file;
    if (!photo) {
        return next(new ErrorHandler("Please Add Photo", 400))
    }
    if (!name || !category || !price || !stock) {
        rm(photo.path, () => {
            console.log("Deleted")
        })
        return next(new ErrorHandler("Please Enter All Field", 400))
    }
    await product.create({ name, category: category.toLowerCase(), price, stock, photo: photo?.path, })
    await invalidateCache({ Product: true, admin: true })
    return res.status(200).json({
        success: true,
        message: "Product Created Successfully"
    })
})

export const updateProduct = TryCatch(async (req, res, next) => {
    const { id } = req.params
    const { name, category, price, stock } = req.body;
    const photo = req.file;
    const Product = await product.findById(id);

    if (!Product) {
        return next(new ErrorHandler("Product Not Found", 404))
    }

    if (photo) {
        rm(Product.photo!, () => {
            console.log("old photo Deleted")
        })
        Product.photo = photo.path
    }
    if (name) Product.name = name
    if (price) Product.price = price
    if (stock) Product.stock = stock
    if (category) Product.category = category

    await Product.save()
    await invalidateCache({ Product: true, productId: String(Product._id), admin: true })

    return res.status(200).json({
        success: true,
        message: "Product Updated Successfully"
    })
})

export const deleteProduct = TryCatch(async (req, res, next) => {
    const products = await product.findById(req.params.id)
    if (!products) {
        return next(new ErrorHandler("Product not found", 404))
    }
    rm(products.photo!, () => {
        console.log("Photo deleted successfully")
    })
    await products.deleteOne()
    await invalidateCache({ Product: true, productId: String(products._id), admin: true })
    return res.status(200).json({
        success: true,
        message: "Product deleted successfully"
    })
})

export const getAllProducts = TryCatch(async (req: Request<{}, {}, {}, searchRequestQuery>, res, next) => {
    const { search, price, category, sort } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;

    const baseQuery: BaseQuery = {}

    if (search) {
        baseQuery.name = {
            $regex: search,
            $options: "i"
        }
    }
    if (price) {
        baseQuery.price = {
            $lte: Number(price)
        }
    }
    if (category) {
        baseQuery.category = category
    }

    const productPromise = product.find(baseQuery).sort(sort && { price: sort === 'asc' ? 1 : -1 }).limit(limit).skip(skip);

    const [products, filteredOnly] = await Promise.all([
        productPromise,
        product.find(baseQuery)
    ])

    const totalPage = Math.ceil(filteredOnly.length / limit);
    return res.status(200).json({
        success: true,
        products,
        totalPage
    })
})