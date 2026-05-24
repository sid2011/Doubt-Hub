E-Commerce Website

A full-stack e-commerce web application built using Node.js, Express.js, MongoDB, and Handlebars. The project includes user authentication, session management, product management, shopping cart functionality, and an admin panel.

Features

User Features

User registration and login

Secure password hashing using bcrypt

Session-based authentication

View products

Add products to cart

View cart items

Remove products from cart

Cart item count display

Admin Features

Admin dashboard

Add products

Edit products

Delete products

Upload product images

Manage product inventory

Technology Stack

Backend

Node.js

Express.js

Database

MongoDB

Authentication & Security

bcrypt

express-session

Template Engine

Handlebars (hbs)

File Handling

express-fileupload

Utilities

Morgan (request logging)

Cookie Parser

Project Structure

project-root/
│
├── bin/
│   └── www
│
├── config/
│   ├── connection.js
│   └── collections.js
│
├── helpers/
│   ├── product-helpers.js
│   └── user-helper.js
│
├── public/
│   ├── images/
│   ├── product-images/
│   ├── stylesheets/
│   └── javascripts/
│
├── routes/
│   ├── user.js
│   └── admin.js
│
├── views/
│   ├── admin/
│   ├── user/
│   ├── user-auth/
│   └── layout/
│
├── app.js
├── package.json
└── README.md

Installation

Clone Repository

git clone <repository-url>
cd e-commerce-website

Install Dependencies

npm install

Configure Environment

Create a .env file in the root directory.

MONGODB_URI=your_mongodb_connection_string

Start Development Server

npm run dev

Start Production Server

npm start

Database Collections

Users

Stores user account information.

Products

Stores product details including:

Name

Category

Price

Description

Image

Cart

Stores cart items associated with users.

Current Functionalities

Product Management (CRUD)

User Authentication

Session Handling

Shopping Cart

Product Image Upload

Admin Product Management

Planned Features

Order Placement

Order History

Payment Integration

Admin Login System

Order Management Dashboard

Contribution Guidelines

Fork the repository.

Create a new branch.

git checkout -b feature-name

Commit your changes.

git commit -m "Add feature"

Push your branch.

git push origin feature-name

Open a Pull Request.

Notes for Contributors

Follow the existing project structure.

Keep database operations inside helper modules.

Keep route handlers clean and focused.

Test features locally before submitting changes.

Do not commit .env files or sensitive credentials.

Author

Sidharth

This project was created as a learning-focused full-stack e-commerce application to strengthen backend development, database management, authentication, and problem-solving skills.
