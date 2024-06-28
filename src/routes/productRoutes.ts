import express from 'express'
import { deleteProduct, getAdminProduct, getAllCategories, getAllProducts, getLatestProduct, getSingleProduct, newProduct, updateProduct } from '../controllers/productController.js';
import { singleUpload } from '../middlewares/multer.js';
import { adminOnly } from '../middlewares/auth.js';

const app = express.Router();

app.post('/new', adminOnly, singleUpload, newProduct)
app.get('/latest', getLatestProduct)
app.get('/all', getAllProducts)
app.get('/categories', getAllCategories)
app.get('/admin-products', adminOnly, getAdminProduct)
app.route('/:id').get(getSingleProduct).put(singleUpload, adminOnly, updateProduct).delete(adminOnly, deleteProduct)

export default app;