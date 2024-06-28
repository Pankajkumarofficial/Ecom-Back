import express from 'express'
import { connectDB } from './utils/features.js'
import { errorMiddleware } from './middlewares/error.js';
import NodeCache from 'node-cache';
import dotenv from 'dotenv'
import morgan from 'morgan'
import Stripe from 'stripe';
import cors from 'cors'

// imported Routes
import userRoutes from './routes/userRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoute from './routes/orderRoute.js'
import paymentRoute from './routes/paymentRoute.js'
import statsRoute from './routes/statsRouter.js'

const port = process.env.PORT || 8000;
connectDB();
const app = express()
dotenv.config()

const stripeKey = process.env.STRIPE_KEY || ""

app.use(express.json())
app.use(morgan("dev"))
app.use(cors())

export const stripe = new Stripe(stripeKey)
export const myCache = new NodeCache();

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// user routes
app.use('/api/v1/user', userRoutes)
app.use('/api/v1/product', productRoutes)
app.use('/api/v1/order', orderRoute)
app.use('/api/v1/payment', paymentRoute)
app.use('/api/v1/dashboard', statsRoute)

app.use("/uploads", express.static("uploads"))
app.use(errorMiddleware)

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})