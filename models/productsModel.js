import { Schema, model } from "mongoose";

const productSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
    },
    sellerID: {
        type: Schema.Types.ObjectId,
    },
    imageUrl: {
        type: String
    }, // Image URL for the product
}, { timestamps: true });

const Product = model('Product', productSchema);

export default Product;