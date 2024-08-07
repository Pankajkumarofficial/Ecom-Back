import express from 'express'
import { AllCoupons, applyDiscount, createPaymentIntent, deleteCoupon, newCoupon } from '../controllers/paymentController.js';
import { adminOnly } from '../middlewares/auth.js';

const app = express.Router()

app.post('/create', createPaymentIntent)
app.get('/discount', applyDiscount)
app.post('/coupon/new', adminOnly, newCoupon)
app.get('/coupon/all', adminOnly, AllCoupons)
app.delete('/coupon/:id', adminOnly, deleteCoupon)

export default app;