import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "./models/userModel.js";
import Product from "./models/productsModel.js";
import multer from "multer";
import uuidv4 from 'uuid';
import bodyParser from "body-parser";
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Set up dotenv config
dotenv.config();

// Set up cloudinary config
cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.cloudinary_api_key,
    api_secret: process.env.api_secret,
});

// Set up multer-storage-cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "grocsy-products",
    },
    allowedFormats: ["jpg", "png"],
    public_id: (req, file) => file.filename
}) // this is storage for uploading image to cloudinary, it will upload image to cloudinary when we call parser function

// image upload parser
const upload = multer({ storage: storage }); // this is parser for uploading image to cloudinary

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// connect to mongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
}).then(() => {
    console.log("Connected to Database");
})

// generate token for user
const generateToken = (user_id) => {
    const token = jwt.sign(
        {
            user_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    return token;
};

// check token middleware
const checkToken = (req, res, next) => {
    let token = req.headers.authorization;

    // token present or not 
    if (!token) {
        return res.status(401).json({
            message: "Unauthorized! Access",
        });
    }

    // check validity of the token
    try {
        token = token.split(" ")[1];

        let decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        req.user_id = decodedToken.user_id;

        next();
    } catch {
        return res.status(401).json({
            message: "Unauthorized! Access",
        });
    }
};

// base url: http://localhost:5000
app.get('/', (req, res) => {
    res.json({
        message: "Server running successfully!",
    })
})

// USER API

//// register user
app.post("/register", (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const userType = req.body.userType;

    if (!name || !email || !password || !userType) {
        return res.status(400).json({
            message: "Please fill all fields!",
        });
    }

    User.findOne({
        email: email,
    }).then((data, err) => {
        if (err) {
            return res.status(500).json({
                message: "Internal Server Error",
            });
        }

        if (data) {
            return res.status(409).json({
                message: "email already used",
            });
        } else {
            const saltRounds = 10;
            const salt = bcrypt.genSaltSync(saltRounds);
            const encryptedPassword = bcrypt.hashSync(password, salt);

            User.create({
                name: name,
                email: email,
                passwordHash: encryptedPassword,
                userType: userType,
            }).then((data, err) => {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                    });
                }

                return res.status(201).json({
                    message: "User registered successfully!",
                    user: data,
                    token: generateToken(data._id),
                });
            });
        }
    });
});

//// login user
app.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).json({
            message: "Please fill all fields!",
        });
    }

    User.findOne({
        email: email,
    }).then((data, err) => {
        if (err) {
            return res.status(500).json({
                message: "Internal Server Error",
            });
        }

        if (data) {
            const isMatch = bcrypt.compareSync(password, data.passwordHash);

            if (isMatch) {
                return res.status(200).json({
                    message: "User validated successfully!",
                    user: data,
                    token: generateToken(data._id),
                });
            } else {
                return res.status(401).json({
                    message: "Invalid Credentials",
                });
            }
        } else {
            return res.status(404).json({
                message: "User not found!",
            });
        }
    });
});

// PRODUCT API

//// get all products
app.get("/products", async (req, res) => {
    Product.find().then((data, err) => {
        if (err) {
            return res.status(500).json({ message: 'Internal Server Error' })
        }
        if (data) {
            return res.status(200).json({
                message: "Products fetched successfully",
                products: data
            })
        }
        else {
            return res.status(404).json({
                message: "No products found",
            })
        }
    })
})

//// get all product by seller id
app.get("/all-products/:sellerId", async (req, res) => {
    const sellerId = req.params.sellerId;

    Product.find({ sellerID: sellerId }).then((data, err) => {
        if (err) {
            return res.status(500).json({ message: 'Internal Server Error' })
        }
        if (data) {
            return res.status(200).json({
                message: "Products fetched successfully",
                products: data
            })
        }
        else {
            return res.status(404).json({
                message: "No products found",
            })
        }
    })
})

//// get product by id

//// add product
app.post("/add-product", upload.single('file'), checkToken, async (req, res) => {
    const category = req.body.category;
    const name = req.body.name;
    const price = req.body.price;
    const quantity = req.body.quantity;
    const unit = req.body.unit;
    const description = req.body.description;
    const sellerID = req.user_id;
    const imagePublicId = req.file.filename;
    const imageUrl = req.file.path;


    try {

        Product.create({
            category,
            name,
            price,
            quantity,
            unit,
            description,
            sellerID,
            imagePublicId,
            imageUrl,
        });

        res.status(201).json({
            message: 'Product added successfully',
            url: imageUrl,
            publicId: imagePublicId
        });
        console.log(req.file);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
})

//// update product
app.patch('/update-product/:productId', checkToken, async (req, res) => {
    const { category, name, price, description, quantity, unit } = req.body;
    const seller = req.user_id;
    const productId = req.params.productId;
    // const imageUrl = req.file.path;
    // console.log(req.file.path);

    try {
        // Find the product by ID and ensure it belongs to the seller
        const product = await Product.findOne({ _id: productId });
        if (!product.sellerID.equals(seller)) {
            return res.status(404).json({ error: 'Product not found or does not belong to the seller.' });
        }

        // Update only the provided fields
        if (category) {
            product.category = category;
        }
        if (name) {
            product.name = name;
        }
        if (price) {
            product.price = price;
        }
        if (description) {
            product.description = description;
        }
        if (quantity) {
            product.quantity = quantity;
        }
        if (unit) {
            product.unit = unit;
        }
        await product.save();

        res.status(200).json({ message: 'Product updated successfully', product });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
});

//// delete product
app.delete('/delete-product/:productId', checkToken, async (req, res) => {
    const sellerID = req.user_id;
    const productId = req.params.productId;
    try {
        const product = await Product.findOne({ _id: productId });
        if (!product.sellerID.equals(sellerID)) {
            return res.status(404).json({ error: 'Product not found or does not belong to the seller.' });
        }
        else {
            // delete image from cloudinary
            const public_id = product.imagePublicId;
            cloudinary.uploader.destroy(public_id, (err, result) => {
                if (err) {
                    console.log(err);
                }
                else {
                    console.log(result);
                }
            });

            // delete product
            product.deleteOne();
            res.status(200).json({ message: 'Product deleted successfully', product });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
})

// CART API

//// add to cart
app.patch('/add-to-cart', checkToken, async (req, res) => {
    const user_id = req.user_id;
    const product_id = req.body.product_id;
    const quantity = req.body.quantity;
    const toDelete = req.body.toDelete;  // if true, delete the product from cart

    try {
        const user = await User.findOne({ _id: user_id });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const existingCartItem = user.cart.find(
            item => item.product_id.toString() === product_id
        );

        if(existingCartItem && toDelete){
            user.cart.pull({ _id: existingCartItem._id });

            await user.save();

            return res.status(200).json({ message: 'Product removed from cart successfully', user });
        } // if toDelete is true, delete the product from cart

        if (existingCartItem) {
            const q = Number(existingCartItem.quantity)
            existingCartItem.quantity = q + Number(quantity);
        } else {
            user.cart.push({ product_id, quantity });
        }

        await user.save();

        res.status(200).json({ message: 'Product added to cart successfully', user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: err });
    }
})


//// get cart
app.get('/get-cart', checkToken, async (req, res) => {
    try {
        const userId = req.user_id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const user = await User.findById(userId).populate('cart.product_id');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const cartItems = user.cart.map(item => ({
            product_id: item.product_id._id,
            name: item.product_id.name, // Assuming you have a 'name' field in your Product model
            quantity: item.quantity,
            price: item.product_id.price,
            unit: item.product_id.unit,
            imageUrl: item.product_id.imageUrl,
        }));

        return res.status(200).json(cartItems);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
})

//// delete from cart

// ORDER API

//// add order

//// get order by id

//// get all orders

//// update order

//// delete order

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})