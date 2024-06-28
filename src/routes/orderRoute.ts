import express from 'express'
import { AllOrders, deleteOrder, getSingleOrder, myOrders, newOrder, processOrder } from '../controllers/orderController.js';
import { adminOnly } from '../middlewares/auth.js';

const app = express.Router();

app.post('/new', newOrder)
app.get('/my-order', myOrders)
app.get('/all-orders', adminOnly, AllOrders)
app.route('/:id').get(getSingleOrder).put(adminOnly, processOrder).delete(adminOnly, deleteOrder)

export default app;