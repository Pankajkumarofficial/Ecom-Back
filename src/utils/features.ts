import mongoose, { Document } from "mongoose";
import dotenv from 'dotenv'
import { OrderItemType, invalidateCacheType } from "../types/types.js";
import { myCache } from "../index.js";
import { product } from "../models/productSchema.js";

dotenv.config();

export const connectDB = async () => {
    try {
        const mongoDB = await mongoose.connect(process.env.MONGO_URL as string, {
            dbName: "Ecommerce-2"
        });
        console.log(`DB connect to ${mongoDB.connection.host}`);
    } catch (error) {
        console.log(error);
    }
}

export const invalidateCache = async ({ Product, order, admin, userId, orderId, productId }: invalidateCacheType) => {
    if (Product) {
        const productKeys: string[] = ["latest-product", "categories", "all-products"]
        if (typeof productId === 'string') { productKeys.push(`products-${productId}`) }
        if (typeof productId === "object") { productId.forEach((i) => productKeys.push(`products-${i}`)) }
        myCache.del(productKeys)
    }
    if (order) {
        const ordersKeys: string[] = ["all-orders", `my-orders-${userId}`, `order-${orderId}`]
        myCache.del(ordersKeys)
    }
    if (admin) {
        myCache.del(["admin-stats", "admin-pie-charts", 'admin-bar-charts', 'admin-line-charts'])
    }
}

export const reduceStock = async (orderItems: OrderItemType[]) => {
    for (let i = 0; i < orderItems.length; i++) {
        const order = orderItems[i];
        const products = await product.findById(order.productId)
        if (!products) {
            throw new Error("Product Not Found")
        }
        products.stock -= order.quantity;
        await products.save();
    }
}

export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
    if (lastMonth === 0) { return thisMonth * 100 }
    const percent = (thisMonth / lastMonth) * 100;
    return Number(percent.toFixed(0))
}

export const getInventory = async ({ categories, productsCount }: { categories: string[]; productsCount: number; }) => {
    const categoriesCountPromise = categories.map(category => product.countDocuments({ category }))

    const categoriesCount = await Promise.all(categoriesCountPromise)

    const categoryCount: Record<string, number>[] = []

    categories.forEach((category, i) => {
        categoryCount.push({
            [category]: Math.round((categoriesCount[i] / productsCount) * 100)
        })
    })

    return categoryCount
}

interface MyDocument extends Document {
    createdAt: Date;
    discount?: number;
    total?: number
}

type FuncProps = {
    length: number,
    docArr: MyDocument[],
    today: Date;
    property?: "discount" | "total"
}

export const getChartData = ({ length, docArr, today, property }: FuncProps) => {
    const data: number[] = new Array(length).fill(0);

    docArr.forEach(i => {
        const creationDate = i.createdAt;
        const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
        if (monthDiff < length) {
            if (property) {
                data[length - monthDiff - 1] += i[property]!;
            }
            else {
                data[length - monthDiff - 1] += 1;
            }
        }
    })

    return data;
}