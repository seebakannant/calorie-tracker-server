const express = require('express'),
    cors = require('cors'),
    app = express(),
    bcrypt = require("bcrypt"),
    mysql = require('mysql');

app.use(cors());
app.use(express.json());

const dbConnection = mysql.createPool({
    host: "localhost",
    user: "ziffity",
    password: "Ziffity@123",
    database: "calorie_app",
    charset: 'utf8mb4'
});

app.post("/save", (req, res) => {
    if (
        !req.hasOwnProperty("body") ||
        !req.body.hasOwnProperty("food_name") ||
        !req.body.hasOwnProperty("date") ||
        !req.body.hasOwnProperty("calories") ||
        isNaN(req.body.calories) ||
        !req.body.hasOwnProperty("price") ||
        !req.body.hasOwnProperty("user") ||
        req.body.user == ""
    ) {
        return res.status(400).send({
            status: false,
            message: "Missing required fields"
        });
    }

    dbConnection.query("INSERT INTO items SET ?", req.body, (err, result) => {
        if (err) {
            return res.status(400).send({
                status: false,
                message: err
            });
        }

        return res.status(200).send({
            status: true,
            message: "Data added successfully"
        });
    });
});

app.post('/get-items', (req, res) => {
    if (
        !req.hasOwnProperty("body") ||
        !req.body.hasOwnProperty("user") ||
        req.body.user == ""
    ) {
        return res.status(400).send({
            status: false,
            message: "Unable to load data"
        });
    }

    const queryData = [req.body.user],
        where = ["where items.user = users.username", "items.user = ?"];

    if (req.body.hasOwnProperty("month") && req.body.month) {
        where.push("MONTH(items.date) = ? ");
        queryData.push(req.body.month);
    }

    if (req.body.hasOwnProperty("year") && req.body.year) {
        where.push("YEAR(items.date) = ? ");
        queryData.push(req.body.year);
    }

    if (req.body.hasOwnProperty("filterString") && req.body.filterString) {
        where.push("items.food_name like ?");
        queryData.push(`${req.body.filterString}%`);
    }

    const whereCondition = where.join(" AND ");
    dbConnection.query(`select food_name as foodName, date, calories, price, users.price_limmit_per_month as priceLimit, users.calorie_limit_per_day as calorieLimit from items, users ${whereCondition} ORDER BY items.date DESC`, queryData, (err, result) => {
        if (err) {
            return res.status(400).send({
                status: false,
                message: err
            });
        }

        dbConnection.query("SELECT price_limmit_per_month as priceLimit, calorie_limit_per_day as calorieLimit from users where username = ?", [req.body.user], (err, limits) => {
            if (err) {
                return res.status(400).send({
                    status: false,
                    message: err
                });
            }

            for (data of result) {
                const date = new Date(data.date.toString()),
                    formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}  ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                data.date = formattedDate;
            }

            return res.status(200).send({
                status: true,
                items: result,
                priceLimit: (limits.length && limits[0].hasOwnProperty("priceLimit")) ? limits[0].priceLimit : 0,
                calorieLimit: (limits.length && limits[0].hasOwnProperty("calorieLimit")) ? limits[0].calorieLimit : 0
            });
        });
    });
});

app.post("/auth", (req, res) => {
    if (
        !req.hasOwnProperty("body") ||
        !req.body.hasOwnProperty("username") ||
        req.body.username == "" ||
        !req.body.hasOwnProperty("password") ||
        req.body.password == ""
    ) {
        return res.status(400).send({
            status: false,
            message: "Authentication Failed! Missing Required fields."
        });
    }

    const username = req.body.username,
        password = req.body.password;

    dbConnection.query("SELECT password FROM users WHERE username = ? ", [username], (err, result) => {
        if (result && result.length && result[0].hasOwnProperty("password")) {
            const passwordHash = result[0].password;
            bcrypt.compare(password, passwordHash).then(result => {
                if (result == true) {
                    return res.status(200).send({
                        status: true,
                        message: "User Authenticated successfully!"
                    });
                } else {

                    return res.status(400).send({
                        status: false,
                        message: "Authentication Failed !!!"
                    });
                }
            }).catch(err => {
                return res.status(400).send({
                    status: false,
                    message: "Authentication Failed !!!"
                });
            });
        } else {
            return res.status(400).send({
                status: false,
                message: "Authentication Failed !!!"
            });
        }
    });
});

app.post("/create-user", (req, res) => {
    if (
        !req.hasOwnProperty("body") ||
        !req.body.hasOwnProperty("username") ||
        req.body.username == "" ||
        !req.body.hasOwnProperty("password") ||
        req.body.password == ""
    ) {
        return res.status(400).send({
            status: false,
            message: "Unable to create user! Please try again.."
        });
    }
    const username = req.body.username,
        password = req.body.password,
        caloriePerDayLimit = 2100,
        saltRounds = 10;

    dbConnection.query("SELECT id FROM users WHERE username = ?", [username], (err, result) => {
        if (result.length == 0) {
            bcrypt.hash(password, saltRounds).then(passwordHash => {
                if (passwordHash) {
                    const payload = {
                        username: username,
                        password: passwordHash,
                        calorie_limit_per_day: caloriePerDayLimit
                    };
                    dbConnection.query("INSERT INTO users SET ?", payload, (err, result) => {
                        return res.status(200).send({
                            status: true,
                            message: "User created successfully!!!"
                        });
                    });
                } else {
                    return res.status(400).send({
                        status: false,
                        message: "Unable to create user. Please try again!"
                    });
                }
            }).catch(err => {
                return res.status(400).send({
                    status: false,
                    message: err
                });
            });
        } else {
            return res.status(400).send({
                status: false,
                message: "Username already exists! Please change and try again!"
            });
        }
    });
});

app.listen(8000, () => {
    console.log(`Server is running on port 8000.`);
});
