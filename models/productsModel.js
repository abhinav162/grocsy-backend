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
    quantity: {
        type: Number,
        required: true,
    },
    unit: {
        type: String,
        default: 'g',
    },
    description: {
        type: String,
    },
    sellerID: {
        type: Schema.Types.ObjectId,
    },
    imagePublicId: {
        type: String,
    }, // Image Public ID for the product
    imageUrl: {
        type: String,
        required: false,
    }, // Image URL for the product
    category : {
        type : String,
        required : true,
        default : "general"
    }
}, { timestamps: true });

const Product = model('Product', productSchema);

export default Product;