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
import fs from 'fs';

const DIR = './uploads/';
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DIR);
    },
    filename: (req, file, cb) => {
        const fileName = file.originalname.toLowerCase().split(' ').join('-');
        cb(null, uuidv4() + '-' + fileName)
    }
});

var upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
        }
    }
});

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'))

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
}).then(() => {
    console.log("Connected to Database");
})

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

const checkToken = (req, res, next) => {
    let token = req.headers.authorization;

    // token present or not
    if (!token) {
        return res.status(401).json({
            message: "Unauthorized!",
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
            message: "Unauthorized!",
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
app.post("/add-product", checkToken, upload.single('imageUrl'), (req, res) => {
    const category = req.body.category;
    const name = req.body.name;
    const price = req.body.price;
    const quantity = req.body.quantity;
    const unit = req.body.unit;
    const description = req.body.description;
    const sellerID = req.user_id;

    try {
        const url = req.protocol + '://' + req.get('host')
        const imageUrl = url + '/uploads/' + req.file.filename
        
        Product.create({
            category,
            name,
            price,
            quantity,
            unit,
            description,
            sellerID,
            imageUrl,
        });

        res.status(201).json({ message: 'Product added successfully' });
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
})

//// update product
app.patch('/update-product/:productId', checkToken, async (req, res) => {
    const {category, name, price, description, quantity, unit } = req.body;
    const seller = req.user_id;
    const productId = req.params.productId;

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
        if (req.file) {
            const url = req.protocol + '://' + req.get('host')
            const imageUrl = url + '/uploads/' + req.file.filename
            product.imageUrl = imageUrl;
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
            // delete image
            const path = product.imageUrl;
            const filename = path.split('/uploads/')[1];
            //// delete image from uploads folder
            fs.unlink(`./uploads/${filename}`, (err) => {
                if (err) {
                    console.error(err);
                    return;
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

//// get cart

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