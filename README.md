# 🛒 E-Commerce Website

A full-stack e-commerce web application built using Node.js, Express.js, MongoDB, and Handlebars.

## ✨ Features

### 👤 User Features

* Sign up & Login
* Secure password hashing with bcrypt
* Session-based authentication
* View products
* Add products to cart
* View cart
* Remove products from cart
* Cart item count display

### 🛠️ Admin Features

* Add products
* Edit products
* Delete products
* Upload product images
* Manage inventory

## 🚀 Tech Stack

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Authentication

* bcrypt
* express-session

### Frontend

* Handlebars (HBS)
* HTML
* CSS
* Bootstrap
* JavaScript
* jQuery (AJAX)

### Other Packages

* express-fileupload
* morgan
* cookie-parser

## 📂 Project Structure

```text
config/      -> Database connection & collections
helpers/     -> Business logic
routes/      -> User & Admin routes
views/       -> Handlebars templates
public/      -> CSS, JS, Images
bin/         -> Server startup files
```

## ⚙️ Installation

Clone the repository:

```bash
git clone <repository-url>
cd e-commerce-website
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
```

Run in development:

```bash
npm run dev
```

Run in production:

```bash
npm start
```

## 🗄️ Database Collections

### Users

Stores user information and authentication data.

### Products

Stores:

* Product name
* Category
* Price
* Description
* Image

### Cart

Stores user cart items and quantities.

## ✅ Completed Features

* User Authentication
* Session Management
* Product CRUD Operations
* Product Image Upload
* Shopping Cart System
* Admin Product Management
* AJAX-based Add to Cart

## 🔨 Features In Progress

* Order Placement
* Order Amount Calculation
* Payment Integration
* Admin Authentication
* Order Management

## 🤝 Contributing

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add feature"
```

4. Push to GitHub

```bash
git push origin feature-name
```

5. Create a Pull Request

## 📝 Notes

* Keep database operations inside helper files.
* Follow the existing project structure.
* Test changes before pushing.
* Never commit `.env` files or credentials.

## 👨‍💻 Author

**Sidharth**

Built to learn full-stack development, database management, authentication, debugging, and problem-solving skills.
