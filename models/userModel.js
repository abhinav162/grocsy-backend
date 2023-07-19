import { Schema, model } from "mongoose";

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    userType: {
        type: String,
        enum: ['buyer', 'seller'],
        required: true,
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }]
}, { timestamps: true });

const User = model('User', userSchema);

export default User;