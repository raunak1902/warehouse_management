import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token;

  if (!authHeader && !queryToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = queryToken || authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const isManagerOrAbove = (req, res, next) => {
  const role = req.user?.role?.toUpperCase();
  if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

export default authMiddleware; // ✅ THIS LINE MUST EXIST

export const isSuperAdmin = (req, res, next) => {
  const role = req.user?.role?.toUpperCase();
  if (role !== "SUPER_ADMIN") {
    return res.status(403).json({ message: "Access denied: SuperAdmin only" });
  }
  next();
};