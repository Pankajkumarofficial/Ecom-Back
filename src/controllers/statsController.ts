import { myCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/orderSchema.js";
import { product } from "../models/productSchema.js";
import { User } from "../models/userSchema.js";
import { calculatePercentage, getChartData, getInventory } from "../utils/features.js";

export const getDashboardStats = TryCatch(async (req, res, next) => {
    let stats = {};
    const key = 'admin-stats'

    if (myCache.has(key)) {
        stats = JSON.parse(myCache.get(key) as string)
    }
    else {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const thisMonth = {
            start: new Date(today.getFullYear(), today.getMonth(), 1),
            end: today
        }

        const lastMonth = {
            start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
            end: new Date(today.getFullYear(), today.getMonth(), 0)
        }

        const thisMonthProductsPromise = product.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end
            }
        })

        const lastMonthProductPromise = product.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end
            }
        })

        const thisMonthUsersPromise = User.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end
            }
        })

        const lastMonthUsersPromise = User.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end
            }
        })

        const thisMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: thisMonth.start,
                $lte: thisMonth.end
            }
        })

        const lastMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: lastMonth.start,
                $lte: lastMonth.end
            }
        })

        const lastSixMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today
            }
        })

        const latestTransactionsPromise = Order.find({}).select(["orderItems", "discount", "total", "status"]).limit(4)

        const [thisMonthProducts, thisMonthUsers, thisMonthOrders, lastMonthProducts, lastMonthUsers, lastMonthOrders, productsCount, usersCount, allOrders, lastSixMonthOrders, categories, femaleUsersCount, latestTransactions] = await Promise.all([thisMonthProductsPromise, thisMonthUsersPromise, thisMonthOrdersPromise, lastMonthProductPromise, lastMonthUsersPromise, lastMonthOrdersPromise, product.countDocuments(), User.countDocuments(), Order.find({}).select("total"), lastSixMonthOrdersPromise, product.distinct("category"), User.countDocuments({ gender: "female" }), latestTransactionsPromise])

        const thisMonthRevenue = thisMonthOrders.reduce((total, order) =>
            total + (order.total || 0), 0
        )

        const lastMonthRevenue = lastMonthOrders.reduce((total, order) =>
            total + (order.total || 0), 0
        )

        const changePercent = {
            revenue: calculatePercentage(thisMonthRevenue, lastMonthRevenue),
            Product: calculatePercentage(thisMonthProducts.length, lastMonthProducts.length),
            user: calculatePercentage(thisMonthUsers.length, lastMonthUsers.length),
            order: calculatePercentage(thisMonthOrders.length, lastMonthOrders.length)
        }

        const revenue = allOrders.reduce((total, order) =>
            total + (order.total || 0), 0
        );

        const count = {
            revenue,
            user: usersCount,
            Product: productsCount,
            order: allOrders.length
        }

        const orderMonthCounts = new Array(6).fill(0);
        const orderMonthRevenue = new Array(6).fill(0);

        lastSixMonthOrders.forEach(order => {
            const creationDate = order.createdAt;
            const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
            if (monthDiff < 6) {
                orderMonthCounts[6 - monthDiff - 1] += 1;
                orderMonthRevenue[6 - monthDiff - 1] += order.total
            }
        })

        const categoryCount = await getInventory({ categories, productsCount });

        const userRatio = {
            male: usersCount - femaleUsersCount,
            female: femaleUsersCount
        }

        const modifiedTransaction = latestTransactions.map(i => ({
            _id: i._id,
            discount: i.discount,
            amount: i.total,
            quantity: i.orderItems.length,
            status: i.status
        }))

        stats = { categoryCount, changePercent, count, chart: { order: orderMonthCounts, revenue: orderMonthRevenue }, userRatio, latestTransactions: modifiedTransaction }

        myCache.set(key, JSON.stringify(stats))
    }

    return res.status(200).json({
        success: true,
        stats
    })
})

export const getPieChart = TryCatch(async (req, res, next) => {
    let charts;
    const key = "admin-pie-charts"

    if (myCache.has(key)) {
        charts = JSON.parse(myCache.get(key) as string)
    }
    else {
        const allOrderPromise = Order.find({}).select(["total", "discount", "subtotal", "tax", "shippingCharges"])

        const [processingOrder, shippedOrder, deliveredOrder, categories, productsCount, productsOutOfStock, allOrders, allUsers, adminUsers, customerUsers] = await Promise.all([
            Order.countDocuments({ status: "Processing" }),
            Order.countDocuments({ status: "Shipped" }),
            Order.countDocuments({ status: "Delivered" }),
            product.distinct("category"),
            product.countDocuments(),
            product.countDocuments({ stock: 0 }),
            allOrderPromise,
            User.find({}).select(["dob"]),
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ role: "user" })
        ])

        const orderFullfillment = {
            processing: processingOrder,
            shipped: shippedOrder,
            delivered: deliveredOrder
        }

        const productCategories = await getInventory({ categories, productsCount });

        const stockAvailability = {
            inStock: productsCount - productsOutOfStock,
            productsOutOfStock
        }

        const grossIncome = allOrders.reduce((prev, order) => prev + (order.total || 0), 0)

        const discount = allOrders.reduce((prev, order) => prev + (order.discount || 0), 0)

        const productionCost = allOrders.reduce((prev, order) => prev + (order.shippingCharges || 0), 0)

        const burnt = allOrders.reduce((prev, order) => prev + (order.tax || 0), 0)

        const marketingCost = Math.round(grossIncome * (300 / 100))

        const netMargin = grossIncome - discount - productionCost - burnt - marketingCost;

        const revenueDistribution = {
            netMargin,
            discount,
            productionCost,
            burnt,
            marketingCost
        }

        const usersAgeGroup = {
            teen: allUsers.filter(i => i.age < 20).length,
            adult: allUsers.filter((i) => i.age >= 20 && i.age < 40).length,
            old: allUsers.filter(i => i.age >= 40).length,
        }

        const adminCustomer = {
            admin: adminUsers,
            customer: customerUsers
        }

        charts = {
            orderFullfillment,
            productCategories,
            stockAvailability,
            revenueDistribution,
            usersAgeGroup,
            adminCustomer
        }

        myCache.set(key, JSON.stringify(charts))
    }

    return res.status(200).json({
        success: true,
        charts
    })
})

export const getBarChart = TryCatch(async (req, res, next) => {
    let charts;
    const key = 'admin-bar-charts'

    if (myCache.has(key)) {
        charts = JSON.parse(myCache.get(key) as string)
    }
    else {
        const today = new Date()
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const sixMonthProductPromise = product.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today
            }
        }).select("createdAt")

        const sixMonthUsersPromise = User.find({
            createdAt: {
                $gte: sixMonthsAgo,
                $lte: today
            }
        }).select("createdAt")

        const twelveMonthOrdersPromise = Order.find({
            createdAt: {
                $gte: twelveMonthsAgo,
                $lte: today
            }
        }).select("createdAt")

        const [products, users, orders] = await Promise.all([
            sixMonthProductPromise,
            sixMonthUsersPromise,
            twelveMonthOrdersPromise
        ])

        const productCounts = getChartData({ length: 6, today, docArr: products })
        const usersCounts = getChartData({ length: 6, today, docArr: users })
        const orderCounts = getChartData({ length: 12, today, docArr: orders })

        charts = {
            users: usersCounts,
            products: productCounts,
            orders: orderCounts
        }

        myCache.set(key, JSON.stringify(charts))
    }

    return res.status(200).json({
        success: true,
        charts
    })
})

export const getLineChart = TryCatch(async (req, res, next) => {
    let charts;
    const key = 'admin-line-charts'

    if (myCache.has(key)) {
        charts = JSON.parse(myCache.get(key) as string)
    }
    else {
        const today = new Date()

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const baseQuery = {
            createdAt: {
                $gte: twelveMonthsAgo,
                $lte: today
            }
        }

        const [products, users, orders] = await Promise.all([
            product.find(baseQuery).select("createdAt"),
            User.find(baseQuery).select("createdAt"),
            Order.find(baseQuery).select(["createdAt", "discount", "total"])
        ])

        const productCounts = getChartData({ length: 12, today, docArr: products })
        const usersCounts = getChartData({ length: 12, today, docArr: users })
        const discount = getChartData({ length: 12, today, docArr: orders, property: "discount" })
        const revenue = getChartData({ length: 12, today, docArr: orders, property: "total" })

        charts = {
            users: usersCounts,
            products: productCounts,
            discount,
            revenue
        }

        myCache.set(key, JSON.stringify(charts))
    }

    return res.status(200).json({
        success: true,
        charts
    })
})