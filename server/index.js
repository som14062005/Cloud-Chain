require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const passport = require("passport");
const { rateLimit } = require("express-rate-limit");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const fileRoutes = require("./routes/files");
const User = require("./models/User");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const allowedOrigins = [
  "https://d2n2fkydruy84k.cloudfront.net",
  "http://3.7.199.245.nip.io",
  "https://3.7.199.245.nip.io",
  "http://localhost:5173",
  "http://localhost",
];

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many auth requests, please try again later." },
});

app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(passport.initialize());

console.log("BACKEND_URL =", process.env.BACKEND_URL);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        if (!email || !name) {
          return done(new Error("Google profile data missing"), null);
        }

        let user = await User.findOne({ email });

        if (!user) {
          user = await User.create({ email, name });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

app.get("/", (req, res) => {
  res.send("<a href='/auth/google'>Login with Google</a>");
});

app.get(
  "/auth/google",
  authLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

app.get(
  "/auth/google/callback",
  authLimiter,
  passport.authenticate("google", {
    failureRedirect: "/",
    session: false,
  }),
  (req, res) => {
    const user = req.user;

    const token = jwt.sign(
      { email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/auth?token=${encodeURIComponent(token)}`
    );
  }
);

app.use("/files", fileRoutes);

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://3.7.199.245.nip.io:${PORT}`);
});

// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const passport = require("passport");
// const { rateLimit } = require("express-rate-limit");
// const GoogleStrategy = require("passport-google-oauth20").Strategy;
// const jwt = require("jsonwebtoken");
// const mongoose = require("mongoose");
// const path = require("path");
// const fs = require("fs");

// const fileRoutes = require("./routes/files");
// const User = require("./models/User");

// const app = express();
// app.set("trust proxy", 1);
// app.disable("x-powered-by");

// const PORT = process.env.PORT || 3000;

// mongoose
//   .connect(process.env.MONGODB_URI)
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// const allowedOrigins = [
//   "https://d2n2fkydruy84k.cloudfront.net",
//   "http://3.7.199.245.nip.io",
//   "https://3.7.199.245.nip.io",
//   "http://localhost:5173",
//   "http://localhost",
// ];

// app.use(
//   helmet({
//     crossOriginResourcePolicy: false,
//   })
// );

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin || allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(new Error("Not allowed by CORS"));
//     },
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 200,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   message: { error: "Too many requests, please try again later." },
// });

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   limit: 20,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   message: { error: "Too many auth requests, please try again later." },
// });

// app.use(globalLimiter);
// app.use(express.json({ limit: "1mb" }));
// app.use(passport.initialize());

// const uploadsPath = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadsPath)) {
//   fs.mkdirSync(uploadsPath, { recursive: true });
// }

// app.use("/uploads", express.static(uploadsPath));

// console.log("BACKEND_URL =", process.env.BACKEND_URL);

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile.emails?.[0]?.value;
//         const name = profile.displayName;

//         if (!email || !name) {
//           return done(new Error("Google profile data missing"), null);
//         }

//         let user = await User.findOne({ email });

//         if (!user) {
//           user = await User.create({ email, name });
//         }

//         return done(null, user);
//       } catch (err) {
//         return done(err, null);
//       }
//     }
//   )
// );

// app.get("/", (req, res) => {
//   res.send("<a href='/auth/google'>Login with Google</a>");
// });

// app.get(
//   "/auth/google",
//   authLimiter,
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//     session: false,
//   })
// );

// app.get(
//   "/auth/google/callback",
//   authLimiter,
//   passport.authenticate("google", {
//     failureRedirect: "/",
//     session: false,
//   }),
//   (req, res) => {
//     const user = req.user;

//     const token = jwt.sign(
//       { email: user.email, name: user.name },
//       process.env.JWT_SECRET,
//       { expiresIn: "1h" }
//     );

//     res.redirect(
//       `${process.env.FRONTEND_URL}/auth?token=${encodeURIComponent(token)}`
//     );
//   }
// );

// app.use("/files", fileRoutes);

// app.use((err, req, res, next) => {
//   console.error("Server error:", err.message);
//   res.status(500).json({ error: "Internal server error" });
// });

// app.listen(PORT, () => {
//   console.log(`Server running at ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
// });