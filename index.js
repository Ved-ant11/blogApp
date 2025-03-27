const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const userModel = require("./models/user");
const Post = require("./models/post");

dotenv.config();

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(cookieParser());

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/blogApp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch (error) {
    res.clearCookie("token");
    res.redirect("/login");
  }
}

app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

app.get("/profile", isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userid);
    if (!user) return res.redirect("/login");

    const posts = await Post.find({ user: user._id }).sort({ date: -1 });

    res.render("profile", { user, posts });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.post("/register", async (req, res) => {
  try {
    const { Name, Email, Password } = req.body;
    let existingUser = await userModel.findOne({ email: Email });

    if (existingUser) return res.status(400).send("User already exists");

    const hashedPassword = await bcrypt.hash(Password, 10);
    const newUser = await userModel.create({
      name: Name,
      email: Email,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { email: Email, userid: newUser._id },
      process.env.JWT_SECRET
    );
    res.cookie("token", token);
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;
    const user = await userModel.findOne({ email: Email });

    if (!user) return res.status(400).send("User not found");

    const isMatch = await bcrypt.compare(Password, user.password);
    if (!isMatch) return res.redirect("/login");

    const token = jwt.sign(
      { email: Email, userid: user._id },
      process.env.JWT_SECRET
    );
    res.cookie("token", token);
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.get("/users", async (req, res) => {
  try {
    const users = await userModel.find();
    res.render("users", { users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    res.render("userProfile", { user });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    await userModel.findByIdAndDelete(req.params.id);
    res.redirect("/users");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.get("/posts", isLoggedIn, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name email")
      .sort({ date: -1 });
    res.render("posts", { user: req.user, posts });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.post("/posts", isLoggedIn, async (req, res) => {
  try {
    const newPost = new Post({
      user: req.user.userid,
      content: req.body.blog,
    });

    await newPost.save();
    res.redirect("/posts");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.listen(port, () =>
  console.log(`Server is running on ${port}`)
);
